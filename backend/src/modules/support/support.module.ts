import crypto from 'crypto';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';

// ----------------------------------------------------------------------------
// SLA CALCULATION & INTERNAL NOTE FILTER HELPERS (C-002, C-013)
// ----------------------------------------------------------------------------

const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  URGENT_RED: 2,
  HIGH: 4,
  MEDIUM: 12,
  LOW: 24,
};

export function computeSlaDueAt(priority: TicketPriority, fromDate = new Date()): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority] ?? 12;
  return new Date(fromDate.getTime() + hours * 3600 * 1000);
}

/**
 * Strips internal support collaboration notes (`isInternalNote === true`) when serializing
 * ticket messages to Student or Teacher actors (`C-013`).
 */
export function filterTicketMessagesForActor<
  T extends { isInternalNote: boolean }
>(messages: T[], actorRole: string): T[] {
  if (actorRole === 'ADMIN' || actorRole === 'SUPPORT') {
    return messages;
  }
  return messages.filter((m) => !m.isInternalNote);
}

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createTicketValidation = {
  body: z.object({
    category: z.enum([
      'STUDENT_QUERY',
      'TEACHER_QUERY',
      'PAYMENT_ISSUE',
      'ENROLLMENT_ISSUE',
      'COURSE_ISSUE',
      'LIVE_CLASS_ISSUE',
    ]),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT_RED']).default('MEDIUM'),
    subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
    description: z.string().trim().min(10, 'Detailed description is required').max(5000),
  }),
};

export const triageTicketValidation = {
  params: z.object({
    ticketId: z.string().uuid('Valid ticketId UUID is required'),
  }),
  body: z.object({
    status: z
      .enum(['INCOMING', 'IN_TRIAGE', 'ESCALATED', 'RESOLVED', 'CLOSED'])
      .optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT_RED']).optional(),
    assignedToId: z.string().uuid().optional().nullable(),
    escalatedTo: z.string().trim().max(120).optional().nullable(),
  }),
};

