'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { financeService } from '../services/finance.service';

export function usePaymentsListQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.finance.payments(filters),
    queryFn: () => financeService.listPayments(filters),
  });
}

export function useCreatePaymentOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.createPaymentOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useVerifyRazorpayCheckoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.verifyRazorpayCheckout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}

export function useUpdatePaymentGstDetailsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      customerGstin,
      placeOfSupplyState,
    }: {
      transactionId: string;
      customerGstin?: string | null;
      placeOfSupplyState: string;
    }) =>
      financeService.updatePaymentGstDetails(transactionId, {
        customerGstin,
        placeOfSupplyState,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

export function useRefundPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      financeService.refundPayment(transactionId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useExtendInstallmentScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      enrollmentId,
      extensionDays,
      reason,
    }: {
      enrollmentId: string;
      extensionDays: number;
      reason: string;
    }) =>
      financeService.extendInstallmentSchedule(enrollmentId, {
        extensionDays,
        reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useMyWalletQuery() {
  return useQuery({
    queryKey: queryKeys.finance.myWallet(),
    queryFn: () => financeService.getMyWallet(),
  });
}

export function useAllWalletsAdminQuery() {
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

export function useCreateRedemptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.createRedemption,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useReviewRedemptionMutation() {
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
      financeService.reviewRedemption(redemptionId, {
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

export function useReferralsQuery() {
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

export function useGenerateTeacherPayoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeService.generateTeacherPayout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.teacherPayouts() });
    },
  });
}

export function useUpdateTeacherPayoutStatusMutation() {
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
    }) => financeService.updateTeacherPayoutStatus(payoutId, { status, paymentReference }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.teacherPayouts() });
    },
  });
}

// Backwards-compatible aliases
export const useReviewUpiRedemptionMutation = useReviewRedemptionMutation;
export const useReferralsListQuery = useReferralsQuery;
export const useRequestUpiRedemptionMutation = useCreateRedemptionMutation;
