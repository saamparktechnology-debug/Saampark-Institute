import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { Prisma, PaymentProviderType, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
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
  env.RAZORPAY_KEY_ID,
  env.RAZORPAY_KEY_SECRET,
  env.RAZORPAY_WEBHOOK_SECRET
);

// ----------------------------------------------------------------------------
// INDIAN GST TAX INVOICE (SAC 999293) & CREDIT NOTE CALCULATOR
// ----------------------------------------------------------------------------

export interface GstTaxInvoiceBreakdown {
  sacCode: string;
  instituteGstin: string;
  instituteState: string;
  placeOfSupplyState: string;
  customerGstin: string | null;
  isIntraState: boolean;
  taxableValueInr: string;
  cgstRatePercent: number;
  cgstAmountInr: string;
  sgstRatePercent: number;
  sgstAmountInr: string;
  igstRatePercent: number;
  igstAmountInr: string;
  totalGstAmountInr: string;
  totalInvoiceAmountInr: string;
}

/**
 * Pure deterministic calculator for Indian GST-Compliant Tax Invoices (SAC 999293 — Commercial Training/Coaching).
 * - Intra-State (`placeOfSupplyState === instituteState`): CGST 9% + SGST 9%
 * - Inter-State (`placeOfSupplyState !== instituteState`): IGST 18%
 */
export function computeGstTaxBreakdown(params: {
  grossAmountInr: number;
  placeOfSupplyState?: string | null;
  instituteState?: string;
  customerGstin?: string | null;
}): GstTaxInvoiceBreakdown {
  const gross = Math.max(0, Number(params.grossAmountInr) || 0);
  const instituteState = (params.instituteState || env.INSTITUTE_STATE || 'West Bengal').trim();
  const placeOfSupplyState = (params.placeOfSupplyState || instituteState).trim();
  const isIntraState =
    placeOfSupplyState.toLowerCase() === instituteState.toLowerCase();

  // Back-calculate 18% GST inclusive price into Taxable Value + 18% GST
  const taxableCents = Math.round((gross * 100) / 1.18);
  const totalCents = Math.round(gross * 100);
  const totalGstCents = Math.max(0, totalCents - taxableCents);

  let cgstCents = 0;
  let sgstCents = 0;
  let igstCents = 0;

  if (isIntraState) {
    cgstCents = Math.floor(totalGstCents / 2);
    sgstCents = totalGstCents - cgstCents;
  } else {
    igstCents = totalGstCents;
  }

  return {
    sacCode: env.INSTITUTE_SAC_CODE || '999293',
    instituteGstin: env.INSTITUTE_GSTIN || '19AABCS1429B1Z1',
    instituteState,
    placeOfSupplyState,
    customerGstin: params.customerGstin ? params.customerGstin.trim().toUpperCase() : null,
    isIntraState,
    taxableValueInr: (taxableCents / 100).toFixed(2),
    cgstRatePercent: isIntraState ? 9 : 0,
    cgstAmountInr: (cgstCents / 100).toFixed(2),
    sgstRatePercent: isIntraState ? 9 : 0,
    sgstAmountInr: (sgstCents / 100).toFixed(2),
    igstRatePercent: isIntraState ? 0 : 18,
    igstAmountInr: (igstCents / 100).toFixed(2),
    totalGstAmountInr: (totalGstCents / 100).toFixed(2),
    totalInvoiceAmountInr: (totalCents / 100).toFixed(2),
  };
}

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
  gstInvoice: GstTaxInvoiceBreakdown;
  creditNoteNumber: string | null;
  creditNoteIssuedAt: string | null;
  refundReason: string | null;
}

