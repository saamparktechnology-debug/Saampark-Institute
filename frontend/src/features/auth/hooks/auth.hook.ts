'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '../services/auth.service';
import {
  LoginPayload,
  LoginWithOtpPayload,
  RequestOtpPayload,
  ResetPasswordWithOtpPayload,
  StudentSignupPayload,
} from '../types/auth.types';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authService.getMe(),
  });
}

export function useAuthProfileQuery() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authService.getMe(),
    select: (data) => data.user,
    retry: false,
  });
}

export function useRoleLoginMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me(), { user: data.user });
      router.push(data.redirectTo);
    },
  });
}

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (payload: RequestOtpPayload) => authService.requestOtp(payload),
  });
}

export function useResetPasswordWithOtpMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordWithOtpPayload) =>
      authService.resetPasswordWithOtp(payload),
  });
}

export function useLoginWithOtpMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginWithOtpPayload) => authService.loginWithOtp(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me(), { user: data.user });
      router.push(data.redirectTo);
    },
  });
}

export function useStudentRegisterMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: StudentSignupPayload) => authService.registerStudent(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me(), { user: data.user });
      router.push(data.redirectTo);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: authService.changePassword,
  });
}

export function useActiveSessionsQuery() {
  return useQuery({
    queryKey: [...queryKeys.auth.all, 'sessions'] as const,
    queryFn: () => authService.listActiveSessions(),
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.auth.all, 'sessions'],
      });
    },
  });
}

export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.auth.all, 'sessions'],
      });
    },
  });
}

export function useLogoutMutation(loginRedirectPath: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
      router.push(loginRedirectPath);
    },
  });
}
