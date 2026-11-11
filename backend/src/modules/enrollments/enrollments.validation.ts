import { z } from 'zod';

export const initiateEnrollmentValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    paymentPlanTemplateId: z.string().uuid('Valid paymentPlanTemplateId UUID is required'),
  }),
};

export const verifyInstallmentPaymentValidation = {
  params: z.object({
    enrollmentId: z.string().uuid('Valid enrollmentId UUID is required'),
  }),
  body: z.object({
    installmentSequenceNumber: z.number().int().min(1).default(1),
    provider: z.enum(['RAZORPAY', 'WALLET', 'MANUAL']).default('RAZORPAY'),
    providerPaymentId: z.string().trim().min(4).max(120),
    idempotencyKey: z.string().trim().min(6).max(120),
  }),
};

export const updateEnrollmentProgressValidation = {
  params: z.object({
    enrollmentId: z.string().uuid(),
  }),
  body: z.object({
    progressPercent: z.number().min(0).max(100),
  }),
};
