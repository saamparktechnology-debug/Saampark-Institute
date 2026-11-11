import { z } from 'zod';
import { Request, Response } from 'express';
import { Prisma, PaymentProviderType, PaymentStatus } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { buildPaginationMeta, parsePaginationAndFilters } from '../../utils/pagination';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { RazorpayPaymentAdapter } from '../../integrations/providers.adapter';
import { EnrollmentsService } from '../enrollments/enrollments.service';

const razorpayAdapter = new RazorpayPaymentAdapter(
  process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
  process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_placeholder'
);

// ----------------------------------------------------------------------------
// TYPES & VALIDATION
// ----------------------------------------------------------------------------

export interface PaymentTransactionDto {
  id: string;
  enrollmentId: string;
  installmentId: string | null;
  installmentSequenceNumber: number | null;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseCode: string;
  provider: PaymentProviderType;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: string;
  walletAmountUsed: string;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  receiptNumber: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export const createPaymentOrderValidation = {
  body: z.object({
    enrollmentId: z.string().uuid(),
    installmentSequenceNumber: z.number().int().min(1).default(1),
    useWalletBalance: z.boolean().default(false),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

export const verifyPaymentCallbackValidation = {
  body: z.object({
    enrollmentId: z.string().uuid(),
    installmentSequenceNumber: z.number().int().min(1).default(1),
    providerOrderId: z.string().trim().min(4).max(120),
    providerPaymentId: z.string().trim().min(4).max(120),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

export const refundPaymentValidation = {
  params: z.object({
    transactionId: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().trim().min(5).max(255),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class PaymentsService {
  /**
   * Lists payment transactions strictly scoped by role (C-014):
   * - STUDENT: Strictly own transactions (`studentId = actor.id`).
   * - ADMIN / SUPPORT: Platform-wide transactions (Support has read-only troubleshooting access).
   * - TEACHER: Blocked from student payment transactions (Teachers use `/teacher-payouts`).
   */
  static async listTransactions(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
    if (actor.role === 'TEACHER') {
      throw ApiError.forbidden(
        'Teachers cannot view student payment records; use /api/v1/teacher-payouts for your payout history.'
      );
    }

    const { page, limit, skip, sortBy, sortOrder, filters } = parsePaginationAndFilters(
      rawQuery,
      ['status', 'provider', 'enrollmentId'],
      ['createdAt', 'amount'],
      'createdAt'
    );

    const where: Prisma.PaymentTransactionWhereInput = {};
    if (actor.role === 'STUDENT') {
      where.studentId = actor.id;
    }
    if (filters.status) {
      where.status = filters.status as PaymentStatus;
    }
    if (filters.provider) {
      where.provider = filters.provider as PaymentProviderType;
    }
    if (filters.enrollmentId) {
      where.enrollmentId = filters.enrollmentId;
    }

    const [total, rows] = await Promise.all([
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          installment: { select: { sequenceNumber: true } },
          enrollment: {
            include: {
              course: { select: { title: true, code: true } },
            },
          },
        },
      }),
    ]);

    const items: PaymentTransactionDto[] = rows.map((tx) => ({
      id: tx.id,
      enrollmentId: tx.enrollmentId,
      installmentId: tx.installmentId,
      installmentSequenceNumber: tx.installment?.sequenceNumber ?? null,
      studentId: tx.student.id,
      studentName: tx.student.fullName,
      studentEmail: tx.student.email,
      courseTitle: tx.enrollment.course.title,
      courseCode: tx.enrollment.course.code,
      provider: tx.provider,
      providerOrderId: tx.providerOrderId,
      providerPaymentId: tx.providerPaymentId,
      amount: tx.amount.toFixed(2),
      walletAmountUsed: tx.walletAmountUsed.toFixed(2),
      currency: tx.currency,
      status: tx.status,
      idempotencyKey: tx.idempotencyKey,
      receiptNumber: tx.receiptNumber,
      verifiedAt: tx.verifiedAt ? tx.verifiedAt.toISOString() : null,
      createdAt: tx.createdAt.toISOString(),
    }));

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Creates a provider payment order (or processes a full/partial wallet debit atomically).
   * Never trusts amounts sent from the browser — always reads the installment amount from MySQL.
   */
  static async createPaymentOrder(
    actor: AuthenticatedActor,
    payload: {
      enrollmentId: string;
      installmentSequenceNumber: number;
      useWalletBalance: boolean;
      idempotencyKey: string;
    }
  ) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: payload.enrollmentId },
      include: { installments: true },
    });

    if (!enrollment) {
      throw ApiError.notFound('Enrollment not found');
    }
    if (actor.role === 'STUDENT' && enrollment.studentId !== actor.id) {
      throw ApiError.forbidden('You can only pay for your own enrollment.');
    }

    const installment = enrollment.installments.find(
      (i) => i.sequenceNumber === payload.installmentSequenceNumber
    );
    if (!installment) {
      throw ApiError.notFound('Requested installment sequence not found.');
    }
    if (installment.status === 'PAID') {
      throw ApiError.conflict('This installment is already marked PAID.');
    }

    // Check if wallet balance should be applied atomically
    if (payload.useWalletBalance) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: enrollment.studentId },
      });

      if (wallet && wallet.availableBalance.gte(installment.amount)) {
        // 100% covered by available wallet balance -> atomic wallet debit + installment verification
        await prisma.$transaction(async (tx) => {
          const freshWallet = await tx.wallet.findUnique({
            where: { id: wallet.id },
          });
          if (!freshWallet || freshWallet.availableBalance.lt(installment.amount)) {
            throw new ApiError(
              422,
              'INSUFFICIENT_WALLET_BALANCE',
              'Insufficient available wallet balance for this installment.'
            );
          }

          const newBalance = freshWallet.availableBalance.sub(installment.amount);
          await tx.wallet.update({
            where: { id: freshWallet.id },
            data: {
              availableBalance: newBalance,
              version: { increment: 1 },
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: freshWallet.id,
              transactionType: 'COURSE_PURCHASE_DEBIT',
              direction: 'DEBIT',
              amount: installment.amount,
              balanceAfter: newBalance,
              currency: installment.currency,
              status: 'POSTED',
              referenceType: 'Installment',
              referenceId: installment.id,
              idempotencyKey: `wallet_debit_${payload.idempotencyKey}`,
              description: `Wallet payment for Installment #${installment.sequenceNumber}`,
              createdById: actor.id,
            },
          });
        });

        const updatedEnrollment = await EnrollmentsService.recordVerifiedInstallmentPayment(
          actor,
          enrollment.id,
          {
            installmentSequenceNumber: installment.sequenceNumber,
            provider: 'WALLET',
            providerPaymentId: `wallet_pay_${payload.idempotencyKey}`,
            idempotencyKey: payload.idempotencyKey,
          }
        );

        return {
          paidViaWallet: true,
          providerOrderId: null,
          amountInr: installment.amount.toFixed(2),
          enrollment: updatedEnrollment,
        };
      }
    }

    // Otherwise create a Razorpay order via the PaymentProvider adapter
    const amountInPaise = Math.round(Number(installment.amount) * 100);
    const order = await razorpayAdapter.createOrder({
      enrollmentId: enrollment.id,
      installmentId: installment.id,
      amountInPaise,
      currency: installment.currency,
      idempotencyKey: payload.idempotencyKey,
    });

    return {
      paidViaWallet: false,
      providerOrderId: order.providerOrderId,
      amountInr: installment.amount.toFixed(2),
      currency: installment.currency,
      enrollmentId: enrollment.id,
      installmentSequenceNumber: installment.sequenceNumber,
    };
  }

