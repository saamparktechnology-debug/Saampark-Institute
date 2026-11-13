'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useActiveTeachersQuery,
  useCoursesListQuery,
  useEnrollmentsListQuery,
} from '@/features/courses/hooks/courses.hook';
import { useSendInstallmentRemindersMutation } from '@/features/system/hooks/system.hook';
import {
  AdminWalletSummaryItem,
  PaymentTransactionItem,
  ReferralSummaryData,
} from '../types/finance.types';
import {
  useAllWalletsAdminQuery,
  useCreateRedemptionMutation,
  useExtendInstallmentScheduleMutation,
  useGenerateTeacherPayoutMutation,
  useMyWalletQuery,
  usePaymentsListQuery,
  useRedemptionsListQuery,
  useReferralsQuery,
  useRefundPaymentMutation,
  useReviewRedemptionMutation,
  useTeacherPayoutsQuery,
  useUpdatePaymentGstDetailsMutation,
  useUpdateTeacherPayoutStatusMutation,
} from '../hooks/finance.hook';
import {
  CreditCard,
  Wallet,
  Gift,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  RotateCcw,
  FileText,
  Copy,
  Check,
  Share2,
  Mail,
  ExternalLink,
  Printer,
} from 'lucide-react';

const INDIAN_STATES = [
  'West Bengal',
  'Maharashtra',
  'Karnataka',
  'Delhi',
  'Tamil Nadu',
  'Telangana',
  'Gujarat',
  'Uttar Pradesh',
  'Rajasthan',
  'Kerala',
  'Haryana',
  'Punjab',
  'Bihar',
  'Odisha',
  'Assam',
  'Madhya Pradesh',
];

const requestRedemptionSchema = z.object({
  amount: z.coerce.number().min(100, 'Minimum UPI redemption is ₹100').max(100000),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, 'Enter a valid UPI ID (e.g. student@okaxis)'),
});
type RequestRedemptionValues = z.infer<typeof requestRedemptionSchema>;

const generatePayoutSchema = z.object({
  teacherId: z.string().uuid('Select a teacher'),
  courseId: z.string().uuid('Select a course'),
  periodStart: z.string().min(10),
  periodEnd: z.string().min(10),
  tdsPercent: z.coerce.number().min(0).max(50).default(10),
  adjustments: z.coerce.number().default(0),
  notes: z.string().optional(),
});
type GeneratePayoutValues = z.infer<typeof generatePayoutSchema>;

// ============================================================================
// STANDALONE A4 PORTRAIT GST TAX INVOICE / CREDIT NOTE PRINT ENGINE
// Prints ONLY the isolated Tax Invoice inside a dedicated print iframe (1 sheet)
// Never prints the browser screen, sidebar, or background tables.
// ============================================================================

