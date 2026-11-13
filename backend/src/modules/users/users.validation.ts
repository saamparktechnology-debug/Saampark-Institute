import { z } from 'zod';

export const createUserByAdminValidation = {
  body: z.object({
    fullName: z.string().trim().min(2).max(150),
    email: z.string().trim().email().toLowerCase(),
    phone: z.string().trim().min(8).max(24).optional(),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']),
    specialization: z.string().trim().max(255).optional(),
    defaultRevenueSharePercent: z.number().min(0).max(100).optional(),
    department: z.string().trim().max(64).optional(),
  }),
};

export const updateUserStatusValidation = {
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'DISABLED']).optional(),
    fullName: z.string().trim().min(2).max(150).optional(),
  }),
};
