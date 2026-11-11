export const EXPORTABLE_DATASETS = [
  { label: 'Verified Payments & Refunds Ledger', value: 'payments' },
  { label: 'Student Course Enrollments & Progress', value: 'enrollments' },
  { label: 'Teacher Revenue-Share Payout Statements', value: 'payouts' },
  { label: 'Session Attendance Records', value: 'attendance' },
  { label: 'Append-Only Security Audit Logs', value: 'audit_logs' },
] as const;

export const AUDIT_ENTITY_TYPES = [
  'Session',
  'User',
  'Course',
  'CourseTeacherAssignment',
  'Enrollment',
  'PaymentTransaction',
  'RedemptionRequest',
  'TeacherPayout',
  'LiveClass',
  'ClassRecording',
  'AttendanceSession',
  'AttendanceRecord',
  'Assignment',
  'AssignmentSubmission',
  'Exam',
  'ExamAttempt',
  'Certificate',
  'SupportTicket',
  'PlatformSettings',
] as const;
