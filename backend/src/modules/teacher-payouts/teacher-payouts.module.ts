import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';

/**
 * Pure deterministic calculator for Teacher Revenue-Share Payouts with Indian Section 194J TDS deduction.
 * - Gross Teacher Share = `grossCourseCollections * (revenueSharePercent / 100)`
 * - TDS under Section 194J (Professional / Technical Services) = `grossTeacherShare * (tdsPercent / 100)` (Default 10%)
 * - Net Disbursable Payout = `max(0, grossTeacherShare - tdsAmount + adjustments)`
 */
export function computeTeacherPayoutWithSection194JTds(params: {
  grossCollectionsInr: number;
  revenueSharePercent: number;
  tdsPercent?: number;
  adjustmentsInr?: number;
}): {
  grossCollectionsInr: string;
  revenueSharePercent: string;
  grossShareAmountInr: string;
  tdsSection: '194J';
  tdsPercent: string;
  tdsAmountInr: string;
  adjustmentsInr: string;
  netPayoutAmountInr: string;
} {
  const grossCollections = Math.max(0, Number(params.grossCollectionsInr) || 0);
  const sharePct = Math.max(0, Math.min(100, Number(params.revenueSharePercent) || 0));
  const tdsPct =
    params.tdsPercent !== undefined
      ? Math.max(0, Math.min(50, Number(params.tdsPercent)))
      : env.DEFAULT_TEACHER_TDS_PERCENT ?? 10;
  const adjustments = Number(params.adjustmentsInr) || 0;

  const grossShareCents = Math.round(grossCollections * sharePct);
  const tdsCents = Math.round((grossShareCents * tdsPct) / 100);
  const adjCents = Math.round(adjustments * 100);
  const netCents = Math.max(0, grossShareCents - tdsCents + adjCents);

  return {
    grossCollectionsInr: grossCollections.toFixed(2),
    revenueSharePercent: sharePct.toFixed(2),
    grossShareAmountInr: (grossShareCents / 100).toFixed(2),
    tdsSection: '194J',
    tdsPercent: tdsPct.toFixed(2),
    tdsAmountInr: (tdsCents / 100).toFixed(2),
    adjustmentsInr: (adjCents / 100).toFixed(2),
    netPayoutAmountInr: (netCents / 100).toFixed(2),
  };
}

export const generatePayoutBatchValidation = {
  body: z.object({
    teacherId: z.string().uuid(),
    courseId: z.string().uuid(),
    periodStart: z.string().min(10),
    periodEnd: z.string().min(10),
    tdsPercent: z.number().min(0).max(50).default(10),
    adjustments: z.number().default(0),
    notes: z.string().trim().max(255).optional(),
  }),
};

export const settleTeacherPayoutValidation = {
  params: z.object({
    payoutId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'PAID', 'CANCELLED']),
    paymentReference: z.string().trim().max(120).optional(),
  }),
};

