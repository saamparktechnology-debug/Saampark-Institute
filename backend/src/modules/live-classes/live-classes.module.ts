import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { LiveClassStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { apiResponse } from '../../utils/apiResponse';
import { catchAsync } from '../../utils/catchAsync';
import {
  assertCourseAccessScope,
  authenticate,
  authorizeRoles,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import {
  Hms100msVideoAdapter,
  JitsiVideoAdapter,
} from '../../integrations/providers.adapter';

const hmsAdapter = new Hms100msVideoAdapter(
  process.env.HMS_100MS_ACCESS_KEY || 'hms_access_key_placeholder',
  process.env.HMS_100MS_APP_SECRET || 'hms_app_secret_placeholder_32_chars',
  process.env.HMS_100MS_WEBHOOK_SECRET || 'hms_webhook_secret_placeholder'
);

const jitsiAdapter = new JitsiVideoAdapter(
  process.env.JITSI_DOMAIN || 'meet.ffmuc.net',
  process.env.JITSI_APP_SECRET || 'saampark_jitsi_room_secret_key'
);

function extractYouTubeLiveId(rawInput?: string | null): string | null {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const v = parsed.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = segments[segments.length - 1];
    if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) return candidate;
  } catch {
    // Not a full URL
  }
  return null;
}

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createLiveClassValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    teacherId: z.string().uuid().optional(),
    title: z.string().trim().min(3, 'Live class title is required').max(200),
    description: z.string().trim().max(1000).optional(),
    scheduledStartAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
    scheduledEndAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
    provider: z
      .enum(['JITSI_MEET', 'YOUTUBE_LIVE', 'HMS_100MS'])
      .optional()
      .default('JITSI_MEET'),
    youtubeLiveUrlOrId: z.string().trim().max(255).optional().nullable(),
  }),
};

export const updateLiveClassStatusValidation = {
  params: z.object({
    liveClassId: z.string().uuid('Valid liveClassId UUID is required'),
  }),
  body: z.object({
    status: z.enum(['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']),
  }),
};

export const liveClassIdParamValidation = {
  params: z.object({
    liveClassId: z.string().uuid('Valid liveClassId UUID is required'),
  }),
};

// ----------------------------------------------------------------------------
// DTO TYPES
// ----------------------------------------------------------------------------

export interface LiveClassDto {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  title: string;
  description: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  provider: string;
  providerRoomId: string | null;
  status: LiveClassStatus;
  participantCount: number;
  createdAt: string;
}

