import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { RoleType } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { AuthenticatedActor } from "../types/express";

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
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const cookieToken = req.cookies?.argon_access_token as string | undefined;
    const token = bearerToken || cookieToken;

    if (!token) {
      throw ApiError.unauthorized(
        "Missing authentication token",
        "AUTH_UNAUTHORIZED",
      );
    }

    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    } catch {
      throw ApiError.unauthorized(
        "Invalid or expired authentication token",
        "AUTH_TOKEN_EXPIRED",
      );
    }

    // Verify user account is still ACTIVE in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized(
        "Account no longer exists",
        "AUTH_UNAUTHORIZED",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(
        403,
        "ACCOUNT_SUSPENDED",
        `Your account status is currently ${user.status}. Please contact support.`,
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
          `Access restricted to [${allowedRoles.join(", ")}] role(s).`,
          "ROLE_PANEL_MISMATCH",
        ),
      );
    }
    return next();
  };
}

/**
 * Layer 3b: Enforce granular RBAC permission code(s), even for Admins on sensitive actions.
 */
export function requirePermissions(
  ...requiredPermissions: string[]
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    const actorPerms = new Set(req.user.permissions);
    const missing = requiredPermissions.filter((perm) => !actorPerms.has(perm));
    if (missing.length > 0) {
      return next(
        ApiError.forbidden(
          `Missing required permission(s): ${missing.join(", ")}`,
          "PERMISSION_DENIED",
        ),
      );
    }
    return next();
  };
}

/**
 * Layer 4: Resource-Level Scope Helpers
 * Ensures Students only access their own records, Teachers only access assigned courses,
 * and Support agents only access authorized tickets.
 */
export async function assertCourseAccessScope(
  actor: AuthenticatedActor,
  courseId: string,
): Promise<void> {
  if (actor.role === "ADMIN") return;

  if (actor.role === "TEACHER") {
    const assignment = await prisma.courseTeacherAssignment.findUnique({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId: actor.id,
        },
      },
      select: { status: true },
    });
    if (!assignment || assignment.status !== "ACTIVE") {
      throw ApiError.forbidden(
        "Teachers can only access courses actively assigned to them.",
        "RESOURCE_FORBIDDEN",
      );
    }
    return;
  }

  if (actor.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId: actor.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw ApiError.forbidden(
        "Course access requires an active or completed enrollment (full payment or verified 1st installment).",
        "RESOURCE_FORBIDDEN",
      );
    }
    return;
  }

  throw ApiError.forbidden(
    "Unauthorized resource scope for this course.",
    "RESOURCE_FORBIDDEN",
  );
}

export function assertOwnStudentRecordOrAdmin(
  actor: AuthenticatedActor,
  targetStudentId: string,
): void {
  if (actor.role === "ADMIN") return;
  if (actor.role === "STUDENT" && actor.id === targetStudentId) return;
  throw ApiError.forbidden(
    "Students may only view or modify their own personal records.",
    "RESOURCE_FORBIDDEN",
  );
}
