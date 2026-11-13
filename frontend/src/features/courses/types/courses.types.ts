export interface TeacherDirectoryItem {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
  createdAt: string;
  lastLoginAt: string | null;
  studentCode?: string | null;
  teacherCode?: string | null;
  specialization?: string | null;
  defaultRevenueSharePercent?: string | null;
  agentCode?: string | null;
  department?: string | null;
}

export interface CourseCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  courseCount?: number;
}

export interface AssignedTeacherItem {
  assignmentId: string;
  teacherId: string;
  fullName: string;
  email: string;
  assignmentRole: 'PRIMARY' | 'CO_INSTRUCTOR' | 'TEACHING_ASSISTANT';
  revenueSharePercent: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PaymentPlanTemplateItem {
  id: string;
  name: string;
  planType: 'FULL' | 'INSTALLMENT';
  installmentCount: number;
  totalAmount: string;
  currency: string;
  gracePeriodDays: number;
  isActive: boolean;
}

export interface CourseLessonItem {
  id: string;
  sectionId: string;
  title: string;
  contentType: string;
  durationSeconds: number;
  sortOrder: number;
  isPreview: boolean;
  isCompleted?: boolean;
}

export interface CourseSectionItem {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: CourseLessonItem[];
}

export interface CourseItem {
  id: string;
  code: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  thumbnailUrl: string | null;
  level: string;
  language: string;
  basePrice: string;
  currency: string;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  minAttendancePercent: string;
  minPassMarksPercent: string;
  publishedAt: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  assignedTeachers: AssignedTeacherItem[];
  paymentPlanTemplates: PaymentPlanTemplateItem[];
  sections?: CourseSectionItem[];
  enrollmentCount: number;
  completedLessonIds?: string[];
  studentProgressPercent?: string;
}

export interface CourseMaterialItem {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  uploadedById: string;
  signedDownloadUrl: string;
  createdAt: string;
}

export interface EnrollmentOnboardingState {
  enrollmentId: string;
  step1PlanAndPaymentVerified: boolean;
  step2AcademicPolicyAccepted: boolean;
  step3WhatsappAlertsOptIn: boolean;
  whatsappNumber: string;
  step4StarterKitAndFirstLesson: boolean;
  completedStepsCount: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface EnrollmentItem {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  planTypeSnapshot: 'FULL' | 'INSTALLMENT';
  purchasedPriceSnapshot: string;
  currencySnapshot: string;
  status:
    | 'PENDING_PAYMENT'
    | 'ACTIVE'
    | 'SUSPENDED_OVERDUE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDED';
  progressPercent: string;
  enrolledAt: string;
  activatedAt: string | null;
  installments: Array<{
    id: string;
    sequenceNumber: number;
    amount: string;
    currency: string;
    dueAt: string;
    graceEndsAt: string;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'CANCELLED';
    paidAt: string | null;
  }>;
  onboarding?: EnrollmentOnboardingState;
}

export interface CourseLessonProgressResult {
  courseId: string;
  enrollmentId: string;
  completedLessonIds: string[];
  completedCount: number;
  totalLessons: number;
  progressPercent: string;
}

export interface TeacherCohortStudentItem {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  studentCode: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  enrollmentStatus:
    | 'PENDING_PAYMENT'
    | 'ACTIVE'
    | 'SUSPENDED_OVERDUE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDED';
  progressPercent: string;
  paidInstallmentsCount: number;
  totalInstallmentsCount: number;
  onboardingCompleted: boolean;
  enrolledAt: string;
}

export interface CourseDoubtReplyItem {
  id: string;
  doubtId: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  message: string;
  createdAt: string;
}

export interface CourseDoubtThreadItem {
  id: string;
  courseId: string;
  lessonTitle: string | null;
  subject: string;
  question: string;
  studentId: string;
  studentName: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  replies: CourseDoubtReplyItem[];
}

export interface MaterialDownloadPayload {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  signedDownloadUrl?: string;
  fileBase64?: string | null;
  studyGuideText: string;
  downloadedAt: string;
}
