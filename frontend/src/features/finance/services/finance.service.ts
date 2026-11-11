import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AdminWalletDirectoryItem,
  MyWalletDetail,
  PaymentTransactionItem,
  RedemptionRequestItem,
  ReferralListResponse,
  TeacherPayoutStatementItem,
} from '../types/finance.types';

/**
 * 100% API-driven Finance Service — zero hardcoded mock records.
 */
export const financeService = {
  async listPaymentTransactions(params?: Record<string, string | number>): Promise<{
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
  }) {
    const res = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
      '/payments/orders',
      payload
    );
    return res.data.data;
  },

  async refundTransaction(transactionId: string, reason: string) {
    const res = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
      `/payments/${transactionId}/refund`,
      { reason }
    );
    return res.data.data;
  },

  async getMyWallet(): Promise<MyWalletDetail> {
    const res = await apiClient.get<ApiEnvelope<MyWalletDetail>>('/wallets/me');
    return res.data.data;
  },

  async listAllWalletsForAdmin(): Promise<AdminWalletDirectoryItem[]> {
    const res = await apiClient.get<ApiEnvelope<AdminWalletDirectoryItem[]>>(
      '/wallets/admin/all'
    );
    return res.data.data;
  },

  async listRedemptions(): Promise<RedemptionRequestItem[]> {
    const res = await apiClient.get<ApiEnvelope<RedemptionRequestItem[]>>(
      '/wallets/redemptions'
    );
    return res.data.data;
  },

  async requestUpiRedemption(payload: {
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

  async reviewUpiRedemption(
    redemptionId: string,
    payload: {
      decision: 'PAID' | 'REJECTED';
      payoutReference?: string;
      rejectionReason?: string;
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<Record<string, unknown>>>(
      `/wallets/redemptions/${redemptionId}/review`,
      payload
    );
    return res.data.data;
  },

  async listReferrals(): Promise<ReferralListResponse> {
    const res = await apiClient.get<ApiEnvelope<ReferralListResponse>>('/referrals');
    return res.data.data;
  },

  async listTeacherPayouts(): Promise<TeacherPayoutStatementItem[]> {
    const res = await apiClient.get<ApiEnvelope<TeacherPayoutStatementItem[]>>(
      '/teacher-payouts'
    );
    return res.data.data;
  },

  async generateTeacherPayout(payload: {
    teacherId: string;
    courseId: string;
    periodStart: string;
    periodEnd: string;
    adjustments: number;
    notes?: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
      '/teacher-payouts/generate',
      payload
    );
    return res.data.data;
  },

  async settleTeacherPayout(
    payoutId: string,
    payload: { status: 'APPROVED' | 'PAID' | 'CANCELLED'; paymentReference?: string }
  ) {
    const res = await apiClient.patch<ApiEnvelope<Record<string, unknown>>>(
      `/teacher-payouts/${payoutId}/status`,
      payload
    );
    return res.data.data;
  },
};
