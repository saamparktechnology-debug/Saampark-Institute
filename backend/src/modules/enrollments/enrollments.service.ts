import { Prisma, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationAndFilters, buildPaginationMeta } from '../../utils/pagination';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import {
  EnrollmentOnboardingStateDto,
  EnrollmentSummaryDto,
} from './enrollments.types';

/**
 * Pure helper to evaluate whether an enrollment should transition to `SUSPENDED_OVERDUE`
 * (when any unpaid installment has passed `graceEndsAt`) or auto-unlock back to `ACTIVE`.
 */
export function evaluateEnrollmentGracePeriodLockState(
  installments: Array<{
    sequenceNumber: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    graceEndsAt: Date | string;
  }>,
  now: Date = new Date()
): {
  shouldLockAccess: boolean;
  overdueSequenceNumbers: number[];
  recommendedEnrollmentStatus: 'ACTIVE' | 'SUSPENDED_OVERDUE' | 'PENDING_PAYMENT';
} {
  const firstInst = installments.find((i) => i.sequenceNumber === 1);
  if (!firstInst || firstInst.status !== 'PAID') {
    return {
      shouldLockAccess: true,
      overdueSequenceNumbers: [],
      recommendedEnrollmentStatus: 'PENDING_PAYMENT',
    };
  }

  const overdueSequenceNumbers = installments
    .filter(
      (i) =>
        i.status !== 'PAID' &&
        i.status !== 'CANCELLED' &&
        new Date(i.graceEndsAt).getTime() < now.getTime()
    )
    .map((i) => i.sequenceNumber);

  const shouldLockAccess = overdueSequenceNumbers.length > 0;
  return {
    shouldLockAccess,
    overdueSequenceNumbers,
    recommendedEnrollmentStatus: shouldLockAccess ? 'SUSPENDED_OVERDUE' : 'ACTIVE',
  };
}

/**
 * Pure helper to compute the 4-step course onboarding checklist state.
 */
export function resolveOnboardingState(params: {
  enrollmentId: string;
  enrollmentStatus: EnrollmentStatus;
  studentPhone: string | null;
  storedJson: Record<string, unknown> | null;
}): EnrollmentOnboardingStateDto {
  const step1 =
    params.enrollmentStatus === 'ACTIVE' || params.enrollmentStatus === 'COMPLETED';
  const step2 = Boolean(params.storedJson?.step2AcademicPolicyAccepted);
  const step3 =
    params.storedJson?.step3WhatsappAlertsOptIn !== undefined
      ? Boolean(params.storedJson.step3WhatsappAlertsOptIn)
      : Boolean(params.studentPhone);
  const whatsappNumber = String(
    params.storedJson?.whatsappNumber || params.studentPhone || ''
  );
  const step4 = Boolean(params.storedJson?.step4StarterKitAndFirstLesson);

  const completedStepsCount = [step1, step2, step3, step4].filter(Boolean).length;
  const isCompleted = completedStepsCount === 4;

  return {
    enrollmentId: params.enrollmentId,
    step1PlanAndPaymentVerified: step1,
    step2AcademicPolicyAccepted: step2,
    step3WhatsappAlertsOptIn: step3,
    whatsappNumber,
    step4StarterKitAndFirstLesson: step4,
    completedStepsCount,
    isCompleted,
    completedAt:
      isCompleted && params.storedJson?.completedAt
        ? String(params.storedJson.completedAt)
        : null,
  };
}


/**
 * Pure helper that shifts unpaid (PENDING or OVERDUE) installment dueAt and graceEndsAt forward by extensionDays.
 */
export function shiftInstallmentDatesForMoratorium(params: {
  dueAt: Date;
  graceEndsAt: Date;
  extensionDays: number;
}) {
  const shiftMs = params.extensionDays * 24 * 60 * 60 * 1000;
  return {
    newDueAt: new Date(params.dueAt.getTime() + shiftMs),
    newGraceEndsAt: new Date(params.graceEndsAt.getTime() + shiftMs),
  };
}

