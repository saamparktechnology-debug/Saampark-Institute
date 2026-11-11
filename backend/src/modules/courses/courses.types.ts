import {
  CourseStatus,
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
}
