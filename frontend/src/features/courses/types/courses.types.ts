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

export interface EnrollmentItem {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
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
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    paidAt: string | null;
  }>;
}
