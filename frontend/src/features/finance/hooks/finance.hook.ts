'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { financeService } from '../services/finance.service';

export function usePaymentsListQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.finance.payments(filters),
    queryFn: () => financeService.listPaymentTransactions(filters),
  });
}

export function useMyWalletQuery() {
  return useQuery({
    queryKey: queryKeys.finance.myWallet(),
    queryFn: () => financeService.getMyWallet(),
  });
}

export function useAdminAllWalletsQuery() {
  return useQuery({
    queryKey: queryKeys.finance.allWallets(),
    queryFn: () => financeService.listAllWalletsForAdmin(),
  });
}

export function useRedemptionsListQuery() {
  return useQuery({
    queryKey: queryKeys.finance.redemptions(),
    queryFn: () => financeService.listRedemptions(),
  });
}

export function useReferralsListQuery() {
  return useQuery({
    queryKey: queryKeys.finance.referrals(),
    queryFn: () => financeService.listReferrals(),
  });
}

export function useTeacherPayoutsQuery() {
  return useQuery({
    queryKey: queryKeys.finance.teacherPayouts(),
    queryFn: () => financeService.listTeacherPayouts(),
  });
}

export function useRequestUpiRedemptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.requestUpiRedemption,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useReviewUpiRedemptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      redemptionId,
      decision,
      payoutReference,
      rejectionReason,
    }: {
      redemptionId: string;
      decision: 'PAID' | 'REJECTED';
      payoutReference?: string;
      rejectionReason?: string;
    }) =>
      financeService.reviewUpiRedemption(redemptionId, {
        decision,
        payoutReference,
        rejectionReason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useRefundTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      financeService.refundTransaction(transactionId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useGenerateTeacherPayoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.generateTeacherPayout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.teacherPayouts() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useSettleTeacherPayoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payoutId,
      status,
      paymentReference,
    }: {
      payoutId: string;
      status: 'APPROVED' | 'PAID' | 'CANCELLED';
      paymentReference?: string;
    }) => financeService.settleTeacherPayout(payoutId, { status, paymentReference }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.teacherPayouts() });
    },
  });
}
