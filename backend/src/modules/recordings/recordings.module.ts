import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { CourseStatus, Prisma } from '@prisma/client';
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
import { buildSafeYouTubeEmbedUrl } from '../../integrations/providers.adapter';

// ----------------------------------------------------------------------------
// YOUTUBE VIDEO ID EXTRACTION, ANTI-PIRACY WATERMARK & WATCH PROGRESS (C-022)
// ----------------------------------------------------------------------------

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts a clean 11-character YouTube video ID from either a direct ID or a standard YouTube URL.
 * Rejects raw HTML/iframe injection attempts (C-022).
 */
export function extractAndValidateYouTubeVideoId(rawInput: string): string {
  const trimmed = rawInput.trim();

  if (trimmed.includes('<') || trimmed.includes('>') || trimmed.toLowerCase().includes('iframe')) {
    throw ApiError.badRequest(
      'Raw HTML or iframe tags are prohibited. Provide a YouTube Video ID or URL.',
      'VALIDATION_ERROR'
    );
  }

  if (YOUTUBE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const candidate = parsed.pathname.slice(1).split('/')[0];
      if (YOUTUBE_ID_PATTERN.test(candidate)) return candidate;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && YOUTUBE_ID_PATTERN.test(vParam)) return vParam;

      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      if (
        (pathSegments[0] === 'embed' ||
          pathSegments[0] === 'shorts' ||
          pathSegments[0] === 'live') &&
        pathSegments[1] &&
        YOUTUBE_ID_PATTERN.test(pathSegments[1])
      ) {
        return pathSegments[1];
      }
    }
  } catch {
    // Fall through to validation error below
  }

  throw ApiError.badRequest(
    'Invalid YouTube Video ID or URL. Must resolve to a valid 11-character YouTube video identifier.',
    'VALIDATION_ERROR'
  );
}

/**
 * Builds deterministic anti-piracy dynamic watermark payload tied to the authenticated viewer.
 */
export function buildStudentWatermarkPayload(actor: {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}) {
  const phoneOrShortId = actor.phone || `ID:${actor.id.slice(0, 8).toUpperCase()}`;
  return {
    studentFullName: actor.fullName,
    studentEmail: actor.email,
    studentPhone: phoneOrShortId,
    watermarkText: `${actor.fullName} • ${actor.email} • ${phoneOrShortId}`,
  };
}

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS & TYPES
// ----------------------------------------------------------------------------

export const createRecordingValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    liveClassId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(3, 'Recording title is required').max(200),
    youtubeUrlOrId: z
      .string()
      .trim()
      .min(11, 'Provide a valid 11-character YouTube video ID or watch URL')
      .max(255),
    durationSeconds: z.number().int().min(0).default(0),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  }),
};

export const updateRecordingStatusValidation = {
  params: z.object({
    recordingId: z.string().uuid('Valid recordingId UUID is required'),
  }),
  body: z.object({
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  }),
};

export const saveWatchProgressValidation = {
  params: z.object({
    recordingId: z.string().uuid('Valid recordingId UUID is required'),
  }),
  body: z.object({
    lastPositionSeconds: z.number().int().min(0),
    watchedSeconds: z.number().int().min(0),
    completed: z.boolean().optional(),
  }),
};

export interface RecordingWatchProgressDto {
  lastPositionSeconds: number;
  watchedSeconds: number;
  completionPercent: number;
  completed: boolean;
  updatedAt: string;
}

