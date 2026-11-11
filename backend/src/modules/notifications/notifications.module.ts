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
    channel: z.enum(['IN_APP', 'EMAIL', 'SMS']).default('IN_APP'),
  }),
};

export const notificationIdParamValidation = {
  params: z.object({
    notificationId: z.string().uuid('Valid notificationId UUID is required'),
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
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientUserId: actor.id },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { recipientUserId: actor.id, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      items: items.map((n) => ({
        id: n.id,
        recipientUserId: n.recipientUserId,
        type: n.type,
        title: n.title,
        body: n.body,
        channel: n.channel,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        sentAt: n.sentAt.toISOString(),
      })),
    };
  }

  /**
   * Dispatches a targeted user notification or a role-wide broadcast notification.
   */
  static async dispatchNotification(
    actor: AuthenticatedActor,
    payload: {
      recipientUserId?: string;
      targetRole?: RoleType;
      type: string;
      title: string;
      body: string;
      channel: NotificationChannel;
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

    await prisma.$transaction(async (tx) => {
      await tx.notification.createMany({
        data: recipientIds.map((uid) => ({
          recipientUserId: uid,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          channel: payload.channel,
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
            title: payload.title,
            channel: payload.channel,
          }),
        },
      });
    });

    return {
      dispatchedCount: recipientIds.length,
      title: payload.title,
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
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class NotificationsController {
  static listMine = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await NotificationsService.listMyNotifications(req.user);
    return apiResponse(res, 200, 'Notifications retrieved successfully', data);
  });

  static dispatch = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await NotificationsService.dispatchNotification(req.user, req.body);
    return apiResponse(res, 201, 'Notification dispatched successfully', result);
  });

  static markRead = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await NotificationsService.markAsRead(
      req.user,
      String(req.params.notificationId)
    );
    return apiResponse(res, 200, 'Notification marked as read', updated);
  });

  static markAllRead = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await NotificationsService.markAllAsRead(req.user);
    return apiResponse(res, 200, 'All notifications marked as read', result);
  });
}

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', NotificationsController.listMine);
notificationsRouter.post(
  '/',
  authorizeRoles('ADMIN', 'TEACHER', 'SUPPORT'),
  validateRequest(createNotificationValidation),
  NotificationsController.dispatch
);
notificationsRouter.patch(
  '/:notificationId/read',
  validateRequest(notificationIdParamValidation),
  NotificationsController.markRead
);
notificationsRouter.post('/read-all', NotificationsController.markAllRead);
