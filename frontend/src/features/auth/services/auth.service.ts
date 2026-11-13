import { apiClient } from '@/lib/axios';
import {
  ActiveDeviceSessionItem,
  ApiEnvelope,
  AuthUser,
  LoginPayload,
  LoginResponseData,
  LoginWithOtpPayload,
  RequestOtpPayload,
  RequestOtpResponseData,
  ResetPasswordWithOtpPayload,
  StudentSignupPayload,
} from '../types/auth.types';

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponseData> {
    const response = await apiClient.post<ApiEnvelope<LoginResponseData>>(
      '/auth/login',
      payload
    );
    return response.data.data;
  },

  async requestOtp(payload: RequestOtpPayload): Promise<RequestOtpResponseData> {
    const response = await apiClient.post<ApiEnvelope<RequestOtpResponseData>>(
      '/auth/forgot-password/request-otp',
      payload
    );
    return response.data.data;
  },

  async resetPasswordWithOtp(payload: ResetPasswordWithOtpPayload): Promise<{
    email: string;
    passwordReset: boolean;
    sessionsRevoked: boolean;
    resetAt: string;
  }> {
    const response = await apiClient.post<
      ApiEnvelope<{
        email: string;
        passwordReset: boolean;
        sessionsRevoked: boolean;
        resetAt: string;
      }>
    >('/auth/forgot-password/reset', payload);
    return response.data.data;
  },

  async loginWithOtp(payload: LoginWithOtpPayload): Promise<LoginResponseData> {
    const response = await apiClient.post<ApiEnvelope<LoginResponseData>>(
      '/auth/login-otp',
      payload
    );
    return response.data.data;
  },

  async registerStudent(payload: StudentSignupPayload): Promise<LoginResponseData> {
    const response = await apiClient.post<ApiEnvelope<LoginResponseData>>(
      '/auth/student/register',
      payload
    );
    return response.data.data;
  },

  async getMe(): Promise<{ user: AuthUser }> {
    const response = await apiClient.get<ApiEnvelope<{ user: AuthUser }>>('/auth/me');
    return response.data.data;
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ updatedAt: string }> {
    const response = await apiClient.post<ApiEnvelope<{ updatedAt: string }>>(
      '/auth/change-password',
      payload
    );
    return response.data.data;
  },

  async listActiveSessions(): Promise<ActiveDeviceSessionItem[]> {
    const response = await apiClient.get<ApiEnvelope<ActiveDeviceSessionItem[]>>(
      '/auth/sessions'
    );
    return response.data.data;
  },

  async revokeSession(sessionId: string): Promise<{ revokedSessionId: string }> {
    const response = await apiClient.delete<ApiEnvelope<{ revokedSessionId: string }>>(
      `/auth/sessions/${sessionId}`
    );
    return response.data.data;
  },

  async revokeOtherSessions(): Promise<{ revokedCount: number }> {
    const response = await apiClient.post<ApiEnvelope<{ revokedCount: number }>>(
      '/auth/sessions/revoke-others'
    );
    return response.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
