export type TicketCategoryType =
  | 'STUDENT_QUERY'
  | 'TEACHER_QUERY'
  | 'PAYMENT_ISSUE'
  | 'ENROLLMENT_ISSUE'
  | 'COURSE_ISSUE'
  | 'LIVE_CLASS_ISSUE';

export type TicketPriorityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT_RED';

export type TicketStatusType =
  | 'INCOMING'
  | 'IN_TRIAGE'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED';

export interface SupportTicketMessageItem {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  category: TicketCategoryType;
  priority: TicketPriorityType;
  status: TicketStatusType;
  subject: string;
  description: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  createdByRole: string;
  assignedToId: string | null;
  assignedToName: string | null;
  escalatedTo: string | null;
  slaDueAt: string;
  slaRemainingMinutes: number;
  isSlaBreachRisk: boolean;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessageItem[];
}

export interface SupportAgentItem {
  id: string;
  fullName: string;
  email: string;
  agentCode: string;
  department: string;
  isTriageLead: boolean;
  maxConcurrentTickets: number;
  openAssignedTicketsCount: number;
}

export interface SupportContextLookupData {
  enrollments: Array<{
    id: string;
    studentName: string;
    studentEmail: string;
    courseCode: string;
    courseTitle: string;
    status: string;
    planType: string;
    purchasedPriceInr: string;
    installments: Array<{
      sequenceNumber: number;
      amountInr: string;
      dueAt: string;
      status: string;
    }>;
  }>;
  payments: Array<{
    id: string;
    studentName: string;
    studentEmail: string;
    courseCode: string;
    provider: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    receiptNumber: string | null;
    amountInr: string;
    status: string;
    createdAt: string;
  }>;
  redemptions: Array<{
    id: string;
    studentName: string;
    studentEmail: string;
    amountInr: string;
    upiIdMasked: string;
    status: string;
    requestedAt: string;
  }>;
}

export interface SupportResolutionReportData {
  totalTickets: number;
  resolvedTickets: number;
  averageResolutionMinutes: number;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    resolved: number;
    escalated: number;
    slaBreaches: number;
  }>;
}

export type OmnichannelEventType =
  | 'ONBOARDING_WELCOME'
  | 'LIVE_CLASS_SCHEDULED'
  | 'STUDY_MATERIAL_UPLOADED'
  | 'RECORDING_PUBLISHED'
  | 'ASSIGNMENT_PUBLISHED'
  | 'EXAM_PUBLISHED'
  | 'INSTALLMENT_REMINDER'
  | 'COURSE_ANNOUNCEMENT';

export interface EventChannelToggle {
  whatsapp: boolean;
  email: boolean;
  inApp: boolean;
  smsDlt?: boolean;
}

export interface OmnichannelSettingsData {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsDltEnabled?: boolean;
  whatsappBusinessNumber: string;
  whatsappProvider: 'META_CLOUD_API' | 'TWILIO_WHATSAPP' | 'WATI_GATEWAY';
  smtpSenderEmail: string;
  smtpProvider: 'HOSTINGER_SMTP' | 'AWS_SES' | 'RESEND';
  smsDltProvider?: 'MSG91_DLT' | 'FAST2SMS_DLT' | 'TEXTLOCAL_DLT' | 'TWILIO_SMS';
  smsDltEntityId?: string;
  smsDltSenderId?: string;
  smsDltTemplateIdDefault?: string;
  smsDltFallbackOnWhatsappFailure?: boolean;
  eventToggles: Record<OmnichannelEventType, EventChannelToggle>;
  updatedAt: string;
  updatedBy: string;
}

export interface OmnichannelDeliveryLogItem {
  id: string;
  eventType: string;
  courseCode: string | null;
  title: string;
  recipientCount: number;
  channelsDispatched: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>;
  skippedChannels: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>;
  whatsappPreview: string | null;
  smsDltPreview?: string | null;
  actorName: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  deliveryChannel?: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS' | 'SMS_DLT';
  readAt: string | null;
  sentAt: string;
}

export interface NotificationsData {
  unreadCount: number;
  channelsStatus?: {
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    smsDltEnabled?: boolean;
  };
  items: NotificationItem[];
}

export interface CalendarEventItem {
  id: string;
  eventType: 'LIVE_CLASS' | 'ASSIGNMENT_DUE' | 'EXAM_WINDOW' | 'INSTALLMENT_DUE';
  title: string;
  courseCode: string;
  courseTitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  badgeColor: string;
}

export interface UserProfileDetailData {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  studentProfile: {
    studentCode: string;
    gradeLevel: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    address: string | null;
    pinCode?: string | null;
    city?: string | null;
    state?: string | null;
    highestQualification?: string | null;
    institutionOrCompany?: string | null;
    graduationYear?: string | null;
    careerGoal?: string | null;
    referralSource?: string | null;
  } | null;
  teacherProfile: {
    teacherCode: string;
    qualification: string | null;
    specialization: string | null;
    biography: string | null;
    defaultRevenueSharePercent: string;
  } | null;
  supportAgentProfile: {
    agentCode: string;
    department: string;
    isTriageLead: boolean;
    maxConcurrentTickets: number;
  } | null;
  walletAvailableInr: string | null;
  referralCode: string | null;
}

export interface RbacPermissionItem {
  id: string;
  code: string;
  module: string;
  description: string;
  assignedRoles: Array<'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT'>;
  userOverrideCount: number;
  createdAt: string;
}
