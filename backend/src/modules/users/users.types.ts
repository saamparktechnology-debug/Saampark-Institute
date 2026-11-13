import { AccountStatus, RoleType } from '@prisma/client';

export interface UserDirectoryItemDto {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: RoleType;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  studentCode?: string | null;
  teacherCode?: string | null;
  specialization?: string | null;
  defaultRevenueSharePercent?: string | null;
  agentCode?: string | null;
  department?: string | null;
}
