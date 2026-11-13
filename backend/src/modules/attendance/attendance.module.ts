import crypto from 'crypto';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
  AttendanceMarkStatus,
  AttendanceSessionStatus,
  Prisma,
} from '@prisma/client';
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

// ----------------------------------------------------------------------------
// ATTENDANCE CODE HASHING, RATE LIMITER & LOW-ATTENDANCE RECOVERY MATH (C-008, O-021)
// ----------------------------------------------------------------------------

export function hashAttendanceCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export function verifyAttendanceCodeHash(rawCode: string, expectedHash: string): boolean {
  const actualHash = hashAttendanceCode(rawCode);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Computes exact attendance percentage and how many consecutive future sessions a student
 * must attend to reach `minAttendancePercent` (default 75%).
 * Formula: `(present + k) / (total + k) >= threshold / 100`
 */
export function computeLowAttendanceRecoveryStats(params: {
  presentCount: number;
  totalSessionsCount: number;
  minAttendancePercent?: number;
}) {
  const threshold = params.minAttendancePercent ?? 75;
  if (params.totalSessionsCount <= 0) {
    return {
      attendancePercent: 100,
      isBelowThreshold: false,
      consecutiveClassesNeededToRecover: 0,
    };
  }

  const attendancePercent = Number(
    ((params.presentCount / params.totalSessionsCount) * 100).toFixed(1)
  );
  const isBelowThreshold = attendancePercent < threshold;
  if (!isBelowThreshold) {
    return {
      attendancePercent,
      isBelowThreshold: false,
      consecutiveClassesNeededToRecover: 0,
    };
  }

  const targetRatio = threshold / 100;
  if (targetRatio >= 1) {
    return {
      attendancePercent,
      isBelowThreshold: true,
      consecutiveClassesNeededToRecover: 99,
    };
  }

  const needed = Math.ceil(
    (targetRatio * params.totalSessionsCount - params.presentCount) / (1 - targetRatio)
  );

  return {
    attendancePercent,
    isBelowThreshold: true,
    consecutiveClassesNeededToRecover: Math.max(1, needed),
  };
}

// Per-student rate limit window: max 5 code submission attempts per 60 seconds (O-021)
const submissionAttemptsMap = new Map<string, number[]>();

export function checkAndRecordAttendanceRateLimit(
  studentId: string,
  sessionId: string,
  nowMs = Date.now(),
  maxAttemptsPerMinute = 5
): void {
  const key = `${studentId}:${sessionId}`;
  const windowStart = nowMs - 60_000;
  const recent = (submissionAttemptsMap.get(key) || []).filter((ts) => ts > windowStart);

  if (recent.length >= maxAttemptsPerMinute) {
    throw new ApiError(
      429,
      'BUSINESS_RULE_VIOLATION',
      'Too many attendance code attempts. Please wait 1 minute before trying again.'
    );
  }

  recent.push(nowMs);
  submissionAttemptsMap.set(key, recent);
}

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createAttendanceSessionValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    liveClassId: z.string().uuid().optional().nullable(),
    expiryMinutes: z.number().int().min(1).max(120).default(10),
  }),
};

export const submitAttendanceCodeValidation = {
  params: z.object({
    sessionId: z.string().uuid('Valid sessionId UUID is required'),
  }),
  body: z.object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Attendance code must be an exact 6-digit numeric code'),
  }),
};

export const manualAttendanceOverrideValidation = {
  params: z.object({
    sessionId: z.string().uuid('Valid sessionId UUID is required'),
  }),
  body: z.object({
    studentId: z.string().uuid('Valid studentId UUID is required'),
    status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
    correctionReason: z
      .string()
      .trim()
      .min(5, 'A mandatory correction reason (min 5 chars) is required for audit logging')
      .max(255),
  }),
};

export const updateAttendanceSessionStatusValidation = {
  params: z.object({
    sessionId: z.string().uuid('Valid sessionId UUID is required'),
  }),
  body: z.object({
    status: z.enum(['OPEN', 'CLOSED', 'FINALIZED']),
  }),
};

export const dispatchLowAttendanceAlertsValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required').optional(),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class AttendanceService {
  /**
   * Lists attendance sessions strictly scoped by role (C-008, C-013, O-021):
   * - TEACHER: Sessions for courses actively assigned to `actor.id`, including full student attendance records.
   * - ADMIN: All platform attendance sessions.
   * - STUDENT: Sessions for courses where `actor.id` has an ACTIVE or COMPLETED enrollment,
   *   returning only the student's own `AttendanceRecord` (`myRecord`) and never exposing other students' records or `codeHash`.
   */
  static async listSessions(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>
  ) {
    const where: Prisma.AttendanceSessionWhereInput = {};

    if (typeof rawQuery.courseId === 'string' && rawQuery.courseId.trim()) {
      await assertCourseAccessScope(actor, rawQuery.courseId.trim());
      where.courseId = rawQuery.courseId.trim();
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

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            minAttendancePercent: true,
            enrollments: {
              where:
                actor.role === 'STUDENT'
                  ? { id: '__student_self_only__' }
                  : { status: { in: ['ACTIVE', 'COMPLETED'] } },
              select: {
                student: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        liveClass: { select: { id: true, title: true } },
        teacher: { select: { id: true, fullName: true } },
        records: {
          where: actor.role === 'STUDENT' ? { studentId: actor.id } : undefined,
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            correctedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { markedAt: 'desc' },
        },
      },
      orderBy: { startsAt: 'desc' },
    });

    const now = new Date();

    return sessions.map((s) => {
      const isCodeExpired = now.getTime() > s.codeExpiresAt.getTime() || s.status !== 'OPEN';

      if (actor.role === 'STUDENT') {
        const own = s.records[0] || null;
        return {
          id: s.id,
          courseId: s.courseId,
          courseCode: s.course.code,
          courseTitle: s.course.title,
          minAttendancePercent: s.course.minAttendancePercent.toFixed(2),
          liveClassId: s.liveClassId,
          liveClassTitle: s.liveClass?.title || null,
          teacherName: s.teacher.fullName,
          sessionDate: s.sessionDate.toISOString().slice(0, 10),
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          codeExpiresAt: s.codeExpiresAt.toISOString(),
          isCodeExpired,
          status: s.status,
          myRecord: own
            ? {
                id: own.id,
                status: own.status,
                markedAt: own.markedAt.toISOString(),
                source: own.source,
                correctionReason: own.correctionReason,
              }
            : null,
          records: [],
          enrolledRoster: [],
        };
      }

      const enrolledList = s.course.enrollments.map((e) => e.student);

      return {
        id: s.id,
        courseId: s.courseId,
        courseCode: s.course.code,
        courseTitle: s.course.title,
        minAttendancePercent: s.course.minAttendancePercent.toFixed(2),
        liveClassId: s.liveClassId,
        liveClassTitle: s.liveClass?.title || null,
        teacherName: s.teacher.fullName,
        sessionDate: s.sessionDate.toISOString().slice(0, 10),
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        codeExpiresAt: s.codeExpiresAt.toISOString(),
        isCodeExpired,
        status: s.status,
        myRecord: null,
        records: s.records.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: r.student.fullName,
          studentEmail: r.student.email,
          status: r.status,
          markedAt: r.markedAt.toISOString(),
          source: r.source,
          correctedByName: r.correctedBy?.fullName || null,
          correctionReason: r.correctionReason,
        })),
        enrolledRoster: enrolledList,
      };
    });
  }

  /**
   * Teacher or Admin generates a new 6-digit session attendance code (`O-021`, `C-008`).
   */
  static async generateSessionCode(
    actor: AuthenticatedActor,
    payload: {
      courseId: string;
      liveClassId?: string | null;
      expiryMinutes: number;
    }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can generate attendance codes.');
    }

    await assertCourseAccessScope(actor, payload.courseId);

    const plainCode = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashAttendanceCode(plainCode);
    const now = new Date();
    const codeExpiresAt = new Date(now.getTime() + payload.expiryMinutes * 60 * 1000);
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000);

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.attendanceSession.create({
        data: {
          courseId: payload.courseId,
          liveClassId: payload.liveClassId || null,
          teacherId: actor.id,
          sessionDate: now,
          startsAt: now,
          endsAt,
          codeHash,
          codeExpiresAt,
          status: 'OPEN',
        },
        include: {
          course: { select: { code: true, title: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ATTENDANCE_SESSION_CODE_GENERATED',
          entityType: 'AttendanceSession',
          entityId: created.id,
          afterDataJson: JSON.stringify({
            courseId: created.courseId,
            liveClassId: created.liveClassId,
            codeExpiresAt: created.codeExpiresAt.toISOString(),
          }),
        },
      });

      return created;
    });

    return {
      sessionId: session.id,
      courseId: session.courseId,
      courseCode: session.course.code,
      courseTitle: session.course.title,
      generatedCode: plainCode,
      codeExpiresAt: session.codeExpiresAt.toISOString(),
      expiryMinutes: payload.expiryMinutes,
      status: session.status,
    };
  }

  /**
   * Student submits a 6-digit session attendance code (`C-008`, `O-021`).
   */
  static async submitAttendanceCode(
    actor: AuthenticatedActor,
    sessionId: string,
    code: string
  ) {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only enrolled students can submit attendance codes.');
    }

    checkAndRecordAttendanceRateLimit(actor.id, sessionId);

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { course: { select: { title: true, code: true } } },
    });

    if (!session) {
      throw ApiError.notFound('Attendance session not found.');
    }

    await assertCourseAccessScope(actor, session.courseId);

    const now = new Date();
    if (session.status !== 'OPEN' || now.getTime() > session.codeExpiresAt.getTime()) {
      throw new ApiError(
        422,
        'ATTENDANCE_CODE_EXPIRED',
        'This attendance session code has expired or the session is closed.'
      );
    }

    const isValidCode = verifyAttendanceCodeHash(code, session.codeHash);
    if (!isValidCode) {
      throw ApiError.badRequest(
        'Invalid 6-digit attendance code. Please check the code displayed by your instructor.',
        'VALIDATION_ERROR'
      );
    }

    const record = await prisma.$transaction(async (tx) => {
      const upserted = await tx.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: session.id,
            studentId: actor.id,
          },
        },
        update: {
          status: 'PRESENT',
          source: 'CODE',
          markedAt: now,
        },
        create: {
          attendanceSessionId: session.id,
          studentId: actor.id,
          status: 'PRESENT',
          source: 'CODE',
          markedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ATTENDANCE_CODE_SUBMITTED',
          entityType: 'AttendanceRecord',
          entityId: upserted.id,
          afterDataJson: JSON.stringify({
            attendanceSessionId: session.id,
            courseId: session.courseId,
            status: 'PRESENT',
          }),
        },
      });

      return upserted;
    });

    return {
      recordId: record.id,
      attendanceSessionId: session.id,
      courseTitle: session.course.title,
      status: record.status,
      source: record.source,
      markedAt: record.markedAt.toISOString(),
    };
  }

  /**
   * Teacher or Admin manually marks or overrides a student's attendance record (`O-021`).
   */
  static async manualOverrideAttendance(
    actor: AuthenticatedActor,
    sessionId: string,
    payload: {
      studentId: string;
      status: AttendanceMarkStatus;
      correctionReason: string;
    }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can override attendance.');
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw ApiError.notFound('Attendance session not found.');
    }

    await assertCourseAccessScope(actor, session.courseId);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        courseId: session.courseId,
        studentId: payload.studentId,
      },
    });
    if (!enrollment) {
      throw ApiError.unprocessable('Target student is not enrolled in this course.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: session.id,
            studentId: payload.studentId,
          },
        },
      });

      const rec = await tx.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: session.id,
            studentId: payload.studentId,
          },
        },
        update: {
          status: payload.status,
          source: 'MANUAL',
          correctedById: actor.id,
          correctionReason: payload.correctionReason,
        },
        create: {
          attendanceSessionId: session.id,
          studentId: payload.studentId,
          status: payload.status,
          source: 'MANUAL',
          correctedById: actor.id,
          correctionReason: payload.correctionReason,
        },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ATTENDANCE_MANUAL_OVERRIDE',
          entityType: 'AttendanceRecord',
          entityId: rec.id,
          reason: payload.correctionReason,
          beforeDataJson: existing ? JSON.stringify({ status: existing.status }) : null,
          afterDataJson: JSON.stringify({
            attendanceSessionId: session.id,
            studentId: payload.studentId,
            status: payload.status,
            source: 'MANUAL',
          }),
        },
      });

      return rec;
    });

    return {
      id: updated.id,
      attendanceSessionId: updated.attendanceSessionId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      studentEmail: updated.student.email,
      status: updated.status,
      source: updated.source,
      correctionReason: updated.correctionReason,
      markedAt: updated.markedAt.toISOString(),
    };
  }

  /**
   * Closes or finalizes an attendance session.
   */
  static async updateSessionStatus(
    actor: AuthenticatedActor,
    sessionId: string,
    status: AttendanceSessionStatus
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can close/finalize sessions.');
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw ApiError.notFound('Attendance session not found.');
    }

    await assertCourseAccessScope(actor, session.courseId);

    return prisma.$transaction(async (tx) => {
      if (status === 'FINALIZED') {
        const activeEnrollments = await tx.enrollment.findMany({
          where: {
            courseId: session.courseId,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
          select: { studentId: true },
        });

        const existingRecords = await tx.attendanceRecord.findMany({
          where: { attendanceSessionId: session.id },
          select: { studentId: true },
        });
        const markedSet = new Set(existingRecords.map((r) => r.studentId));

        for (const enr of activeEnrollments) {
          if (!markedSet.has(enr.studentId)) {
            await tx.attendanceRecord.create({
              data: {
                attendanceSessionId: session.id,
                studentId: enr.studentId,
                status: 'ABSENT',
                source: 'MANUAL',
                correctedById: actor.id,
                correctionReason: 'Auto-marked ABSENT upon session finalization',
              },
            });
          }
        }
      }

      const updated = await tx.attendanceSession.update({
        where: { id: sessionId },
        data: {
          status,
          finalizedAt: status === 'FINALIZED' ? new Date() : session.finalizedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'ATTENDANCE_SESSION_STATUS_UPDATED',
          entityType: 'AttendanceSession',
          entityId: sessionId,
          afterDataJson: JSON.stringify({ status }),
        },
      });

      return updated;
    });
  }

  /**
   * Identifies enrolled students falling below the course's `minAttendancePercent` (default 75%)
   * and dispatches automated Low-Attendance Early Warning notifications via Email + WhatsApp + In-App (`POST /api/v1/attendance/low-attendance-alerts`).
   */
  static async dispatchLowAttendanceAlerts(
    actor: AuthenticatedActor,
    payload: { courseId?: string }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden(
        'Only Administrators or assigned Teachers can trigger low-attendance warning alerts.'
      );
    }

    if (payload.courseId) {
      await assertCourseAccessScope(actor, payload.courseId);
    }

    const courseWhere: Prisma.CourseWhereInput = payload.courseId
      ? { id: payload.courseId }
      : actor.role === 'TEACHER'
      ? {
          teacherAssignments: {
            some: { teacherId: actor.id, status: 'ACTIVE' },
          },
        }
      : {};

    const courses = await prisma.course.findMany({
      where: courseWhere,
      include: {
        enrollments: {
          where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
          include: {
            student: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
        attendanceSessions: {
          include: {
            records: true,
          },
        },
      },
    });

    const alertedStudents: Array<{
      studentId: string;
      studentName: string;
      studentEmail: string;
      courseCode: string;
      attendancePercent: number;
      minAttendancePercent: number;
      consecutiveClassesNeededToRecover: number;
    }> = [];

    for (const course of courses) {
      const totalSessions = course.attendanceSessions.length;
      if (totalSessions === 0) continue;

      const minPct = Number(course.minAttendancePercent) || 75;

      for (const enr of course.enrollments) {
        let presentCount = 0;
        for (const sess of course.attendanceSessions) {
          const rec = sess.records.find((r) => r.studentId === enr.studentId);
          if (
            rec &&
            (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED')
          ) {
            presentCount += 1;
          }
        }

        const stats = computeLowAttendanceRecoveryStats({
          presentCount,
          totalSessionsCount: totalSessions,
          minAttendancePercent: minPct,
        });

        if (stats.isBelowThreshold) {
          alertedStudents.push({
            studentId: enr.studentId,
            studentName: enr.student.fullName,
            studentEmail: enr.student.email,
            courseCode: course.code,
            attendancePercent: stats.attendancePercent,
            minAttendancePercent: minPct,
            consecutiveClassesNeededToRecover: stats.consecutiveClassesNeededToRecover,
          });

          await OmnichannelMessagingService.dispatchToUsers({
            actorId: actor.id,
            eventType: 'COURSE_ANNOUNCEMENT',
            courseCode: course.code,
            title: `Attendance Warning: ${course.code} (${stats.attendancePercent}% < ${minPct}%)`,
            body: `Hello ${enr.student.fullName}, your current attendance in ${course.code} (${course.title}) is ${stats.attendancePercent}% (${presentCount}/${totalSessions} sessions), which is below the ${minPct}% certificate eligibility threshold. Please attend the next ${stats.consecutiveClassesNeededToRecover} consecutive live session(s) to restore eligibility.`,
            recipientUserIds: [enr.studentId],
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'LOW_ATTENDANCE_WARNING_DISPATCHED',
        entityType: 'AttendanceSession',
        entityId: payload.courseId || 'ALL_ASSIGNED_COURSES',
        afterDataJson: JSON.stringify({
          alertedStudentsCount: alertedStudents.length,
          alertedStudents,
        }),
      },
    });

    return {
      alertedStudentsCount: alertedStudents.length,
      alertedStudents,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class AttendanceController {
  static listSessions = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await AttendanceService.listSessions(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Attendance sessions retrieved successfully', list);
  });

  static generateCode = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await AttendanceService.generateSessionCode(req.user, req.body);
    return apiResponse(
      res,
      201,
      '6-digit attendance code generated (hashed at rest with SHA-256)',
      created
    );
  });

  static submitCode = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await AttendanceService.submitAttendanceCode(
      req.user,
      String(req.params.sessionId),
      req.body.code
    );
    return apiResponse(res, 200, 'Attendance marked PRESENT via session code', result);
  });

  static manualOverride = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await AttendanceService.manualOverrideAttendance(
      req.user,
      String(req.params.sessionId),
      req.body
    );
    return apiResponse(res, 200, 'Attendance manually updated and audited', result);
  });

  static updateStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await AttendanceService.updateSessionStatus(
      req.user,
      String(req.params.sessionId),
      req.body.status
    );
    return apiResponse(res, 200, 'Attendance session status updated', updated);
  });

  static dispatchLowAttendanceAlerts = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await AttendanceService.dispatchLowAttendanceAlerts(req.user, req.body);
    return apiResponse(
      res,
      200,
      `Dispatched low-attendance warnings to ${result.alertedStudentsCount} student(s)`,
      result
    );
  });
}

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

attendanceRouter.get('/sessions', AttendanceController.listSessions);
attendanceRouter.post(
  '/sessions',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createAttendanceSessionValidation),
  AttendanceController.generateCode
);
attendanceRouter.post(
  '/sessions/:sessionId/submit-code',
  authorizeRoles('STUDENT'),
  validateRequest(submitAttendanceCodeValidation),
  AttendanceController.submitCode
);
attendanceRouter.patch(
  '/sessions/:sessionId/override',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(manualAttendanceOverrideValidation),
  AttendanceController.manualOverride
);
attendanceRouter.patch(
  '/sessions/:sessionId/status',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(updateAttendanceSessionStatusValidation),
  AttendanceController.updateStatus
);
attendanceRouter.post(
  '/low-attendance-alerts',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(dispatchLowAttendanceAlertsValidation),
  AttendanceController.dispatchLowAttendanceAlerts
);
