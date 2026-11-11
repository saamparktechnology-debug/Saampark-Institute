import { RoleType, AccountStatus } from '@prisma/client';

export interface LoginRequestDto {
  email: string;
  password: string;
  rolePanel: RoleType;
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
}