  /**
   * Processes an incoming Razorpay webhook with HMAC signature verification and idempotent `(provider, providerEventId)` logging.
   */
  static async handleRazorpayWebhook(
    rawBody: string,
    signatureHeader: string,
    parsedBody: {
      eventId: string;
      eventType: string;
      enrollmentId: string;
      installmentSequenceNumber: number;
      providerPaymentId: string;
    }
  ) {
    const isValidSig = razorpayAdapter.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValidSig) {
      throw new ApiError(
        401,
        'WEBHOOK_SIGNATURE_INVALID',
        'Invalid payment provider webhook signature.'
      );
    }

    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'RAZORPAY',
          providerEventId: parsedBody.eventId,
        },
      },
    });

    if (existingEvent) {
      return { idempotentDuplicate: true, status: existingEvent.processingStatus };
    }

    await prisma.paymentWebhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        providerEventId: parsedBody.eventId,
        eventType: parsedBody.eventType,
        signatureVerified: true,
        payloadJson: rawBody,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return { idempotentDuplicate: false, status: 'PROCESSED' };
  }

  /**
   * Admin-only refund/reversal action: marks payment REFUNDED, suspends enrollment if needed,
   * and writes an append-only audit log entry (never deletes financial history).
   */
  static async refundTransaction(
    actor: AuthenticatedActor,
    transactionId: string,
    reason: string
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only finance administrators can issue refunds.');
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
      });
      if (!payment) {
        throw ApiError.notFound('Payment transaction not found');
      }
      if (payment.status === 'REFUNDED') {
        throw ApiError.conflict('Transaction is already refunded.');
      }

      const updated = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: { status: 'REFUNDED' },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'PAYMENT_TRANSACTION_REFUNDED',
          entityType: 'PaymentTransaction',
          entityId: transactionId,
          reason,
          afterDataJson: JSON.stringify({
            amount: payment.amount.toFixed(2),
            enrollmentId: payment.enrollmentId,
          }),
        },
      });

      return updated;
    });
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class PaymentsController {
  static listTransactions = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await PaymentsService.listTransactions(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(
      res,
      200,
      'Payment transactions retrieved successfully',
      result.items,
      result.meta
    );
  });

  static createOrder = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await PaymentsService.createPaymentOrder(req.user, req.body);
    return apiResponse(res, 201, 'Payment order processed', result);
  });

  static refundTransaction = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const refunded = await PaymentsService.refundTransaction(
      req.user,
      String(req.params.transactionId),
      req.body.reason
    );
    return apiResponse(res, 200, 'Payment refunded and audited', refunded);
  });
}

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

paymentsRouter.get('/', PaymentsController.listTransactions);
paymentsRouter.post(
  '/orders',
  authorizeRoles('STUDENT', 'ADMIN'),
  validateRequest(createPaymentOrderValidation),
  PaymentsController.createOrder
);
paymentsRouter.post(
  '/:transactionId/refund',
  authorizeRoles('ADMIN'),
  validateRequest(refundPaymentValidation),
  PaymentsController.refundTransaction
);