export class EnrollmentsService {
  /**
   * Automated 00:00 IST Grace-Period Default & Access Lock Sweep.
   * Transitions any `ACTIVE` enrollment whose 2nd/3rd installment has passed `graceEndsAt`
   * to `SUSPENDED_OVERDUE`, marks those installments `OVERDUE`, and notifies affected students.
   */
  static async sweepOverdueInstallmentsAndLockAccess(actorId?: string | null): Promise<{
    sweptAt: string;
    expiredInstallmentsMarkedOverdue: number;
    enrollmentsLockedCount: number;
    lockedEnrollmentIds: string[];
  }> {
    const now = new Date();

    const expiredInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        graceEndsAt: { lt: now },
        enrollment: {
          status: 'ACTIVE',
        },
      },
      include: {
        enrollment: {
          include: {
            course: { select: { code: true, title: true } },
          },
        },
      },
    });

    if (expiredInstallments.length === 0) {
      return {
        sweptAt: now.toISOString(),
        expiredInstallmentsMarkedOverdue: 0,
        enrollmentsLockedCount: 0,
        lockedEnrollmentIds: [],
      };
    }

    const installmentIds = expiredInstallments.map((i) => i.id);
    const enrollmentIds = Array.from(
      new Set(expiredInstallments.map((i) => i.enrollmentId))
    );
    const studentIds = Array.from(
      new Set(expiredInstallments.map((i) => i.enrollment.studentId))
    );

    await prisma.$transaction(async (tx) => {
      await tx.installment.updateMany({
        where: { id: { in: installmentIds } },
        data: { status: 'OVERDUE' },
      });

      await tx.enrollment.updateMany({
        where: { id: { in: enrollmentIds } },
        data: {
          status: 'SUSPENDED_OVERDUE',
          suspendedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorId || null,
          action: 'ENROLLMENT_OVERDUE_ACCESS_LOCKED',
          entityType: 'Enrollment',
          entityId: enrollmentIds[0],
          afterDataJson: JSON.stringify({
            sweptAt: now.toISOString(),
            lockedEnrollmentIds: enrollmentIds,
            expiredInstallmentIds: installmentIds,
          }),
        },
      });
    });

    await OmnichannelMessagingService.dispatchToUsers({
      actorId: actorId || null,
      eventType: 'INSTALLMENT_REMINDER',
      courseCode: 'ACCESS-LOCK',
      title: 'Course Access Paused: Installment Grace Period Expired',
      body: 'Your course installment grace period has expired and live/recorded classes & study materials are temporarily locked. Please visit Installments & Dues (/student/enrollments) to pay via Razorpay and immediately auto-unlock your course.',
      recipientUserIds: studentIds,
    });

    return {
      sweptAt: now.toISOString(),
      expiredInstallmentsMarkedOverdue: installmentIds.length,
      enrollmentsLockedCount: enrollmentIds.length,
      lockedEnrollmentIds: enrollmentIds,
    };
  }

  /**
   * Lists enrollments strictly scoped by role (C-013, C-026, C-027):
   * Automatically runs a lightweight overdue sweep first so statuses are always fresh.
   */
  static async listEnrollments(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
    await this.sweepOverdueInstallmentsAndLockAccess(actor.id).catch(() => undefined);

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
          student: { select: { id: true, fullName: true, email: true, phone: true } },
          course: { select: { id: true, code: true, title: true } },
          installments: { orderBy: { sequenceNumber: 'asc' } },
        },
      }),
    ]);

    const enrollmentIds = records.map((r) => r.id);
    const onboardingLogs =
      enrollmentIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              action: 'COURSE_ONBOARDING_UPDATED',
              entityType: 'Enrollment',
              entityId: { in: enrollmentIds },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const latestOnboardingMap = new Map<string, Record<string, unknown>>();
    for (const log of onboardingLogs) {
      if (!latestOnboardingMap.has(log.entityId) && log.afterDataJson) {
        try {
          latestOnboardingMap.set(
            log.entityId,
            JSON.parse(log.afterDataJson) as Record<string, unknown>
          );
        } catch {
          // ignore malformed JSON
        }
      }
    }

    const items: EnrollmentSummaryDto[] = records.map((enr) => ({
      id: enr.id,
      studentId: enr.student.id,
      studentFullName: enr.student.fullName,
      studentEmail: enr.student.email,
      studentPhone: enr.student.phone,
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
      onboarding: resolveOnboardingState({
        enrollmentId: enr.id,
        enrollmentStatus: enr.status,
        studentPhone: enr.student.phone,
        storedJson: latestOnboardingMap.get(enr.id) || null,
      }),
    }));

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Student initiates an enrollment in a published course with a chosen PaymentPlanTemplate.
   */
  static async initiateEnrollment(
    actor: AuthenticatedActor,
    payload: { courseId: string; paymentPlanTemplateId: string }
  ): Promise<EnrollmentSummaryDto> {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only student accounts can initiate self-enrollments.');
    }

    return this.createEnrollmentInternal({
      actor,
      studentId: actor.id,
      courseId: payload.courseId,
      paymentPlanTemplateId: payload.paymentPlanTemplateId,
      admissionMode: 'PENDING_PAYMENT',
    });
  }

  /**
   * Admin directly enrolls / onboards a student into a course (Offline Cash/Bank Transfer, Scholarship, or Pending).
   */
  static async adminAssignEnrollment(
    actor: AuthenticatedActor,
    payload: {
      studentId: string;
      courseId: string;
      paymentPlanTemplateId: string;
      admissionMode: 'VERIFY_FIRST_INSTALLMENT' | 'FULL_SCHOLARSHIP' | 'PENDING_PAYMENT';
      notes?: string;
    }
  ): Promise<EnrollmentSummaryDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can perform direct student course admissions.');
    }

    const student = await prisma.user.findUnique({
      where: { id: payload.studentId },
      select: { id: true, role: true, status: true },
    });
    if (!student || student.role !== 'STUDENT') {
      throw ApiError.notFound('Target student account not found.');
    }

    return this.createEnrollmentInternal({
      actor,
      studentId: payload.studentId,
      courseId: payload.courseId,
      paymentPlanTemplateId: payload.paymentPlanTemplateId,
      admissionMode: payload.admissionMode,
      notes: payload.notes,
    });
  }

  private static async createEnrollmentInternal(params: {
    actor: AuthenticatedActor;
    studentId: string;
    courseId: string;
    paymentPlanTemplateId: string;
    admissionMode: 'VERIFY_FIRST_INSTALLMENT' | 'FULL_SCHOLARSHIP' | 'PENDING_PAYMENT';
    notes?: string;
  }): Promise<EnrollmentSummaryDto> {
    const [course, planTemplate, existingEnrollment] = await Promise.all([
      prisma.course.findUnique({ where: { id: params.courseId } }),
      prisma.paymentPlanTemplate.findFirst({
        where: {
          id: params.paymentPlanTemplateId,
          courseId: params.courseId,
          isActive: true,
        },
      }),
      prisma.enrollment.findFirst({
        where: {
          studentId: params.studentId,
          courseId: params.courseId,
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
        `Student already has an enrollment (${existingEnrollment.status}) for this course.`
      );
    }

    const totalCents = Math.round(Number(planTemplate.totalAmount) * 100);
    const count = planTemplate.installmentCount;
    const baseInstallmentCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseInstallmentCents * count;

    const now = new Date();
    const isScholarship = params.admissionMode === 'FULL_SCHOLARSHIP';
    const isFirstVerified = params.admissionMode === 'VERIFY_FIRST_INSTALLMENT';
    const activateNow = isScholarship || isFirstVerified;

    const installmentCreates: Prisma.InstallmentCreateWithoutEnrollmentInput[] = [];

    for (let seq = 1; seq <= count; seq++) {
      const cents = seq === 1 ? baseInstallmentCents + remainderCents : baseInstallmentCents;
      const dueAt = new Date(now.getTime() + (seq - 1) * 30 * 24 * 3600 * 1000);
      const graceEndsAt = new Date(
        dueAt.getTime() + planTemplate.gracePeriodDays * 24 * 3600 * 1000
      );

      const instStatus: 'PAID' | 'PENDING' = isScholarship
        ? 'PAID'
        : isFirstVerified && seq === 1
        ? 'PAID'
        : 'PENDING';

      installmentCreates.push({
        sequenceNumber: seq,
        amount: new Prisma.Decimal((cents / 100).toFixed(2)),
        currency: planTemplate.currency,
        dueAt,
        graceEndsAt,
        status: instStatus,
        paidAt: instStatus === 'PAID' ? now : null,
      });
    }

    const createdId = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: params.studentId,
          courseId: course.id,
          paymentPlanTemplateId: planTemplate.id,
          planTypeSnapshot: planTemplate.planType,
          purchasedPriceSnapshot: isScholarship
            ? new Prisma.Decimal(0)
            : planTemplate.totalAmount,
          currencySnapshot: planTemplate.currency,
          status: activateNow ? 'ACTIVE' : 'PENDING_PAYMENT',
          activatedAt: activateNow ? now : null,
          progressPercent: new Prisma.Decimal(0),
          installments: {
            create: installmentCreates,
          },
        },
        include: {
          installments: { orderBy: { sequenceNumber: 'asc' } },
        },
      });

      if (isFirstVerified && enrollment.installments[0]) {
        const firstInst = enrollment.installments[0];
        await tx.paymentTransaction.create({
          data: {
            enrollmentId: enrollment.id,
            installmentId: firstInst.id,
            studentId: params.studentId,
            provider: 'MANUAL',
            providerPaymentId: `ADM-MAN-${Date.now()}`,
            receiptNumber: `INV-2026-${Date.now().toString().slice(-6)}`,
            amount: firstInst.amount,
            currency: firstInst.currency,
            status: 'CAPTURED',
            idempotencyKey: `admin_admit_${enrollment.id}_seq1`,
            verifiedAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: params.actor.id,
          action:
            params.actor.role === 'ADMIN'
              ? 'ADMIN_DIRECT_ENROLLMENT_ASSIGNED'
              : 'ENROLLMENT_INITIATED',
          entityType: 'Enrollment',
          entityId: enrollment.id,
          reason: params.notes || null,
          afterDataJson: JSON.stringify({
            studentId: params.studentId,
            courseId: course.id,
            admissionMode: params.admissionMode,
            planTypeSnapshot: planTemplate.planType,
            purchasedPriceSnapshot: planTemplate.totalAmount.toFixed(2),
            installmentCount: count,
          }),
        },
      });

      return enrollment.id;
    });

    if (activateNow) {
      await OmnichannelMessagingService.dispatchToUsers({
        actorId: params.actor.id,
        eventType: 'ONBOARDING_WELCOME',
        courseCode: course.code,
        title: `Welcome to ${course.title} (${course.code})!`,
        body: `Your enrollment in ${course.title} is now ACTIVE. Complete your 4-step Course Onboarding Checklist in My Courses to start Lesson 1.`,
        recipientUserIds: [params.studentId],
      });
    }

    return this.getEnrollmentById(params.actor, createdId);
  }

  /**
   * Verifies installment or full payment and activates or auto-unlocks enrollment (`SUSPENDED_OVERDUE` -> `ACTIVE`),
   * credits any pending referral reward, and dispatches the Onboarding Welcome / Auto-Unlocked alert.
   */
  static async recordVerifiedInstallmentPayment(
    actor: AuthenticatedActor,
    enrollmentId: string,
    payload: {
      installmentSequenceNumber: number;
      provider: 'RAZORPAY' | 'WALLET' | 'MANUAL';
      providerOrderId?: string;
      providerPaymentId: string;
      idempotencyKey: string;
    }
  ): Promise<EnrollmentSummaryDto> {
    let activatedFirstTime = false;
    let unlockedFromOverdue = false;
    let studentIdForAlert = '';
    let courseCodeForAlert = '';
    let courseTitleForAlert = '';

    await prisma.$transaction(async (tx) => {
      const existingTx = await tx.paymentTransaction.findUnique({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (existingTx && existingTx.status === 'CAPTURED') {
        return; // Idempotent no-op if already captured
      }

      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          course: { select: { code: true, title: true } },
          installments: { orderBy: { sequenceNumber: 'asc' } },
        },
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

      await tx.paymentTransaction.upsert({
        where: { idempotencyKey: payload.idempotencyKey },
        update: {
          providerOrderId: payload.providerOrderId || null,
          providerPaymentId: payload.providerPaymentId,
          status: 'CAPTURED',
          verifiedAt: now,
        },
        create: {
          enrollmentId: enrollment.id,
          installmentId: targetInstallment.id,
          studentId: enrollment.studentId,
          provider: payload.provider,
          providerOrderId: payload.providerOrderId || null,
          providerPaymentId: payload.providerPaymentId,
          receiptNumber: `INV-2026-${Date.now().toString().slice(-6)}`,
          amount: targetInstallment.amount,
          currency: targetInstallment.currency,
          status: 'CAPTURED',
          idempotencyKey: payload.idempotencyKey,
          verifiedAt: now,
        },
      });

      const remainingOverdue = enrollment.installments.some(
        (i) =>
          i.id !== targetInstallment.id &&
          i.status !== 'PAID' &&
          i.status !== 'CANCELLED' &&
          i.graceEndsAt.getTime() < now.getTime()
      );

      const nextStatus: EnrollmentStatus = remainingOverdue ? 'SUSPENDED_OVERDUE' : 'ACTIVE';

      if (!enrollment.activatedAt && nextStatus === 'ACTIVE') {
        activatedFirstTime = true;
        studentIdForAlert = enrollment.studentId;
        courseCodeForAlert = enrollment.course.code;
        courseTitleForAlert = enrollment.course.title;
      } else if (enrollment.status === 'SUSPENDED_OVERDUE' && nextStatus === 'ACTIVE') {
        unlockedFromOverdue = true;
        studentIdForAlert = enrollment.studentId;
        courseCodeForAlert = enrollment.course.code;
        courseTitleForAlert = enrollment.course.title;
      }

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: nextStatus,
          activatedAt: enrollment.activatedAt || now,
          suspendedAt: remainingOverdue ? enrollment.suspendedAt || now : null,
        },
      });

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
            providerOrderId: payload.providerOrderId || null,
            providerPaymentId: payload.providerPaymentId,
            enrollmentStatus: nextStatus,
            unlockedFromOverdue,
          }),
        },
      });
    });

    if (activatedFirstTime && studentIdForAlert) {
      await OmnichannelMessagingService.dispatchToUsers({
        actorId: actor.id,
        eventType: 'ONBOARDING_WELCOME',
        courseCode: courseCodeForAlert,
        title: `Welcome to ${courseTitleForAlert} (${courseCodeForAlert})!`,
        body: `Your 1st installment payment is verified and full course access is now unlocked. Complete your 4-Step Course Onboarding Wizard in My Courses to begin learning.`,
        recipientUserIds: [studentIdForAlert],
      });
    } else if (unlockedFromOverdue && studentIdForAlert) {
      await OmnichannelMessagingService.dispatchToUsers({
        actorId: actor.id,
        eventType: 'ONBOARDING_WELCOME',
        courseCode: courseCodeForAlert,
        title: `Course Access Restored: ${courseTitleForAlert} (${courseCodeForAlert})`,
        body: `Your overdue installment payment has been verified and your full access to live classes, recordings, and study materials is automatically unlocked!`,
        recipientUserIds: [studentIdForAlert],
      });
    }

    return this.getEnrollmentById(actor, enrollmentId);
  }

  /**
   * Retrieves or updates the 4-Step Guided Student Course Onboarding Checklist for an enrollment.
   */
  static async updateOnboardingState(
    actor: AuthenticatedActor,
    enrollmentId: string,
    payload: {
      step2AcademicPolicyAccepted?: boolean;
      step3WhatsappAlertsOptIn?: boolean;
      whatsappNumber?: string;
      step4StarterKitAndFirstLesson?: boolean;
    }
  ): Promise<EnrollmentSummaryDto> {
    const enr = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
        course: { select: { id: true, code: true, title: true } },
      },
    });

    if (!enr) {
      throw ApiError.notFound('Enrollment not found.');
    }

    if (actor.role === 'STUDENT' && enr.studentId !== actor.id) {
      throw ApiError.forbidden('You can only update onboarding steps for your own enrollment.');
    }

    const latestLog = await prisma.auditLog.findFirst({
      where: {
        action: 'COURSE_ONBOARDING_UPDATED',
        entityType: 'Enrollment',
        entityId: enrollmentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    let currentJson: Record<string, unknown> = {};
    if (latestLog?.afterDataJson) {
      try {
        currentJson = JSON.parse(latestLog.afterDataJson) as Record<string, unknown>;
      } catch {
        currentJson = {};
      }
    }

    const nextStep2 =
      payload.step2AcademicPolicyAccepted !== undefined
        ? payload.step2AcademicPolicyAccepted
        : Boolean(currentJson.step2AcademicPolicyAccepted);
    const nextStep3 =
      payload.step3WhatsappAlertsOptIn !== undefined
        ? payload.step3WhatsappAlertsOptIn
        : Boolean(currentJson.step3WhatsappAlertsOptIn ?? Boolean(enr.student.phone));
    const nextWhatsappNumber =
      payload.whatsappNumber !== undefined
        ? payload.whatsappNumber
        : String(currentJson.whatsappNumber || enr.student.phone || '');
    const nextStep4 =
      payload.step4StarterKitAndFirstLesson !== undefined
        ? payload.step4StarterKitAndFirstLesson
        : Boolean(currentJson.step4StarterKitAndFirstLesson);

    const step1 = enr.status === 'ACTIVE' || enr.status === 'COMPLETED';
    const isNowComplete = step1 && nextStep2 && nextStep3 && nextStep4;

    const updatedJson = {
      step2AcademicPolicyAccepted: nextStep2,
      step3WhatsappAlertsOptIn: nextStep3,
      whatsappNumber: nextWhatsappNumber,
      step4StarterKitAndFirstLesson: nextStep4,
      completedAt: isNowComplete
        ? String(currentJson.completedAt || new Date().toISOString())
        : null,
    };

    await prisma.$transaction(async (tx) => {
      if (payload.whatsappNumber && payload.whatsappNumber.trim().length >= 8) {
        await tx.user.update({
          where: { id: enr.studentId },
          data: { phone: payload.whatsappNumber.trim() },
        });
      }

      if (isNowComplete && Number(enr.progressPercent) < 5) {
        await tx.enrollment.update({
          where: { id: enr.id },
          data: { progressPercent: new Prisma.Decimal(5) },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_ONBOARDING_UPDATED',
          entityType: 'Enrollment',
          entityId: enrollmentId,
          afterDataJson: JSON.stringify(updatedJson),
        },
      });
    });

    if (isNowComplete && !currentJson.completedAt) {
      await OmnichannelMessagingService.dispatchToUsers({
        actorId: actor.id,
        eventType: 'ONBOARDING_WELCOME',
        courseCode: enr.course.code,
        title: `Onboarding Completed: ${enr.course.title}`,
        body: `Congratulations ${enr.student.fullName}! You have completed all 4 onboarding steps for ${enr.course.code}. Your WhatsApp and Email study alerts are now active.`,
        recipientUserIds: [enr.studentId],
      });
    }

    return this.getEnrollmentById(actor, enrollmentId);
  }

  static async getEnrollmentById(
    actor: AuthenticatedActor,
    enrollmentId: string
  ): Promise<EnrollmentSummaryDto> {
    const enr = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, fullName: true, email: true, phone: true } },
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

    const latestOnboardingLog = await prisma.auditLog.findFirst({
      where: {
        action: 'COURSE_ONBOARDING_UPDATED',
        entityType: 'Enrollment',
        entityId: enr.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    let storedJson: Record<string, unknown> | null = null;
    if (latestOnboardingLog?.afterDataJson) {
      try {
        storedJson = JSON.parse(latestOnboardingLog.afterDataJson) as Record<string, unknown>;
      } catch {
        storedJson = null;
      }
    }

    return {
      id: enr.id,
      studentId: enr.student.id,
      studentFullName: enr.student.fullName,
      studentEmail: enr.student.email,
      studentPhone: enr.student.phone,
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
      onboarding: resolveOnboardingState({
        enrollmentId: enr.id,
        enrollmentStatus: enr.status,
        studentPhone: enr.student.phone,
        storedJson,
      }),
    };
  }

  /**
   * Grants an Academic/Medical Moratorium or Grace Extension (`POST /api/v1/enrollments/:enrollmentId/extend-schedule`).
   * Shifts `dueAt` and `graceEndsAt` forward by `extensionDays` for all unpaid (`PENDING` or `OVERDUE`) installments,
   * automatically restores `SUSPENDED_OVERDUE -> ACTIVE` if the new grace period is in the future,
   * writes an immutable AuditLog (`ENROLLMENT_MORATORIUM_SCHEDULE_SHIFTED`), and notifies the student.
   */
  static async extendInstallmentScheduleMoratorium(
    actor: AuthenticatedActor,
    enrollmentId: string,
    payload: { extensionDays: number; reason: string }
  ): Promise<EnrollmentSummaryDto> {
    if (actor.role !== 'ADMIN' && actor.role !== 'SUPPORT') {
      throw ApiError.forbidden(
        'Only Administrators or Support Officers can grant installment moratorium extensions.'
      );
    }

    const enr = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, fullName: true, email: true, phone: true } },
        course: { select: { id: true, code: true, title: true } },
        installments: { orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!enr) {
      throw ApiError.notFound('Enrollment not found.');
    }

    const unpaidInstallments = enr.installments.filter(
      (i) => i.status !== 'PAID' && i.status !== 'CANCELLED'
    );
    if (unpaidInstallments.length === 0) {
      throw ApiError.unprocessable(
        'All installments on this enrollment are already paid or settled.'
      );
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const inst of unpaidInstallments) {
        const shifted = shiftInstallmentDatesForMoratorium({
          dueAt: inst.dueAt,
          graceEndsAt: inst.graceEndsAt,
          extensionDays: payload.extensionDays,
        });

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            dueAt: shifted.newDueAt,
            graceEndsAt: shifted.newGraceEndsAt,
            status: shifted.newGraceEndsAt.getTime() > now.getTime() ? 'PENDING' : inst.status,
          },
        });
      }

      if (enr.status === 'SUSPENDED_OVERDUE') {
        await tx.enrollment.update({
          where: { id: enr.id },
          data: {
            status: 'ACTIVE',
            suspendedAt: null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ENROLLMENT_MORATORIUM_SCHEDULE_SHIFTED',
          entityType: 'Enrollment',
          entityId: enr.id,
          reason: payload.reason,
          afterDataJson: JSON.stringify({
            extensionDays: payload.extensionDays,
            shiftedInstallmentSequences: unpaidInstallments.map((i) => i.sequenceNumber),
            previousStatus: enr.status,
          }),
        },
      });
    });

    await OmnichannelMessagingService.dispatchToUsers({
      actorId: actor.id,
      eventType: 'INSTALLMENT_REMINDER',
      courseCode: enr.course.code,
      title: `Installment Schedule Extended (+${payload.extensionDays} Days): ${enr.course.code}`,
      body: `Hello ${enr.student.fullName}, an installment moratorium/extension of +${payload.extensionDays} day(s) has been applied to your ${enr.course.code} (${enr.course.title}) enrollment. Reason: ${payload.reason}. Your course access is active.`,
      recipientUserIds: [enr.studentId],
    });

    return this.getEnrollmentById(actor, enrollmentId);
  }
}
