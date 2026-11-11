import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AssignedTeacherItem,
  CourseCategoryItem,
  CourseItem,
  CourseLessonItem,
  CourseMaterialItem,
  CourseSectionItem,
  EnrollmentItem,
  PaymentPlanTemplateItem,
  TeacherDirectoryItem,
} from '../types/courses.types';

/**
 * 100% API-driven service for Categories, Courses, Multi-Teacher Assignments,
 * Payment Plan Templates, Curriculum Sections/Lessons, Materials, Enrollments, and Users.
 */
export const coursesService = {
  // Users & Teachers Directory
  async listUsers(params?: Record<string, string | number>): Promise<{
    items: TeacherDirectoryItem[];
    meta: Record<string, unknown> | null;
  }> {
    const res = await apiClient.get<ApiEnvelope<TeacherDirectoryItem[]>>('/users', { params });
    return { items: res.data.data, meta: res.data.meta };
  },

  async listActiveTeachers(): Promise<TeacherDirectoryItem[]> {
    const res = await apiClient.get<ApiEnvelope<TeacherDirectoryItem[]>>('/users/teachers');
    return res.data.data;
  },

  async createUserByAdmin(payload: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    role: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
    specialization?: string;
    defaultRevenueSharePercent?: number;
    department?: string;
  }): Promise<TeacherDirectoryItem> {
    const res = await apiClient.post<ApiEnvelope<TeacherDirectoryItem>>('/users', payload);
    return res.data.data;
  },

  // Course Categories
  async listCategories(): Promise<CourseCategoryItem[]> {
    const res = await apiClient.get<ApiEnvelope<CourseCategoryItem[]>>('/courses/categories');
    return res.data.data;
  },

  async createCategory(payload: {
    name: string;
    slug: string;
    description?: string;
  }): Promise<CourseCategoryItem> {
    const res = await apiClient.post<ApiEnvelope<CourseCategoryItem>>(
      '/courses/categories',
      payload
    );
    return res.data.data;
  },

  // Courses
  async listCourses(params?: Record<string, string | number>): Promise<{
    items: CourseItem[];
    meta: Record<string, unknown> | null;
  }> {
    const res = await apiClient.get<ApiEnvelope<CourseItem[]>>('/courses', { params });
    return { items: res.data.data, meta: res.data.meta };
  },

  async getCourseDetail(courseId: string): Promise<CourseItem> {
    const res = await apiClient.get<ApiEnvelope<CourseItem>>(`/courses/${courseId}`);
    return res.data.data;
  },

  async createCourse(payload: {
    categoryId: string;
    code: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    language: string;
    basePrice: number;
    minAttendancePercent: number;
    minPassMarksPercent: number;
  }): Promise<CourseItem> {
    const res = await apiClient.post<ApiEnvelope<CourseItem>>('/courses', payload);
    return res.data.data;
  },

  async updateCourseStatus(
    courseId: string,
    status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
  ): Promise<CourseItem> {
    const res = await apiClient.patch<ApiEnvelope<CourseItem>>(`/courses/${courseId}/status`, {
      status,
    });
    return res.data.data;
  },

  async assignTeacher(
    courseId: string,
    payload: {
      teacherId: string;
      assignmentRole: 'PRIMARY' | 'CO_INSTRUCTOR' | 'TEACHING_ASSISTANT';
      revenueSharePercent: number;
    }
  ): Promise<AssignedTeacherItem> {
    const res = await apiClient.post<ApiEnvelope<AssignedTeacherItem>>(
      `/courses/${courseId}/teachers`,
      payload
    );
    return res.data.data;
  },

  async createPaymentPlanTemplate(
    courseId: string,
    payload: {
      name: string;
      planType: 'FULL' | 'INSTALLMENT';
      installmentCount: number;
      totalAmount: number;
      gracePeriodDays: number;
    }
  ): Promise<PaymentPlanTemplateItem> {
    const res = await apiClient.post<ApiEnvelope<PaymentPlanTemplateItem>>(
      `/courses/${courseId}/payment-plans`,
      payload
    );
    return res.data.data;
  },

  async createSection(
    courseId: string,
    payload: { title: string; description?: string; sortOrder: number }
  ): Promise<CourseSectionItem> {
    const res = await apiClient.post<ApiEnvelope<CourseSectionItem>>(
      `/courses/${courseId}/sections`,
      payload
    );
    return res.data.data;
  },

  async createLesson(
    courseId: string,
    sectionId: string,
    payload: {
      title: string;
      contentType: 'VIDEO' | 'DOCUMENT' | 'QUIZ' | 'LIVE_SESSION';
      durationSeconds: number;
      sortOrder: number;
      isPreview: boolean;
    }
  ): Promise<CourseLessonItem> {
    const res = await apiClient.post<ApiEnvelope<CourseLessonItem>>(
      `/courses/${courseId}/sections/${sectionId}/lessons`,
      payload
    );
    return res.data.data;
  },

  // Materials
  async listMaterials(courseId: string): Promise<CourseMaterialItem[]> {
    const res = await apiClient.get<ApiEnvelope<CourseMaterialItem[]>>(
      `/materials/courses/${courseId}`
    );
    return res.data.data;
  },

  async createMaterial(
    courseId: string,
    payload: {
      title: string;
      description?: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }
  ): Promise<{ material: CourseMaterialItem; uploadTicket: { uploadToken: string; expiresAt: string } }> {
    const res = await apiClient.post<
      ApiEnvelope<{
        material: CourseMaterialItem;
        uploadTicket: { uploadToken: string; expiresAt: string };
      }>
    >(`/materials/courses/${courseId}`, payload);
    return res.data.data;
  },

  // Enrollments
  async listEnrollments(params?: Record<string, string | number>): Promise<EnrollmentItem[]> {
    const res = await apiClient.get<ApiEnvelope<EnrollmentItem[]>>('/enrollments', { params });
    return res.data.data;
  },

  async initiateEnrollment(payload: {
    courseId: string;
    paymentPlanTemplateId: string;
  }): Promise<EnrollmentItem> {
    const res = await apiClient.post<ApiEnvelope<EnrollmentItem>>('/enrollments', payload);
    return res.data.data;
  },

  async verifyInstallmentPayment(
    enrollmentId: string,
    payload: {
      installmentSequenceNumber: number;
      provider: 'RAZORPAY' | 'WALLET' | 'MANUAL';
      providerPaymentId: string;
      idempotencyKey: string;
    }
  ): Promise<EnrollmentItem> {
    const res = await apiClient.post<ApiEnvelope<EnrollmentItem>>(
      `/enrollments/${enrollmentId}/verify-payment`,
      payload
    );
    return res.data.data;
  },
};
