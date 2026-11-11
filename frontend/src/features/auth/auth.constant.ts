import { RolePanelType } from './types/auth.types';

export interface RolePortalMetadata {
  role: RolePanelType;
  loginPath: string;
  dashboardPath: string;
  badgeLabel: string;
  portalTitle: string;
  portalSubtitle: string;
  accentGradient: string;
  demoEmail: string;
}

export const ROLE_PORTAL_CONFIG: Record<RolePanelType, RolePortalMetadata> = {
  ADMIN: {
    role: 'ADMIN',
    loginPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
    badgeLabel: 'ADMINISTRATION PORTAL',
    portalTitle: 'Admin Command & Telemetry',
    portalSubtitle:
      'Sign in to manage users, courses, revenue-share payouts, UPI redemptions, and live audit logs.',
    accentGradient: 'from-emerald-500 to-cyan-500',
    demoEmail: 'admin.jack@institute.edu',
  },
  STUDENT: {
    role: 'STUDENT',
    loginPath: '/student/login',
    dashboardPath: '/student/dashboard',
    badgeLabel: 'STUDENT LEARNING HUB',
    portalTitle: 'Student Portal Login',
    portalSubtitle:
      'Access your enrolled courses, 100ms live classrooms, YouTube recordings, attendance codes, and wallet.',
    accentGradient: 'from-violet-500 to-cyan-400',
    demoEmail: 'sarah.student@institute.edu',
  },
  TEACHER: {
    role: 'TEACHER',
    loginPath: '/teacher/login',
    dashboardPath: '/teacher/dashboard',
    badgeLabel: "TEACHER'S COCKPIT",
    portalTitle: 'Faculty & Instructor Sign In',
    portalSubtitle:
      'Launch assigned live classrooms, generate session attendance codes, evaluate submissions, and track revenue share.',
    accentGradient: 'from-indigo-500 to-violet-500',
    demoEmail: 'prof.david@institute.edu',
  },
  SUPPORT: {
    role: 'SUPPORT',
    loginPath: '/support/login',
    dashboardPath: '/support/dashboard',
    badgeLabel: 'SUPPORT OPERATIONS CENTER',
    portalTitle: 'Support Team Triage Login',
    portalSubtitle:
      'Monitor SLA breach risks, triage incoming student/teacher queues, and inspect read-only payment references.',
    accentGradient: 'from-amber-500 to-rose-500',
    demoEmail: 'captain.support@institute.edu',
  },
};
