import { RoleType, AccountStatus } from '@prisma/client';

export interface LoginRequestDto {
  email: string;
  password: string;
  rolePanel: RoleType;
}

export interface RequestOtpDto {
  email: string;
  rolePanel: RoleType;
  purpose?: 'PASSWORD_RESET' | 'OTP_LOGIN';
}

export interface ResetPasswordWithOtpDto {
  email: string;
  rolePanel: RoleType;
  otp: string;
  newPassword: string;
}

export interface LoginWithOtpDto {
  email: string;
  rolePanel: RoleType;
  otp: string;
}

export interface StudentSignupRequestDto {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  referralCode?: string;
}

export interface SafeUserDto {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: RoleType;
  status: AccountStatus;
  permissions: string[];
  lastLoginAt: Date | null;
}

export interface AuthSessionResponseDto {
  user: SafeUserDto;
  accessToken: string;
  refreshToken: string;
  redirectTo: string;
  evictedOldestSessionsCount?: number;
}

export interface ActiveDeviceSessionDto {
  id: string;
  rolePanel: RoleType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}
