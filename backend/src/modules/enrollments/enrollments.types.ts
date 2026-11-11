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

export interface EnrollmentSummaryDto {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
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
}
