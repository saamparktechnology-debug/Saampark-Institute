export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.users.all, 'list', filters ?? {}] as const,
    teachers: () => [...queryKeys.users.all, 'teachers'] as const,
  },
  dashboards: {
    all: ['dashboards'] as const,
    admin: () => [...queryKeys.dashboards.all, 'admin'] as const,
    student: () => [...queryKeys.dashboards.all, 'student'] as const,
    teacher: () => [...queryKeys.dashboards.all, 'teacher'] as const,
    support: () => [...queryKeys.dashboards.all, 'support'] as const,
  },
  courses: {
    all: ['courses'] as const,
    categories: () => [...queryKeys.courses.all, 'categories'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.courses.all, 'list', filters ?? {}] as const,
    detail: (courseId: string) => [...queryKeys.courses.all, 'detail', courseId] as const,
    materials: (courseId: string) => [...queryKeys.courses.all, 'materials', courseId] as const,
    teacherStudents: () => [...queryKeys.courses.all, 'teacher-students'] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.enrollments.all, 'list', filters ?? {}] as const,
    detail: (enrollmentId: string) =>
      [...queryKeys.enrollments.all, 'detail', enrollmentId] as const,
  },
  finance: {
    all: ['finance'] as const,
    payments: (filters?: Record<string, unknown>) =>
      [...queryKeys.finance.all, 'payments', filters ?? {}] as const,
    myWallet: () => [...queryKeys.finance.all, 'my-wallet'] as const,
    allWallets: () => [...queryKeys.finance.all, 'all-wallets'] as const,
    redemptions: () => [...queryKeys.finance.all, 'redemptions'] as const,
    referrals: () => [...queryKeys.finance.all, 'referrals'] as const,
    teacherPayouts: () => [...queryKeys.finance.all, 'teacher-payouts'] as const,
  },
  liveLearning: {
    all: ['live-learning'] as const,
    liveClasses: (filters?: Record<string, unknown>) =>
      [...queryKeys.liveLearning.all, 'live-classes', filters ?? {}] as const,
    participants: (liveClassId: string) =>
      [...queryKeys.liveLearning.all, 'participants', liveClassId] as const,
    recordings: (filters?: Record<string, unknown>) =>
      [...queryKeys.liveLearning.all, 'recordings', filters ?? {}] as const,
    attendanceSessions: (filters?: Record<string, unknown>) =>
      [...queryKeys.liveLearning.all, 'attendance-sessions', filters ?? {}] as const,
  },
  assessments: {
    all: ['assessments'] as const,
    assignments: (filters?: Record<string, unknown>) =>
      [...queryKeys.assessments.all, 'assignments', filters ?? {}] as const,
    exams: (filters?: Record<string, unknown>) =>
      [...queryKeys.assessments.all, 'exams', filters ?? {}] as const,
    performance: () => [...queryKeys.assessments.all, 'performance'] as const,
    certificates: () => [...queryKeys.assessments.all, 'certificates'] as const,
    verifyCertificate: (certificateNumber: string) =>
      [...queryKeys.assessments.all, 'verify-certificate', certificateNumber] as const,
  },
  operations: {
    all: ['operations'] as const,
    tickets: (filters?: Record<string, unknown>) =>
      [...queryKeys.operations.all, 'tickets', filters ?? {}] as const,
    supportAgents: () => [...queryKeys.operations.all, 'support-agents'] as const,
    supportContextLookup: () => [...queryKeys.operations.all, 'support-context-lookup'] as const,
    supportReports: () => [...queryKeys.operations.all, 'support-reports'] as const,
    notifications: () => [...queryKeys.operations.all, 'notifications'] as const,
    omnichannelSettings: () => [...queryKeys.operations.all, 'omnichannel-settings'] as const,
    deliveryLogs: () => [...queryKeys.operations.all, 'delivery-logs'] as const,
    calendarEvents: () => [...queryKeys.operations.all, 'calendar-events'] as const,
    profile: () => [...queryKeys.operations.all, 'profile'] as const,
    rbacMatrix: () => [...queryKeys.operations.all, 'rbac-matrix'] as const,
  },
  system: {
    all: ['system'] as const,
    reports: () => [...queryKeys.system.all, 'reports'] as const,
    auditLogs: (filters?: Record<string, unknown>) =>
      [...queryKeys.system.all, 'audit-logs', filters ?? {}] as const,
    settings: () => [...queryKeys.system.all, 'settings'] as const,
    vpsReadiness: () => [...queryKeys.system.all, 'vps-readiness'] as const,
  },
} as const;
