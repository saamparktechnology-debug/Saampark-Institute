export type RolePanelType = 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: RolePanelType;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
  permissions: string[];
  lastLoginAt: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  rolePanel: RolePanelType;
}

export interface RequestOtpPayload {
  email: string;
  rolePanel: RolePanelType;
  purpose?: 'PASSWORD_RESET' | 'OTP_LOGIN';
}

export interface RequestOtpResponseData {
  email: string;
  rolePanel: RolePanelType;
  purpose: 'PASSWORD_RESET' | 'OTP_LOGIN';
  expiresAt: string;
  channelsDispatched: string[];
  devOtpPreview?: string;
}

export interface ResetPasswordWithOtpPayload {
  email: string;
  rolePanel: RolePanelType;
  otp: string;
  newPassword: string;
}

export interface LoginWithOtpPayload {
  email: string;
  rolePanel: RolePanelType;
  otp: string;
}

export interface StudentSignupPayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  referralCode?: string;
}

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  redirectTo: string;
  evictedOldestSessionsCount?: number;
}

export interface ActiveDeviceSessionItem {
  id: string;
  rolePanel: RolePanelType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}
