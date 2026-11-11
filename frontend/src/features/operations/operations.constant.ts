export const TICKET_CATEGORIES = [
  { label: 'Student Query', value: 'STUDENT_QUERY' },
  { label: 'Teacher Query', value: 'TEACHER_QUERY' },
  { label: 'Payment & Billing Issue', value: 'PAYMENT_ISSUE' },
  { label: 'Enrollment & Installment Issue', value: 'ENROLLMENT_ISSUE' },
  { label: 'Course Content Issue', value: 'COURSE_ISSUE' },
  { label: '100ms Live Class Issue', value: 'LIVE_CLASS_ISSUE' },
] as const;

export const TICKET_PRIORITIES = [
  { label: 'Low (24h SLA)', value: 'LOW' },
  { label: 'Medium (12h SLA)', value: 'MEDIUM' },
  { label: 'High (4h SLA)', value: 'HIGH' },
  { label: 'Urgent Red (2h SLA)', value: 'URGENT_RED' },
] as const;

export const TICKET_STATUSES = [
  { label: 'Incoming', value: 'INCOMING' },
  { label: 'In Triage', value: 'IN_TRIAGE' },
  { label: 'Escalated', value: 'ESCALATED' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
] as const;
