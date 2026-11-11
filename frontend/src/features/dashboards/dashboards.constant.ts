import { RolePanelType } from '@/features/auth/types/auth.types';
import { NavSection } from './types/dashboards.types';

/**
 * Complete Full-Scope Sidebar Navigation for all 4 roles (100% of Phases 1–7 Live & Active).
 */
export const PANEL_SIDEBAR_NAVIGATION: Record<RolePanelType, NavSection[]> = {
  ADMIN: [
    {
      heading: 'ADMINISTRATION',
      items: [
        { label: 'Dashboard & Analytics', key: 'dashboard', href: '/admin/dashboard' },
        { label: 'User Management', key: 'users', href: '/admin/users' },
        { label: 'Teacher Management', key: 'teachers', href: '/admin/users?role=TEACHER' },
        { label: 'Student Management', key: 'students', href: '/admin/users?role=STUDENT' },
        { label: 'Support Team Management', key: 'support-team', href: '/admin/users?role=SUPPORT' },
        { label: 'Role & Permissions', key: 'roles', href: '/admin/roles' },
      ],
    },
    {
      heading: 'OPERATION',
      items: [
        { label: 'Course Management', key: 'courses', href: '/admin/courses' },
        { label: 'Enrollment Management', key: 'enrollments', href: '/admin/enrollments' },
        { label: 'Live Class Management', key: 'live-classes', href: '/admin/live-classes' },
        { label: 'Payment Management', key: 'payments', href: '/admin/payments' },
        { label: 'Referral Management', key: 'referrals', href: '/admin/referrals' },
        { label: 'Wallet Management', key: 'wallets', href: '/admin/wallets' },
        { label: 'Certificate Management', key: 'certificates', href: '/admin/certificates' },
      ],
    },
    {
      heading: 'SYSTEM',
      items: [
        { label: 'Reports & Exports', key: 'reports', href: '/admin/reports' },
        { label: 'Platform Settings', key: 'settings', href: '/admin/settings' },
        { label: 'Audit Logs', key: 'audit-logs', href: '/admin/audit-logs' },
      ],
    },
  ],
  STUDENT: [
    {
      heading: 'MAIN',
      items: [
        { label: 'Dashboard', key: 'dashboard', href: '/student/dashboard' },
        { label: 'My Courses', key: 'my-courses', href: '/student/courses' },
        { label: 'Course Details', key: 'course-details', href: '/student/courses' },
      ],
    },
    {
      heading: 'ACADEMICS',
      items: [
        { label: 'Live Classes', key: 'live-classes', href: '/student/live-classes' },
        { label: 'Recorded Classes', key: 'recorded-classes', href: '/student/recorded-classes' },
        { label: 'Learning Materials', key: 'materials', href: '/student/materials' },
        { label: 'Assignments', key: 'assignments', href: '/student/assignments' },
        { label: 'Examinations', key: 'examinations', href: '/student/examinations' },
        { label: 'Results', key: 'results', href: '/student/results' },
        { label: 'My Performance', key: 'performance', href: '/student/performance' },
        { label: 'Attendance', key: 'attendance', href: '/student/attendance' },
      ],
    },
    {
      heading: 'FINANCE',
      items: [
        { label: 'Payment History', key: 'payment-history', href: '/student/payment-history' },
        { label: 'Installments & Dues', key: 'installments', href: '/student/enrollments' },
        { label: 'Wallet', key: 'wallet', href: '/student/wallet' },
        { label: 'Referral Program', key: 'referrals', href: '/student/referrals' },
        { label: 'Redeem Wallet', key: 'redeem-wallet', href: '/student/redeem-wallet' },
      ],
    },
    {
      heading: 'OTHERS',
      items: [
        { label: 'Certificates', key: 'certificates', href: '/student/certificates' },
        { label: 'Notifications', key: 'notifications', href: '/student/notifications' },
        { label: 'Calendar', key: 'calendar', href: '/student/calendar' },
        { label: 'Profile & Settings', key: 'profile', href: '/student/profile' },
        { label: 'Help & Support', key: 'support', href: '/student/support' },
      ],
    },
  ],
  TEACHER: [
    {
      heading: 'TEACHER',
      items: [
        { label: 'Dashboard', key: 'dashboard', href: '/teacher/dashboard' },
        { label: 'My Courses', key: 'my-courses', href: '/teacher/courses' },
        { label: 'My Students', key: 'my-students', href: '/teacher/students' },
        { label: 'Live Class Management', key: 'live-classes', href: '/teacher/live-classes' },
        { label: 'Class Schedule', key: 'class-schedule', href: '/teacher/class-schedule' },
        { label: 'Recorded Classes', key: 'recorded-classes', href: '/teacher/recorded-classes' },
        { label: 'Materials Management', key: 'materials', href: '/teacher/materials' },
      ],
    },
    {
      heading: 'EVALUATION',
      items: [
        { label: 'Assignments', key: 'assignments', href: '/teacher/assignments' },
        { label: 'Assignment Evaluation', key: 'assignment-evaluation', href: '/teacher/assignment-evaluation' },
        { label: 'Exam Management', key: 'exams', href: '/teacher/exams' },
        { label: 'Result Management', key: 'results', href: '/teacher/results' },
      ],
    },
    {
      heading: 'ENGAGEMENT',
      items: [
        { label: 'Attendance Management', key: 'attendance', href: '/teacher/attendance' },
        { label: 'Daily Attendance Code', key: 'attendance-code', href: '/teacher/attendance-code' },
        { label: 'Student Performance', key: 'student-performance', href: '/teacher/student-performance' },
        { label: 'My Performance', key: 'my-performance', href: '/teacher/my-performance' },
      ],
    },
    {
      heading: 'FINANCIAL & ACCOUNTS',
      items: [
        { label: 'My Payment History', key: 'payouts', href: '/teacher/payouts' },
        { label: 'Notifications', key: 'notifications', href: '/teacher/notifications' },
        { label: 'Calendar', key: 'calendar', href: '/teacher/calendar' },
        { label: 'Profile', key: 'profile', href: '/teacher/profile' },
        { label: 'Support', key: 'support', href: '/teacher/support' },
      ],
    },
  ],
  SUPPORT: [
    {
      heading: 'GENERAL',
      items: [{ label: 'Support Dashboard', key: 'dashboard', href: '/support/dashboard' }],
    },
    {
      heading: 'WORKSPACE',
      items: [
        { label: 'Ticket Management', key: 'ticket-management', href: '/support/ticket-management' },
        { label: 'Ticket Assignment', key: 'ticket-assignment', href: '/support/ticket-assignment' },
      ],
    },
    {
      heading: 'TICKET CATEGORIES',
      items: [
        { label: 'Student Queries', key: 'student-queries', href: '/support/student-queries' },
        { label: 'Teacher Queries', key: 'teacher-queries', href: '/support/teacher-queries' },
        { label: 'Payment Issues', key: 'payment-issues', href: '/support/payment-issues' },
        { label: 'Enrollment Issues', key: 'enrollment-issues', href: '/support/enrollment-issues' },
        { label: 'Course Issues', key: 'course-issues', href: '/support/course-issues' },
        { label: 'Live Class Issues', key: 'live-class-issues', href: '/support/live-class-issues' },
      ],
    },
    {
      heading: 'COLLABORATION',
      items: [
        { label: 'Internal Notes', key: 'internal-notes', href: '/support/internal-notes' },
        { label: 'Communication History', key: 'communication-history', href: '/support/communication-history' },
      ],
    },
    {
      heading: 'INSIGHTS & REPORTS',
      items: [
        { label: 'Escalation Management', key: 'escalations', href: '/support/escalations' },
        { label: 'Resolution Reports', key: 'resolution-reports', href: '/support/resolution-reports' },
        { label: 'Notifications', key: 'notifications', href: '/support/notifications' },
      ],
    },
  ],
};
