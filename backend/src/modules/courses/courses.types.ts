import {
  CourseStatus,
  EnrollmentStatus,
  PaymentPlanType,
  TeacherAssignmentRole,
  AssignmentStatus,
} from '@prisma/client';

export interface CourseCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  courseCount?: number;
}

export interface AssignedTeacherDto {
  assignmentId: string;
  teacherId: string;
  fullName: string;
  email: string;
  assignmentRole: TeacherAssignmentRole;
  revenueSharePercent: string;
  status: AssignmentStatus;
}

export interface PaymentPlanTemplateDto {
  id: string;
  name: string;
  planType: PaymentPlanType;
  installmentCount: number;
  totalAmount: string;
  currency: string;
  gracePeriodDays: number;
  isActive: boolean;
}

export interface CourseLessonDto {
  id: string;
  sectionId: string;
  title: string;
  contentType: string;
  durationSeconds: number;
  sortOrder: number;
  isPreview: boolean;
  isCompleted?: boolean;
}

export interface CourseSectionDto {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: CourseLessonDto[];
}

export interface CourseSummaryDto {
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
  status: CourseStatus;
  minAttendancePercent: string;
  minPassMarksPercent: string;
  publishedAt: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  assignedTeachers: AssignedTeacherDto[];
  paymentPlanTemplates: PaymentPlanTemplateDto[];
  sections?: CourseSectionDto[];
  enrollmentCount: number;
  completedLessonIds?: string[];
  studentProgressPercent?: string;
}

export interface CourseLessonProgressDto {
  courseId: string;
  enrollmentId: string;
  completedLessonIds: string[];
  completedCount: number;
  totalLessons: number;
  progressPercent: string;
}

export interface TeacherCohortStudentDto {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  studentCode: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  enrollmentStatus: EnrollmentStatus;
  progressPercent: string;
  paidInstallmentsCount: number;
  totalInstallmentsCount: number;
  onboardingCompleted: boolean;
  enrolledAt: string;
}

export interface CourseDoubtReplyDto {
  id: string;
  doubtId: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  message: string;
  createdAt: string;
}

export interface CourseDoubtThreadDto {
  id: string;
  courseId: string;
  lessonTitle: string | null;
  subject: string;
  question: string;
  studentId: string;
  studentName: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  replies: CourseDoubtReplyDto[];
}
