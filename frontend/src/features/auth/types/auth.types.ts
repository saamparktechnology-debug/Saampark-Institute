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

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  redirectTo: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}
