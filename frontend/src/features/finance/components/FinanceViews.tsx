'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useAdminAllWalletsQuery,
  useGenerateTeacherPayoutMutation,
  useMyWalletQuery,
  usePaymentsListQuery,
  useRedemptionsListQuery,
  useReferralsListQuery,
  useRefundTransactionMutation,
  useRequestUpiRedemptionMutation,
  useReviewUpiRedemptionMutation,
  useSettleTeacherPayoutMutation,
  useTeacherPayoutsQuery,
} from '../hooks/finance.hook';
import {
  useActiveTeachersQuery,
  useCoursesListQuery,
} from '@/features/courses/hooks/courses.hook';
import { PAYMENT_STATUS_FILTERS } from '../finance.constant';
import {
  CreditCard,
  Wallet,
  Share2,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  IndianRupee,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 3 FINANCIAL FORMS
// ----------------------------------------------------------------------------

const requestRedemptionSchema = z.object({
  amount: z.coerce
    .number()
    .min(100, 'Minimum UPI redemption is ₹100.00')
    .max(100000, 'Maximum single redemption is ₹1,00,000.00'),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, 'Enter a valid UPI ID (e.g. sarah@okaxis)'),
});
type RequestRedemptionValues = z.infer<typeof requestRedemptionSchema>;

const generatePayoutSchema = z.object({
  teacherId: z.string().uuid('Select an assigned teacher'),
  courseId: z.string().uuid('Select a course'),
  periodStart: z.string().min(10, 'Start date required (YYYY-MM-DD)'),
  periodEnd: z.string().min(10, 'End date required (YYYY-MM-DD)'),
  adjustments: z.coerce.number().default(0),
  notes: z.string().trim().max(255).optional(),
});
type GeneratePayoutValues = z.infer<typeof generatePayoutSchema>;

// ============================================================================
// 1. ADMIN PAYMENTS, REFUNDS & TEACHER REVENUE-SHARE PAYOUTS VIEW (/admin/payments)
// ============================================================================