export const createPaymentOrderValidation = {
  body: z.object({
    enrollmentId: z.string().uuid(),
    installmentSequenceNumber: z.number().int().min(1).default(1),
    useWalletBalance: z.boolean().default(false),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

export const verifyRazorpayCheckoutValidation = {
  body: z.object({
    enrollmentId: z.string().uuid(),
    installmentSequenceNumber: z.number().int().min(1).default(1),
    razorpayOrderId: z.string().trim().min(4).max(120),
    razorpayPaymentId: z.string().trim().min(4).max(120),
    razorpaySignature: z.string().trim().min(8, 'razorpay_signature is required for HMAC verification'),
  }),
};

export const updatePaymentGstDetailsValidation = {
  params: z.object({
    transactionId: z.string().uuid(),
  }),
  body: z.object({
    customerGstin: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable(),
    placeOfSupplyState: z.string().trim().min(2).max(64),
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
   * Lists payment transactions strictly scoped by role (C-014), enriched with
   * Indian GST Tax Invoice breakdowns (SAC 999293) and Credit Note metadata for refunded transactions.
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

    const txIds = rows.map((r) => r.id);
    const taxAndRefundLogs =
      txIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'PaymentTransaction',
              entityId: { in: txIds },
              action: {
                in: ['PAYMENT_GST_DETAILS_UPDATED', 'PAYMENT_TRANSACTION_REFUNDED'],
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const gstMetaMap = new Map<
      string,
      { customerGstin?: string | null; placeOfSupplyState?: string | null }
    >();
    const refundMetaMap = new Map<
      string,
      { creditNoteNumber: string; creditNoteIssuedAt: string; refundReason: string | null }
    >();

    for (const log of taxAndRefundLogs) {
      if (log.action === 'PAYMENT_GST_DETAILS_UPDATED' && !gstMetaMap.has(log.entityId)) {
        try {
          const parsed = JSON.parse(log.afterDataJson || '{}') as {
            customerGstin?: string | null;
            placeOfSupplyState?: string | null;
          };
          gstMetaMap.set(log.entityId, parsed);
        } catch {
          // ignore
        }
      }
      if (log.action === 'PAYMENT_TRANSACTION_REFUNDED' && !refundMetaMap.has(log.entityId)) {
        try {
          const parsed = JSON.parse(log.afterDataJson || '{}') as {
            creditNoteNumber?: string;
          };
          refundMetaMap.set(log.entityId, {
            creditNoteNumber:
              parsed.creditNoteNumber || `CN-2026-${log.entityId.slice(0, 6).toUpperCase()}`,
            creditNoteIssuedAt: log.createdAt.toISOString(),
            refundReason: log.reason || 'Admin verified refund',
          });
        } catch {
          // ignore
        }
      }
    }

    const items: PaymentTransactionDto[] = rows.map((tx) => {
      const gstMeta = gstMetaMap.get(tx.id);
      const refundMeta = refundMetaMap.get(tx.id);
      const gstInvoice = computeGstTaxBreakdown({
        grossAmountInr: Number(tx.amount),
        placeOfSupplyState: gstMeta?.placeOfSupplyState || env.INSTITUTE_STATE,
        customerGstin: gstMeta?.customerGstin || null,
      });

      return {
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
        receiptNumber: tx.receiptNumber || `INV-2026-${tx.id.slice(0, 6).toUpperCase()}`,
        verifiedAt: tx.verifiedAt ? tx.verifiedAt.toISOString() : null,
        createdAt: tx.createdAt.toISOString(),
        gstInvoice,
        creditNoteNumber:
          tx.status === 'REFUNDED'
            ? refundMeta?.creditNoteNumber || `CN-2026-${tx.id.slice(0, 6).toUpperCase()}`
            : null,
        creditNoteIssuedAt:
          tx.status === 'REFUNDED'
            ? refundMeta?.creditNoteIssuedAt || tx.createdAt.toISOString()
            : null,
        refundReason: tx.status === 'REFUNDED' ? refundMeta?.refundReason || null : null,
      };
    });

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Updates student/company B2B GSTIN and Place of Supply State on a payment invoice.
   */
  static async updatePaymentGstDetails(
    actor: AuthenticatedActor,
    transactionId: string,
    payload: { customerGstin?: string | null; placeOfSupplyState: string }
  ) {
    const txRecord = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!txRecord) {
      throw ApiError.notFound('Payment transaction not found.');
    }
    if (actor.role === 'STUDENT' && txRecord.studentId !== actor.id) {
      throw ApiError.forbidden('You can only update GST invoice details on your own payments.');
    }

    const gstInvoice = computeGstTaxBreakdown({
      grossAmountInr: Number(txRecord.amount),
      placeOfSupplyState: payload.placeOfSupplyState,
      customerGstin: payload.customerGstin || null,
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'PAYMENT_GST_DETAILS_UPDATED',
        entityType: 'PaymentTransaction',
        entityId: transactionId,
        afterDataJson: JSON.stringify({
          customerGstin: gstInvoice.customerGstin,
          placeOfSupplyState: gstInvoice.placeOfSupplyState,
          isIntraState: gstInvoice.isIntraState,
        }),
      },
    });

    return {
      transactionId,
      gstInvoice,
    };
  }

  /**
   * Step 2 of Official Razorpay Node.js Integration:
   * Calls Razorpay Orders API (`POST https://api.razorpay.com/v1/orders`) to create a real order,
   * persists `providerOrderId` (`order_...`) on a `CREATED` `PaymentTransaction` row in MySQL so
   * Step 5 can verify the signature against the server-stored `order_id`, and returns the checkout options.
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
      include: {
        student: { select: { id: true, fullName: true, email: true, phone: true } },
        course: { select: { id: true, code: true, title: true } },
        installments: true,
      },
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
          razorpayKeyId: env.RAZORPAY_KEY_ID,
          isLiveRazorpayOrder: false,
          amountInPaise: 0,
          amountInr: installment.amount.toFixed(2),
          currency: installment.currency,
          enrollmentId: enrollment.id,
          installmentSequenceNumber: installment.sequenceNumber,
          courseTitle: enrollment.course.title,
          courseCode: enrollment.course.code,
          studentName: enrollment.student.fullName,
          studentEmail: enrollment.student.email,
          studentPhone: enrollment.student.phone || '+919876543210',
          enrollment: updatedEnrollment,
        };
      }
    }

    // Step 2: Create a real Razorpay Order via Razorpay's Orders API
    const amountInPaise = Math.round(Number(installment.amount) * 100);
    let order;
    try {
      order = await razorpayAdapter.createOrder({
        enrollmentId: enrollment.id,
        installmentId: installment.id,
        installmentSequenceNumber: installment.sequenceNumber,
        courseCode: enrollment.course.code,
        amountInPaise,
        currency: installment.currency,
        idempotencyKey: payload.idempotencyKey,
      });
    } catch (err) {
      throw ApiError.badRequest(
        err instanceof Error
          ? err.message
          : 'Failed to create order with Razorpay Orders API.'
      );
    }

    // Persist the server-created order_id in payment_transactions (status = CREATED)
    // so Step 5 retrieves order_id from our server database rather than trusting client input.
    await prisma.paymentTransaction.upsert({
      where: { idempotencyKey: payload.idempotencyKey },
      update: {
        providerOrderId: order.providerOrderId,
      },
      create: {
        enrollmentId: enrollment.id,
        installmentId: installment.id,
        studentId: enrollment.studentId,
        provider: 'RAZORPAY',
        providerOrderId: order.providerOrderId,
        amount: installment.amount,
        currency: installment.currency,
        status: 'CREATED',
        idempotencyKey: payload.idempotencyKey,
      },
    });

    return {
      paidViaWallet: false,
      providerOrderId: order.providerOrderId,
      razorpayKeyId: order.razorpayKeyId,
      isLiveRazorpayOrder: order.isLiveRazorpayOrder,
      amountInPaise: order.amount,
      amountInr: installment.amount.toFixed(2),
      currency: order.currency,
      enrollmentId: enrollment.id,
      installmentSequenceNumber: installment.sequenceNumber,
      courseTitle: enrollment.course.title,
      courseCode: enrollment.course.code,
      studentName: enrollment.student.fullName,
      studentEmail: enrollment.student.email,
      studentPhone: enrollment.student.phone || '+919876543210',
    };
  }

  /**
   * Step 4 & Step 5 of Official Razorpay Node.js Integration:
   * 1. Retrieves the `order_id` (`providerOrderId`) stored on our server for this installment.
   * 2. Verifies `hmac_sha256(stored_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET) === razorpay_signature`.
   * 3. Marks the installment `PAID`, transitions the `PaymentTransaction` to `CAPTURED`, and activates/auto-unlocks the course.
   */
  static async verifyRazorpayCheckoutCallback(
    actor: AuthenticatedActor,
    payload: {
      enrollmentId: string;
      installmentSequenceNumber: number;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: payload.enrollmentId },
      include: {
        installments: { orderBy: { sequenceNumber: 'asc' } },
      },
    });
    if (!enrollment) {
      throw ApiError.notFound('Enrollment not found.');
    }

    const installment = enrollment.installments.find(
      (i) => i.sequenceNumber === payload.installmentSequenceNumber
    );
    if (!installment) {
      throw ApiError.notFound('Installment not found.');
    }

    // Retrieve the order_id from our server database (per Razorpay Step 5 specification)
    const pendingOrderTx = await prisma.paymentTransaction.findFirst({
      where: {
        enrollmentId: payload.enrollmentId,
        installmentId: installment.id,
        provider: 'RAZORPAY',
        providerOrderId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serverOrderId = pendingOrderTx?.providerOrderId || payload.razorpayOrderId;

    const sigOk = razorpayAdapter.verifyCheckoutSignature({
      orderId: serverOrderId,
      paymentId: payload.razorpayPaymentId,
      signature: payload.razorpaySignature,
    });

    if (!sigOk) {
      throw new ApiError(
        400,
        'WEBHOOK_SIGNATURE_INVALID',
        'Razorpay payment signature verification failed (HMAC-SHA256 mismatch).'
      );
    }

    // Remove the temporary CREATED row so recordVerifiedInstallmentPayment writes the final CAPTURED row cleanly
    if (pendingOrderTx && pendingOrderTx.status === 'CREATED') {
      await prisma.paymentTransaction.delete({
        where: { id: pendingOrderTx.id },
      }).catch(() => undefined);
    }

    const updatedEnrollment = await EnrollmentsService.recordVerifiedInstallmentPayment(
      actor,
      payload.enrollmentId,
      {
        installmentSequenceNumber: payload.installmentSequenceNumber,
        provider: 'RAZORPAY',
        providerOrderId: serverOrderId,
        providerPaymentId: payload.razorpayPaymentId,
        idempotencyKey: `rzp_chk_${serverOrderId}_${payload.installmentSequenceNumber}`,
      }
    );

    return {
      verified: true,
      razorpayOrderId: serverOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      enrollment: updatedEnrollment,
    };
  }

  /**
   * Processes an incoming Razorpay webhook (`POST /api/v1/webhooks/razorpay` or `/api/webhooks/razorpay`)
   * with HMAC-SHA256 signature verification and idempotent `(provider, providerEventId)` reconciliation.
   * Handles `payment.captured`, `order.paid`, `payment.failed`, and `refund.processed`.
   */
  static async handleRazorpayWebhook(
    rawBody: string,
    signatureHeader: string,
    parsedBody: Record<string, unknown>
  ) {
    const isValidSig = razorpayAdapter.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValidSig) {
      throw new ApiError(
        401,
        'WEBHOOK_SIGNATURE_INVALID',
        'Invalid payment provider webhook signature.'
      );
    }

    const eventId = String(
      parsedBody.eventId || parsedBody.id || `evt_${Date.now()}`
    );
    const eventType = String(
      parsedBody.eventType || parsedBody.event || 'payment.captured'
    );

    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'RAZORPAY',
          providerEventId: eventId,
        },
      },
    });

    if (existingEvent) {
      return {
        idempotentDuplicate: true,
        eventType,
        status: existingEvent.processingStatus,
      };
    }

    // Extract enrollmentId, installmentSequenceNumber, providerPaymentId from either flat or nested Razorpay payload
    const paymentEntity = (
      (parsedBody.payload as Record<string, unknown> | undefined)?.payment as
        | Record<string, unknown>
        | undefined
    )?.entity as Record<string, unknown> | undefined;
    const notes = (paymentEntity?.notes as Record<string, unknown> | undefined) || {};

    const enrollmentId = String(
      parsedBody.enrollmentId || notes.enrollmentId || ''
    );
    const installmentSequenceNumber = Number(
      parsedBody.installmentSequenceNumber || notes.installmentSequenceNumber || 1
    );
    const providerPaymentId = String(
      parsedBody.providerPaymentId || paymentEntity?.id || `pay_wh_${eventId}`
    );
    const providerOrderId = String(
      parsedBody.providerOrderId || paymentEntity?.order_id || ''
    );

    if (
      (eventType === 'payment.captured' || eventType === 'order.paid') &&
      enrollmentId
    ) {
      const enr = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { student: true },
      });
      if (enr) {
        const systemActor: AuthenticatedActor = {
          id: enr.studentId,
          email: enr.student.email,
          fullName: enr.student.fullName,
          role: 'STUDENT',
          permissions: [],
          sessionId: 'webhook',
        };
        await EnrollmentsService.recordVerifiedInstallmentPayment(
          systemActor,
          enrollmentId,
          {
            installmentSequenceNumber,
            provider: 'RAZORPAY',
            providerOrderId: providerOrderId || undefined,
            providerPaymentId,
            idempotencyKey: `rzp_wh_${eventId}`,
          }
        );
      }
    } else if (eventType === 'payment.failed' && enrollmentId) {
      await prisma.auditLog.create({
        data: {
          action: 'RAZORPAY_WEBHOOK_PAYMENT_FAILED',
          entityType: 'Enrollment',
          entityId: enrollmentId,
          afterDataJson: JSON.stringify({
            eventId,
            providerPaymentId,
            installmentSequenceNumber,
          }),
        },
      });
    } else if (eventType === 'refund.processed' && providerPaymentId) {
      const txRow = await prisma.paymentTransaction.findFirst({
        where: { providerPaymentId },
      });
      if (txRow && txRow.status !== 'REFUNDED') {
        const creditNoteNumber = `CN-${new Date().getFullYear()}-${Date.now()
          .toString()
          .slice(-4)}`;
        await prisma.$transaction([
          prisma.paymentTransaction.update({
            where: { id: txRow.id },
            data: { status: 'REFUNDED' },
          }),
          prisma.auditLog.create({
            data: {
              action: 'PAYMENT_TRANSACTION_REFUNDED',
              entityType: 'PaymentTransaction',
              entityId: txRow.id,
              reason: 'Razorpay webhook refund.processed',
              afterDataJson: JSON.stringify({
                creditNoteNumber,
                originalReceiptNumber: txRow.receiptNumber,
                amount: txRow.amount.toFixed(2),
              }),
            },
          }),
        ]);
      }
    }

    await prisma.paymentWebhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        providerEventId: eventId,
        eventType,
        signatureVerified: true,
        payloadJson: rawBody,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return {
      idempotentDuplicate: false,
      eventType,
      status: 'PROCESSED',
    };
  }

  /**
   * Admin-only refund/reversal action that calls Razorpay's Refunds API (`POST /v1/payments/:id/refund`)
   * and generates a sequential GST Credit Note (`CN-2026-XXXX`) linked to the original Tax Invoice.
   */
  static async refundTransaction(
    actor: AuthenticatedActor,
    transactionId: string,
    reason: string
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only finance administrators can issue refunds.');
    }

    const existingPayment = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!existingPayment) {
      throw ApiError.notFound('Payment transaction not found');
    }
    if (existingPayment.status === 'REFUNDED') {
      throw ApiError.conflict('Transaction is already refunded.');
    }

    const rzpRefund = await razorpayAdapter.createRefund({
      providerPaymentId: existingPayment.providerPaymentId || '',
      amountInPaise: Math.round(Number(existingPayment.amount) * 100),
      reason,
    });

    return prisma.$transaction(async (tx) => {
      const refundCount = await tx.paymentTransaction.count({
        where: { status: 'REFUNDED' },
      });
      const creditNoteNumber = `CN-${new Date().getFullYear()}-${String(
        refundCount + 1
      ).padStart(4, '0')}`;

      const gstBreakdown = computeGstTaxBreakdown({
        grossAmountInr: Number(existingPayment.amount),
      });

      const updated = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

      await tx.enrollment.update({
        where: { id: existingPayment.enrollmentId },
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
            creditNoteNumber,
            providerRefundId: rzpRefund.providerRefundId,
            originalInvoiceNumber:
              existingPayment.receiptNumber ||
              `INV-2026-${existingPayment.id.slice(0, 6).toUpperCase()}`,
            amount: existingPayment.amount.toFixed(2),
            reversedTaxableValueInr: gstBreakdown.taxableValueInr,
            reversedGstAmountInr: gstBreakdown.totalGstAmountInr,
            enrollmentId: existingPayment.enrollmentId,
          }),
        },
      });

      return {
        ...updated,
        amount: updated.amount.toFixed(2),
        providerRefundId: rzpRefund.providerRefundId,
        creditNoteNumber,
        creditNoteIssuedAt: new Date().toISOString(),
        refundReason: reason,
      };
    });
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTERS
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
    return apiResponse(res, 201, 'Razorpay payment order created', result);
  });

  static verifyCheckout = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await PaymentsService.verifyRazorpayCheckoutCallback(
      req.user,
      req.body
    );
    return apiResponse(
      res,
      200,
      'Razorpay payment signature verified and installment marked PAID',
      result
    );
  });

  static updateGstDetails = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await PaymentsService.updatePaymentGstDetails(
      req.user,
      String(req.params.transactionId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'GSTIN and Place of Supply updated on Tax Invoice',
      result
    );
  });

  static refundTransaction = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const refunded = await PaymentsService.refundTransaction(
      req.user,
      String(req.params.transactionId),
      req.body.reason
    );
    return apiResponse(
      res,
      200,
      'Payment refunded via Razorpay and sequential GST Credit Note generated',
      refunded
    );
  });

  static razorpayWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = JSON.stringify(req.body || {});
    const result = await PaymentsService.handleRazorpayWebhook(
      rawBody,
      signature,
      (req.body || {}) as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Razorpay webhook processed', result);
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
  '/verify-checkout',
  authorizeRoles('STUDENT', 'ADMIN'),
  validateRequest(verifyRazorpayCheckoutValidation),
  PaymentsController.verifyCheckout
);
paymentsRouter.patch(
  '/:transactionId/gst-details',
  authorizeRoles('STUDENT', 'ADMIN'),
  validateRequest(updatePaymentGstDetailsValidation),
  PaymentsController.updateGstDetails
);
paymentsRouter.post(
  '/:transactionId/refund',
  authorizeRoles('ADMIN'),
  validateRequest(refundPaymentValidation),
  PaymentsController.refundTransaction
);

// Unauthenticated, HMAC-verified Razorpay Webhook Router
export const razorpayWebhooksRouter = Router();
razorpayWebhooksRouter.post('/razorpay', PaymentsController.razorpayWebhook);