export interface ClassRecordingDto {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  liveClassId: string | null;
  liveClassTitle: string | null;
  title: string;
  provider: string;
  youtubeVideoId: string;
  safeEmbedUrl: string;
  durationSeconds: number;
  status: CourseStatus;
  publishedAt: string;
  createdAt: string;
  watermarkMeta: {
    studentFullName: string;
    studentEmail: string;
    studentPhone: string;
    watermarkText: string;
  };
  myWatchProgress: RecordingWatchProgressDto | null;
  watchAnalytics?: {
    uniqueViewersCount: number;
    completedViewersCount: number;
    averageCompletionPercent: number;
  };
}

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class RecordingsService {
  /**
   * Lists recorded classes strictly scoped by role (C-013, C-022, C-026, C-027)
   * and attaches anti-piracy viewer watermark metadata + resume watch progress.
   */
  static async listRecordings(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>
  ): Promise<ClassRecordingDto[]> {
    const where: Prisma.ClassRecordingWhereInput = {};

    if (typeof rawQuery.courseId === 'string' && rawQuery.courseId.trim()) {
      const requestedCourseId = rawQuery.courseId.trim();
      await assertCourseAccessScope(actor, requestedCourseId);
      where.courseId = requestedCourseId;
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
      where.status = 'PUBLISHED';
      where.course = {
        enrollments: {
          some: {
            studentId: actor.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
        },
      };
    } else if (actor.role === 'ADMIN' && typeof rawQuery.status === 'string') {
      where.status = rawQuery.status as CourseStatus;
    }

    const [rows, actorUser] = await Promise.all([
      prisma.classRecording.findMany({
        where,
        include: {
          course: { select: { id: true, code: true, title: true } },
          liveClass: { select: { id: true, title: true } },
        },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, fullName: true, email: true, phone: true },
      }),
    ]);

    const recordingIds = rows.map((r) => r.id);
    const watchLogs =
      recordingIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'ClassRecording',
              entityId: { in: recordingIds },
              action: 'RECORDING_WATCH_PROGRESS_SYNC',
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    // Latest watch progress per (recordingId, userId)
    const latestByRecAndUser = new Map<string, RecordingWatchProgressDto>();
    for (const log of watchLogs) {
      if (!log.entityId || !log.actorUserId || !log.afterDataJson) continue;
      const key = `${log.entityId}:${log.actorUserId}`;
      if (latestByRecAndUser.has(key)) continue;
      try {
        const parsed = JSON.parse(log.afterDataJson) as Partial<RecordingWatchProgressDto>;
        latestByRecAndUser.set(key, {
          lastPositionSeconds: Number(parsed.lastPositionSeconds || 0),
          watchedSeconds: Number(parsed.watchedSeconds || 0),
          completionPercent: Number(parsed.completionPercent || 0),
          completed: Boolean(parsed.completed),
          updatedAt: parsed.updatedAt || log.createdAt.toISOString(),
        });
      } catch {
        // Ignore malformed JSON
      }
    }

    const watermarkMeta = buildStudentWatermarkPayload({
      id: actor.id,
      fullName: actorUser?.fullName || actor.fullName,
      email: actorUser?.email || actor.email,
      phone: actorUser?.phone || null,
    });

    return rows.map((r) => {
      const myWatchProgress = latestByRecAndUser.get(`${r.id}:${actor.id}`) || null;

      // Aggregate cohort watch telemetry for Teachers & Admins
      let watchAnalytics: ClassRecordingDto['watchAnalytics'];
      if (actor.role !== 'STUDENT') {
        const entriesForRec: RecordingWatchProgressDto[] = [];
        for (const [key, val] of latestByRecAndUser.entries()) {
          if (key.startsWith(`${r.id}:`)) {
            entriesForRec.push(val);
          }
        }
        const uniqueViewersCount = entriesForRec.length;
        const completedViewersCount = entriesForRec.filter((e) => e.completed).length;
        const averageCompletionPercent =
          uniqueViewersCount > 0
            ? Number(
                (
                  entriesForRec.reduce((acc, e) => acc + e.completionPercent, 0) /
                  uniqueViewersCount
                ).toFixed(1)
              )
            : 0;
        watchAnalytics = {
          uniqueViewersCount,
          completedViewersCount,
          averageCompletionPercent,
        };
      }

      const startParam =
        myWatchProgress && myWatchProgress.lastPositionSeconds > 5 && !myWatchProgress.completed
          ? `&start=${Math.floor(myWatchProgress.lastPositionSeconds)}`
          : '';

      return {
        id: r.id,
        courseId: r.courseId,
        courseCode: r.course.code,
        courseTitle: r.course.title,
        liveClassId: r.liveClassId,
        liveClassTitle: r.liveClass?.title || null,
        title: r.title,
        provider: r.provider,
        youtubeVideoId: r.youtubeVideoId,
        safeEmbedUrl: `${buildSafeYouTubeEmbedUrl(r.youtubeVideoId)}${startParam}`,
        durationSeconds: r.durationSeconds,
        status: r.status,
        publishedAt: r.publishedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        watermarkMeta,
        myWatchProgress,
        watchAnalytics,
      };
    });
  }

  /**
   * Saves student watch-time progress and resume position (`POST /api/v1/recordings/:recordingId/progress`).
   */
  static async saveWatchProgress(
    actor: AuthenticatedActor,
    recordingId: string,
    payload: {
      lastPositionSeconds: number;
      watchedSeconds: number;
      completed?: boolean;
    }
  ): Promise<RecordingWatchProgressDto> {
    const rec = await prisma.classRecording.findUnique({
      where: { id: recordingId },
    });
    if (!rec) {
      throw ApiError.notFound('Class recording not found.');
    }

    await assertCourseAccessScope(actor, rec.courseId);

    const duration = Math.max(1, rec.durationSeconds || 1800);
    const effectiveWatched = Math.max(payload.watchedSeconds, payload.lastPositionSeconds);
    const rawPct = Math.min(100, Math.round((effectiveWatched / duration) * 100));
    const completed = Boolean(payload.completed) || rawPct >= 90;
    const completionPercent = completed ? 100 : rawPct;
    const updatedAt = new Date().toISOString();

    const progressDto: RecordingWatchProgressDto = {
      lastPositionSeconds: payload.lastPositionSeconds,
      watchedSeconds: effectiveWatched,
      completionPercent,
      completed,
      updatedAt,
    };

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'RECORDING_WATCH_PROGRESS_SYNC',
        entityType: 'ClassRecording',
        entityId: recordingId,
        afterDataJson: JSON.stringify(progressDto),
      },
    });

    return progressDto;
  }

  /**
   * Registers a new YouTube recorded class using a validated 11-character video ID (C-022).
   */
  static async createRecording(
    actor: AuthenticatedActor,
    payload: {
      courseId: string;
      liveClassId?: string | null;
      title: string;
      youtubeUrlOrId: string;
      durationSeconds: number;
      status: CourseStatus;
    }
  ): Promise<ClassRecordingDto> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can publish class recordings.');
    }

    await assertCourseAccessScope(actor, payload.courseId);

    const youtubeVideoId = extractAndValidateYouTubeVideoId(payload.youtubeUrlOrId);
    const safeEmbedUrl = buildSafeYouTubeEmbedUrl(youtubeVideoId);

    const created = await prisma.$transaction(async (tx) => {
      const rec = await tx.classRecording.create({
        data: {
          courseId: payload.courseId,
          liveClassId: payload.liveClassId || null,
          title: payload.title,
          provider: 'YOUTUBE',
          youtubeVideoId,
          durationSeconds: payload.durationSeconds,
          status: payload.status,
          publishedAt: new Date(),
        },
        include: {
          course: { select: { id: true, code: true, title: true } },
          liveClass: { select: { id: true, title: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'CLASS_RECORDING_PUBLISHED',
          entityType: 'ClassRecording',
          entityId: rec.id,
          afterDataJson: JSON.stringify({
            courseId: rec.courseId,
            title: rec.title,
            youtubeVideoId: rec.youtubeVideoId,
            status: rec.status,
          }),
        },
      });

      return rec;
    });

    await OmnichannelMessagingService.dispatchToCourseCohort({
      actorId: actor.id,
      courseId: created.courseId,
      eventType: 'RECORDING_PUBLISHED',
      title: `Recorded Class Uploaded: ${created.title}`,
      body: `The recorded class video for ${created.course.code} (${created.title}) is now available in your Recorded Classes library.`,
    });

    return {
      id: created.id,
      courseId: created.courseId,
      courseCode: created.course.code,
      courseTitle: created.course.title,
      liveClassId: created.liveClassId,
      liveClassTitle: created.liveClass?.title || null,
      title: created.title,
      provider: created.provider,
      youtubeVideoId: created.youtubeVideoId,
      safeEmbedUrl,
      durationSeconds: created.durationSeconds,
      status: created.status,
      publishedAt: created.publishedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      watermarkMeta: buildStudentWatermarkPayload({
        id: actor.id,
        fullName: actor.fullName,
        email: actor.email,
      }),
      myWatchProgress: null,
      watchAnalytics: {
        uniqueViewersCount: 0,
        completedViewersCount: 0,
        averageCompletionPercent: 0,
      },
    };
  }

  static async updateRecordingStatus(
    actor: AuthenticatedActor,
    recordingId: string,
    status: CourseStatus
  ): Promise<ClassRecordingDto> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can update recording status.');
    }

    const existing = await prisma.classRecording.findUnique({
      where: { id: recordingId },
    });
    if (!existing) {
      throw ApiError.notFound('Class recording not found.');
    }

    await assertCourseAccessScope(actor, existing.courseId);

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.classRecording.update({
        where: { id: recordingId },
        data: { status },
        include: {
          course: { select: { id: true, code: true, title: true } },
          liveClass: { select: { id: true, title: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'CLASS_RECORDING_STATUS_UPDATED',
          entityType: 'ClassRecording',
          entityId: recordingId,
          beforeDataJson: JSON.stringify({ status: existing.status }),
          afterDataJson: JSON.stringify({ status }),
        },
      });

      return rec;
    });

    return {
      id: updated.id,
      courseId: updated.courseId,
      courseCode: updated.course.code,
      courseTitle: updated.course.title,
      liveClassId: updated.liveClassId,
      liveClassTitle: updated.liveClass?.title || null,
      title: updated.title,
      provider: updated.provider,
      youtubeVideoId: updated.youtubeVideoId,
      safeEmbedUrl: buildSafeYouTubeEmbedUrl(updated.youtubeVideoId),
      durationSeconds: updated.durationSeconds,
      status: updated.status,
      publishedAt: updated.publishedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      watermarkMeta: buildStudentWatermarkPayload({
        id: actor.id,
        fullName: actor.fullName,
        email: actor.email,
      }),
      myWatchProgress: null,
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class RecordingsController {
  static list = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await RecordingsService.listRecordings(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Recorded classes retrieved successfully', list);
  });

  static create = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await RecordingsService.createRecording(req.user, req.body);
    return apiResponse(res, 201, 'YouTube class recording registered and validated', created);
  });

  static updateStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await RecordingsService.updateRecordingStatus(
      req.user,
      String(req.params.recordingId),
      req.body.status
    );
    return apiResponse(res, 200, 'Recording status updated', updated);
  });

  static saveProgress = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const saved = await RecordingsService.saveWatchProgress(
      req.user,
      String(req.params.recordingId),
      req.body
    );
    return apiResponse(res, 200, 'Recording watch progress saved', saved);
  });
}

export const recordingsRouter = Router();
recordingsRouter.use(authenticate);

recordingsRouter.get('/', RecordingsController.list);
recordingsRouter.post(
  '/',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createRecordingValidation),
  RecordingsController.create
);
recordingsRouter.patch(
  '/:recordingId/status',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(updateRecordingStatusValidation),
  RecordingsController.updateStatus
);
recordingsRouter.post(
  '/:recordingId/progress',
  authorizeRoles('STUDENT', 'TEACHER', 'ADMIN'),
  validateRequest(saveWatchProgressValidation),
  RecordingsController.saveProgress
);
