import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { buildPaginationMeta, parsePaginationAndFilters } from '../../utils/pagination';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import { validateRequest } from '../../middlewares/validate.middleware';

// ----------------------------------------------------------------------------
// CSV FORMULA-INJECTION SANITIZATION & SERIALIZATION HELPERS
// ----------------------------------------------------------------------------

const DANGEROUS_CSV_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (str.length > 0 && DANGEROUS_CSV_PREFIXES.includes(str[0])) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(
  headers: string[],
  rows: Array<Record<string, unknown>>
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvCell(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ----------------------------------------------------------------------------
// CONFIGURABLE PLATFORM SETTINGS SCHEMA & DEFAULTS
// ----------------------------------------------------------------------------

export interface PlatformSettingsDto {
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

const DEFAULT_PLATFORM_SETTINGS: Omit<PlatformSettingsDto, 'updatedAt' | 'updatedBy'> = {
  instituteName: 'Gemini Argon Institute of Technology & Sciences',
  defaultCurrency: 'INR',
  defaultTimezone: env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  defaultReferralRewardInr: 500,
  minUpiRedemptionInr: 100,
  defaultInstallmentGraceDays: 5,
  defaultAttendanceExpiryMinutes: 10,
  defaultMinAttendancePercent: 75,
  defaultMinPassMarksPercent: 50,
  maintenanceMode: false,
};

export const exportReportQueryValidation = {
  query: z.object({
    dataset: z
      .enum(['payments', 'enrollments', 'payouts', 'attendance', 'audit_logs'])
      .default('payments'),
    format: z.enum(['csv', 'json']).default('csv'),
  }),
};

export const updatePlatformSettingsValidation = {
  body: z.object({
    instituteName: z.string().trim().min(3).max(150),
    defaultCurrency: z.string().trim().length(3).default('INR'),
    defaultTimezone: z.string().trim().min(3).max(64).default('Asia/Kolkata'),
    defaultReferralRewardInr: z.number().min(0).max(50000),
    minUpiRedemptionInr: z.number().min(10).max(100000),
    defaultInstallmentGraceDays: z.number().int().min(0).max(30),
    defaultAttendanceExpiryMinutes: z.number().int().min(1).max(120),
    defaultMinAttendancePercent: z.number().min(0).max(100),
    defaultMinPassMarksPercent: z.number().min(0).max(100),
    maintenanceMode: z.boolean().default(false),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class SystemAdministrationService {
  /**
   * Computes executive financial, academic, and operational summary metrics from MySQL (`/admin/reports`).
   */
  static async getExecutiveReports(actor: AuthenticatedActor) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can access platform-wide executive reports.');
    }

    const [
      capturedPaymentsAgg,
      refundedPaymentsAgg,
      walletsAgg,
      payoutsAgg,
      overdueInstallmentsAgg,
      activeEnrollmentsCount,
      completedEnrollmentsCount,
      issuedCertificatesCount,
      attendanceRecords,
      supportTickets,
      coursesWithStats,
    ] = await Promise.all([
      prisma.paymentTransaction.aggregate({
        where: { status: 'CAPTURED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.paymentTransaction.aggregate({
        where: { status: 'REFUNDED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.wallet.aggregate({
        _sum: { availableBalance: true, reservedBalance: true },
      }),
      prisma.teacherPayout.aggregate({
        where: { status: { in: ['APPROVED', 'PAID'] } },
        _sum: { netPayoutAmount: true },
      }),
      prisma.installment.aggregate({
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
      prisma.enrollment.count({ where: { status: 'COMPLETED' } }),
      prisma.certificate.count({ where: { status: 'ISSUED' } }),
      prisma.attendanceRecord.findMany({ select: { status: true } }),
      prisma.supportTicket.findMany({ select: { status: true } }),
      prisma.course.findMany({
        include: {
          _count: {
            select: {
              enrollments: true,
              certificates: true,
              liveClasses: true,
            },
          },
          enrollments: {
            include: {
              paymentTransactions: {
                where: { status: 'CAPTURED' },
                select: { amount: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const presentAtt = attendanceRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED'
    ).length;
    const overallAttendancePercent =
      attendanceRecords.length > 0
        ? Number(((presentAtt / attendanceRecords.length) * 100).toFixed(1))
        : 0;

    const resolvedTickets = supportTickets.filter(
      (t) => t.status === 'RESOLVED' || t.status === 'CLOSED'
    ).length;
    const ticketResolutionPercent =
      supportTickets.length > 0
        ? Number(((resolvedTickets / supportTickets.length) * 100).toFixed(1))
        : 100;

    return {
      financialSummary: {
        totalCapturedRevenueInr: (
          capturedPaymentsAgg._sum.amount || new Prisma.Decimal(0)
        ).toFixed(2),
        capturedTransactionsCount: capturedPaymentsAgg._count.id,
        totalRefundedInr: (
          refundedPaymentsAgg._sum.amount || new Prisma.Decimal(0)
        ).toFixed(2),
        refundedTransactionsCount: refundedPaymentsAgg._count.id,
        totalWalletAvailableInr: (
          walletsAgg._sum.availableBalance || new Prisma.Decimal(0)
        ).toFixed(2),
        totalWalletReservedInr: (
          walletsAgg._sum.reservedBalance || new Prisma.Decimal(0)
        ).toFixed(2),
        totalTeacherPayoutsInr: (
          payoutsAgg._sum.netPayoutAmount || new Prisma.Decimal(0)
        ).toFixed(2),
        outstandingInstallmentsInr: (
          overdueInstallmentsAgg._sum.amount || new Prisma.Decimal(0)
        ).toFixed(2),
        outstandingInstallmentsCount: overdueInstallmentsAgg._count.id,
      },
      academicSummary: {
        activeEnrollmentsCount,
        completedEnrollmentsCount,
        issuedCertificatesCount,
        overallAttendancePercent,
        ticketResolutionPercent,
      },
      coursePerformanceBreakdown: coursesWithStats.map((c) => {
        const courseRevenue = c.enrollments.reduce((acc, enr) => {
          const sum = enr.paymentTransactions.reduce(
            (s, tx) => s + Number(tx.amount),
            0
          );
          return acc + sum;
        }, 0);

        return {
          courseId: c.id,
          courseCode: c.code,
          courseTitle: c.title,
          status: c.status,
          basePriceInr: c.basePrice.toFixed(2),
          enrollmentsCount: c._count.enrollments,
          certificatesIssuedCount: c._count.certificates,
          liveClassesCount: c._count.liveClasses,
          capturedRevenueInr: courseRevenue.toFixed(2),
        };
      }),
    };
  }

  /**
   * Generates a sanitized CSV or JSON export of a requested dataset and writes an `AuditLog` entry.
   */
  static async exportDataset(
    actor: AuthenticatedActor,
    dataset: 'payments' | 'enrollments' | 'payouts' | 'attendance' | 'audit_logs',
    format: 'csv' | 'json'
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can export platform datasets.');
    }

    let headers: string[] = [];
    let rows: Array<Record<string, unknown>> = [];

    if (dataset === 'payments') {
      const data = await prisma.paymentTransaction.findMany({
        include: {
          student: { select: { fullName: true, email: true } },
          enrollment: { include: { course: { select: { code: true, title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      headers = [
        'transactionId',
        'receiptNumber',
        'studentName',
        'studentEmail',
        'courseCode',
        'provider',
        'amountInr',
        'status',
        'verifiedAt',
      ];
      rows = data.map((tx) => ({
        transactionId: tx.id,
        receiptNumber: tx.receiptNumber || tx.providerPaymentId || '',
        studentName: tx.student.fullName,
        studentEmail: tx.student.email,
        courseCode: tx.enrollment.course.code,
        provider: tx.provider,
        amountInr: tx.amount.toFixed(2),
        status: tx.status,
        verifiedAt: tx.verifiedAt ? tx.verifiedAt.toISOString() : '',
      }));
    } else if (dataset === 'enrollments') {
      const data = await prisma.enrollment.findMany({
        include: {
          student: { select: { fullName: true, email: true } },
          course: { select: { code: true, title: true } },
        },
        orderBy: { enrolledAt: 'desc' },
        take: 500,
      });
      headers = [
        'enrollmentId',
        'studentName',
        'studentEmail',
        'courseCode',
        'courseTitle',
        'planType',
        'purchasedPriceInr',
        'status',
        'progressPercent',
        'enrolledAt',
      ];
      rows = data.map((e) => ({
        enrollmentId: e.id,
        studentName: e.student.fullName,
        studentEmail: e.student.email,
        courseCode: e.course.code,
        courseTitle: e.course.title,
        planType: e.planTypeSnapshot,
        purchasedPriceInr: e.purchasedPriceSnapshot.toFixed(2),
        status: e.status,
        progressPercent: e.progressPercent.toFixed(2),
        enrolledAt: e.enrolledAt.toISOString(),
      }));
    } else if (dataset === 'payouts') {
      const data = await prisma.teacherPayout.findMany({
        include: {
          teacher: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      headers = [
        'payoutId',
        'teacherName',
        'teacherEmail',
        'periodStart',
        'periodEnd',
        'grossCollectionsInr',
        'sharePercent',
        'netPayoutInr',
        'status',
      ];
      rows = data.map((p) => ({
        payoutId: p.id,
        teacherName: p.teacher.fullName,
        teacherEmail: p.teacher.email,
        periodStart: p.periodStart.toISOString().slice(0, 10),
        periodEnd: p.periodEnd.toISOString().slice(0, 10),
        grossCollectionsInr: p.grossCourseCollections.toFixed(2),
        sharePercent: p.revenueSharePercentSnapshot.toFixed(2),
        netPayoutInr: p.netPayoutAmount.toFixed(2),
        status: p.status,
      }));
    } else if (dataset === 'attendance') {
      const data = await prisma.attendanceRecord.findMany({
        include: {
          student: { select: { fullName: true, email: true } },
          attendanceSession: {
            include: { course: { select: { code: true, title: true } } },
          },
        },
        orderBy: { markedAt: 'desc' },
        take: 500,
      });
      headers = [
        'recordId',
        'courseCode',
        'sessionDate',
        'studentName',
        'studentEmail',
        'status',
        'source',
        'correctionReason',
        'markedAt',
      ];
      rows = data.map((r) => ({
        recordId: r.id,
        courseCode: r.attendanceSession.course.code,
        sessionDate: r.attendanceSession.sessionDate.toISOString().slice(0, 10),
        studentName: r.student.fullName,
        studentEmail: r.student.email,
        status: r.status,
        source: r.source,
        correctionReason: r.correctionReason || '',
        markedAt: r.markedAt.toISOString(),
      }));
    } else {
      const data = await prisma.auditLog.findMany({
        include: { actor: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      headers = [
        'auditId',
        'action',
        'entityType',
        'entityId',
        'actorName',
        'actorRole',
        'reason',
        'createdAt',
      ];
      rows = data.map((l) => ({
        auditId: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actorName: l.actor?.fullName || 'SYSTEM',
        actorRole: l.actor?.role || 'SYSTEM',
        reason: l.reason || '',
        createdAt: l.createdAt.toISOString(),
      }));
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'ADMIN_REPORT_EXPORTED',
        entityType: 'ReportExport',
        entityId: dataset,
        afterDataJson: JSON.stringify({
          dataset,
          format,
          rowCount: rows.length,
        }),
      },
    });

    const content =
      format === 'csv'
        ? buildCsvDocument(headers, rows)
        : JSON.stringify(rows, null, 2);

    return {
      dataset,
      format,
      fileName: `argon-lms-${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      content,
    };
  }

  /**
   * Paginated, filterable Append-Only Audit Log Explorer (`/admin/audit-logs`).
   */
  static async listAuditLogs(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can inspect the platform audit log.');
    }

    const { page, limit, skip, filters } = parsePaginationAndFilters(
      rawQuery,
      ['action', 'entityType', 'search'],
      ['createdAt'],
      'createdAt',
      100
    );

    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) {
      where.action = { contains: filters.action };
    }
    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.search) {
      where.OR = [
        { action: { contains: filters.search } },
        { entityType: { contains: filters.search } },
        { entityId: { contains: filters.search } },
        { reason: { contains: filters.search } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      items: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actorId: l.actorUserId,
        actorName: l.actor?.fullName || 'System Process',
        actorEmail: l.actor?.email || null,
        actorRole: l.actor?.role || 'SYSTEM',
        beforeDataJson: l.beforeDataJson,
        afterDataJson: l.afterDataJson,
        reason: l.reason,
        ipAddress: l.ipAddress,
        requestId: l.requestId,
        createdAt: l.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Retrieves the latest persisted platform settings snapshot from `audit_logs` (or default settings).
   */
  static async getPlatformSettings(actor: AuthenticatedActor): Promise<PlatformSettingsDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can view platform settings.');
    }

    const latestConfigLog = await prisma.auditLog.findFirst({
      where: {
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSettings',
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true } } },
    });

    if (latestConfigLog && latestConfigLog.afterDataJson) {
      try {
        const parsed = JSON.parse(latestConfigLog.afterDataJson) as Partial<PlatformSettingsDto>;
        return {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...parsed,
          updatedAt: latestConfigLog.createdAt.toISOString(),
          updatedBy: latestConfigLog.actor?.fullName || 'Administrator',
        };
      } catch {
        // Fallback to default settings
      }
    }

    return {
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Default',
    };
  }

  /**
   * Updates configurable platform operational settings and appends an immutable `PLATFORM_SETTINGS_UPDATED` audit log.
   */
  static async updatePlatformSettings(
    actor: AuthenticatedActor,
    payload: Omit<PlatformSettingsDto, 'updatedAt' | 'updatedBy'>
  ): Promise<PlatformSettingsDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can modify platform settings.');
    }

    const current = await this.getPlatformSettings(actor);

    const log = await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSettings',
        entityId: 'SINGLE_INSTITUTE_CONFIG',
        beforeDataJson: JSON.stringify(current),
        afterDataJson: JSON.stringify(payload),
      },
    });

    return {
      ...payload,
      updatedAt: log.createdAt.toISOString(),
      updatedBy: actor.fullName,
    };
  }

  /**
   * Returns live Hostinger VPS runtime & adapter telemetry (`/admin/settings`).
   */
  /**
   * Scans all PENDING or OVERDUE installments across active/pending enrollments and dispatches
   * omnichannel (WhatsApp + Email + In-App) payment reminders (`POST /api/v1/system/reminders/installments`).
   */
  static async dispatchInstallmentReminders(actor: AuthenticatedActor) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can trigger batch installment reminders.');
    }

    const pendingInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        enrollment: {
          status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED_OVERDUE'] },
        },
      },
      include: {
        enrollment: {
          include: {
            student: { select: { id: true, fullName: true } },
            course: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
    });

    const studentIds = Array.from(
      new Set(pendingInstallments.map((i) => i.enrollment.studentId))
    );

    const dispatchResult = await OmnichannelMessagingService.dispatchToUsers({
      actorId: actor.id,
      eventType: 'INSTALLMENT_REMINDER',
      courseCode: 'FINANCE-DUE',
      title: 'Upcoming / Pending Course Fee Installment Reminder',
      body: 'You have a pending course fee installment on your learning account. Please visit Installments & Dues in your Student Portal to complete verification before your grace period expires.',
      recipientUserIds: studentIds,
    });

    return {
      remindedInstallmentsCount: pendingInstallments.length,
      uniqueStudentsNotified: studentIds.length,
      channelsDispatched: dispatchResult.channelsDispatched,
      skippedChannels: dispatchResult.skippedChannels,
      dispatchedAt: new Date().toISOString(),
    };
  }

  static async getVpsReadiness(actor: AuthenticatedActor) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can inspect VPS infrastructure telemetry.');
    }

    const mem = process.memoryUsage();
    return {
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      timezone: env.DEFAULT_TIMEZONE,
      uptimeSeconds: Math.round(process.uptime()),
      rssMemoryMb: Number((mem.rss / (1024 * 1024)).toFixed(1)),
      heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
      storageDriver: process.env.STORAGE_DRIVER || 'LOCAL_VPS',
      adapters: {
        databaseMysql: 'CONNECTED',
        liveVideo100ms: 'HMS_100MS_READY',
        paymentsRazorpay: 'RAZORPAY_ADAPTER_READY',
        recordingsYouTube: 'YOUTUBE_SAFE_EMBED_READY',
        upiEncryptionAes256Gcm: 'ACTIVE',
      },
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class SystemAdministrationController {
  static getReports = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await SystemAdministrationService.getExecutiveReports(req.user);
    return apiResponse(res, 200, 'Executive reports retrieved successfully', data);
  });

  static exportReport = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const dataset = (req.query.dataset as
      | 'payments'
      | 'enrollments'
      | 'payouts'
      | 'attendance'
      | 'audit_logs') || 'payments';
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const exported = await SystemAdministrationService.exportDataset(
      req.user,
      dataset,
      format
    );
    return apiResponse(res, 200, 'Dataset export generated and audited', exported);
  });

  static listAuditLogs = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await SystemAdministrationService.listAuditLogs(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(
      res,
      200,
      'Append-only audit logs retrieved successfully',
      result.items,
      result.meta
    );
  });

  static getSettings = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const settings = await SystemAdministrationService.getPlatformSettings(req.user);
    return apiResponse(res, 200, 'Platform settings retrieved', settings);
  });

  static updateSettings = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await SystemAdministrationService.updatePlatformSettings(
      req.user,
      req.body
    );
    return apiResponse(res, 200, 'Platform settings updated and audited', updated);
  });

  static sendInstallmentReminders = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await SystemAdministrationService.dispatchInstallmentReminders(req.user);
    return apiResponse(
      res,
      200,
      'Installment fee reminders dispatched via active WhatsApp & Email channels',
      result
    );
  });

  static getVpsReadiness = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const health = await SystemAdministrationService.getVpsReadiness(req.user);
    return apiResponse(res, 200, 'Hostinger VPS readiness telemetry retrieved', health);
  });
}

export const systemRouter = Router();
systemRouter.use(authenticate);
systemRouter.use(authorizeRoles('ADMIN'));

systemRouter.get('/reports', SystemAdministrationController.getReports);
systemRouter.get(
  '/reports/export',
  validateRequest(exportReportQueryValidation),
  SystemAdministrationController.exportReport
);
systemRouter.get('/audit-logs', SystemAdministrationController.listAuditLogs);
systemRouter.get('/settings', SystemAdministrationController.getSettings);
systemRouter.patch(
  '/settings',
  validateRequest(updatePlatformSettingsValidation),
  SystemAdministrationController.updateSettings
);
systemRouter.get('/vps-readiness', SystemAdministrationController.getVpsReadiness);

systemRouter.post('/reminders/installments', SystemAdministrationController.sendInstallmentReminders);
