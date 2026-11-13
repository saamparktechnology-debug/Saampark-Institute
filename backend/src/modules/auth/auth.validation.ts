import { z } from 'zod';

export const rolePanelSchema = z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']);

export const loginValidation = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    rolePanel: rolePanelSchema,
  }),
};

export const requestOtpValidation = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    rolePanel: rolePanelSchema,
    purpose: z.enum(['PASSWORD_RESET', 'OTP_LOGIN']).default('PASSWORD_RESET'),
  }),
};

export const resetPasswordWithOtpValidation = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    rolePanel: rolePanelSchema,
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit numeric verification code'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number'),
  }),
};

export const loginWithOtpValidation = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    rolePanel: rolePanelSchema,
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit numeric verification code'),
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

export const changePasswordValidation = {
  body: z.object({
    currentPassword: z.string().min(6, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number'),
  }),
};

export const sessionIdParamValidation = {
  params: z.object({
    sessionId: z.string().uuid('Valid sessionId UUID is required'),
  }),
};