export interface LiveRoomJoinTicketDto {
  liveClassId: string;
  courseTitle: string;
  courseCode: string;
  title: string;
  provider: 'JITSI_MEET' | 'YOUTUBE_LIVE' | 'HMS_100MS';
  providerRoomId: string;
  jitsiDomain: string;
  jitsiRoomName: string;
  embedUrl: string;
  youtubeEmbedUrl: string | null;
  roomRole: 'host' | 'co-host' | 'guest-student';
  participantDisplayName: string;
  participantEmail: string;
  token: string;
  expiresAt: string;
  participantId: string;
}

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class LiveClassesService {
  /**
   * Lists live classes strictly scoped by role (C-004, C-012, C-013, C-026, C-027):
   * - ADMIN / SUPPORT: All platform live classes (filterable by courseId, status).
   * - TEACHER: Strictly live classes for courses actively assigned to `actor.id`.
   * - STUDENT: Strictly live classes for courses where `actor.id` holds an ACTIVE or COMPLETED enrollment.
   */
  static async listLiveClasses(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>
  ): Promise<LiveClassDto[]> {
    const where: Prisma.LiveClassWhereInput = {};

    if (typeof rawQuery.courseId === 'string' && rawQuery.courseId.trim()) {
      where.courseId = rawQuery.courseId.trim();
    }
    if (typeof rawQuery.status === 'string' && rawQuery.status.trim()) {
      where.status = rawQuery.status.trim() as LiveClassStatus;
    }

    if (actor.role === 'TEACHER') {
      where.course = {
        teacherAssignments: {
          some: {
            teacherId: actor.id,
            status: 'ACTIVE',
          },
        },
      };
    } else if (actor.role === 'STUDENT') {
      where.course = {
        enrollments: {
          some: {
            studentId: actor.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
        },
      };
    }

    const rows = await prisma.liveClass.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true } },
        teacher: { select: { id: true, fullName: true, email: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { scheduledStartAt: 'asc' },
    });

    return rows.map((lc) => ({
      id: lc.id,
      courseId: lc.courseId,
      courseCode: lc.course.code,
      courseTitle: lc.course.title,
      teacherId: lc.teacherId,
      teacherName: lc.teacher.fullName,
      teacherEmail: lc.teacher.email,
      title: lc.title,
      description: lc.description,
      scheduledStartAt: lc.scheduledStartAt.toISOString(),
      scheduledEndAt: lc.scheduledEndAt.toISOString(),
      provider:
        lc.provider === 'HMS_100MS' && !hmsAdapter.isLive100msConfigured()
          ? 'JITSI_MEET'
          : lc.provider,
      providerRoomId: lc.providerRoomId,
      status: lc.status,
      participantCount: lc._count.participants,
      createdAt: lc.createdAt.toISOString(),
    }));
  }

  /**
   * Schedules a new live class using Jitsi Meet (default, zero credit card, works on localhost & VPS),
   * Unlisted YouTube Live Broadcast, or 100ms (if configured).
   */
  static async createLiveClass(
    actor: AuthenticatedActor,
    payload: {
      courseId: string;
      teacherId?: string;
      title: string;
      description?: string;
      scheduledStartAt: string;
      scheduledEndAt: string;
      provider?: 'JITSI_MEET' | 'YOUTUBE_LIVE' | 'HMS_100MS';
      youtubeLiveUrlOrId?: string | null;
    }
  ): Promise<LiveClassDto> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can schedule live classes.');
    }

    await assertCourseAccessScope(actor, payload.courseId);

    const startDate = new Date(payload.scheduledStartAt);
    const endDate = new Date(payload.scheduledEndAt);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw ApiError.badRequest('Invalid scheduledStartAt or scheduledEndAt timestamp.');
    }
    if (endDate.getTime() <= startDate.getTime()) {
      throw ApiError.unprocessable('scheduledEndAt must be after scheduledStartAt.');
    }

    let resolvedTeacherId = actor.id;
    if (actor.role === 'ADMIN') {
      if (payload.teacherId) {
        resolvedTeacherId = payload.teacherId;
      } else {
        const primaryAssignment = await prisma.courseTeacherAssignment.findFirst({
          where: { courseId: payload.courseId, status: 'ACTIVE' },
          orderBy: { assignedAt: 'asc' },
        });
        if (!primaryAssignment) {
          throw ApiError.unprocessable(
            'Assign at least one active teacher to this course before scheduling a live class.'
          );
        }
        resolvedTeacherId = primaryAssignment.teacherId;
      }
    }

    const [assignment, courseInfo] = await Promise.all([
      prisma.courseTeacherAssignment.findUnique({
        where: {
          courseId_teacherId: {
            courseId: payload.courseId,
            teacherId: resolvedTeacherId,
          },
        },
      }),
      prisma.course.findUnique({
        where: { id: payload.courseId },
        select: { code: true, title: true },
      }),
    ]);

    if (!assignment || assignment.status !== 'ACTIVE') {
      throw ApiError.unprocessable(
        'The specified instructor is not actively assigned to this course.'
      );
    }

    const requestedProvider = payload.provider || 'JITSI_MEET';
    const effectiveProvider: 'JITSI_MEET' | 'YOUTUBE_LIVE' | 'HMS_100MS' =
      requestedProvider === 'YOUTUBE_LIVE'
        ? 'YOUTUBE_LIVE'
        : requestedProvider === 'HMS_100MS' && hmsAdapter.isLive100msConfigured()
        ? 'HMS_100MS'
        : 'JITSI_MEET';

    let youtubeVideoId: string | null = null;
    if (effectiveProvider === 'YOUTUBE_LIVE') {
      youtubeVideoId = extractYouTubeLiveId(payload.youtubeLiveUrlOrId);
      if (!youtubeVideoId) {
        throw ApiError.badRequest(
          'Provide a valid 11-character YouTube Live Video ID or watch URL when scheduling a YOUTUBE_LIVE broadcast.'
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const initial = await tx.liveClass.create({
        data: {
          courseId: payload.courseId,
          teacherId: resolvedTeacherId,
          title: payload.title,
          description: payload.description || null,
          scheduledStartAt: startDate,
          scheduledEndAt: endDate,
          provider: effectiveProvider,
          status: 'SCHEDULED',
        },
      });

      let provisionedRoomId: string;
      if (effectiveProvider === 'YOUTUBE_LIVE' && youtubeVideoId) {
        provisionedRoomId = youtubeVideoId;
      } else if (effectiveProvider === 'HMS_100MS') {
        const room = await hmsAdapter.createRoom({
          courseId: payload.courseId,
          liveClassId: initial.id,
          title: payload.title,
        });
        provisionedRoomId = room.providerRoomId;
      } else {
        const jitsiRoom = await jitsiAdapter.createRoom({
          courseId: payload.courseId,
          courseCode: courseInfo?.code || 'COURSE',
          liveClassId: initial.id,
          title: payload.title,
        });
        provisionedRoomId = jitsiRoom.providerRoomId;
      }

      const withRoom = await tx.liveClass.update({
        where: { id: initial.id },
        data: { providerRoomId: provisionedRoomId },
        include: {
          course: { select: { id: true, code: true, title: true } },
          teacher: { select: { id: true, fullName: true, email: true } },
          _count: { select: { participants: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'LIVE_CLASS_SCHEDULED',
          entityType: 'LiveClass',
          entityId: withRoom.id,
          afterDataJson: JSON.stringify({
            courseId: withRoom.courseId,
            teacherId: withRoom.teacherId,
            provider: effectiveProvider,
            providerRoomId: withRoom.providerRoomId,
            scheduledStartAt: withRoom.scheduledStartAt.toISOString(),
          }),
        },
      });

      return withRoom;
    });

    await OmnichannelMessagingService.dispatchToCourseCohort({
      actorId: actor.id,
      courseId: created.courseId,
      eventType: 'LIVE_CLASS_SCHEDULED',
      title: `Live Class Scheduled: ${created.title}`,
      body: `Instructor ${created.teacher.fullName} scheduled a live session (${created.provider}) for ${created.course.code} starting at ${created.scheduledStartAt.toISOString()}.`,
    });

    return {
      id: created.id,
      courseId: created.courseId,
      courseCode: created.course.code,
      courseTitle: created.course.title,
      teacherId: created.teacherId,
      teacherName: created.teacher.fullName,
      teacherEmail: created.teacher.email,
      title: created.title,
      description: created.description,
      scheduledStartAt: created.scheduledStartAt.toISOString(),
      scheduledEndAt: created.scheduledEndAt.toISOString(),
      provider: created.provider,
      providerRoomId: created.providerRoomId,
      status: created.status,
      participantCount: created._count.participants,
      createdAt: created.createdAt.toISOString(),
    };
  }

  /**
   * Transitions a live class state (SCHEDULED -> LIVE -> ENDED / CANCELLED).
   */
  static async updateLiveClassStatus(
    actor: AuthenticatedActor,
    liveClassId: string,
    status: LiveClassStatus
  ): Promise<LiveClassDto> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can update live class status.');
    }

    const existing = await prisma.liveClass.findUnique({
      where: { id: liveClassId },
    });
    if (!existing) {
      throw ApiError.notFound('Live class session not found.');
    }

    await assertCourseAccessScope(actor, existing.courseId);

    const updated = await prisma.$transaction(async (tx) => {
      const lc = await tx.liveClass.update({
        where: { id: liveClassId },
        data: { status },
        include: {
          course: { select: { id: true, code: true, title: true } },
          teacher: { select: { id: true, fullName: true, email: true } },
          _count: { select: { participants: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'LIVE_CLASS_STATUS_CHANGED',
          entityType: 'LiveClass',
          entityId: liveClassId,
          beforeDataJson: JSON.stringify({ status: existing.status }),
          afterDataJson: JSON.stringify({ status }),
        },
      });

      return lc;
    });

    return {
      id: updated.id,
      courseId: updated.courseId,
      courseCode: updated.course.code,
      courseTitle: updated.course.title,
      teacherId: updated.teacherId,
      teacherName: updated.teacher.fullName,
      teacherEmail: updated.teacher.email,
      title: updated.title,
      description: updated.description,
      scheduledStartAt: updated.scheduledStartAt.toISOString(),
      scheduledEndAt: updated.scheduledEndAt.toISOString(),
      provider: updated.provider,
      providerRoomId: updated.providerRoomId,
      status: updated.status,
      participantCount: updated._count.participants,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Issues a live classroom join ticket (Jitsi Meet IFrame API / YouTube Live / 100ms)
   * and logs participant join in `live_class_participants` (C-004, C-027, C-030).
   * Automatically routes legacy `HMS_100MS` sessions to `JITSI_MEET` when 100ms keys are unconfigured
   * so localhost and VPS testing works immediately with zero credit card required.
   */
  static async issueJoinToken(
    actor: AuthenticatedActor,
    liveClassId: string
  ): Promise<LiveRoomJoinTicketDto> {
    const [liveClass, actorUser] = await Promise.all([
      prisma.liveClass.findUnique({
        where: { id: liveClassId },
        include: { course: { select: { code: true, title: true } } },
      }),
      prisma.user.findUnique({
        where: { id: actor.id },
        select: { fullName: true, email: true },
      }),
    ]);

    if (!liveClass) {
      throw ApiError.notFound('Live class session not found.');
    }

    await assertCourseAccessScope(actor, liveClass.courseId);

    if (liveClass.status === 'CANCELLED' || liveClass.status === 'ENDED') {
      throw ApiError.unprocessable(
        `Cannot join a live class whose status is ${liveClass.status}.`
      );
    }

    const rawRoomId = liveClass.providerRoomId || `room_${liveClass.id.slice(0, 8)}`;
    const roomRole: 'host' | 'co-host' | 'guest-student' =
      actor.role === 'ADMIN'
        ? 'co-host'
        : actor.role === 'TEACHER'
        ? liveClass.teacherId === actor.id
          ? 'host'
          : 'co-host'
        : 'guest-student';

    const participantDisplayName = actorUser?.fullName || actor.email;
    const participantEmail = actorUser?.email || actor.email;

    // Resolve effective provider (use Jitsi Meet if HMS_100MS is not configured with live keys)
    const effectiveProvider: 'JITSI_MEET' | 'YOUTUBE_LIVE' | 'HMS_100MS' =
      liveClass.provider === 'YOUTUBE_LIVE'
        ? 'YOUTUBE_LIVE'
        : liveClass.provider === 'HMS_100MS' && hmsAdapter.isLive100msConfigured()
        ? 'HMS_100MS'
        : 'JITSI_MEET';

    const jitsiTicket = await jitsiAdapter.generateShortLivedRoomToken({
      roomId: rawRoomId,
      courseCode: liveClass.course.code,
      userId: actor.id,
      role: roomRole,
      displayName: participantDisplayName,
      email: participantEmail,
      expiresInSeconds: 3600,
    });

    let token = jitsiTicket.token;
    let expiresAt = jitsiTicket.expiresAt;

    if (effectiveProvider === 'HMS_100MS') {
      const hmsTicket = await hmsAdapter.generateShortLivedRoomToken({
        roomId: rawRoomId,
        userId: actor.id,
        role: roomRole,
        expiresInSeconds: 900,
      });
      token = hmsTicket.token;
      expiresAt = hmsTicket.expiresAt;
    }

    const youtubeId =
      effectiveProvider === 'YOUTUBE_LIVE'
        ? extractYouTubeLiveId(rawRoomId) || 'M7lc1UVf-VE'
        : null;
    const youtubeEmbedUrl = youtubeId
      ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`
      : null;

    const participant = await prisma.$transaction(async (tx) => {
      // Auto-transition SCHEDULED -> LIVE if the host teacher joins
      if (actor.role === 'TEACHER' && liveClass.status === 'SCHEDULED') {
        await tx.liveClass.update({
          where: { id: liveClass.id },
          data: { status: 'LIVE', providerRoomId: rawRoomId },
        });
      }

      const p = await tx.liveClassParticipant.create({
        data: {
          liveClassId: liveClass.id,
          userId: actor.id,
          participantRole: actor.role,
          joinedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'LIVE_CLASS_JOIN_TOKEN_ISSUED',
          entityType: 'LiveClassParticipant',
          entityId: p.id,
          afterDataJson: JSON.stringify({
            liveClassId: liveClass.id,
            provider: effectiveProvider,
            roomId: jitsiTicket.jitsiRoomName,
            roomRole,
          }),
        },
      });

      return p;
    });

    return {
      liveClassId: liveClass.id,
      courseTitle: liveClass.course.title,
      courseCode: liveClass.course.code,
      title: liveClass.title,
      provider: effectiveProvider,
      providerRoomId:
        effectiveProvider === 'JITSI_MEET' ? jitsiTicket.jitsiRoomName : rawRoomId,
      jitsiDomain: jitsiTicket.jitsiDomain,
      jitsiRoomName: jitsiTicket.jitsiRoomName,
      embedUrl: youtubeEmbedUrl || jitsiTicket.embedUrl,
      youtubeEmbedUrl,
      roomRole,
      participantDisplayName,
      participantEmail,
      token,
      expiresAt,
      participantId: participant.id,
    };
  }

  /**
   * Records participant leave timestamp and computes attendance duration in seconds.
   */
  static async recordParticipantLeave(actor: AuthenticatedActor, liveClassId: string) {
    const activeParticipation = await prisma.liveClassParticipant.findFirst({
      where: {
        liveClassId,
        userId: actor.id,
        leftAt: null,
      },
      orderBy: { joinedAt: 'desc' },
    });

    if (!activeParticipation) {
      throw ApiError.notFound('No active live class participation found to close.');
    }

    const leftAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((leftAt.getTime() - activeParticipation.joinedAt.getTime()) / 1000)
    );

    const updated = await prisma.liveClassParticipant.update({
      where: { id: activeParticipation.id },
      data: {
        leftAt,
        durationSeconds,
      },
    });

    return {
      participantId: updated.id,
      liveClassId: updated.liveClassId,
      joinedAt: updated.joinedAt.toISOString(),
      leftAt: leftAt.toISOString(),
      durationSeconds: updated.durationSeconds,
    };
  }

  /**
   * Lists participant join/leave logs for a live class (Admin or assigned Teacher).
   */
  static async listParticipants(actor: AuthenticatedActor, liveClassId: string) {
    const liveClass = await prisma.liveClass.findUnique({
      where: { id: liveClassId },
    });
    if (!liveClass) {
      throw ApiError.notFound('Live class not found.');
    }

    await assertCourseAccessScope(actor, liveClass.courseId);

    const rows = await prisma.liveClassParticipant.findMany({
      where: { liveClassId },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return rows.map((p) => ({
      id: p.id,
      liveClassId: p.liveClassId,
      userId: p.userId,
      fullName: p.user.fullName,
      email: p.user.email,
      participantRole: p.participantRole,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt ? p.leftAt.toISOString() : null,
      durationSeconds: p.durationSeconds,
    }));
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class LiveClassesController {
  static list = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const items = await LiveClassesService.listLiveClasses(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Live classes retrieved successfully', items);
  });

  static create = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await LiveClassesService.createLiveClass(req.user, req.body);
    return apiResponse(
      res,
      201,
      'Live class scheduled and classroom room provisioned',
      created
    );
  });

  static updateStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await LiveClassesService.updateLiveClassStatus(
      req.user,
      String(req.params.liveClassId),
      req.body.status
    );
    return apiResponse(res, 200, 'Live class status updated', updated);
  });

  static issueJoinToken = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const ticket = await LiveClassesService.issueJoinToken(
      req.user,
      String(req.params.liveClassId)
    );
    return apiResponse(
      res,
      200,
      'Live classroom join ticket generated and participation logged',
      ticket
    );
  });

  static leaveClass = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await LiveClassesService.recordParticipantLeave(
      req.user,
      String(req.params.liveClassId)
    );
    return apiResponse(res, 200, 'Live class leave timestamp and duration recorded', result);
  });

  static listParticipants = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await LiveClassesService.listParticipants(
      req.user,
      String(req.params.liveClassId)
    );
    return apiResponse(res, 200, 'Live class participants retrieved', list);
  });
}

export const liveClassesRouter = Router();
liveClassesRouter.use(authenticate);

liveClassesRouter.get('/', LiveClassesController.list);
liveClassesRouter.post(
  '/',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createLiveClassValidation),
  LiveClassesController.create
);
liveClassesRouter.patch(
  '/:liveClassId/status',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(updateLiveClassStatusValidation),
  LiveClassesController.updateStatus
);
liveClassesRouter.post(
  '/:liveClassId/join-token',
  authorizeRoles('ADMIN', 'TEACHER', 'STUDENT'),
  validateRequest(liveClassIdParamValidation),
  LiveClassesController.issueJoinToken
);
liveClassesRouter.post(
  '/:liveClassId/leave',
  authorizeRoles('ADMIN', 'TEACHER', 'STUDENT'),
  validateRequest(liveClassIdParamValidation),
  LiveClassesController.leaveClass
);
liveClassesRouter.get(
  '/:liveClassId/participants',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(liveClassIdParamValidation),
  LiveClassesController.listParticipants
);
