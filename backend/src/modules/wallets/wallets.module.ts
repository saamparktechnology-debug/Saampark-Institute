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
import { encryptUpiId, maskUpiId } from '../../utils/crypto.util';

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createRedemptionValidation = {
  body: z.object({
    amount: z
      .number()
      .min(100, 'Minimum UPI redemption amount is ₹100.00')
      .max(100000, 'Maximum single UPI redemption is ₹1,00,000.00'),
    upiId: z
      .string()
      .trim()
      .min(5)
      .max(100)
      .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, 'Enter a valid UPI ID (e.g. student@okaxis)'),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

export const reviewRedemptionValidation = {
  params: z.object({
    redemptionId: z.string().uuid(),
  }),
  body: z.object({
    decision: z.enum(['PAID', 'REJECTED']),
    payoutReference: z.string().trim().max(120).optional(),
    rejectionReason: z.string().trim().max(255).optional(),
  }),
};

export const adminWalletAdjustmentValidation = {
  params: z.object({
    walletId: z.string().uuid(),
  }),
  body: z.object({
    direction: z.enum(['CREDIT', 'DEBIT']),
    amount: z.number().positive(),
    reason: z.string().trim().min(5).max(255),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE: WALLETS, REFERRALS & UPI REDEMPTIONS (C-005, C-006, C-028)
// ----------------------------------------------------------------------------

export class WalletsAndReferralsService {
  /**
   * Returns a user's wallet summary, append-only ledger transactions, and reconciliation check.
   * Students see strictly their own wallet; Admins can inspect any wallet or all wallets.
   */
  static async getMyWalletAndLedger(actor: AuthenticatedActor) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId: actor.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        redemptionRequests: {
          orderBy: { requestedAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: actor.id,
          currency: 'INR',
          availableBalance: new Prisma.Decimal('0.00'),
          reservedBalance: new Prisma.Decimal('0.00'),
        },
        include: {
          transactions: true,
          redemptionRequests: true,
        },
      });
    }

    // Reconcile posted ledger entries against cached balance
    let computedLedgerNet = new Prisma.Decimal(0);
    for (const entry of wallet.transactions) {
      if (entry.status === 'POSTED') {
        if (entry.direction === 'CREDIT') {
          computedLedgerNet = computedLedgerNet.add(entry.amount);
        } else {
          computedLedgerNet = computedLedgerNet.sub(entry.amount);
        }
      }
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      availableBalance: wallet.availableBalance.toFixed(2),
      reservedBalance: wallet.reservedBalance.toFixed(2),
      reconciledLedgerBalance: computedLedgerNet.toFixed(2),
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        transactionType: t.transactionType,
        direction: t.direction,
        amount: t.amount.toFixed(2),
        balanceAfter: t.balanceAfter.toFixed(2),
        currency: t.currency,
        status: t.status,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
      redemptionRequests: wallet.redemptionRequests.map((r) => ({
        id: r.id,
        amount: r.amount.toFixed(2),
        currency: r.currency,
        upiIdMasked: r.upiIdMasked,
        status: r.status,
        payoutReference: r.payoutReference,
        rejectionReason: r.rejectionReason,
        requestedAt: r.requestedAt.toISOString(),
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      })),
    };
  }

  /**
   * Admin view of all platform wallets and append-only ledger activity.
   */
  static async listAllWalletsForAdmin(actor: AuthenticatedActor) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can view all platform wallets.');
    }

    const wallets = await prisma.wallet.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        _count: { select: { transactions: true, redemptionRequests: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return wallets.map((w) => ({
      id: w.id,
      userId: w.userId,
      userFullName: w.user.fullName,
      userEmail: w.user.email,
      userRole: w.user.role,
      currency: w.currency,
      availableBalance: w.availableBalance.toFixed(2),
      reservedBalance: w.reservedBalance.toFixed(2),
      transactionCount: w._count.transactions,
      redemptionCount: w._count.redemptionRequests,
      updatedAt: w.updatedAt.toISOString(),
    }));
  }

  /**
   * Student submits a UPI redemption request (C-006, C-028):
   * - Atomically checks `availableBalance >= amount`.
   * - Deducts `amount` from `availableBalance` and adds to `reservedBalance`.
   * - Writes an append-only `REDEMPTION_RESERVE` DEBIT ledger entry.
   * - Encrypts the UPI ID with AES-256-GCM and stores only `upiIdMasked` for UI display.
   */
  static async createRedemptionRequest(
    actor: AuthenticatedActor,
    payload: { amount: number; upiId: string; idempotencyKey: string }
  ) {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only students can request UPI wallet redemptions.');
    }

    const requestedDecimal = new Prisma.Decimal(payload.amount.toFixed(2));
    const masked = maskUpiId(payload.upiId);
    const encrypted = encryptUpiId(payload.upiId);

    return prisma.$transaction(async (tx) => {
      const existingLedger = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (existingLedger) {
        throw ApiError.conflict('Duplicate redemption request idempotency key.');
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId: actor.id },
      });

      if (!wallet || wallet.availableBalance.lt(requestedDecimal)) {
        throw new ApiError(
          422,
          'INSUFFICIENT_WALLET_BALANCE',
          `Insufficient available wallet balance. Available: ₹${
            wallet ? wallet.availableBalance.toFixed(2) : '0.00'
          }`
        );
      }

      const newAvailable = wallet.availableBalance.sub(requestedDecimal);
      const newReserved = wallet.reservedBalance.add(requestedDecimal);

      await tx.wallet.update({
        where: { id: wallet.id, version: wallet.version },
        data: {
          availableBalance: newAvailable,
          reservedBalance: newReserved,
          version: { increment: 1 },
        },
      });

      const reserveTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'REDEMPTION_RESERVE',
          direction: 'DEBIT',
          amount: requestedDecimal,
          balanceAfter: newAvailable,
          currency: wallet.currency,
          status: 'POSTED',
          referenceType: 'RedemptionRequest',
          referenceId: actor.id,
          idempotencyKey: payload.idempotencyKey,
          description: `UPI Redemption reservation (${masked})`,
          createdById: actor.id,
        },
      });

      const redemption = await tx.redemptionRequest.create({
        data: {
          userId: actor.id,
          walletId: wallet.id,
          amount: requestedDecimal,
          currency: wallet.currency,
          upiIdMasked: masked,
          upiIdEncrypted: encrypted,
          status: 'REQUESTED',
          reserveTransactionId: reserveTx.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'UPI_REDEMPTION_REQUESTED',
          entityType: 'RedemptionRequest',
          entityId: redemption.id,
          afterDataJson: JSON.stringify({
            amount: requestedDecimal.toFixed(2),
            upiIdMasked: masked,
          }),
        },
      });

      return {
        id: redemption.id,
        amount: redemption.amount.toFixed(2),
        currency: redemption.currency,
        upiIdMasked: redemption.upiIdMasked,
        status: redemption.status,
        requestedAt: redemption.requestedAt.toISOString(),
      };
    });
  }

  /**
   * Lists UPI redemption requests:
   * - ADMIN: All platform redemption requests.
   * - STUDENT: Strictly own redemption requests.
   */
  static async listRedemptionRequests(actor: AuthenticatedActor) {
    const where: Prisma.RedemptionRequestWhereInput =
      actor.role === 'ADMIN' ? {} : { userId: actor.id };

    const rows = await prisma.redemptionRequest.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userFullName: r.user.fullName,
      userEmail: r.user.email,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      upiIdMasked: r.upiIdMasked,
      status: r.status,
      payoutReference: r.payoutReference,
      rejectionReason: r.rejectionReason,
      reviewedBy: r.reviewer?.fullName || null,
      requestedAt: r.requestedAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    }));
  }

  /**
   * Admin approves (marks PAID with payoutReference) or rejects a UPI redemption request (C-028):
   * - If PAID: Decrements `reservedBalance` and records `payoutReference` + `paidAt`.
   * - If REJECTED: Decrements `reservedBalance`, restores `availableBalance`, and writes an append-only
   *   `REDEMPTION_REVERSAL` CREDIT entry in `wallet_transactions`.
   */
  static async reviewRedemptionRequest(
    actor: AuthenticatedActor,
    redemptionId: string,
    payload: {
      decision: 'PAID' | 'REJECTED';
      payoutReference?: string;
      rejectionReason?: string;
    }
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can approve or reject UPI redemptions.');
    }

    if (payload.decision === 'PAID' && !payload.payoutReference) {
      throw ApiError.badRequest(
        'A bank/UPI payoutReference is required when marking a redemption PAID.'
      );
    }
    if (payload.decision === 'REJECTED' && !payload.rejectionReason) {
      throw ApiError.badRequest(
        'A rejectionReason is required when rejecting a redemption request.'
      );
    }

    return prisma.$transaction(async (tx) => {
      const reqRecord = await tx.redemptionRequest.findUnique({
        where: { id: redemptionId },
      });

      if (!reqRecord) {
        throw ApiError.notFound('Redemption request not found.');
      }
      if (reqRecord.status !== 'REQUESTED' && reqRecord.status !== 'UNDER_REVIEW') {
        throw ApiError.conflict(`Redemption request is already finalized (${reqRecord.status}).`);
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: reqRecord.walletId },
      });
      if (!wallet) {
        throw ApiError.notFound('Associated wallet not found.');
      }

      const now = new Date();

      if (payload.decision === 'PAID') {
        const nextReserved = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          wallet.reservedBalance.sub(reqRecord.amount)
        );

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            reservedBalance: nextReserved,
            version: { increment: 1 },
          },
        });

        const settled = await tx.redemptionRequest.update({
          where: { id: redemptionId },
          data: {
            status: 'PAID',
            payoutReference: payload.payoutReference,
            reviewedById: actor.id,
            reviewedAt: now,
            paidAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: 'UPI_REDEMPTION_PAID',
            entityType: 'RedemptionRequest',
            entityId: redemptionId,
            afterDataJson: JSON.stringify({
              amount: reqRecord.amount.toFixed(2),
              payoutReference: payload.payoutReference,
            }),
          },
        });

        return settled;
      } else {
        // REJECTED -> Restore availableBalance via append-only REDEMPTION_REVERSAL entry
        const nextReserved = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          wallet.reservedBalance.sub(reqRecord.amount)
        );
        const restoredAvailable = wallet.availableBalance.add(reqRecord.amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: restoredAvailable,
            reservedBalance: nextReserved,
            version: { increment: 1 },
          },
        });

        const reversalTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionType: 'REDEMPTION_REVERSAL',
            direction: 'CREDIT',
            amount: reqRecord.amount,
            balanceAfter: restoredAvailable,
            currency: wallet.currency,
            status: 'POSTED',
            referenceType: 'RedemptionRequest',
            referenceId: redemptionId,
            idempotencyKey: `redemption_reversal_${redemptionId}`,
            description: `Reversal for rejected UPI redemption (${payload.rejectionReason})`,
            createdById: actor.id,
          },
        });

        const rejected = await tx.redemptionRequest.update({
          where: { id: redemptionId },
          data: {
            status: 'REJECTED',
            rejectionReason: payload.rejectionReason,
            reversalTransactionId: reversalTx.id,
            reviewedById: actor.id,
            reviewedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: 'UPI_REDEMPTION_REJECTED_AND_REVERSED',
            entityType: 'RedemptionRequest',
            entityId: redemptionId,
            reason: payload.rejectionReason,
            afterDataJson: JSON.stringify({
              restoredAmount: reqRecord.amount.toFixed(2),
              reversalTransactionId: reversalTx.id,
            }),
          },
        });

        return rejected;
      }
    });
  }

  /**
   * Lists referrals and referral code details (C-005, C-028):
   * - STUDENT: Own referral code + referrals made by `actor.id`.
   * - ADMIN: All platform referrals.
   */
  static async listReferrals(actor: AuthenticatedActor) {
    const where: Prisma.ReferralWhereInput =
      actor.role === 'ADMIN' ? {} : { referrerUserId: actor.id };

    const [ownCode, referrals] = await Promise.all([
      prisma.referralCode.findUnique({ where: { userId: actor.id } }),
      prisma.referral.findMany({
        where,
        include: {
          referrerUser: { select: { id: true, fullName: true, email: true } },
          referredUser: { select: { id: true, fullName: true, email: true } },
          referralCode: { select: { code: true } },
        },
        orderBy: { attributedAt: 'desc' },
      }),
    ]);

    return {
      myReferralCode: ownCode?.code || null,
      items: referrals.map((ref) => ({
        id: ref.id,
        referrerName: ref.referrerUser.fullName,
        referrerEmail: ref.referrerUser.email,
        referredName: ref.referredUser.fullName,
        referredEmail: ref.referredUser.email,
        codeUsed: ref.referralCode.code,
        status: ref.status,
        rewardAmountSnapshot: ref.rewardAmountSnapshot.toFixed(2),
        currency: ref.currency,
        attributedAt: ref.attributedAt.toISOString(),
        rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : null,
      })),
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLERS & ROUTERS
// ----------------------------------------------------------------------------

export class WalletsAndReferralsController {
  static getMyWallet = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await WalletsAndReferralsService.getMyWalletAndLedger(req.user);
    return apiResponse(res, 200, 'Wallet and append-only ledger retrieved', data);
  });

  static listAllWallets = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await WalletsAndReferralsService.listAllWalletsForAdmin(req.user);
    return apiResponse(res, 200, 'Platform wallets retrieved', list);
  });

  static listRedemptions = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await WalletsAndReferralsService.listRedemptionRequests(req.user);
    return apiResponse(res, 200, 'UPI redemption requests retrieved', list);
  });

  static createRedemption = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await WalletsAndReferralsService.createRedemptionRequest(req.user, req.body);
    return apiResponse(
      res,
      201,
      'UPI redemption requested and wallet funds reserved atomically',
      created
    );
  });

  static reviewRedemption = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await WalletsAndReferralsService.reviewRedemptionRequest(
      req.user,
      String(req.params.redemptionId),
      req.body
    );
    return apiResponse(res, 200, 'Redemption request reviewed and ledger updated', updated);
  });

  static listReferrals = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await WalletsAndReferralsService.listReferrals(req.user);
    return apiResponse(res, 200, 'Referrals retrieved successfully', data);
  });
}

export const walletsRouter = Router();
walletsRouter.use(authenticate);
walletsRouter.get('/me', WalletsAndReferralsController.getMyWallet);
walletsRouter.get(
  '/admin/all',
  authorizeRoles('ADMIN'),
  WalletsAndReferralsController.listAllWallets
);
walletsRouter.get('/redemptions', WalletsAndReferralsController.listRedemptions);
walletsRouter.post(
  '/redemptions',
  authorizeRoles('STUDENT'),
  validateRequest(createRedemptionValidation),
  WalletsAndReferralsController.createRedemption
);
walletsRouter.patch(
  '/redemptions/:redemptionId/review',
  authorizeRoles('ADMIN'),
  validateRequest(reviewRedemptionValidation),
  WalletsAndReferralsController.reviewRedemption
);

export const referralsRouter = Router();
referralsRouter.use(authenticate);
referralsRouter.get('/', WalletsAndReferralsController.listReferrals);