export class TeacherPayoutsService {
  /**
   * Lists teacher revenue-share payout statements (C-014, C-029) enriched with Section 194J TDS breakdown:
   * - TEACHER: Strictly own payout statements (`teacherId = actor.id`).
   * - ADMIN: All platform teacher payouts.
   */
  static async listPayouts(actor: AuthenticatedActor) {
    if (actor.role !== 'TEACHER' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Access restricted to Teachers and Administrators.');
    }

    const where: Prisma.TeacherPayoutWhereInput =
      actor.role === 'TEACHER' ? { teacherId: actor.id } : {};

    const rows = await prisma.teacherPayout.findMany({
      where,
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((p) => {
      const tdsCalc = computeTeacherPayoutWithSection194JTds({
        grossCollectionsInr: Number(p.grossCourseCollections),
        revenueSharePercent: Number(p.revenueSharePercentSnapshot),
        tdsPercent: env.DEFAULT_TEACHER_TDS_PERCENT ?? 10,
        adjustmentsInr: 0,
      });

      return {
        id: p.id,
        teacherId: p.teacherId,
        teacherName: p.teacher.fullName,
        teacherEmail: p.teacher.email,
        courseId: p.courseId,
        periodStart: p.periodStart.toISOString().slice(0, 10),
        periodEnd: p.periodEnd.toISOString().slice(0, 10),
        grossCourseCollections: p.grossCourseCollections.toFixed(2),
        revenueSharePercentSnapshot: p.revenueSharePercentSnapshot.toFixed(2),
        grossPayoutAmount: p.grossPayoutAmount.toFixed(2),
        tdsSection: '194J' as const,
        tdsPercent: tdsCalc.tdsPercent,
        tdsAmount: tdsCalc.tdsAmountInr,
        adjustments: p.adjustments.toFixed(2),
        netPayoutAmount: p.netPayoutAmount.toFixed(2),
        currency: p.currency,
        status: p.status,
        approvedBy: p.approver?.fullName || null,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        paymentReference: p.paymentReference,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  /**
   * Calculates and generates a Teacher Revenue-Share Payout statement from verified `CAPTURED`
   * course collections in `payment_transactions` for an assigned course (C-029), applying Section 194J TDS (default 10%).
   */
  static async generateRevenueSharePayout(
    actor: AuthenticatedActor,
    payload: {
      teacherId: string;
      courseId: string;
      periodStart: string;
      periodEnd: string;
      tdsPercent?: number;
      adjustments: number;
      notes?: string;
    }
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can generate teacher payout statements.');
    }

    const assignment = await prisma.courseTeacherAssignment.findUnique({
      where: {
        courseId_teacherId: {
          courseId: payload.courseId,
          teacherId: payload.teacherId,
        },
      },
    });

    if (!assignment) {
      throw ApiError.unprocessable(
        'Selected teacher is not assigned to the specified course.'
      );
    }

    const startDate = new Date(payload.periodStart);
    const endDate = new Date(payload.periodEnd);

    // Sum verified CAPTURED payment transactions for that course within the period
    const capturedAgg = await prisma.paymentTransaction.aggregate({
      where: {
        status: 'CAPTURED',
        enrollment: { courseId: payload.courseId },
        verifiedAt: {
          gte: startDate,
          lte: new Date(endDate.getTime() + 24 * 3600 * 1000 - 1),
        },
      },
      _sum: { amount: true },
    });

    const grossCollections = Number(capturedAgg._sum.amount || 0);
    const sharePct = Number(assignment.revenueSharePercent);
    const tdsPercent = payload.tdsPercent ?? env.DEFAULT_TEACHER_TDS_PERCENT ?? 10;

    const calc = computeTeacherPayoutWithSection194JTds({
      grossCollectionsInr: grossCollections,
      revenueSharePercent: sharePct,
      tdsPercent,
      adjustmentsInr: payload.adjustments,
    });

    // Store net adjustment = (adjustments - tdsAmount) in `adjustments` column so DB columns reconcile cleanly
    const netAdjustmentWithTds = (
      Number(calc.adjustmentsInr) - Number(calc.tdsAmountInr)
    ).toFixed(2);
    const notesWithTds = `${
      payload.notes || 'Monthly revenue-share payout'
    } [Sec 194J TDS @ ${calc.tdsPercent}% = ₹${calc.tdsAmountInr} deducted]`;

    return prisma.$transaction(async (tx) => {
      const created = await tx.teacherPayout.create({
        data: {
          teacherId: payload.teacherId,
          courseId: payload.courseId,
          periodStart: startDate,
          periodEnd: endDate,
          grossCourseCollections: new Prisma.Decimal(calc.grossCollectionsInr),
          revenueSharePercentSnapshot: new Prisma.Decimal(calc.revenueSharePercent),
          grossPayoutAmount: new Prisma.Decimal(calc.grossShareAmountInr),
          adjustments: new Prisma.Decimal(netAdjustmentWithTds),
          netPayoutAmount: new Prisma.Decimal(calc.netPayoutAmountInr),
          currency: 'INR',
          status: 'APPROVED',
          approvedById: actor.id,
          notes: notesWithTds.slice(0, 255),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'TEACHER_REVENUE_SHARE_PAYOUT_GENERATED',
          entityType: 'TeacherPayout',
          entityId: created.id,
          afterDataJson: JSON.stringify({
            teacherId: payload.teacherId,
            courseId: payload.courseId,
            ...calc,
          }),
        },
      });

      return {
        ...created,
        tdsSection: '194J',
        tdsPercent: calc.tdsPercent,
        tdsAmount: calc.tdsAmountInr,
      };
    });
  }

  static async updatePayoutStatus(
    actor: AuthenticatedActor,
    payoutId: string,
    payload: { status: 'APPROVED' | 'PAID' | 'CANCELLED'; paymentReference?: string }
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can settle teacher payouts.');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.teacherPayout.update({
        where: { id: payoutId },
        data: {
          status: payload.status,
          paymentReference: payload.paymentReference || null,
          approvedById: actor.id,
          paidAt: payload.status === 'PAID' ? new Date() : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'TEACHER_PAYOUT_STATUS_UPDATED',
          entityType: 'TeacherPayout',
          entityId: payoutId,
          afterDataJson: JSON.stringify(payload),
        },
      });

      return updated;
    });
  }
}

export class TeacherPayoutsController {
  static listPayouts = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await TeacherPayoutsService.listPayouts(req.user);
    return apiResponse(res, 200, 'Teacher payouts retrieved successfully', list);
  });

  static generatePayout = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await TeacherPayoutsService.generateRevenueSharePayout(req.user, req.body);
    return apiResponse(
      res,
      201,
      'Teacher revenue-share payout generated with Section 194J TDS deduction',
      created
    );
  });

  static updateStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await TeacherPayoutsService.updatePayoutStatus(
      req.user,
      String(req.params.payoutId),
      req.body
    );
    return apiResponse(res, 200, 'Teacher payout updated', updated);
  });
}

export const teacherPayoutsRouter = Router();
teacherPayoutsRouter.use(authenticate);

teacherPayoutsRouter.get('/', TeacherPayoutsController.listPayouts);
teacherPayoutsRouter.post(
  '/generate',
  authorizeRoles('ADMIN'),
  validateRequest(generatePayoutBatchValidation),
  TeacherPayoutsController.generatePayout
);
teacherPayoutsRouter.patch(
  '/:payoutId/status',
  authorizeRoles('ADMIN'),
  validateRequest(settleTeacherPayoutValidation),
  TeacherPayoutsController.updateStatus
);