export const postTicketMessageValidation = {
  params: z.object({
    ticketId: z.string().uuid('Valid ticketId UUID is required'),
  }),
  body: z.object({
    message: z.string().trim().min(2, 'Message cannot be empty').max(5000),
    isInternalNote: z.boolean().default(false),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class SupportService {
  /**
   * Lists support tickets strictly scoped by role (`C-013`):
   * - SUPPORT / ADMIN: All platform tickets (filterable by category, status, priority, assignedToId),
   *   including internal collaboration notes.
   * - STUDENT / TEACHER: Strictly tickets created by `actor.id`, with `isInternalNote: true` messages stripped.
   */
  static async listTickets(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>
  ) {
    const where: Prisma.SupportTicketWhereInput = {};

    if (actor.role === 'STUDENT' || actor.role === 'TEACHER') {
      where.createdById = actor.id;
    } else {
      if (typeof rawQuery.category === 'string' && rawQuery.category.trim()) {
        where.category = rawQuery.category.trim() as TicketCategory;
      }
      if (typeof rawQuery.status === 'string' && rawQuery.status.trim()) {
        where.status = rawQuery.status.trim() as TicketStatus;
      }
      if (typeof rawQuery.priority === 'string' && rawQuery.priority.trim()) {
        where.priority = rawQuery.priority.trim() as TicketPriority;
      }
      if (typeof rawQuery.assignedToId === 'string' && rawQuery.assignedToId.trim()) {
        where.assignedToId =
          rawQuery.assignedToId.trim() === 'UNASSIGNED'
            ? null
            : rawQuery.assignedToId.trim();
      }
    }

    const now = new Date();
    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, email: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        messages: {
          include: {
            sender: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tickets.map((t) => {
      const visibleMessages = filterTicketMessagesForActor(t.messages, actor.role);
      const isOpen =
        t.status === 'INCOMING' || t.status === 'IN_TRIAGE' || t.status === 'ESCALATED';
      const remainingMinutes = Math.round((t.slaDueAt.getTime() - now.getTime()) / 60000);
      const isSlaBreachRisk = isOpen && remainingMinutes <= 120;

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        description: t.description,
        createdById: t.createdById,
        createdByName: t.createdBy.fullName,
        createdByEmail: t.createdBy.email,
        createdByRole: t.createdBy.role,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedTo?.fullName || null,
        escalatedTo: t.escalatedTo,
        slaDueAt: t.slaDueAt.toISOString(),
        slaRemainingMinutes: remainingMinutes,
        isSlaBreachRisk,
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        closedAt: t.closedAt ? t.closedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        messages: visibleMessages.map((m) => ({
          id: m.id,
          ticketId: m.ticketId,
          senderId: m.senderId,
          senderName: m.sender.fullName,
          senderRole: m.sender.role,
          message: m.message,
          isInternalNote: m.isInternalNote,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    });
  }

  /**
   * Creates a new support ticket and initial message, computes `slaDueAt`, and dispatches an in-app notification.
   */
  static async createTicket(
    actor: AuthenticatedActor,
    payload: {
      category: TicketCategory;
      priority: TicketPriority;
      subject: string;
      description: string;
    }
  ) {
    const suffix = `${Date.now().toString().slice(-4)}${crypto.randomInt(10, 99)}`;
    const ticketNumber = `TKT-2026-${suffix}`;
    const slaDueAt = computeSlaDueAt(payload.priority);

    return prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber,
          createdById: actor.id,
          category: payload.category,
          priority: payload.priority,
          status: 'INCOMING',
          subject: payload.subject,
          description: payload.description,
          slaDueAt,
          messages: {
            create: {
              senderId: actor.id,
              message: payload.description,
              isInternalNote: false,
            },
          },
        },
      });

      await tx.notification.create({
        data: {
          recipientUserId: actor.id,
          type: 'SUPPORT_TICKET_OPENED',
          title: `Ticket ${ticketNumber} Received`,
          body: `Your support request "${payload.subject}" (${payload.category}) has been logged with SLA target ${slaDueAt.toISOString()}.`,
          channel: 'IN_APP',
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'SUPPORT_TICKET_CREATED',
          entityType: 'SupportTicket',
          entityId: created.id,
          afterDataJson: JSON.stringify({
            ticketNumber: created.ticketNumber,
            category: created.category,
            priority: created.priority,
          }),
        },
      });

      return created;
    });
  }

  /**
   * Support Agent or Admin assigns, triages, escalates, resolves, or closes a ticket.
   */
  static async triageTicket(
    actor: AuthenticatedActor,
    ticketId: string,
    payload: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedToId?: string | null;
      escalatedTo?: string | null;
    }
  ) {
    if (actor.role !== 'SUPPORT' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Support agents or Administrators can triage tickets.');
    }

    const existing = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) {
      throw ApiError.notFound('Support ticket not found.');
    }

    const now = new Date();
    const nextStatus = payload.status ?? existing.status;
    const nextPriority = payload.priority ?? existing.priority;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: nextStatus,
          priority: nextPriority,
          assignedToId:
            payload.assignedToId !== undefined ? payload.assignedToId : existing.assignedToId,
          escalatedTo:
            payload.escalatedTo !== undefined ? payload.escalatedTo : existing.escalatedTo,
          resolvedAt:
            nextStatus === 'RESOLVED' && !existing.resolvedAt ? now : existing.resolvedAt,
          closedAt: nextStatus === 'CLOSED' && !existing.closedAt ? now : existing.closedAt,
        },
      });

      if (payload.status && payload.status !== existing.status) {
        await tx.notification.create({
          data: {
            recipientUserId: existing.createdById,
            type: 'SUPPORT_TICKET_STATUS_UPDATED',
            title: `Ticket ${existing.ticketNumber} is now ${nextStatus}`,
            body: `Support updated your ticket "${existing.subject}" status from ${existing.status} to ${nextStatus}.`,
            channel: 'IN_APP',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'SUPPORT_TICKET_TRIAGED',
          entityType: 'SupportTicket',
          entityId: ticketId,
          beforeDataJson: JSON.stringify({
            status: existing.status,
            priority: existing.priority,
            assignedToId: existing.assignedToId,
          }),
          afterDataJson: JSON.stringify({
            status: updated.status,
            priority: updated.priority,
            assignedToId: updated.assignedToId,
            escalatedTo: updated.escalatedTo,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * Appends a reply or internal note (`isInternalNote`) to a support ticket.
   * Students and Teachers can only post public replies (`isInternalNote = false`) on their own tickets.
   */
  static async postMessage(
    actor: AuthenticatedActor,
    ticketId: string,
    payload: { message: string; isInternalNote: boolean }
  ) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw ApiError.notFound('Support ticket not found.');
    }

    const isStaff = actor.role === 'SUPPORT' || actor.role === 'ADMIN';
    if (!isStaff && ticket.createdById !== actor.id) {
      throw ApiError.forbidden('You can only reply to your own support tickets.');
    }

    if (!isStaff && payload.isInternalNote) {
      throw ApiError.forbidden('Only Support agents or Administrators can post internal notes.');
    }

    const safeInternalFlag = isStaff ? Boolean(payload.isInternalNote) : false;

    return prisma.$transaction(async (tx) => {
      const msg = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: actor.id,
          message: payload.message,
          isInternalNote: safeInternalFlag,
        },
        include: {
          sender: { select: { id: true, fullName: true, role: true } },
        },
      });

      if (isStaff && !safeInternalFlag && ticket.createdById !== actor.id) {
        await tx.notification.create({
          data: {
            recipientUserId: ticket.createdById,
            type: 'SUPPORT_TICKET_REPLY',
            title: `New Reply on Ticket ${ticket.ticketNumber}`,
            body: `${actor.fullName} replied: "${payload.message.slice(0, 120)}"`,
            channel: 'IN_APP',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: safeInternalFlag
            ? 'SUPPORT_INTERNAL_NOTE_ADDED'
            : 'SUPPORT_TICKET_REPLY_ADDED',
          entityType: 'SupportTicketMessage',
          entityId: msg.id,
          afterDataJson: JSON.stringify({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            isInternalNote: safeInternalFlag,
          }),
        },
      });

      return {
        id: msg.id,
        ticketId: msg.ticketId,
        senderId: msg.senderId,
        senderName: msg.sender.fullName,
        senderRole: msg.sender.role,
        message: msg.message,
        isInternalNote: msg.isInternalNote,
        createdAt: msg.createdAt.toISOString(),
      };
    });
  }

  /**
   * Lists active Support Agents with workload counts (`support_agent_profiles`).
   */
  static async listSupportAgents(actor: AuthenticatedActor) {
    if (actor.role !== 'SUPPORT' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Support or Admin role required.');
    }

    const agents = await prisma.user.findMany({
      where: { role: 'SUPPORT', status: 'ACTIVE' },
      include: {
        supportAgentProfile: true,
        _count: {
          select: {
            ticketsAssigned: {
              where: { status: { in: ['INCOMING', 'IN_TRIAGE', 'ESCALATED'] } },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return agents.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      agentCode: a.supportAgentProfile?.agentCode || 'SUP-AGENT',
      department: a.supportAgentProfile?.department || 'GENERAL',
      isTriageLead: a.supportAgentProfile?.isTriageLead ?? false,
      maxConcurrentTickets: a.supportAgentProfile?.maxConcurrentTickets ?? 20,
      openAssignedTicketsCount: a._count.ticketsAssigned,
    }));
  }

  /**
   * Read-only payment, installment, and enrollment lookup for Support troubleshooting (`C-013`, `C-014`).
   * Never exposes raw unmasked UPI IDs or financial mutation actions.
   */
  static async getReadOnlySupportContext(actor: AuthenticatedActor) {
    if (actor.role !== 'SUPPORT' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Support or Admin role required.');
    }

    const [enrollments, payments, redemptions] = await Promise.all([
      prisma.enrollment.findMany({
        take: 25,
        orderBy: { enrolledAt: 'desc' },
        include: {
          student: { select: { fullName: true, email: true } },
          course: { select: { code: true, title: true } },
          installments: { orderBy: { sequenceNumber: 'asc' } },
        },
      }),
      prisma.paymentTransaction.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { fullName: true, email: true } },
          enrollment: { include: { course: { select: { code: true, title: true } } } },
        },
      }),
      prisma.redemptionRequest.findMany({
        take: 20,
        orderBy: { requestedAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true } },
        },
      }),
    ]);

    return {
      enrollments: enrollments.map((e) => ({
        id: e.id,
        studentName: e.student.fullName,
        studentEmail: e.student.email,
        courseCode: e.course.code,
        courseTitle: e.course.title,
        status: e.status,
        planType: e.planTypeSnapshot,
        purchasedPriceInr: e.purchasedPriceSnapshot.toFixed(2),
        installments: e.installments.map((i) => ({
          sequenceNumber: i.sequenceNumber,
          amountInr: i.amount.toFixed(2),
          dueAt: i.dueAt.toISOString(),
          status: i.status,
        })),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        studentName: p.student.fullName,
        studentEmail: p.student.email,
        courseCode: p.enrollment.course.code,
        provider: p.provider,
        providerOrderId: p.providerOrderId,
        providerPaymentId: p.providerPaymentId,
        receiptNumber: p.receiptNumber,
        amountInr: p.amount.toFixed(2),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      redemptions: redemptions.map((r) => ({
        id: r.id,
        studentName: r.user.fullName,
        studentEmail: r.user.email,
        amountInr: r.amount.toFixed(2),
        upiIdMasked: r.upiIdMasked,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
      })),
    };
  }

  /**
   * Computes Support Resolution & SLA Analytics across categories and statuses.
   */
  static async getResolutionReports(actor: AuthenticatedActor) {
    if (actor.role !== 'SUPPORT' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Support or Admin role required.');
    }

    const now = new Date();
    const allTickets = await prisma.supportTicket.findMany({
      select: {
        id: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        slaDueAt: true,
        resolvedAt: true,
      },
    });

    const byCategoryMap = new Map<
      string,
      { total: number; resolved: number; escalated: number; slaBreaches: number }
    >();

    let totalResolved = 0;
    let totalResolutionMinutes = 0;

    for (const t of allTickets) {
      const entry = byCategoryMap.get(t.category) || {
        total: 0,
        resolved: 0,
        escalated: 0,
        slaBreaches: 0,
      };
      entry.total += 1;

      if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
        entry.resolved += 1;
        if (t.resolvedAt) {
          totalResolved += 1;
          totalResolutionMinutes += Math.max(
            1,
            Math.round((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000)
          );
        }
      }
      if (t.status === 'ESCALATED') {
        entry.escalated += 1;
      }
      const isBreached =
        (t.resolvedAt ? t.resolvedAt.getTime() : now.getTime()) > t.slaDueAt.getTime();
      if (isBreached) {
        entry.slaBreaches += 1;
      }

      byCategoryMap.set(t.category, entry);
    }

    return {
      totalTickets: allTickets.length,
      resolvedTickets: totalResolved,
      averageResolutionMinutes:
        totalResolved > 0 ? Math.round(totalResolutionMinutes / totalResolved) : 0,
      categoryBreakdown: Array.from(byCategoryMap.entries()).map(([category, stats]) => ({
        category,
        ...stats,
      })),
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class SupportController {
  static listTickets = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await SupportService.listTickets(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Support tickets retrieved successfully', list);
  });

  static createTicket = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await SupportService.createTicket(req.user, req.body);
    return apiResponse(res, 201, 'Support ticket logged with SLA timer', created);
  });

  static triageTicket = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await SupportService.triageTicket(
      req.user,
      String(req.params.ticketId),
      req.body
    );
    return apiResponse(res, 200, 'Support ticket triaged and updated', updated);
  });

  static postMessage = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const msg = await SupportService.postMessage(
      req.user,
      String(req.params.ticketId),
      req.body
    );
    return apiResponse(res, 201, 'Ticket message recorded', msg);
  });

  static listAgents = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const agents = await SupportService.listSupportAgents(req.user);
    return apiResponse(res, 200, 'Active support agents retrieved', agents);
  });

  static getContextLookup = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const ctx = await SupportService.getReadOnlySupportContext(req.user);
    return apiResponse(
      res,
      200,
      'Read-only payment and enrollment context retrieved',
      ctx
    );
  });

  static getReports = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const report = await SupportService.getResolutionReports(req.user);
    return apiResponse(res, 200, 'Support SLA and resolution reports retrieved', report);
  });
}

export const supportRouter = Router();
supportRouter.use(authenticate);

supportRouter.get('/tickets', SupportController.listTickets);
supportRouter.post(
  '/tickets',
  validateRequest(createTicketValidation),
  SupportController.createTicket
);
supportRouter.patch(
  '/tickets/:ticketId/triage',
  authorizeRoles('SUPPORT', 'ADMIN'),
  validateRequest(triageTicketValidation),
  SupportController.triageTicket
);
supportRouter.post(
  '/tickets/:ticketId/messages',
  validateRequest(postTicketMessageValidation),
  SupportController.postMessage
);
supportRouter.get(
  '/agents',
  authorizeRoles('SUPPORT', 'ADMIN'),
  SupportController.listAgents
);
supportRouter.get(
  '/context-lookup',
  authorizeRoles('SUPPORT', 'ADMIN'),
  SupportController.getContextLookup
);
supportRouter.get(
  '/reports',
  authorizeRoles('SUPPORT', 'ADMIN'),
  SupportController.getReports
);