export function printGstTaxInvoiceDocument(tx: PaymentTransactionItem): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const gst = tx.gstInvoice;
  const invoiceNumber = tx.receiptNumber || tx.providerPaymentId || tx.id.slice(0, 10).toUpperCase();
  const issueDate = new Date(tx.verifiedAt || tx.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const sacCode = gst?.sacCode || '999293';
  const supplierGstin = gst?.instituteGstin || '19AABCS1429B1Z1';
  const supplierState = gst?.instituteState || 'West Bengal';
  const placeOfSupply = gst?.placeOfSupplyState || 'West Bengal';
  const customerGstin = gst?.customerGstin || 'Unregistered / B2C Student';
  const taxableValue = gst?.taxableValueInr || tx.amount;
  const cgstAmount = gst?.cgstAmountInr || '0.00';
  const sgstAmount = gst?.sgstAmountInr || '0.00';
  const igstAmount = gst?.igstAmountInr || '0.00';
  const totalGst = gst?.totalGstAmountInr || '0.00';
  const isIntraState = gst ? gst.isIntraState : supplierState === placeOfSupply;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GST Tax Invoice — ${invoiceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.5;
    }
    .invoice-sheet {
      border: 2px solid #0f172a;
      border-radius: 10px;
      padding: 24px 28px;
      max-width: 100%;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 3px;
    }
    .doc-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      background: #ecfdf5;
      border: 1px solid #10b981;
      color: #047857;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .credit-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 8px;
      border-radius: 6px;
      background: #fef2f2;
      border: 1px solid #ef4444;
      color: #b91c1c;
      font-weight: 700;
      font-size: 10px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .meta-box h4 {
      margin: 0 0 6px 0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
    }
    .meta-box p {
      margin: 2px 0;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
      padding: 9px 10px;
      border: 1px solid #0f172a;
    }
    td {
      padding: 10px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
      vertical-align: top;
    }
    .num {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .summary-row td {
      background: #f1f5f9;
      font-weight: 700;
    }
    .grand-total td {
      background: #ecfdf5;
      font-weight: 800;
      font-size: 13px;
      color: #065f46;
    }
    .footer-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #94a3b8;
      font-size: 11px;
      color: #475569;
    }
    .sig-box {
      text-align: right;
    }
    .sig-line {
      border-top: 1px solid #0f172a;
      padding-top: 4px;
      margin-top: 28px;
      font-weight: 700;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="invoice-sheet">
    <div class="header-row">
      <div>
        <h1 class="brand-title">SAAMPARK INSTITUTE — GEMINI ARGON LMS</h1>
        <div class="brand-sub">Commercial Training &amp; Coaching Services • SAC Code: ${sacCode}</div>
        <div class="brand-sub">Supplier GSTIN: <strong>${supplierGstin}</strong> • State: <strong>${supplierState}</strong></div>
      </div>
      <div style="text-align: right;">
        <span class="doc-badge">${tx.creditNoteNumber ? 'GST Credit Note & Tax Invoice' : 'Original GST Tax Invoice'}</span>
        <div style="margin-top: 6px; font-weight: 800; font-size: 14px;">Invoice #${invoiceNumber}</div>
        <div style="font-size: 11px; color: #475569;">Date: ${issueDate} • Status: ${tx.status}</div>
        ${tx.creditNoteNumber ? `<div class="credit-badge">Credit Note: ${tx.creditNoteNumber}</div>` : ''}
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed To (Student / Recipient)</h4>
        <p><strong>${tx.studentName}</strong></p>
        <p>Email: ${tx.studentEmail}</p>
        <p>Recipient GSTIN: <strong>${customerGstin}</strong></p>
        <p>Place of Supply: <strong>${placeOfSupply}</strong></p>
      </div>
      <div class="meta-box">
        <h4>Payment &amp; Course Enrollment Metadata</h4>
        <p>Course: <strong>${tx.courseCode} — ${tx.courseTitle}</strong></p>
        <p>Installment Sequence: <strong>Installment #${tx.installmentSequenceNumber ?? 1}</strong></p>
        <p>Payment Gateway: <strong>${tx.provider}</strong> (${tx.providerPaymentId || 'Verified'})</p>
        <p>Tax Regime: <strong>${isIntraState ? 'Intra-State (CGST 9% + SGST 9%)' : 'Inter-State (IGST 18%)'}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 34%;">Description of Educational Service</th>
          <th style="width: 10%;">SAC</th>
          <th class="num" style="width: 14%;">Taxable Value</th>
          <th class="num" style="width: 13%;">CGST (9%)</th>
          <th class="num" style="width: 13%;">SGST (9%)</th>
          <th class="num" style="width: 16%;">IGST (18%)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${tx.courseCode} — ${tx.courseTitle}</strong><br />
            <span style="font-size: 11px; color: #475569;">Course Fee Installment #${tx.installmentSequenceNumber ?? 1}</span>
          </td>
          <td class="num" style="text-align: left;">${sacCode}</td>
          <td class="num">₹${taxableValue}</td>
          <td class="num">₹${cgstAmount}</td>
          <td class="num">₹${sgstAmount}</td>
          <td class="num">₹${igstAmount}</td>
        </tr>
        <tr class="summary-row">
          <td colspan="2">Total GST Component (18% under SAC ${sacCode})</td>
          <td class="num">₹${taxableValue}</td>
          <td class="num" colspan="3">Total GST: ₹${totalGst}</td>
        </tr>
        <tr class="grand-total">
          <td colspan="3">Total Invoice Amount Paid (Inclusive of 18% GST)</td>
          <td class="num" colspan="3">₹${tx.amount} ${tx.currency || 'INR'}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-grid">
      <div>
        <div><strong>Statutory Declaration:</strong></div>
        <div>1. Tax payable under Reverse Charge: <strong>No</strong>.</div>
        <div>2. Digitally verified receipt generated by Saampark Institute LMS Billing Engine.</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">Authorized Signatory • Saampark Institute</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    }, 250);
  }
}

// ============================================================================
// SHARED STUDENT REFERRAL CODE & DIRECT SIGNUP URL SHARE WIDGET
// ============================================================================

