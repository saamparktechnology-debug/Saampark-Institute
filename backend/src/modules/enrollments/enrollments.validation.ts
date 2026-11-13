import { z } from 'zod';

export const initiateEnrollmentValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    paymentPlanTemplateId: z.string().uuid('Valid paymentPlanTemplateId UUID is required'),
  }),
};

export const adminAssignEnrollmentValidation = {
  body: z.object({
    studentId: z.string().uuid('Valid studentId UUID is required'),
    courseId: z.string().uuid('Valid courseId UUID is required'),
    paymentPlanTemplateId: z.string().uuid('Valid paymentPlanTemplateId UUID is required'),
    admissionMode: z
      .enum(['VERIFY_FIRST_INSTALLMENT', 'FULL_SCHOLARSHIP', 'PENDING_PAYMENT'])
      .default('VERIFY_FIRST_INSTALLMENT'),
    notes: z.string().trim().max(255).optional(),
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

export const updateOnboardingStateValidation = {
  params: z.object({
    enrollmentId: z.string().uuid('Valid enrollmentId UUID is required'),
  }),
  body: z.object({
    step2AcademicPolicyAccepted: z.boolean().optional(),
    step3WhatsappAlertsOptIn: z.boolean().optional(),
    whatsappNumber: z.string().trim().min(8).max(24).optional(),
    step4StarterKitAndFirstLesson: z.boolean().optional(),
  }),
};

export const extendInstallmentScheduleValidation = {
  params: z.object({
    enrollmentId: z.string().uuid('Valid enrollmentId UUID is required'),
  }),
  body: z.object({
    extensionDays: z.number().int().min(1).max(90).default(7),
    reason: z
      .string()
      .trim()
      .min(5, 'Provide a mandatory audit reason (min 5 characters) for the moratorium/extension')
      .max(255),
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