export function AdminPaymentsAndPayoutsView() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = usePaymentsListQuery(statusFilter ? { status: statusFilter } : undefined);

  const { data: payouts = [], isLoading: payoutsLoading } = useTeacherPayoutsQuery();
  const { data: teachers = [] } = useActiveTeachersQuery();
  const { data: coursesData } = useCoursesListQuery();

  const refundMutation = useRefundTransactionMutation();
  const generatePayoutMutation = useGenerateTeacherPayoutMutation();
  const settlePayoutMutation = useSettleTeacherPayoutMutation();

  const [refundReasonMap, setRefundReasonMap] = useState<Record<string, string>>({});
  const [payoutRefMap, setPayoutRefMap] = useState<Record<string, string>>({});

  const payoutForm = useForm<GeneratePayoutValues>({
    resolver: zodResolver(generatePayoutSchema),
    defaultValues: {
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      adjustments: 0,
      notes: 'Monthly Revenue-Share Settlement',
    },
  });

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Finance & Payout Admin"
      operatorSubtitle="Append-Only Financial Ledger"
      headerTitle="Payments, Refunds & Teacher Revenue-Share Payouts"
    >
      <div className="space-y-6">
        {/* Section A: Platform Payment Transactions & Audited Refund Reversal */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" /> 1. Verified Payment Transactions (`GET /api/v1/payments`)
              </h2>
              <p className="text-xs text-slate-500">
                All full and installment captures from Razorpay and Wallet debits. Refunds preserve immutable history and write an audit log.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                {PAYMENT_STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void refetchPayments()}
                className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {paymentsLoading && (
            <p className="text-xs text-slate-500">Loading payment transactions from MySQL...</p>
          )}

          {paymentsData && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Course / Installment</th>
                    <th className="py-2.5 px-3">Provider & Ref</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Audited Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {paymentsData.items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 px-3">
                        <p className="font-bold">{tx.studentName}</p>
                        <p className="text-[11px] text-slate-500">{tx.studentEmail}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold">
                          {tx.courseCode} — {tx.courseTitle}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Installment #{tx.installmentSequenceNumber ?? 1}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {tx.provider} • {tx.providerPaymentId || tx.idempotencyKey}
                      </td>
                      <td className="py-3 px-3 font-bold">₹{tx.amount}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.status === 'CAPTURED'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : tx.status === 'REFUNDED'
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {tx.status === 'CAPTURED' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="text"
                              placeholder="Refund reason..."
                              value={refundReasonMap[tx.id] || ''}
                              onChange={(e) =>
                                setRefundReasonMap((prev) => ({
                                  ...prev,
                                  [tx.id]: e.target.value,
                                }))
                              }
                              className="w-32 px-2 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                refundMutation.mutate({
                                  transactionId: tx.id,
                                  reason:
                                    refundReasonMap[tx.id] || 'Admin approved course refund',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 text-white flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" /> Refund
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section B: Teacher Revenue-Share Payout Generator & Settlement (C-029) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-cyan-500" /> 2. Generate Teacher Revenue-Share Payout Statement (`POST /api/v1/teacher-payouts/generate`)
          </h2>
          <p className="text-xs text-slate-500">
            Automatically aggregates verified `CAPTURED` course collections for the selected course and multiplies by the teacher&apos;s assigned `revenueSharePercent` (`C-029`).
          </p>

          <form
            onSubmit={payoutForm.handleSubmit((vals) => generatePayoutMutation.mutate(vals))}
            className="grid grid-cols-1 md:grid-cols-5 gap-3"
          >
            <select
              {...payoutForm.register('teacherId')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>

            <select
              {...payoutForm.register('courseId')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Assigned Course</option>
              {coursesData?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <input
              type="date"
              {...payoutForm.register('periodStart')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />

            <input
              type="date"
              {...payoutForm.register('periodEnd')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />

            <button
              type="submit"
              disabled={generatePayoutMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-emerald-500"
            >
              {generatePayoutMutation.isPending ? 'Computing...' : 'Compute & Issue Statement'}
            </button>
          </form>

          {payoutsLoading && <p className="text-xs text-slate-500">Loading teacher payouts...</p>}
          {payouts.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <p className="font-bold">
                      {p.teacherName} ({p.teacherEmail}) • Period: {p.periodStart} to {p.periodEnd}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verified Course Collections: ₹{p.grossCourseCollections} ×{' '}
                      {p.revenueSharePercentSnapshot}% Share ={' '}
                      <strong className="text-emerald-500">Net ₹{p.netPayoutAmount}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400">
                      {p.status}
                    </span>
                    {p.status !== 'PAID' && (
                      <>
                        <input
                          type="text"
                          placeholder="UTR / Bank Ref"
                          value={payoutRefMap[p.id] || ''}
                          onChange={(e) =>
                            setPayoutRefMap((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-32 px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            settlePayoutMutation.mutate({
                              payoutId: p.id,
                              status: 'PAID',
                              paymentReference: payoutRefMap[p.id] || `UTR-${Date.now()}`,
                            })
                          }
                          className="px-3 py-1 rounded-lg font-bold bg-emerald-600 text-white"
                        >
                          Mark Paid
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. ADMIN WALLETS & UPI REDEMPTION APPROVAL / REJECTION VIEW (/admin/wallets)
// ============================================================================

export function AdminWalletsAndRedemptionsView() {
  const { data: wallets = [], isLoading: walletsLoading } = useAdminAllWalletsQuery();
  const { data: redemptions = [], isLoading: redemptionsLoading } = useRedemptionsListQuery();
  const reviewMutation = useReviewUpiRedemptionMutation();

  const [utrInputMap, setUtrInputMap] = useState<Record<string, string>>({});
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Wallet & UPI Treasury Admin"
      operatorSubtitle="Append-Only Ledger & Reservation Control"
      headerTitle="Platform Wallets & UPI Redemption Approvals"
    >
      <div className="space-y-6">
        {/* UPI Redemption Approval / Rejection Queue (C-028) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-500" /> 1. UPI Redemption Requests (`GET/PATCH /api/v1/wallets/redemptions`)
            </h2>
            <p className="text-xs text-slate-500">
              Funds were atomically reserved from the student&apos;s `availableBalance` at request time. Approving marks `PAID` with your UTR reference; Rejecting writes an append-only `REDEMPTION_REVERSAL` credit entry restoring `availableBalance`.
            </p>
          </div>

          {redemptionsLoading && <p className="text-xs text-slate-500">Loading redemption queue...</p>}
          <div className="space-y-3">
            {redemptions.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div>
                  <p className="font-bold">
                    {req.userFullName} ({req.userEmail}) —{' '}
                    <span className="text-emerald-500 font-extrabold">₹{req.amount}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Masked UPI Handle: <strong className="font-mono">{req.upiIdMasked}</strong> •
                    Requested: {req.requestedAt}
                  </p>
                  {req.payoutReference && (
                    <p className="text-[11px] text-emerald-500 mt-0.5">
                      Payout Reference: {req.payoutReference}
                    </p>
                  )}
                  {req.rejectionReason && (
                    <p className="text-[11px] text-rose-500 mt-0.5">
                      Rejected & Reversed: {req.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
                    {req.status}
                  </span>

                  {(req.status === 'REQUESTED' || req.status === 'UNDER_REVIEW') && (
                    <>
                      <input
                        type="text"
                        placeholder="UPI UTR Ref..."
                        value={utrInputMap[req.id] || ''}
                        onChange={(e) =>
                          setUtrInputMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-28 px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          reviewMutation.mutate({
                            redemptionId: req.id,
                            decision: 'PAID',
                            payoutReference: utrInputMap[req.id] || `UPI-UTR-${Date.now()}`,
                          })
                        }
                        className="px-3 py-1 rounded-lg font-bold bg-emerald-600 text-white flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Pay
                      </button>

                      <input
                        type="text"
                        placeholder="Reject reason..."
                        value={rejectReasonMap[req.id] || ''}
                        onChange={(e) =>
                          setRejectReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-28 px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          reviewMutation.mutate({
                            redemptionId: req.id,
                            decision: 'REJECTED',
                            rejectionReason:
                              rejectReasonMap[req.id] || 'Invalid UPI handle verification',
                          })
                        }
                        className="px-3 py-1 rounded-lg font-bold bg-rose-600 text-white flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject & Reverse
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Platform Wallets Overview */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-violet-500" /> 2. Platform Wallets Directory (`GET /api/v1/wallets/admin/all`)
          </h2>
          {walletsLoading && <p className="text-xs text-slate-500">Loading wallets...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Available Balance</th>
                  <th className="py-2 px-3">Reserved for UPI</th>
                  <th className="py-2 px-3">Ledger Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {wallets.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 px-3">
                      <span className="font-bold">{w.userFullName}</span> ({w.userEmail})
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-500">
                      ₹{w.availableBalance}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-amber-500">
                      ₹{w.reservedBalance}
                    </td>
                    <td className="py-2.5 px-3">{w.transactionCount} entries</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. ADMIN & STUDENT REFERRALS VIEW (/admin/referrals & /student/referrals)
// ============================================================================

export function RoleReferralsView({ role }: { role: 'ADMIN' | 'STUDENT' }) {
  const { data, isLoading } = useReferralsListQuery();

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Referral Program`}
      operatorSubtitle="1st-Paid-Enrollment Reward Policy"
      headerTitle="Referral Attribution & Reward Ledger"
    >
      <div className="space-y-6">
        {role === 'STUDENT' && data?.myReferralCode && (
          <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Your Unique Student Referral Code
              </p>
              <p className="text-2xl font-mono font-extrabold mt-1">{data.myReferralCode}</p>
              <p className="text-xs text-slate-500 mt-1">
                When a referred student completes their 1st verified course payment, your wallet is automatically credited once (`C-005`, `C-028`).
              </p>
            </div>
            <Share2 className="w-8 h-8 text-violet-400" />
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-3">
            Referral Attribution & Qualification Records (`GET /api/v1/referrals`)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading referrals from MySQL...</p>}
          {data && data.items.length === 0 && (
            <p className="text-xs text-slate-500">No referral attributions recorded yet.</p>
          )}
          {data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3">Referrer</th>
                    <th className="py-2 px-3">Referred Student</th>
                    <th className="py-2 px-3">Code Used</th>
                    <th className="py-2 px-3">Reward Snapshot</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3 font-semibold">{r.referrerName}</td>
                      <td className="py-2.5 px-3">
                        {r.referredName} ({r.referredEmail})
                      </td>
                      <td className="py-2.5 px-3 font-mono">{r.codeUsed}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-500">
                        ₹{r.rewardAmountSnapshot}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. STUDENT WALLET, APPEND-ONLY LEDGER & UPI REDEMPTION VIEW (/student/wallet & /student/redeem-wallet)
// ============================================================================

export function StudentWalletAndRedemptionView() {
  const { data: wallet, isLoading } = useMyWalletQuery();
  const requestRedemptionMutation = useRequestUpiRedemptionMutation();

  const form = useForm<RequestRedemptionValues>({
    resolver: zodResolver(requestRedemptionSchema),
    defaultValues: {
      amount: 200,
      upiId: 'sarah@okaxis',
    },
  });

  const onSubmit = (vals: RequestRedemptionValues) => {
    requestRedemptionMutation.mutate(
      {
        amount: vals.amount,
        upiId: vals.upiId,
        idempotencyKey: `upi_req_${Date.now()}`,
      },
      {
        onSuccess: () => form.reset(),
      }
    );
  };

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Student Wallet & UPI Redemption"
      operatorSubtitle="Append-Only Ledger & Atomic Reservation"
      headerTitle="My Wallet, Ledger Reconciliation & UPI Redemption"
    >
      {isLoading && <p className="text-xs text-slate-500">Loading wallet ledger from MySQL...</p>}
      {wallet && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#131127] p-5">
              <p className="text-xs text-slate-500">Available to Spend / Redeem</p>
              <p className="text-2xl font-extrabold text-emerald-500 mt-1">
                ₹{wallet.availableBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-white dark:bg-[#131127] p-5">
              <p className="text-xs text-slate-500">Reserved in Pending UPI Requests</p>
              <p className="text-2xl font-extrabold text-amber-500 mt-1">
                ₹{wallet.reservedBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-white dark:bg-[#131127] p-5">
              <p className="text-xs text-slate-500">Reconciled Posted Ledger Net</p>
              <p className="text-2xl font-extrabold text-cyan-500 mt-1">
                ₹{wallet.reconciledLedgerBalance}
              </p>
            </div>
          </div>

          {/* Request UPI Redemption Form */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-4">
            <h2 className="text-sm font-bold">
              Request UPI Wallet Redemption (`POST /api/v1/wallets/redemptions`)
            </h2>
            <p className="text-xs text-slate-500">
              Your UPI ID is encrypted at rest with AES-256-GCM and masked in all tables. Submitting immediately reserves the amount from your available balance so it cannot be double-spent (`C-028`).
            </p>

            {requestRedemptionMutation.isError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {(requestRedemptionMutation.error as { message?: string })?.message ||
                  'Failed to submit redemption request.'}
              </div>
            )}

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount INR (Min ₹100)"
                  {...form.register('amount')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                {form.formState.errors.amount && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="UPI ID (e.g. sarah@okaxis)"
                  {...form.register('upiId')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                {form.formState.errors.upiId && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    {form.formState.errors.upiId.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={requestRedemptionMutation.isPending}
                className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
              >
                {requestRedemptionMutation.isPending
                  ? 'Reserving Funds...'
                  : 'Reserve Funds & Request UPI Payout'}
              </button>
            </form>
          </div>

          {/* Append-Only Wallet Transaction Ledger */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
            <h2 className="text-sm font-bold mb-3">
              Append-Only Wallet Ledger (`wallet_transactions`)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Direction & Amount</th>
                    <th className="py-2 px-3">Balance After</th>
                    <th className="py-2 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {wallet.transactions.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {entry.transactionType}
                      </td>
                      <td className="py-2.5 px-3">{entry.description}</td>
                      <td
                        className={`py-2.5 px-3 font-bold ${
                          entry.direction === 'CREDIT' ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {entry.direction === 'CREDIT' ? '+' : '-'}₹{entry.amount}
                      </td>
                      <td className="py-2.5 px-3 font-mono">₹{entry.balanceAfter}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {entry.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RolePanelShell>
  );
}

// ============================================================================
// 5. STUDENT PAYMENT HISTORY VIEW (/student/payment-history)
// ============================================================================

export function StudentPaymentHistoryView() {
  const { data, isLoading } = usePaymentsListQuery();

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Student Billing & Receipts"
      operatorSubtitle="Scoped to Own Student ID"
      headerTitle="My Course Payment History & Receipts"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
        <h2 className="text-sm font-bold mb-3">
          Verified Course & Installment Payments (`GET /api/v1/payments`)
        </h2>
        {isLoading && <p className="text-xs text-slate-500">Loading payment history...</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Course</th>
                  <th className="py-2 px-3">Installment</th>
                  <th className="py-2 px-3">Provider & Ref</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {data.items.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 px-3 font-bold">
                      {tx.courseCode} — {tx.courseTitle}
                    </td>
                    <td className="py-2.5 px-3">
                      Installment #{tx.installmentSequenceNumber ?? 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {tx.provider} • {tx.providerPaymentId || tx.receiptNumber || tx.idempotencyKey}
                    </td>
                    <td className="py-2.5 px-3 font-bold">₹{tx.amount}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 6. TEACHER REVENUE-SHARE PAYOUT HISTORY VIEW (/teacher/payouts)
// ============================================================================

export function TeacherPayoutHistoryView() {
  const { data: payouts = [], isLoading } = useTeacherPayoutsQuery();

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Faculty Compensation"
      operatorSubtitle="Scoped to Own Teacher ID (C-014, C-029)"
      headerTitle="My Revenue-Share Payout Statements"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
        <h2 className="text-sm font-bold mb-1">
          Revenue-Share Payout Statements (`GET /api/v1/teacher-payouts`)
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Teachers see strictly their own payout statements calculated from verified collections on assigned courses (`C-014`, `C-029`).
        </p>

        {isLoading && <p className="text-xs text-slate-500">Loading payout statements...</p>}
        {payouts.length === 0 && !isLoading && (
          <p className="text-xs text-slate-500">No payout statements generated yet.</p>
        )}

        <div className="space-y-3">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
            >
              <div>
                <p className="font-bold">
                  Period: {p.periodStart} to {p.periodEnd}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gross Verified Course Collections: ₹{p.grossCourseCollections} ×{' '}
                  {p.revenueSharePercentSnapshot}% Revenue Share
                </p>
                {p.notes && <p className="text-[11px] text-slate-400 mt-0.5">{p.notes}</p>}
              </div>

              <div className="text-right">
                <p className="text-base font-extrabold text-indigo-400">
                  Net ₹{p.netPayoutAmount}
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                  {p.status} {p.paymentReference ? `• ${p.paymentReference}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RolePanelShell>
  );
}
