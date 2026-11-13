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

export interface PaymentTransactionItem {
  id: string;
  enrollmentId: string;
  installmentId: string | null;
  installmentSequenceNumber: number | null;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseCode: string;
  provider: 'RAZORPAY' | 'WALLET' | 'MANUAL';
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: string;
  walletAmountUsed: string;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  idempotencyKey: string;
  receiptNumber: string | null;
  verifiedAt: string | null;
  createdAt: string;
  gstInvoice?: GstTaxInvoiceBreakdown;
  creditNoteNumber?: string | null;
  creditNoteIssuedAt?: string | null;
  refundReason?: string | null;
}

export interface CreateRazorpayOrderResponse {
  paidViaWallet: boolean;
  providerOrderId: string | null;
  razorpayKeyId: string;
  isLiveRazorpayOrder: boolean;
  amountInPaise: number;
  amountInr: string;
  currency: string;
  enrollmentId: string;
  installmentSequenceNumber: number;
  courseTitle: string;
  courseCode: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
}

export interface WalletTransactionItem {
  id: string;
  transactionType:
    | 'REFERRAL_REWARD'
    | 'COURSE_PURCHASE_DEBIT'
    | 'REDEMPTION_RESERVE'
    | 'REDEMPTION_SETTLED'
    | 'REDEMPTION_REVERSAL'
    | 'ADMIN_ADJUSTMENT'
    | 'REFUND_CREDIT';
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  balanceAfter: string;
  currency: string;
  status: 'PENDING' | 'POSTED' | 'REVERSED';
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface RedemptionRequestItem {
  id: string;
  userId?: string;
  userFullName?: string;
  userEmail?: string;
  amount: string;
  currency: string;
  upiIdMasked: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED';
  payoutReference: string | null;
  rejectionReason: string | null;
  reviewedBy?: string | null;
  requestedAt: string;
  paidAt: string | null;
}

export interface MyWalletAndLedgerData {
  id: string;
  userId: string;
  currency: string;
  availableBalance: string;
  reservedBalance: string;
  reconciledLedgerBalance: string;
  transactions: WalletTransactionItem[];
  redemptionRequests: RedemptionRequestItem[];
}

export interface AdminWalletSummaryItem {
  id: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  userRole: string;
  currency: string;
  availableBalance: string;
  reservedBalance: string;
  transactionCount: number;
  redemptionCount: number;
  updatedAt: string;
}

export interface ReferralSummaryData {
  myReferralCode: string | null;
  items: Array<{
    id: string;
    referrerName: string;
    referrerEmail: string;
    referredName: string;
    referredEmail: string;
    codeUsed: string;
    status: 'ATTRIBUTED' | 'QUALIFIED' | 'REWARDED' | 'REVERSED';
    rewardAmountSnapshot: string;
    currency: string;
    attributedAt: string;
    rewardedAt: string | null;
  }>;
}

export interface TeacherPayoutItem {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  courseId: string | null;
  periodStart: string;
  periodEnd: string;
  grossCourseCollections: string;
  revenueSharePercentSnapshot: string;
  grossPayoutAmount: string;
  tdsSection?: '194J';
  tdsPercent?: string;
  tdsAmount?: string;
  adjustments: string;
  netPayoutAmount: string;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  approvedBy: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
}
