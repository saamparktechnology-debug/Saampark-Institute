import { z } from 'zod';

export const createMaterialValidation = {
  params: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
  }),
  body: z.object({
    lessonId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional(),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(120),
    sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
    fileBase64: z.string().optional().nullable(),
  }),
};

export const listCourseMaterialsValidation = {
  params: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
  }),
};

export const downloadMaterialValidation = {
  params: z.object({
    materialId: z.string().uuid('Valid materialId UUID is required'),
  }),
};
