import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { NotificationChannel, RoleType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  OmnichannelEventType,
  OmnichannelMessagingService,
} from '../../integrations/messaging.adapter';

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createNotificationValidation = {
  body: z.object({
    recipientUserId: z.string().uuid().optional(),
    targetRole: z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']).optional(),
    type: z.string().trim().min(2).max(64).default('SYSTEM_ALERT'),
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(5).max(2000),
    channel: z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']).default('IN_APP'),
  }),
};

export const notificationIdParamValidation = {
  params: z.object({
    notificationId: z.string().uuid('Valid notificationId UUID is required'),
  }),
};

const channelToggleSchema = z.object({
  whatsapp: z.boolean(),
  email: z.boolean(),
  inApp: z.boolean(),
  smsDlt: z.boolean().optional(),
});

export const updateOmnichannelSettingsValidation = {
  body: z.object({
    whatsappEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    smsDltEnabled: z.boolean().optional(),
    whatsappBusinessNumber: z.string().trim().min(5).max(32).optional(),
    whatsappProvider: z.enum(['META_CLOUD_API', 'TWILIO_WHATSAPP', 'WATI_GATEWAY']).optional(),
    smtpSenderEmail: z.string().trim().email().optional(),
    smtpProvider: z.enum(['HOSTINGER_SMTP', 'AWS_SES', 'RESEND']).optional(),
    smsDltProvider: z
      .enum(['MSG91_DLT', 'FAST2SMS_DLT', 'TEXTLOCAL_DLT', 'TWILIO_SMS'])
      .optional(),
    smsDltEntityId: z.string().trim().min(4).max(64).optional(),
    smsDltSenderId: z.string().trim().min(3).max(16).optional(),
    smsDltTemplateIdDefault: z.string().trim().min(4).max(64).optional(),
    smsDltFallbackOnWhatsappFailure: z.boolean().optional(),
    eventToggles: z
      .object({
        ONBOARDING_WELCOME: channelToggleSchema.optional(),
        LIVE_CLASS_SCHEDULED: channelToggleSchema.optional(),
        STUDY_MATERIAL_UPLOADED: channelToggleSchema.optional(),
        RECORDING_PUBLISHED: channelToggleSchema.optional(),
        ASSIGNMENT_PUBLISHED: channelToggleSchema.optional(),
        EXAM_PUBLISHED: channelToggleSchema.optional(),
        INSTALLMENT_REMINDER: channelToggleSchema.optional(),
        COURSE_ANNOUNCEMENT: channelToggleSchema.optional(),
      })
      .optional(),
  }),
};

export const testOmnichannelDispatchValidation = {
  body: z.object({
    eventType: z
      .enum([
        'ONBOARDING_WELCOME',
        'LIVE_CLASS_SCHEDULED',
        'STUDY_MATERIAL_UPLOADED',
        'RECORDING_PUBLISHED',
        'ASSIGNMENT_PUBLISHED',
        'EXAM_PUBLISHED',
        'INSTALLMENT_REMINDER',
        'COURSE_ANNOUNCEMENT',
      ])
      .default('LIVE_CLASS_SCHEDULED'),
    courseId: z.string().uuid().optional(),
    title: z.string().trim().min(3).max(200).optional(),
    body: z.string().trim().min(5).max(2000).optional(),
  }),
};

