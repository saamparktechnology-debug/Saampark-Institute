import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AdminWalletSummaryItem,
  CreateRazorpayOrderResponse,
  GstTaxInvoiceBreakdown,
  MyWalletAndLedgerData,
  PaymentTransactionItem,
  RedemptionRequestItem,
  ReferralSummaryData,
  TeacherPayoutItem,
} from '../types/finance.types';

export const financeService = {
  async listPayments(params?: Record<string, string | number>): Promise<{
    items: PaymentTransactionItem[];
    meta: Record<string, unknown> | null;
  }> {
    const res = await apiClient.get<ApiEnvelope<PaymentTransactionItem[]>>('/payments', {
      params,
    });
    return { items: res.data.data, meta: res.data.meta };
  },

  async createPaymentOrder(payload: {
    enrollmentId: string;
    installmentSequenceNumber: number;
    useWalletBalance: boolean;
    idempotencyKey: string;
  }): Promise<CreateRazorpayOrderResponse> {
    const res = await apiClient.post<ApiEnvelope<CreateRazorpayOrderResponse>>(
      '/payments/orders',
      payload
    );
    return res.data.data;
  },

  async verifyRazorpayCheckout(payload: {
    enrollmentId: string;
    installmentSequenceNumber: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      '/payments/verify-checkout',
      payload
    );
    return res.data.data;
  },

  async updatePaymentGstDetails(
    transactionId: string,
    payload: {
      customerGstin?: string | null;
      placeOfSupplyState: string;
    }
  ): Promise<{ transactionId: string; gstInvoice: GstTaxInvoiceBreakdown }> {
    const res = await apiClient.patch<
      ApiEnvelope<{ transactionId: string; gstInvoice: GstTaxInvoiceBreakdown }>
    >(`/payments/${transactionId}/gst-details`, payload);
    return res.data.data;
  },

  async refundPayment(transactionId: string, reason: string) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/payments/${transactionId}/refund`,
      { reason }
    );
    return res.data.data;
  },

  async extendInstallmentSchedule(
    enrollmentId: string,
    payload: { extensionDays: number; reason: string }
  ) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/enrollments/${enrollmentId}/extend-schedule`,
      payload
    );
    return res.data.data;
  },

  async getMyWallet(): Promise<MyWalletAndLedgerData> {
    const res = await apiClient.get<ApiEnvelope<MyWalletAndLedgerData>>('/wallets/me');
    return res.data.data;
  },

  async listAllWalletsForAdmin(): Promise<AdminWalletSummaryItem[]> {
    const res = await apiClient.get<ApiEnvelope<AdminWalletSummaryItem[]>>('/wallets/admin/all');
    return res.data.data;
  },

  async listRedemptions(): Promise<RedemptionRequestItem[]> {
    const res = await apiClient.get<ApiEnvelope<RedemptionRequestItem[]>>('/wallets/redemptions');
    return res.data.data;
  },

  async createRedemption(payload: {
    amount: number;
    upiId: string;
    idempotencyKey: string;
  }): Promise<RedemptionRequestItem> {
    const res = await apiClient.post<ApiEnvelope<RedemptionRequestItem>>(
      '/wallets/redemptions',
      payload
    );
    return res.data.data;
  },

  async reviewRedemption(
    redemptionId: string,
    payload: {
      decision: 'PAID' | 'REJECTED';
      payoutReference?: string;
      rejectionReason?: string;
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/wallets/redemptions/${redemptionId}/review`,
      payload
    );
    return res.data.data;
  },

  async listReferrals(): Promise<ReferralSummaryData> {
    const res = await apiClient.get<ApiEnvelope<ReferralSummaryData>>('/referrals');
    return res.data.data;
  },

  async listTeacherPayouts(): Promise<TeacherPayoutItem[]> {
    const res = await apiClient.get<ApiEnvelope<TeacherPayoutItem[]>>('/teacher-payouts');
    return res.data.data;
  },

  async generateTeacherPayout(payload: {
    teacherId: string;
    courseId: string;
    periodStart: string;
    periodEnd: string;
    tdsPercent?: number;
    adjustments: number;
    notes?: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      '/teacher-payouts/generate',
      payload
    );
    return res.data.data;
  },

  async updateTeacherPayoutStatus(
    payoutId: string,
    payload: {
      status: 'APPROVED' | 'PAID' | 'CANCELLED';
      paymentReference?: string;
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/teacher-payouts/${payoutId}/status`,
      payload
    );
    return res.data.data;
  },
};
