import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { RoleType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { AuthenticatedActor } from '../types/express';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  fullName: string;
  role: RoleType;
  permissions: string[];
  sessionId: string;
}

/**
 * Layer 1 & 2: Verify JWT access token and check account status.
 * Never trusts user IDs or roles passed in request body/query.
 */
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieToken = req.cookies?.argon_access_token as string | undefined;
    const token = bearerToken || cookieToken;

    if (!token) {
      throw ApiError.unauthorized('Missing authentication token', 'AUTH_UNAUTHORIZED');
    }

    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    } catch {
      throw ApiError.unauthorized('Invalid or expired authentication token', 'AUTH_TOKEN_EXPIRED');
    }

    // Verify user account is still ACTIVE in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    if (!user) {
      throw ApiError.unauthorized('Account no longer exists', 'AUTH_UNAUTHORIZED');
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(
        403,
        'ACCOUNT_SUSPENDED',
        `Your account status is currently ${user.status}. Please contact support.`
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: decoded.permissions || [],
      sessionId: decoded.sessionId,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Layer 3a: Enforce primary role scope (e.g. ADMIN, STUDENT, TEACHER, SUPPORT).
 */
export function authorizeRoles(...allowedRoles: RoleType[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access restricted to [${allowedRoles.join(', ')}] role(s).`,
          'ROLE_PANEL_MISMATCH'
        )
      );
    }
    return next();
  };
}

/**
 * Layer 3b: Enforce granular RBAC permission code(s), even for Admins on sensitive actions.
 */
export function requirePermissions(...requiredPermissions: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    const actorPerms = new Set(req.user.permissions);
    const missing = requiredPermissions.filter((perm) => !actorPerms.has(perm));
    if (missing.length > 0) {
      return next(
        ApiError.forbidden(
          `Missing required permission(s): ${missing.join(', ')}`,
          'PERMISSION_DENIED'
        )
      );
    }
    return next();
  };
}

/**
 * Layer 4: Resource-Level Scope Helpers
 * Ensures Students only access their own records, Teachers only access assigned courses,
 * and automatically enforces the Installment Grace-Period Access Lock (`SUSPENDED_OVERDUE`)
 * on Live Classes, Recorded Classes, and Study Materials while keeping `/student/enrollments` and `/student/support` open!
 */
export async function assertCourseAccessScope(
  actor: AuthenticatedActor,
  courseId: string
): Promise<void> {
  if (actor.role === 'ADMIN') return;

  if (actor.role === 'TEACHER') {
    const assignment = await prisma.courseTeacherAssignment.findUnique({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId: actor.id,
        },
      },
      select: { status: true },
    });
    if (!assignment || assignment.status !== 'ACTIVE') {
      throw ApiError.forbidden(
        'Teachers can only access courses actively assigned to them.',
        'RESOURCE_FORBIDDEN'
      );
    }
    return;
  }

  if (actor.role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId: actor.id,
      },
      include: {
        installments: { orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!enrollment) {
      throw ApiError.forbidden(
        'Course access requires an active or completed enrollment (full payment or verified 1st installment).',
        'RESOURCE_FORBIDDEN'
      );
    }

    // Real-time automated grace-period check: if any unpaid installment has passed graceEndsAt,
    // transition enrollment to SUSPENDED_OVERDUE and block access until paid in /student/enrollments.
    const now = new Date();
    const expiredUnpaidInstallments = enrollment.installments.filter(
      (i) => i.status !== 'PAID' && i.status !== 'CANCELLED' && i.graceEndsAt.getTime() < now.getTime()
    );

    if (
      expiredUnpaidInstallments.length > 0 &&
      (enrollment.status === 'ACTIVE' || enrollment.status === 'SUSPENDED_OVERDUE')
    ) {
      if (enrollment.status !== 'SUSPENDED_OVERDUE') {
        await prisma.$transaction([
          prisma.installment.updateMany({
            where: { id: { in: expiredUnpaidInstallments.map((i) => i.id) } },
            data: { status: 'OVERDUE' },
          }),
          prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { status: 'SUSPENDED_OVERDUE', suspendedAt: now },
          }),
        ]);
      }

      const overdueSeq = expiredUnpaidInstallments[0].sequenceNumber;
      const overdueAmt = expiredUnpaidInstallments[0].amount.toFixed(2);
      throw new ApiError(
        403,
        'INSTALLMENT_OVERDUE_LOCKED',
        `Course access is temporarily locked because Installment #${overdueSeq} (₹${overdueAmt}) passed its grace period. Please pay the overdue installment in Installments & Dues (/student/enrollments) to automatically unlock your classes and study materials.`
      );
    }

    if (enrollment.status === 'SUSPENDED_OVERDUE') {
      throw new ApiError(
        403,
        'INSTALLMENT_OVERDUE_LOCKED',
        'Course access is temporarily locked due to an overdue installment. Please complete your payment in Installments & Dues (/student/enrollments) to automatically unlock your account.'
      );
    }

    if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'COMPLETED') {
      throw ApiError.forbidden(
        'Course access requires an active or completed enrollment (full payment or verified 1st installment).',
        'RESOURCE_FORBIDDEN'
      );
    }
    return;
  }

  throw ApiError.forbidden('Unauthorized resource scope for this course.', 'RESOURCE_FORBIDDEN');
}

export function assertOwnStudentRecordOrAdmin(
  actor: AuthenticatedActor,
  targetStudentId: string
): void {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'STUDENT' && actor.id === targetStudentId) return;
  throw ApiError.forbidden(
    'Students may only view or modify their own personal records.',
    'RESOURCE_FORBIDDEN'
  );
}
