import { EnrollmentStatus, InstallmentStatus, PaymentPlanType } from '@prisma/client';

export interface InstallmentDto {
  id: string;
  sequenceNumber: number;
  amount: string;
  currency: string;
  dueAt: string;
  graceEndsAt: string;
  status: InstallmentStatus;
  paidAt: string | null;
}

export interface EnrollmentOnboardingStateDto {
  enrollmentId: string;
  step1PlanAndPaymentVerified: boolean;
  step2AcademicPolicyAccepted: boolean;
  step3WhatsappAlertsOptIn: boolean;
  whatsappNumber: string;
  step4StarterKitAndFirstLesson: boolean;
  completedStepsCount: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface EnrollmentSummaryDto {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  planTypeSnapshot: PaymentPlanType;
  purchasedPriceSnapshot: string;
  currencySnapshot: string;
  status: EnrollmentStatus;
  progressPercent: string;
  enrolledAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
  completedAt: string | null;
  installments: InstallmentDto[];
  onboarding?: EnrollmentOnboardingStateDto;
}
