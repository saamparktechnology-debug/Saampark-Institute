import { Prisma, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationAndFilters, buildPaginationMeta } from '../../utils/pagination';
import { EnrollmentSummaryDto } from './enrollments.types';

export class EnrollmentsService {
  /**
   * Lists enrollments strictly scoped by role (C-013, C-026, C-027):
   * - STUDENT: Strictly own enrollments (`studentId = actor.id`). Never trusts query.studentId!
   * - TEACHER: Strictly enrollments for courses actively assigned to `actor.id`.
   * - ADMIN / SUPPORT: Platform-wide enrollments (Support is read-only).
   */
  static async listEnrollments(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder, filters } = parsePaginationAndFilters(
      rawQuery,
      ['status', 'courseId'],
      ['enrolledAt', 'progressPercent'],
      'enrolledAt'
    );

    const where: Prisma.EnrollmentWhereInput = {};

    if (actor.role === 'STUDENT') {
      where.studentId = actor.id;
    } else if (actor.role === 'TEACHER') {
      where.course = {
        teacherAssignments: {
          some: {
            teacherId: actor.id,
            status: 'ACTIVE',
          },
        },
      };
    }

    if (filters.status) {
      where.status = filters.status as EnrollmentStatus;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }

    const [total, records] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          course: { select: { id: true, code: true, title: true } },
          installments: { orderBy: { sequenceNumber: 'asc' } },
        },
      }),
    ]);

    const items: EnrollmentSummaryDto[] = records.map((enr) => ({
      id: enr.id,
      studentId: enr.student.id,
      studentFullName: enr.student.fullName,
      studentEmail: enr.student.email,
      courseId: enr.course.id,
      courseCode: enr.course.code,
      courseTitle: enr.course.title,
      planTypeSnapshot: enr.planTypeSnapshot,
      purchasedPriceSnapshot: enr.purchasedPriceSnapshot.toFixed(2),
      currencySnapshot: enr.currencySnapshot,
      status: enr.status,
      progressPercent: enr.progressPercent.toFixed(2),
      enrolledAt: enr.enrolledAt.toISOString(),
      activatedAt: enr.activatedAt ? enr.activatedAt.toISOString() : null,
      suspendedAt: enr.suspendedAt ? enr.suspendedAt.toISOString() : null,
      completedAt: enr.completedAt ? enr.completedAt.toISOString() : null,
      installments: enr.installments.map((inst) => ({
        id: inst.id,
        sequenceNumber: inst.sequenceNumber,
        amount: inst.amount.toFixed(2),
        currency: inst.currency,
        dueAt: inst.dueAt.toISOString(),
        graceEndsAt: inst.graceEndsAt.toISOString(),
        status: inst.status,
        paidAt: inst.paidAt ? inst.paidAt.toISOString() : null,
      })),
    }));

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Student initiates an enrollment in a published course with a chosen PaymentPlanTemplate.
   * - Prevents duplicate active/pending enrollments for the same student + course.
   * - Preserves an immutable purchase-time price and installment schedule snapshot (DATABASE_PLAN.md §4-5).
   * - Never trusts prices sent from the browser.
   */
  static async initiateEnrollment(
    actor: AuthenticatedActor,
    payload: { courseId: string; paymentPlanTemplateId: string }
  ): Promise<EnrollmentSummaryDto> {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only student accounts can initiate course enrollments.');
    }

    const [course, planTemplate, existingEnrollment] = await Promise.all([
      prisma.course.findUnique({ where: { id: payload.courseId } }),
      prisma.paymentPlanTemplate.findFirst({
        where: {
          id: payload.paymentPlanTemplateId,
          courseId: payload.courseId,
          isActive: true,
        },
      }),
      prisma.enrollment.findFirst({
        where: {
          studentId: actor.id,
          courseId: payload.courseId,
          status: { in: ['PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED_OVERDUE', 'COMPLETED'] },
        },
      }),
    ]);

    if (!course || course.status !== 'PUBLISHED') {
      throw ApiError.notFound('Published course not found.');
    }
    if (!planTemplate) {
      throw ApiError.notFound('Active payment plan template not found for this course.');
    }
    if (existingEnrollment) {
      throw ApiError.conflict(
        `You already have an enrollment (${existingEnrollment.status}) for this course.`
      );
    }

    const totalCents = Math.round(Number(planTemplate.totalAmount) * 100);
    const count = planTemplate.installmentCount;
    const baseInstallmentCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseInstallmentCents * count;

    const now = new Date();
    const installmentCreates: Prisma.InstallmentCreateWithoutEnrollmentInput[] = [];

    for (let seq = 1; seq <= count; seq++) {
      const cents = seq === 1 ? baseInstallmentCents + remainderCents : baseInstallmentCents;
      const dueAt = new Date(now.getTime() + (seq - 1) * 30 * 24 * 3600 * 1000);
      const graceEndsAt = new Date(
        dueAt.getTime() + planTemplate.gracePeriodDays * 24 * 3600 * 1000
      );

      installmentCreates.push({
        sequenceNumber: seq,
        amount: new Prisma.Decimal((cents / 100).toFixed(2)),
        currency: planTemplate.currency,
        dueAt,
        graceEndsAt,
        status: 'PENDING',
      });
    }

    const createdId = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: actor.id,
          courseId: course.id,
          paymentPlanTemplateId: planTemplate.id,
          planTypeSnapshot: planTemplate.planType,
          purchasedPriceSnapshot: planTemplate.totalAmount,
          currencySnapshot: planTemplate.currency,
          status: 'PENDING_PAYMENT',
          progressPercent: new Prisma.Decimal(0),
          installments: {
            create: installmentCreates,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ENROLLMENT_INITIATED',
          entityType: 'Enrollment',
          entityId: enrollment.id,
          afterDataJson: JSON.stringify({
            courseId: course.id,
            planTypeSnapshot: planTemplate.planType,
            purchasedPriceSnapshot: planTemplate.totalAmount.toFixed(2),
            installmentCount: count,
          }),
        },
      });

      return enrollment.id;
    });

    return this.getEnrollmentById(actor, createdId);
  }

  /**
   * Verifies installment or full payment and activates enrollment immediately on the 1st verified installment (C-027),
   * and credits any pending first-paid-enrollment referral reward atomically in the append-only wallet ledger (C-028).
   */
  static async recordVerifiedInstallmentPayment(
    actor: AuthenticatedActor,
    enrollmentId: string,
    payload: {
      installmentSequenceNumber: number;
      provider: 'RAZORPAY' | 'WALLET' | 'MANUAL';
      providerPaymentId: string;
      idempotencyKey: string;
    }
  ): Promise<EnrollmentSummaryDto> {
    await prisma.$transaction(async (tx) => {
      const existingTx = await tx.paymentTransaction.findUnique({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (existingTx) {
        return; // Idempotent no-op if already processed
      }

      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { installments: { orderBy: { sequenceNumber: 'asc' } } },
      });

      if (!enrollment) {
        throw ApiError.notFound('Enrollment not found');
      }

      if (actor.role === 'STUDENT' && enrollment.studentId !== actor.id) {
        throw ApiError.forbidden('Cannot verify payment for another student.');
      }

      const targetInstallment = enrollment.installments.find(
        (i) => i.sequenceNumber === payload.installmentSequenceNumber
      );
      if (!targetInstallment) {
        throw ApiError.notFound(
          `Installment #${payload.installmentSequenceNumber} not found for this enrollment.`
        );
      }
      if (targetInstallment.status === 'PAID') {
        return;
      }

      const now = new Date();

      await tx.installment.update({
        where: { id: targetInstallment.id },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      await tx.paymentTransaction.create({
        data: {
          enrollmentId: enrollment.id,
          installmentId: targetInstallment.id,
          studentId: enrollment.studentId,
          provider: payload.provider,
          providerPaymentId: payload.providerPaymentId,
          amount: targetInstallment.amount,
          currency: targetInstallment.currency,
          status: 'CAPTURED',
          idempotencyKey: payload.idempotencyKey,
          verifiedAt: now,
        },
      });

      // C-027: Paying the 1st installment (or clearing overdue installments) unlocks full course access (ACTIVE)
      const remainingOverdue = enrollment.installments.some(
        (i) =>
          i.id !== targetInstallment.id &&
          i.status !== 'PAID' &&
          i.graceEndsAt.getTime() < now.getTime()
      );

      const nextStatus: EnrollmentStatus = remainingOverdue ? 'SUSPENDED_OVERDUE' : 'ACTIVE';

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: nextStatus,
          activatedAt: enrollment.activatedAt || now,
          suspendedAt: remainingOverdue ? enrollment.suspendedAt || now : null,
        },
      });

      // C-028: If this is the referred student's 1st verified paid enrollment, credit referrer wallet once
      if (payload.installmentSequenceNumber === 1) {
        const attributedReferral = await tx.referral.findUnique({
          where: { referredUserId: enrollment.studentId },
        });

        if (attributedReferral && attributedReferral.status === 'ATTRIBUTED') {
          const referrerWallet = await tx.wallet.findUnique({
            where: { userId: attributedReferral.referrerUserId },
          });

          if (referrerWallet) {
            const newBalance = referrerWallet.availableBalance.add(
              attributedReferral.rewardAmountSnapshot
            );

            await tx.wallet.update({
              where: { id: referrerWallet.id },
              data: {
                availableBalance: newBalance,
                version: { increment: 1 },
              },
            });

            await tx.walletTransaction.create({
              data: {
                walletId: referrerWallet.id,
                transactionType: 'REFERRAL_REWARD',
                direction: 'CREDIT',
                amount: attributedReferral.rewardAmountSnapshot,
                balanceAfter: newBalance,
                currency: attributedReferral.currency,
                status: 'POSTED',
                referenceType: 'Referral',
                referenceId: attributedReferral.id,
                idempotencyKey: `ref_reward_${attributedReferral.id}`,
                description: `Referral reward for verified enrollment ${enrollment.id.slice(0, 8)}`,
                createdById: actor.id,
              },
            });

            await tx.referral.update({
              where: { id: attributedReferral.id },
              data: {
                status: 'REWARDED',
                qualifyingEnrollmentId: enrollment.id,
                qualifiedAt: now,
                rewardedAt: now,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'INSTALLMENT_PAYMENT_VERIFIED',
          entityType: 'Enrollment',
          entityId: enrollment.id,
          afterDataJson: JSON.stringify({
            installmentSequenceNumber: payload.installmentSequenceNumber,
            providerPaymentId: payload.providerPaymentId,
            enrollmentStatus: nextStatus,
          }),
        },
      });
    });

    return this.getEnrollmentById(actor, enrollmentId);
  }

  static async getEnrollmentById(
    actor: AuthenticatedActor,
    enrollmentId: string
  ): Promise<EnrollmentSummaryDto> {
    const enr = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        course: {
          include: {
            teacherAssignments: { where: { status: 'ACTIVE' } },
          },
        },
        installments: { orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!enr) {
      throw ApiError.notFound('Enrollment not found');
    }

    if (actor.role === 'STUDENT' && enr.studentId !== actor.id) {
      throw ApiError.forbidden('Students may only access their own enrollment records.');
    }

    if (actor.role === 'TEACHER') {
      const isAssigned = enr.course.teacherAssignments.some((ta) => ta.teacherId === actor.id);
      if (!isAssigned) {
        throw ApiError.forbidden('Teachers may only view enrollments for their assigned courses.');
      }
    }

    return {
      id: enr.id,
      studentId: enr.student.id,
      studentFullName: enr.student.fullName,
      studentEmail: enr.student.email,
      courseId: enr.course.id,
      courseCode: enr.course.code,
      courseTitle: enr.course.title,
      planTypeSnapshot: enr.planTypeSnapshot,
      purchasedPriceSnapshot: enr.purchasedPriceSnapshot.toFixed(2),
      currencySnapshot: enr.currencySnapshot,
      status: enr.status,
      progressPercent: enr.progressPercent.toFixed(2),
      enrolledAt: enr.enrolledAt.toISOString(),
      activatedAt: enr.activatedAt ? enr.activatedAt.toISOString() : null,
      suspendedAt: enr.suspendedAt ? enr.suspendedAt.toISOString() : null,
      completedAt: enr.completedAt ? enr.completedAt.toISOString() : null,
      installments: enr.installments.map((inst) => ({
        id: inst.id,
        sequenceNumber: inst.sequenceNumber,
        amount: inst.amount.toFixed(2),
        currency: inst.currency,
        dueAt: inst.dueAt.toISOString(),
        graceEndsAt: inst.graceEndsAt.toISOString(),
        status: inst.status,
        paidAt: inst.paidAt ? inst.paidAt.toISOString() : null,
      })),
    };
  }
}
