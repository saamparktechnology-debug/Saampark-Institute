import { z } from 'zod';

export const rolePanelSchema = z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']);

export const loginValidation = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    rolePanel: rolePanelSchema,
  }),
};

export const studentSignupValidation = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name is required').max(150),
    email: z.string().trim().email('Valid email is required').toLowerCase(),
    phone: z.string().trim().min(8).max(20).optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    referralCode: z.string().trim().max(32).optional(),
  }),
};