export const nudgeStudentValidation = {
  body: z.object({
    studentId: z.string().uuid('Valid studentId UUID is required'),
    courseCode: z.string().trim().max(32).optional(),
    eventType: z
      .enum([
        'ONBOARDING_WELCOME',
        'LIVE_CLASS_SCHEDULED',
        'STUDY_MATERIAL_UPLOADED',
        'RECORDING_PUBLISHED',
        'ASSIGNMENT_PUBLISHED',
        'EXAM_PUBLISHED',
        'INSTALLMENT_REMINDER',
        'COURSE_ANNOUNCEMENT',
      ])
      .default('COURSE_ANNOUNCEMENT'),
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(5).max(2000),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE (C-010, C-013)
// ----------------------------------------------------------------------------

export class NotificationsService {
  /**
   * Lists notifications strictly scoped to the authenticated recipient (`recipientUserId = actor.id`).
   */
  static async listMyNotifications(actor: AuthenticatedActor) {
    const [items, unreadCount, omnichannelSettings] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientUserId: actor.id },
        orderBy: { sentAt: 'desc' },
        take: 60,
      }),
      prisma.notification.count({
        where: { recipientUserId: actor.id, readAt: null },
      }),
      OmnichannelMessagingService.getSettings(),
    ]);

    return {
      unreadCount,
      channelsStatus: {
        whatsappEnabled: omnichannelSettings.whatsappEnabled,
        emailEnabled: omnichannelSettings.emailEnabled,
        inAppEnabled: omnichannelSettings.inAppEnabled,
        smsDltEnabled: omnichannelSettings.smsDltEnabled,
      },
      items: items.map((n) => {
        const isWhatsapp = n.type.startsWith('WHATSAPP_') || n.title.startsWith('[WhatsApp]');
        return {
          id: n.id,
          recipientUserId: n.recipientUserId,
          type: n.type,
          title: n.title,
          body: n.body,
          channel: n.channel,
          deliveryChannel: isWhatsapp ? 'WHATSAPP' : n.channel,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          sentAt: n.sentAt.toISOString(),
        };
      }),
    };
  }

  /**
   * Dispatches a targeted user notification or a role-wide broadcast notification.
   * Supports `WHATSAPP`, `EMAIL`, `IN_APP`, and `SMS`.
   */
  static async dispatchNotification(
    actor: AuthenticatedActor,
    payload: {
      recipientUserId?: string;
      targetRole?: RoleType;
      type: string;
      title: string;
      body: string;
      channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
    }
  ) {
    if (actor.role === 'STUDENT') {
      throw ApiError.forbidden('Students cannot broadcast system notifications.');
    }

    let recipientIds: string[] = [];
    if (payload.recipientUserId) {
      recipientIds = [payload.recipientUserId];
    } else if (payload.targetRole) {
      const users = await prisma.user.findMany({
        where: { role: payload.targetRole, status: 'ACTIVE' },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    } else {
      recipientIds = [actor.id];
    }

    if (recipientIds.length === 0) {
      throw ApiError.notFound('No active recipients found for notification dispatch.');
    }

    const dbChannel: NotificationChannel =
      payload.channel === 'WHATSAPP' ? 'SMS' : payload.channel;
    const resolvedType =
      payload.channel === 'WHATSAPP' ? `WHATSAPP_${payload.type}` : payload.type;
    const resolvedTitle =
      payload.channel === 'WHATSAPP' && !payload.title.startsWith('[WhatsApp]')
        ? `[WhatsApp] ${payload.title}`
        : payload.title;

    await prisma.$transaction(async (tx) => {
      await tx.notification.createMany({
        data: recipientIds.map((uid) => ({
          recipientUserId: uid,
          type: resolvedType,
          title: resolvedTitle,
          body: payload.body,
          channel: dbChannel,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'NOTIFICATION_DISPATCHED',
          entityType: 'Notification',
          entityId: recipientIds[0],
          afterDataJson: JSON.stringify({
            recipientCount: recipientIds.length,
            targetRole: payload.targetRole || null,
            title: resolvedTitle,
            channel: payload.channel,
          }),
        },
      });
    });

    return {
      dispatchedCount: recipientIds.length,
      title: resolvedTitle,
      channel: payload.channel,
    };
  }

  /**
   * Marks a single notification owned by `actor.id` as read.
   */
  static async markAsRead(actor: AuthenticatedActor, notificationId: string) {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing || existing.recipientUserId !== actor.id) {
      throw ApiError.notFound('Notification not found for your account.');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: existing.readAt || new Date() },
    });

    return {
      id: updated.id,
      readAt: updated.readAt?.toISOString() || null,
    };
  }

  /**
   * Marks all unread notifications for `actor.id` as read.
   */
  static async markAllAsRead(actor: AuthenticatedActor) {
    const result = await prisma.notification.updateMany({
      where: { recipientUserId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  /**
   * Sends a test or manual omnichannel notification respecting the Admin WhatsApp, Email & DLT SMS toggles.
   */
  static async sendTestOmnichannelAlert(
    actor: AuthenticatedActor,
    payload: {
      eventType: OmnichannelEventType;
      courseId?: string;
      title?: string;
      body?: string;
    }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or Teachers can trigger omnichannel test dispatches.');
    }

    const defaultTitle =
      payload.title || `Test Alert: ${payload.eventType.replace(/_/g, ' ')}`;
    const defaultBody =
      payload.body ||
      `This is a live omnichannel verification message dispatched by ${actor.fullName} to confirm Email, WhatsApp, DLT SMS, and In-App notification routing.`;

    if (payload.courseId) {
      return OmnichannelMessagingService.dispatchToCourseCohort({
        actorId: actor.id,
        courseId: payload.courseId,
        eventType: payload.eventType,
        title: defaultTitle,
        body: defaultBody,
      });
    }

    return OmnichannelMessagingService.dispatchToUsers({
      actorId: actor.id,
      eventType: payload.eventType,
      courseCode: 'TEST-VERIFY',
      title: defaultTitle,
      body: defaultBody,
      recipientUserIds: [actor.id],
    });
  }

  /**
   * Sends a direct 1-click omnichannel nudge (WhatsApp + Email + DLT SMS + In-App) to a specific student.
   */
  static async nudgeStudentOmnichannel(
    actor: AuthenticatedActor,
    payload: {
      studentId: string;
      courseCode?: string;
      eventType: OmnichannelEventType;
      title: string;
      body: string;
    }
  ) {
    if (actor.role === 'STUDENT') {
      throw ApiError.forbidden('Students cannot send administrative cohort nudges.');
    }

    return OmnichannelMessagingService.dispatchToUsers({
      actorId: actor.id,
      eventType: payload.eventType,
      courseCode: payload.courseCode || 'ACADEMIC-NUDGE',
      title: payload.title,
      body: payload.body,
      recipientUserIds: [payload.studentId],
    });
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class NotificationsController {
  static listMyNotifications = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await NotificationsService.listMyNotifications(req.user);
    return apiResponse(res, 200, 'Notifications retrieved successfully', data);
  });

  static createNotification = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await NotificationsService.dispatchNotification(req.user, req.body);
    return apiResponse(res, 201, 'Notification dispatched and audited', created);
  });

  static markAsRead = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await NotificationsService.markAsRead(
      req.user,
      String(req.params.notificationId)
    );
    return apiResponse(res, 200, 'Notification marked as read', updated);
  });

  static markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await NotificationsService.markAllAsRead(req.user);
    return apiResponse(res, 200, 'All notifications marked as read', result);
  });

  static getOmnichannelSettings = catchAsync(async (_req: Request, res: Response) => {
    const settings = await OmnichannelMessagingService.getSettings();
    return apiResponse(res, 200, 'Omnichannel notification settings retrieved', settings);
  });

  static updateOmnichannelSettings = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await OmnichannelMessagingService.updateSettings(req.user, req.body);
    return apiResponse(
      res,
      200,
      'Omnichannel WhatsApp, Email & DLT SMS notification settings updated',
      updated
    );
  });

  static listDeliveryLogs = catchAsync(async (_req: Request, res: Response) => {
    const logs = await OmnichannelMessagingService.listDeliveryLogs();
    return apiResponse(res, 200, 'Omnichannel delivery logs retrieved', logs);
  });

  static testOmnichannelDispatch = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await NotificationsService.sendTestOmnichannelAlert(req.user, req.body);
    return apiResponse(res, 200, 'Omnichannel test alert dispatched', result);
  });

  static nudgeStudent = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await NotificationsService.nudgeStudentOmnichannel(req.user, req.body);
    return apiResponse(
      res,
      200,
      'Direct WhatsApp + Email nudge dispatched to student',
      result
    );
  });
}

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', NotificationsController.listMyNotifications);
notificationsRouter.post(
  '/',
  authorizeRoles('ADMIN', 'TEACHER', 'SUPPORT'),
  validateRequest(createNotificationValidation),
  NotificationsController.createNotification
);
notificationsRouter.patch('/read-all', NotificationsController.markAllAsRead);
notificationsRouter.patch(
  '/:notificationId/read',
  validateRequest(notificationIdParamValidation),
  NotificationsController.markAsRead
);

// Omnichannel WhatsApp, Email & DLT SMS Control Center endpoints
notificationsRouter.get('/settings', NotificationsController.getOmnichannelSettings);
notificationsRouter.patch(
  '/settings',
  authorizeRoles('ADMIN'),
  validateRequest(updateOmnichannelSettingsValidation),
  NotificationsController.updateOmnichannelSettings
);
notificationsRouter.get(
  '/delivery-logs',
  authorizeRoles('ADMIN', 'TEACHER', 'SUPPORT'),
  NotificationsController.listDeliveryLogs
);
notificationsRouter.post(
  '/test-dispatch',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(testOmnichannelDispatchValidation),
  NotificationsController.testOmnichannelDispatch
);
notificationsRouter.post(
  '/nudge-student',
  authorizeRoles('ADMIN', 'TEACHER', 'SUPPORT'),
  validateRequest(nudgeStudentValidation),
  NotificationsController.nudgeStudent
);
