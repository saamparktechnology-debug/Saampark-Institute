export interface ExecutiveReportsData {
  financialSummary: {
    totalCapturedRevenueInr: string;
    capturedTransactionsCount: number;
    totalRefundedInr: string;
    refundedTransactionsCount: number;
    totalWalletAvailableInr: string;
    totalWalletReservedInr: string;
    totalTeacherPayoutsInr: string;
    outstandingInstallmentsInr: string;
    outstandingInstallmentsCount: number;
  };
  academicSummary: {
    activeEnrollmentsCount: number;
    completedEnrollmentsCount: number;
    issuedCertificatesCount: number;
    overallAttendancePercent: number;
    ticketResolutionPercent: number;
  };
  coursePerformanceBreakdown: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    status: string;
    basePriceInr: string;
    enrollmentsCount: number;
    certificatesIssuedCount: number;
    liveClassesCount: number;
    capturedRevenueInr: string;
  }>;
}

export interface DatasetExportResult {
  dataset: 'payments' | 'enrollments' | 'payouts' | 'attendance' | 'audit_logs';
  format: 'csv' | 'json';
  fileName: string;
  generatedAt: string;
  rowCount: number;
  content: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string;
  beforeDataJson: string | null;
  afterDataJson: string | null;
  reason: string | null;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface PlatformSettingsItem {
  instituteName: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultReferralRewardInr: number;
  minUpiRedemptionInr: number;
  defaultInstallmentGraceDays: number;
  defaultAttendanceExpiryMinutes: number;
  defaultMinAttendancePercent: number;
  defaultMinPassMarksPercent: number;
  maintenanceMode: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface VpsReadinessData {
  nodeVersion: string;
  environment: string;
  timezone: string;
  uptimeSeconds: number;
  rssMemoryMb: number;
  heapUsedMb: number;
  storageDriver: string;
  adapters: {
    databaseMysql: string;
    liveVideo100ms: string;
    paymentsRazorpay: string;
    recordingsYouTube: string;
    upiEncryptionAes256Gcm: string;
  };
}
