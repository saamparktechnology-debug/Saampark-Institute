import { apiClient } from '@/lib/axios';
import { ApiEnvelope, AuthUser, LoginPayload, LoginResponseData } from '../types/auth.types';

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponseData> {
    const response = await apiClient.post<ApiEnvelope<LoginResponseData>>('/auth/login', payload);
    return response.data.data;
  },

  async getMe(): Promise<{ user: AuthUser }> {
    const response = await apiClient.get<ApiEnvelope<{ user: AuthUser }>>('/auth/me');
    return response.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
