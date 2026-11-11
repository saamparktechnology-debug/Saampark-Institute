import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';

export const generatePayoutBatchValidation = {
  body: z.object({
    teacherId: z.string().uuid(),
    courseId: z.string().uuid(),
    periodStart: z.string().min(10),
    periodEnd: z.string().min(10),
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
   * Lists teacher revenue-share payout statements (C-014, C-029):
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

    return rows.map((p) => ({
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
      adjustments: p.adjustments.toFixed(2),
      netPayoutAmount: p.netPayoutAmount.toFixed(2),
      currency: p.currency,
      status: p.status,
      approvedBy: p.approver?.fullName || null,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      paymentReference: p.paymentReference,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * Calculates and generates a Teacher Revenue-Share Payout statement from verified `CAPTURED`
   * course collections in `payment_transactions` for an assigned course (C-029).
   */
  static async generateRevenueSharePayout(
    actor: AuthenticatedActor,
    payload: {
      teacherId: string;
      courseId: string;
      periodStart: string;
      periodEnd: string;
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

    const grossCollections = capturedAgg._sum.amount || new Prisma.Decimal(0);
    const sharePct = assignment.revenueSharePercent;
    const grossPayout = grossCollections.mul(sharePct).div(new Prisma.Decimal(100));
    const adjDecimal = new Prisma.Decimal(payload.adjustments.toFixed(2));
    const netPayout = Prisma.Decimal.max(new Prisma.Decimal(0), grossPayout.add(adjDecimal));

    return prisma.$transaction(async (tx) => {
      const created = await tx.teacherPayout.create({
        data: {
          teacherId: payload.teacherId,
          courseId: payload.courseId,
          periodStart: startDate,
          periodEnd: endDate,
          grossCourseCollections: grossCollections,
          revenueSharePercentSnapshot: sharePct,
          grossPayoutAmount: grossPayout,
          adjustments: adjDecimal,
          netPayoutAmount: netPayout,
          currency: 'INR',
          status: 'APPROVED',
          approvedById: actor.id,
          notes: payload.notes || null,
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
            grossCollections: grossCollections.toFixed(2),
            sharePct: sharePct.toFixed(2),
            netPayout: netPayout.toFixed(2),
          }),
        },
      });

      return created;
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
    return apiResponse(res, 201, 'Teacher revenue-share payout generated', created);
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