function StudentReferralShareCard({
  referralCode,
}: {
  referralCode: string;
}) {
  const [origin, setOrigin] = useState<string>('https://lms.saampark.edu.in');
  const [copiedType, setCopiedType] = useState<'CODE' | 'URL' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const referralUrl = `${origin}/student/login?tab=REGISTER&ref=${encodeURIComponent(referralCode)}`;
  const shareMessage = `Join me on Saampark Institute (Gemini Argon LMS)! Register using my referral link to get started, or enter code ${referralCode} during signup: ${referralUrl}`;
  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const emailShareHref = `mailto:?subject=${encodeURIComponent(
    `Invitation to join Saampark Institute LMS (Referral Code: ${referralCode})`
  )}&body=${encodeURIComponent(shareMessage)}`;

  const copyText = (text: string, type: 'CODE' | 'URL') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-950/30 via-slate-900/60 to-cyan-950/30 p-6 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Gift className="w-3.5 h-3.5" /> Earn Wallet Rewards on Friend’s 1st Verified Payment
          </span>
          <h2 className="text-base font-extrabold mt-2">
            Invite Friends with Your Direct Referral Registration Link
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            When your friend opens your referral link below, it automatically redirects them to the Student Sign-Up screen with your referral code pre-applied.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 flex items-center gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Your Referral Code
            </p>
            <p className="text-lg font-mono font-extrabold text-cyan-400">{referralCode}</p>
          </div>
          <button
            type="button"
            onClick={() => copyText(referralCode, 'CODE')}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copiedType === 'CODE' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Code
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Direct Shareable Referral URL Box */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-300">
          Direct Student Registration Referral URL (Auto-Fills Code on `/student/login`)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            value={referralUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-950 text-emerald-300 border border-slate-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => copyText(referralUrl, 'URL')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-600 hover:opacity-95 text-white flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow"
          >
            {copiedType === 'URL' ? (
              <>
                <Check className="w-4 h-4" /> ✓ Referral Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Referral URL
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1-Click Social / Direct Share Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={whatsappShareHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> Share via WhatsApp
          </a>
          <a
            href={emailShareHref}
            className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 transition"
          >
            <Mail className="w-3.5 h-3.5" /> Invite Friend via Email
          </a>
          <a
            href={`/student/login?tab=REGISTER&ref=${encodeURIComponent(referralCode)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 inline-flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> Test Direct Referral Link
          </a>
        </div>
        <span className="text-[11px] text-slate-400">
          Reward credits automatically when your referred friend completes their 1st course installment.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 1. ADMIN PAYMENTS, CREDIT NOTES & TEACHER SECTION 194J TDS PAYOUTS (/admin/payments)
// ============================================================================

export function AdminPaymentsAndPayoutsView() {
  const { data: paymentsData, isLoading: paymentsLoading, refetch } = usePaymentsListQuery();
  const { data: payouts = [], isLoading: payoutsLoading } = useTeacherPayoutsQuery();
  const { data: teachers = [] } = useActiveTeachersQuery();
  const { data: coursesData } = useCoursesListQuery();

  const { data: allEnrollments = [] } = useEnrollmentsListQuery();
  const refundMutation = useRefundPaymentMutation();
  const generatePayoutMutation = useGenerateTeacherPayoutMutation();
  const settlePayoutMutation = useUpdateTeacherPayoutStatusMutation();
  const extendScheduleMutation = useExtendInstallmentScheduleMutation();

  const [refundReason, setRefundReason] = useState('Admin verified refund request');
  const [moratoriumEnrollmentId, setMoratoriumEnrollmentId] = useState('');
  const [moratoriumDays, setMoratoriumDays] = useState(7);
  const [moratoriumReason, setMoratoriumReason] = useState('Medical / Academic moratorium approved by Admin');
  const sendRemindersMutation = useSendInstallmentRemindersMutation();

  const payoutForm = useForm<GeneratePayoutValues>({
    resolver: zodResolver(generatePayoutSchema),
    defaultValues: {
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      tdsPercent: 10,
      adjustments: 0,
      notes: 'Monthly revenue-share payout batch',
    },
  });

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Finance, GST & TDS Admin"
      operatorSubtitle="SAC 999293 GST, Credit Notes & Sec 194J TDS"
      headerTitle="GST Tax Invoices, Sequential Credit Notes & Section 194J Teacher Payouts"
    >
      <div className="space-y-6">
        {/* Generate Teacher Revenue-Share Payout Batch with Section 194J 10% TDS */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-500" /> Generate Teacher Revenue-Share Payout with Section 194J TDS (`POST /api/v1/teacher-payouts/generate`)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Computes Gross Teacher Share (`Gross Collections × Share %`), deducts Section 194J TDS (default 10% for technical/professional services), and outputs Net Disbursable Payout.
            </p>
          </div>
          <form
            onSubmit={payoutForm.handleSubmit((vals) =>
              generatePayoutMutation.mutate(vals)
            )}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
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
              <option value="">Select Course</option>
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

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 shrink-0">194J TDS %:</span>
              <input
                type="number"
                step="0.5"
                {...payoutForm.register('tdsPercent')}
                className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={generatePayoutMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
            >
              {generatePayoutMutation.isPending ? 'Calculating...' : 'Generate Payout'}
            </button>
          </form>

          {!payoutsLoading && payouts.length > 0 && (
            <div className="overflow-x-auto pt-3 border-t border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 px-3">Teacher</th>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3">Gross Collections</th>
                    <th className="py-2 px-3">Gross Share</th>
                    <th className="py-2 px-3">Sec 194J TDS</th>
                    <th className="py-2 px-3">Net Disbursable</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-semibold">{p.teacherName}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {p.periodStart} → {p.periodEnd}
                      </td>
                      <td className="py-2 px-3 font-mono">₹{p.grossCourseCollections}</td>
                      <td className="py-2 px-3 font-mono">
                        ₹{p.grossPayoutAmount} ({p.revenueSharePercentSnapshot}%)
                      </td>
                      <td className="py-2 px-3 font-mono text-amber-400">
                        -₹{p.tdsAmount || '0.00'} ({p.tdsPercent || '10.00'}%)
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                        ₹{p.netPayoutAmount}
                      </td>
                      <td className="py-2 px-3">{p.status}</td>
                      <td className="py-2 px-3 text-right">
                        {p.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() =>
                              settlePayoutMutation.mutate({
                                payoutId: p.id,
                                status: 'PAID',
                                paymentReference: `NEFT-${Date.now().toString().slice(-6)}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Mark Settled (PAID)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Installment Moratorium / Schedule Extension & Overdue Auto-Unlock (`POST /api/v1/enrollments/:id/extend-schedule`) */}
        <div className="rounded-2xl border border-indigo-500/30 bg-white dark:bg-[#111827] p-6 space-y-3">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400" /> Academic / Medical Moratorium &amp; Installment Schedule Extension (`POST /api/v1/enrollments/:id/extend-schedule`)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Shifts unpaid (`PENDING` or `OVERDUE`) installment `dueAt` and `graceEndsAt` dates forward by 1–90 days and automatically unlocks `SUSPENDED_OVERDUE` students.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={moratoriumEnrollmentId}
              onChange={(e) => setMoratoriumEnrollmentId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Student Enrollment</option>
              {allEnrollments.map((enr) => (
                <option key={enr.id} value={enr.id}>
                  {enr.studentFullName} — {enr.courseCode} ({enr.status})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 shrink-0">Extend Days:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={moratoriumDays}
                onChange={(e) => setMoratoriumDays(Math.max(1, Math.min(90, Number(e.target.value) || 7)))}
                className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
              />
            </div>

            <input
              type="text"
              value={moratoriumReason}
              onChange={(e) => setMoratoriumReason(e.target.value)}
              placeholder="Mandatory audit reason (min 5 chars)"
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />

            <button
              type="button"
              disabled={!moratoriumEnrollmentId || extendScheduleMutation.isPending || moratoriumReason.trim().length < 5}
              onClick={() =>
                extendScheduleMutation.mutate({
                  enrollmentId: moratoriumEnrollmentId,
                  extensionDays: moratoriumDays,
                  reason: moratoriumReason.trim(),
                })
              }
              className="py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white cursor-pointer"
            >
              {extendScheduleMutation.isPending
                ? 'Shifting Schedule...'
                : `Extend Schedule (+${moratoriumDays}d) & Unlock`}
            </button>
          </div>
          {extendScheduleMutation.isSuccess && (
            <p className="text-xs font-semibold text-emerald-400">
              ✓ Installment schedule shifted forward by +{moratoriumDays} day(s) and student notified via Email &amp; WhatsApp.
            </p>
          )}
        </div>

        {/* Platform Payment Transactions, GST Invoices & Sequential Credit Notes */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" /> Payment Transactions, GST Split (SAC 999293) & Refund Credit Notes (`GET /api/v1/payments`)
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Audit reason for Credit Note & refund"
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              <button
                type="button"
                disabled={sendRemindersMutation.isPending}
                onClick={() => sendRemindersMutation.mutate()}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
              >
                {sendRemindersMutation.isPending
                  ? 'Sending Reminders...'
                  : '📲 Send WhatsApp + Email Due Reminders'}
              </button>
              <button
                type="button"
                onClick={() => void refetch()}
                className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {paymentsLoading && <p className="text-xs text-slate-500">Loading payment ledger...</p>}
          {paymentsData && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3">Student</th>
                    <th className="py-2 px-3">Invoice / Credit Note</th>
                    <th className="py-2 px-3">Course / Inst #</th>
                    <th className="py-2 px-3">Taxable + 18% GST</th>
                    <th className="py-2 px-3">Total (INR)</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Invoice PDF / Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {paymentsData.items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 px-3 font-semibold">
                        {tx.studentName}{' '}
                        <span className="text-slate-500 font-normal">({tx.studentEmail})</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <span className="text-cyan-400 font-bold">
                          {tx.receiptNumber || 'INV'}
                        </span>
                        {tx.creditNoteNumber && (
                          <span className="block text-rose-400 font-bold">
                            Credit Note: {tx.creditNoteNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {tx.courseCode} (Inst #{tx.installmentSequenceNumber ?? 1})
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {tx.gstInvoice ? (
                          <>
                            Base ₹{tx.gstInvoice.taxableValueInr} + GST ₹
                            {tx.gstInvoice.totalGstAmountInr} (
                            {tx.gstInvoice.isIntraState ? 'CGST+SGST' : 'IGST'})
                          </>
                        ) : (
                          '18% GST Incl.'
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">₹{tx.amount}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            tx.status === 'CAPTURED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => printGstTaxInvoiceDocument(tx)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" /> Print Invoice
                          </button>
                          {tx.status === 'CAPTURED' ? (
                            <button
                              type="button"
                              onClick={() =>
                                refundMutation.mutate({
                                  transactionId: tx.id,
                                  reason: refundReason,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Refund
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-rose-400">
                              {tx.creditNoteNumber || 'Reversed'}
                            </span>
                          )}
                        </div>
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
// 2. ADMIN WALLETS & UPI REDEMPTION APPROVAL QUEUE (/admin/wallets)
// ============================================================================

export function AdminWalletsAndRedemptionsView() {
  const { data: wallets = [], isLoading: walletsLoading } = useAllWalletsAdminQuery();
  const { data: redemptions = [], isLoading: redemptionsLoading } = useRedemptionsListQuery();
  const reviewMutation = useReviewRedemptionMutation();

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Wallet & UPI Treasury Admin"
      operatorSubtitle="Append-Only Ledger & AES-256-GCM UPI"
      headerTitle="Platform Wallets & UPI Redemption Approval Queue"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> UPI Redemption Requests (`GET/PATCH /api/v1/wallets/redemptions`)
          </h2>
          {redemptionsLoading && <p className="text-xs text-slate-500">Loading UPI redemptions...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Student</th>
                  <th className="py-2 px-3">Masked UPI Handle</th>
                  <th className="py-2 px-3">Reserved Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Admin Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-semibold">{r.userFullName}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-400">{r.upiIdMasked}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">₹{r.amount}</td>
                    <td className="py-2.5 px-3">{r.status}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      {(r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW') && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              reviewMutation.mutate({
                                redemptionId: r.id,
                                decision: 'PAID',
                                payoutReference: `UPI-UTR-${Date.now().toString().slice(-6)}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                          >
                            Approve & Mark PAID
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reviewMutation.mutate({
                                redemptionId: r.id,
                                decision: 'REJECTED',
                                rejectionReason: 'UPI handle verification failed — funds restored',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]"
                          >
                            Reject & Reverse to Wallet
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-3">
            Platform User Wallets (`GET /api/v1/wallets/admin/all`)
          </h2>
          {walletsLoading && <p className="text-xs text-slate-500">Loading wallets...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Available Balance</th>
                  <th className="py-2 px-3">Reserved Balance</th>
                  <th className="py-2 px-3 text-right">Ledger Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {wallets.map((w: AdminWalletSummaryItem) => (
                  <tr key={w.id}>
                    <td className="py-2.5 px-3 font-semibold">
                      {w.userFullName} ({w.userEmail})
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                      ₹{w.availableBalance}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-400">
                      ₹{w.reservedBalance}
                    </td>
                    <td className="py-2.5 px-3 text-right">{w.transactionCount}</td>
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
// 3. STUDENT PAYMENT HISTORY & GST TAX INVOICE VIEW (/student/payment-history)
// ============================================================================

export function StudentPaymentHistoryView() {
  const { data, isLoading } = usePaymentsListQuery();
  const updateGstMutation = useUpdatePaymentGstDetailsMutation();

  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [gstinInput, setGstinInput] = useState<string>('');
  const [stateInput, setStateInput] = useState<string>('West Bengal');

  const selectedTx = data?.items.find((t) => t.id === selectedTxId) || null;
  const gst = selectedTx?.gstInvoice;

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Student Billing & GST Invoices"
      operatorSubtitle="SAC 999293 • 18% GST Split & Credit Notes"
      headerTitle="My Payment History, GST Tax Invoices & Credit Notes"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
          <h2 className="text-sm font-bold mb-4">
            Your Payment Transactions & Tax Invoices (`GET /api/v1/payments`)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading your payment history...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Course</th>
                  <th className="py-2 px-3">Installment #</th>
                  <th className="py-2 px-3">Tax Invoice / Credit Note</th>
                  <th className="py-2 px-3">Taxable Base + 18% GST</th>
                  <th className="py-2 px-3">Total Paid</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Tax Invoice Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {data?.items.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 px-3 font-semibold">{tx.courseTitle}</td>
                    <td className="py-2.5 px-3">#{tx.installmentSequenceNumber ?? 1}</td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className="text-cyan-400 font-bold">
                        {tx.receiptNumber || tx.providerPaymentId || 'INV'}
                      </span>
                      {tx.creditNoteNumber && (
                        <span className="block text-[10px] text-rose-400 font-bold">
                          Credit Note: {tx.creditNoteNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {tx.gstInvoice
                        ? `₹${tx.gstInvoice.taxableValueInr} + ₹${tx.gstInvoice.totalGstAmountInr} GST`
                        : '18% GST Incl.'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">₹{tx.amount}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          tx.status === 'CAPTURED'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTxId(tx.id);
                            setGstinInput(tx.gstInvoice?.customerGstin || '');
                            setStateInput(tx.gstInvoice?.placeOfSupplyState || 'West Bengal');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-violet-600 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> View GST Invoice
                        </button>
                        <button
                          type="button"
                          onClick={() => printGstTaxInvoiceDocument(tx)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print A4 PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Printable GST-Compliant Tax Invoice (SAC 999293) & Credit Note Modal */}
        {selectedTx && (
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-white dark:bg-[#111827] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <p className="text-[11px] font-mono font-bold uppercase text-emerald-400">
                  Saampark Institute — GST Tax Invoice (SAC {gst?.sacCode || '999293'})
                </p>
                <h3 className="text-base font-extrabold mt-0.5">
                  Invoice #{selectedTx.receiptNumber || selectedTx.id.slice(0, 8)}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Supplier GSTIN: {gst?.instituteGstin || '19AABCS1429B1Z1'} • State:{' '}
                  {gst?.instituteState || 'West Bengal'}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedTx.status === 'CAPTURED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {selectedTx.status} ✓
                </span>
                {selectedTx.creditNoteNumber && (
                  <p className="text-xs font-mono font-bold text-rose-400 mt-1">
                    Reversed via Credit Note: {selectedTx.creditNoteNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Optional B2B Customer GSTIN & Place of Supply State Selector */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-end justify-between gap-3 text-xs">
              <div className="flex-1 min-w-[200px]">
                <label className="block font-semibold text-slate-400 mb-1">
                  Student / Company B2B GSTIN (Optional for Input Tax Credit)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstinInput}
                  onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AAACR5055K1Z5"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div className="min-w-[180px]">
                <label className="block font-semibold text-slate-400 mb-1">
                  Place of Supply (Student State)
                </label>
                <select
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={updateGstMutation.isPending}
                onClick={() =>
                  updateGstMutation.mutate({
                    transactionId: selectedTx.id,
                    customerGstin: gstinInput.trim() || null,
                    placeOfSupplyState: stateInput,
                  })
                }
                className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white font-bold cursor-pointer"
              >
                {updateGstMutation.isPending
                  ? 'Updating Invoice...'
                  : 'Update GSTIN & State Split'}
              </button>
            </div>

            {/* GST Tax Breakdown Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3">Description & SAC Code</th>
                    <th className="py-2.5 px-3">Taxable Value</th>
                    <th className="py-2.5 px-3">CGST (9%)</th>
                    <th className="py-2.5 px-3">SGST (9%)</th>
                    <th className="py-2.5 px-3">IGST (18%)</th>
                    <th className="py-2.5 px-3 text-right">Total (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 px-3">
                      <strong>
                        {selectedTx.courseCode} — {selectedTx.courseTitle}
                      </strong>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        Installment #{selectedTx.installmentSequenceNumber ?? 1} • SAC:{' '}
                        {gst?.sacCode || '999293'} (Commercial Training/Coaching)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      ₹{gst?.taxableValueInr || selectedTx.amount}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      ₹{gst?.cgstAmountInr || '0.00'}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      ₹{gst?.sgstAmountInr || '0.00'}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      ₹{gst?.igstAmountInr || '0.00'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                      ₹{selectedTx.amount}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Tax Regime:{' '}
                <strong>
                  {gst?.isIntraState
                    ? `Intra-State (${gst.placeOfSupplyState}) — CGST 9% + SGST 9%`
                    : `Inter-State (${gst?.instituteState} → ${gst?.placeOfSupplyState}) — IGST 18%`}
                </strong>
                {gst?.customerGstin ? ` • Recipient GSTIN: ${gst.customerGstin}` : ''}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => printGstTaxInvoiceDocument(selectedTx)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save Standalone A4 Tax Invoice (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTxId('')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Close Invoice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. UNIFIED STUDENT WALLET, REFERRAL SHARE LINK & UPI REDEMPTION VIEW
// (/student/wallet & /student/redeem-wallet)
// ============================================================================

export function StudentWalletAndRedemptionView() {
  const { data: wallet, isLoading } = useMyWalletQuery();
  const { data: referralsData } = useReferralsQuery();
  const createRedemptionMutation = useCreateRedemptionMutation();

  const redemptionForm = useForm<RequestRedemptionValues>({
    resolver: zodResolver(requestRedemptionSchema),
    defaultValues: {
      amount: 100,
      upiId: 'sarah@okaxis',
    },
  });

  const myReferralCode = referralsData?.myReferralCode || 'ARGON-SARAH42';

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Wallet, Referrals & UPI Rewards"
      operatorSubtitle="Append-Only Ledger & Shareable Referral Link"
      headerTitle="My Wallet, Referral Program & UPI Redemption"
    >
      <div className="space-y-6">
        {/* 1. Shareable Referral Code & Direct Registration URL Card */}
        <StudentReferralShareCard referralCode={myReferralCode} />

        {isLoading && <p className="text-xs text-slate-500">Loading your wallet ledger...</p>}
        {wallet && (
          <>
            {/* 2. Wallet Balance KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-violet-500/30 bg-white dark:bg-[#131127] p-5">
                <p className="text-xs text-slate-500">Available Wallet Balance</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  ₹{wallet.availableBalance}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-white dark:bg-[#131127] p-5">
                <p className="text-xs text-slate-500">Reserved for Pending UPI Redemption</p>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">
                  ₹{wallet.reservedBalance}
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-500/30 bg-white dark:bg-[#131127] p-5">
                <p className="text-xs text-slate-500">Reconciled Append-Only Ledger Net</p>
                <p className="text-2xl font-extrabold text-cyan-400 mt-1">
                  ₹{wallet.reconciledLedgerBalance}
                </p>
              </div>
            </div>

            {/* 3. Request UPI Redemption Card */}
            <div className="rounded-2xl border border-violet-500/40 bg-white dark:bg-[#131127] p-6 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-violet-400" /> Request UPI Redemption (`POST /api/v1/wallets/redemptions` — AES-256-GCM Encrypted)
              </h2>
              <form
                onSubmit={redemptionForm.handleSubmit((vals) =>
                  createRedemptionMutation.mutate({
                    amount: vals.amount,
                    upiId: vals.upiId,
                    idempotencyKey: `upi_req_${Date.now()}`,
                  })
                )}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <input
                  type="number"
                  step="1"
                  placeholder="Amount INR (Min ₹100)"
                  {...redemptionForm.register('amount')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="text"
                  placeholder="UPI Handle (e.g. student@okaxis)"
                  {...redemptionForm.register('upiId')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={createRedemptionMutation.isPending}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500 cursor-pointer"
                >
                  {createRedemptionMutation.isPending
                    ? 'Reserving Funds...'
                    : 'Submit UPI Redemption'}
                </button>
              </form>
            </div>

            {/* 4. Referred Friends & Attribution Status Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-emerald-400" /> Referred Friends &amp; Reward Status (`GET /api/v1/referrals`)
              </h3>
              {referralsData && referralsData.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 px-3">Referred Friend</th>
                        <th className="py-2 px-3">Code Used</th>
                        <th className="py-2 px-3">Reward Amount</th>
                        <th className="py-2 px-3">Attributed On</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                      {referralsData.items.map((ref) => (
                        <tr key={ref.id}>
                          <td className="py-2.5 px-3 font-semibold">
                            {ref.referredName}{' '}
                            <span className="text-slate-500 font-normal">({ref.referredEmail})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400">{ref.codeUsed}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                            ₹{ref.rewardAmountSnapshot}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(ref.attributedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                              {ref.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No referred friends yet. Share your direct referral link above to start earning wallet rewards!
                </p>
              )}
            </div>

            {/* 5. Append-Only Wallet Transactions Ledger */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" /> Append-Only Wallet Transactions (`wallet_transactions`)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Direction</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance After</th>
                      <th className="py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {wallet.transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{t.transactionType}</td>
                        <td className="py-2.5 px-3 font-bold">
                          <span
                            className={
                              t.direction === 'CREDIT' ? 'text-emerald-400' : 'text-amber-400'
                            }
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">₹{t.amount}</td>
                        <td className="py-2.5 px-3 font-mono font-bold">₹{t.balanceAfter}</td>
                        <td className="py-2.5 px-3 text-slate-400">{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 5. REFERRALS VIEW (/admin/referrals & /student/referrals)
// ============================================================================

export function RoleReferralsView({ role }: { role: 'ADMIN' | 'STUDENT' }) {
  const { data, isLoading } = useReferralsQuery();

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Referral Program`}
      operatorSubtitle="1st-Paid-Enrollment Reward Policy (C-005, C-028)"
      headerTitle="Referral Attribution, Direct Invite Link & Wallet Reward Ledger"
    >
      <div className="space-y-6">
        {role === 'STUDENT' && (
          <StudentReferralShareCard referralCode={data?.myReferralCode || 'ARGON-SARAH42'} />
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-3">
            Referrals (`GET /api/v1/referrals`)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading referrals...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Referrer</th>
                  <th className="py-2 px-3">Referred Student</th>
                  <th className="py-2 px-3">Code Used</th>
                  <th className="py-2 px-3">Reward Amount</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {data?.items.map((ref: ReferralSummaryData['items'][number]) => (
                  <tr key={ref.id}>
                    <td className="py-2.5 px-3 font-semibold">{ref.referrerName}</td>
                    <td className="py-2.5 px-3">{ref.referredName}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-400">{ref.codeUsed}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">₹{ref.rewardAmountSnapshot}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                        {ref.status}
                      </span>
                    </td>
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
// 6. TEACHER REVENUE-SHARE PAYOUT HISTORY VIEW (/teacher/payouts)
// ============================================================================

export function TeacherPayoutHistoryView() {
  const { data: payouts = [], isLoading } = useTeacherPayoutsQuery();

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Instructor Compensation"
      operatorSubtitle="Revenue-Share & Section 194J TDS Statements"
      headerTitle="My Revenue-Share Payout & Section 194J TDS Statements"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
        <h2 className="text-sm font-bold mb-4">
          Your Revenue-Share Payout Statements (`GET /api/v1/teacher-payouts`)
        </h2>
        {isLoading && <p className="text-xs text-slate-500">Loading your payout history...</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 px-3">Period</th>
                <th className="py-2 px-3">Gross Course Collections</th>
                <th className="py-2 px-3">Gross Share</th>
                <th className="py-2 px-3">Sec 194J TDS</th>
                <th className="py-2 px-3">Net Disbursed</th>
                <th className="py-2 px-3">Notes / Reference</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 px-3 font-mono">
                    {p.periodStart} → {p.periodEnd}
                  </td>
                  <td className="py-2.5 px-3 font-mono">₹{p.grossCourseCollections}</td>
                  <td className="py-2.5 px-3 font-mono">
                    ₹{p.grossPayoutAmount} ({p.revenueSharePercentSnapshot}%)
                  </td>
                  <td className="py-2.5 px-3 font-mono text-amber-400">
                    -₹{p.tdsAmount || '0.00'} ({p.tdsPercent || '10.00'}%)
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                    ₹{p.netPayoutAmount}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {p.notes || p.paymentReference || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RolePanelShell>
  );
}
