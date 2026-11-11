'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { coursesService } from '../services/courses.service';

export function useUsersListQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => coursesService.listUsers(filters),
  });
}

export function useActiveTeachersQuery() {
  return useQuery({
    queryKey: queryKeys.users.teachers(),
    queryFn: () => coursesService.listActiveTeachers(),
  });
}

export function useCreateUserByAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesService.createUserByAdmin,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.courses.categories(),
    queryFn: () => coursesService.listCategories(),
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesService.createCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.categories() });
    },
  });
}

export function useCoursesListQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: () => coursesService.listCourses(filters),
  });
}

export function useCourseDetailQuery(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: () => coursesService.getCourseDetail(courseId),
    enabled: Boolean(courseId),
  });
}

export function useCourseMaterialsQuery(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courses.materials(courseId),
    queryFn: () => coursesService.listMaterials(courseId),
    enabled: Boolean(courseId),
  });
}

export function useEnrollmentsListQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.enrollments.list(filters),
    queryFn: () => coursesService.listEnrollments(filters),
  });
}

export function useCreateCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesService.createCourse,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useUpdateCourseStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      status,
    }: {
      courseId: string;
      status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
    }) => coursesService.updateCourseStatus(courseId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useAssignTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      teacherId,
      assignmentRole,
      revenueSharePercent,
    }: {
      courseId: string;
      teacherId: string;
      assignmentRole: 'PRIMARY' | 'CO_INSTRUCTOR' | 'TEACHING_ASSISTANT';
      revenueSharePercent: number;
    }) =>
      coursesService.assignTeacher(courseId, {
        teacherId,
        assignmentRole,
        revenueSharePercent,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useCreatePaymentPlanTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      name,
      planType,
      installmentCount,
      totalAmount,
      gracePeriodDays,
    }: {
      courseId: string;
      name: string;
      planType: 'FULL' | 'INSTALLMENT';
      installmentCount: number;
      totalAmount: number;
      gracePeriodDays: number;
    }) =>
      coursesService.createPaymentPlanTemplate(courseId, {
        name,
        planType,
        installmentCount,
        totalAmount,
        gracePeriodDays,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export function useCreateSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      title,
      description,
      sortOrder,
    }: {
      courseId: string;
      title: string;
      description?: string;
      sortOrder: number;
    }) => coursesService.createSection(courseId, { title, description, sortOrder }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseId),
      });
    },
  });
}

export function useCreateLessonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      title,
      contentType,
      durationSeconds,
      sortOrder,
      isPreview,
    }: {
      courseId: string;
      sectionId: string;
      title: string;
      contentType: 'VIDEO' | 'DOCUMENT' | 'QUIZ' | 'LIVE_SESSION';
      durationSeconds: number;
      sortOrder: number;
      isPreview: boolean;
    }) =>
      coursesService.createLesson(courseId, sectionId, {
        title,
        contentType,
        durationSeconds,
        sortOrder,
        isPreview,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseId),
      });
    },
  });
}

export function useInitiateEnrollmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesService.initiateEnrollment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useVerifyInstallmentPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      enrollmentId,
      installmentSequenceNumber,
      provider,
      providerPaymentId,
      idempotencyKey,
    }: {
      enrollmentId: string;
      installmentSequenceNumber: number;
      provider: 'RAZORPAY' | 'WALLET' | 'MANUAL';
      providerPaymentId: string;
      idempotencyKey: string;
    }) =>
      coursesService.verifyInstallmentPayment(enrollmentId, {
        installmentSequenceNumber,
        provider,
        providerPaymentId,
        idempotencyKey,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useCreateMaterialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      title,
      description,
      fileName,
      mimeType,
      sizeBytes,
    }: {
      courseId: string;
      title: string;
      description?: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }) =>
      coursesService.createMaterial(courseId, {
        title,
        description,
        fileName,
        mimeType,
        sizeBytes,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.courses.materials(variables.courseId),
      });
    },
  });
}
