import { z } from 'zod';

export const createCategoryValidation = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().trim().max(1000).optional(),
    isActive: z.boolean().optional().default(true),
  }),
};

export const createCourseValidation = {
  body: z.object({
    categoryId: z.string().uuid('Valid categoryId UUID is required'),
    code: z.string().trim().min(2).max(32).toUpperCase(),
    title: z.string().trim().min(3).max(200),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(220)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    shortDescription: z.string().trim().min(10).max(500),
    description: z.string().trim().min(20),
    thumbnailUrl: z.string().url().optional().nullable(),
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('INTERMEDIATE'),
    language: z.string().trim().min(2).max(64).default('English'),
    basePrice: z.number().nonnegative('Course basePrice must be non-negative'),
    currency: z.string().length(3).default('INR'),
    minAttendancePercent: z.number().min(0).max(100).default(75),
    minPassMarksPercent: z.number().min(0).max(100).default(50),
  }),
};

export const updateCourseStatusValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
  }),
};

export const assignTeacherValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    teacherId: z.string().uuid('Valid teacher user UUID is required'),
    assignmentRole: z.enum(['PRIMARY', 'CO_INSTRUCTOR', 'TEACHING_ASSISTANT']).default('PRIMARY'),
    revenueSharePercent: z
      .number()
      .min(0, 'Revenue share cannot be negative')
      .max(100, 'Revenue share cannot exceed 100%')
      .default(30),
  }),
};

export const createPaymentPlanTemplateValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(120),
    planType: z.enum(['FULL', 'INSTALLMENT']),
    installmentCount: z.number().int().min(1).max(24),
    totalAmount: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    gracePeriodDays: z.number().int().min(0).max(30).default(5),
  }),
};

export const createSectionValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional(),
    sortOrder: z.number().int().min(1).default(1),
  }),
};

export const createLessonValidation = {
  params: z.object({
    courseId: z.string().uuid(),
    sectionId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(200),
    contentType: z.enum(['VIDEO', 'DOCUMENT', 'QUIZ', 'LIVE_SESSION']).default('VIDEO'),
    durationSeconds: z.number().int().min(0).default(0),
    sortOrder: z.number().int().min(1).default(1),
    isPreview: z.boolean().default(false),
  }),
};

export const toggleLessonCompleteValidation = {
  params: z.object({
    courseId: z.string().uuid(),
    lessonId: z.string().uuid(),
  }),
  body: z.object({
    completed: z.boolean().optional(),
  }),
};

export const broadcastCourseAnnouncementValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(5).max(2000),
  }),
};

export const createCourseDoubtValidation = {
  params: z.object({
    courseId: z.string().uuid(),
  }),
  body: z.object({
    lessonTitle: z.string().trim().max(200).optional(),
    subject: z.string().trim().min(3).max(200),
    question: z.string().trim().min(5).max(2000),
  }),
};

export const replyCourseDoubtValidation = {
  params: z.object({
    courseId: z.string().uuid(),
    doubtId: z.string().uuid(),
  }),
  body: z.object({
    message: z.string().trim().min(2).max(2000),
  }),
};
