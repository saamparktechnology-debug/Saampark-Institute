import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { RoleType } from '@prisma/client';
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

export const updateProfileValidation = {
  body: z.object({
    fullName: z.string().trim().min(2).max(150),
    phone: z.string().trim().min(8).max(24).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
    gradeLevel: z.string().trim().max(64).optional().nullable(),
    guardianName: z.string().trim().max(150).optional().nullable(),
    guardianPhone: z.string().trim().max(32).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    qualification: z.string().trim().max(255).optional().nullable(),
    specialization: z.string().trim().max(255).optional().nullable(),
    biography: z.string().trim().max(2000).optional().nullable(),
    department: z.string().trim().max(64).optional().nullable(),
  }),
};

export const createPermissionValidation = {
  body: z.object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9._-]+$/, 'Permission code must be lowercase dot/underscore separated'),
    module: z.string().trim().min(2).max(64),
    description: z.string().trim().min(5).max(255),
    roles: z.array(z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT'])).default(['ADMIN']),
  }),
};

export const toggleRolePermissionValidation = {
  body: z.object({
    role: z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']),
    permissionId: z.string().uuid('Valid permissionId UUID is required'),
    granted: z.boolean(),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE: UNIFIED CALENDAR, PROFILE & RBAC MATRIX (C-012, C-013, C-025)
// ----------------------------------------------------------------------------

export class CalendarProfileRbacService {
  /**
   * Returns a unified chronological schedule & calendar feed scoped strictly to the actor's role (`C-012`, `C-013`):
   * - Aggregates `LiveClass`, `Assignment` due dates, `Exam` windows, and `Installment` due dates.
   */
  static async listCalendarEvents(actor: AuthenticatedActor) {
    let courseIds: string[] = [];

    if (actor.role === 'STUDENT') {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { courseId: true },
      });
      courseIds = enrollments.map((e) => e.courseId);
    } else if (actor.role === 'TEACHER') {
      const assignments = await prisma.courseTeacherAssignment.findMany({
        where: { teacherId: actor.id, status: 'ACTIVE' },
        select: { courseId: true },
      });
      courseIds = assignments.map((a) => a.courseId);
    }

    const courseFilter =
      actor.role === 'ADMIN' || actor.role === 'SUPPORT'
        ? {}
        : { courseId: { in: courseIds } };

    const [liveClasses, assignments, exams, installments] = await Promise.all([
      prisma.liveClass.findMany({
        where: courseFilter,
        include: { course: { select: { code: true, title: true } } },
        orderBy: { scheduledStartAt: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { ...courseFilter, status: 'PUBLISHED' },
        include: { course: { select: { code: true, title: true } } },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.exam.findMany({
        where: { ...courseFilter, status: 'PUBLISHED' },
        include: { course: { select: { code: true, title: true } } },
        orderBy: { startsAt: 'asc' },
      }),
      actor.role === 'STUDENT'
        ? prisma.installment.findMany({
            where: {
              enrollment: { studentId: actor.id },
              status: { in: ['PENDING', 'OVERDUE'] },
            },
            include: {
              enrollment: { include: { course: { select: { code: true, title: true } } } },
            },
            orderBy: { dueAt: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const events = [
      ...liveClasses.map((lc) => ({
        id: `live_${lc.id}`,
        eventType: 'LIVE_CLASS' as const,
        title: lc.title,
        courseCode: lc.course.code,
        courseTitle: lc.course.title,
        startsAt: lc.scheduledStartAt.toISOString(),
        endsAt: lc.scheduledEndAt.toISOString(),
        status: lc.status,
        badgeColor: 'emerald',
      })),
      ...assignments.map((a) => ({
        id: `asgn_${a.id}`,
        eventType: 'ASSIGNMENT_DUE' as const,
        title: `Assignment Due: ${a.title}`,
        courseCode: a.course.code,
        courseTitle: a.course.title,
        startsAt: a.dueAt.toISOString(),
        endsAt: a.dueAt.toISOString(),
        status: a.status,
        badgeColor: 'violet',
      })),
      ...exams.map((ex) => ({
        id: `exam_${ex.id}`,
        eventType: 'EXAM_WINDOW' as const,
        title: `Examination: ${ex.title}`,
        courseCode: ex.course.code,
        courseTitle: ex.course.title,
        startsAt: ex.startsAt.toISOString(),
        endsAt: ex.endsAt.toISOString(),
        status: ex.status,
        badgeColor: 'cyan',
      })),
      ...installments.map((inst) => ({
        id: `inst_${inst.id}`,
        eventType: 'INSTALLMENT_DUE' as const,
        title: `Installment #${inst.sequenceNumber} Due (₹${inst.amount.toFixed(2)})`,
        courseCode: inst.enrollment.course.code,
        courseTitle: inst.enrollment.course.title,
        startsAt: inst.dueAt.toISOString(),
        endsAt: inst.graceEndsAt.toISOString(),
        status: inst.status,
        badgeColor: 'amber',
      })),
    ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return events;
  }

  /**
   * Retrieves the authenticated user's profile and role-specific profile record.
   */
  static async getMyProfile(actor: AuthenticatedActor) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        studentProfile: true,
        teacherProfile: true,
        supportAgentProfile: true,
        wallet: { select: { availableBalance: true, reservedBalance: true, currency: true } },
        referralCode: { select: { code: true } },
      },
    });

    if (!user) {
      throw ApiError.notFound('User profile not found.');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      studentProfile: user.studentProfile
        ? {
            studentCode: user.studentProfile.studentCode,
            gradeLevel: user.studentProfile.gradeLevel,
            guardianName: user.studentProfile.guardianName,
            guardianPhone: user.studentProfile.guardianPhone,
            address: user.studentProfile.address,
          }
        : null,
      teacherProfile: user.teacherProfile
        ? {
            teacherCode: user.teacherProfile.teacherCode,
            qualification: user.teacherProfile.qualification,
            specialization: user.teacherProfile.specialization,
            biography: user.teacherProfile.biography,
            defaultRevenueSharePercent:
              user.teacherProfile.defaultRevenueSharePercent.toFixed(2),
          }
        : null,
      supportAgentProfile: user.supportAgentProfile
        ? {
            agentCode: user.supportAgentProfile.agentCode,
            department: user.supportAgentProfile.department,
            isTriageLead: user.supportAgentProfile.isTriageLead,
            maxConcurrentTickets: user.supportAgentProfile.maxConcurrentTickets,
          }
        : null,
      walletAvailableInr: user.wallet ? user.wallet.availableBalance.toFixed(2) : null,
      referralCode: user.referralCode?.code || null,
    };
  }

  /**
   * Updates the authenticated user's profile fields and writes an audit log entry.
   */
  static async updateMyProfile(
    actor: AuthenticatedActor,
    payload: {
      fullName: string;
      phone?: string | null;
      avatarUrl?: string | null;
      gradeLevel?: string | null;
      guardianName?: string | null;
      guardianPhone?: string | null;
      address?: string | null;
      qualification?: string | null;
      specialization?: string | null;
      biography?: string | null;
      department?: string | null;
    }
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: {
          fullName: payload.fullName,
          phone: payload.phone !== undefined ? payload.phone : undefined,
          avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : undefined,
        },
      });

      if (actor.role === 'STUDENT') {
        await tx.studentProfile.updateMany({
          where: { userId: actor.id },
          data: {
            gradeLevel: payload.gradeLevel ?? undefined,
            guardianName: payload.guardianName ?? undefined,
            guardianPhone: payload.guardianPhone ?? undefined,
            address: payload.address ?? undefined,
          },
        });
      } else if (actor.role === 'TEACHER') {
        await tx.teacherProfile.updateMany({
          where: { userId: actor.id },
          data: {
            qualification: payload.qualification ?? undefined,
            specialization: payload.specialization ?? undefined,
            biography: payload.biography ?? undefined,
          },
        });
      } else if (actor.role === 'SUPPORT') {
        await tx.supportAgentProfile.updateMany({
          where: { userId: actor.id },
          data: {
            department: payload.department ?? undefined,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'USER_PROFILE_UPDATED',
          entityType: 'User',
          entityId: actor.id,
          afterDataJson: JSON.stringify({ fullName: payload.fullName }),
        },
      });
    });

    return this.getMyProfile(actor);
  }

  /**
   * Admin RBAC Permission Matrix (`C-025`): Lists all granular permissions and role mappings.
   */
  static async getRbacMatrix(actor: AuthenticatedActor) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can inspect the RBAC permission matrix.');
    }

    const permissions = await prisma.permission.findMany({
      include: {
        rolePermissions: true,
        _count: { select: { userPermissions: true } },
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id,
      code: p.code,
      module: p.module,
      description: p.description,
      assignedRoles: p.rolePermissions.map((rp) => rp.role),
      userOverrideCount: p._count.userPermissions,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * Admin creates a new granular RBAC permission code and maps it to initial roles.
   */
  static async createPermission(
    actor: AuthenticatedActor,
    payload: {
      code: string;
      module: string;
      description: string;
      roles: RoleType[];
    }
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can create RBAC permissions.');
    }

    return prisma.$transaction(async (tx) => {
      const perm = await tx.permission.create({
        data: {
          code: payload.code.toLowerCase(),
          module: payload.module.toUpperCase(),
          description: payload.description,
          rolePermissions: {
            create: payload.roles.map((r) => ({ role: r })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'RBAC_PERMISSION_CREATED',
          entityType: 'Permission',
          entityId: perm.id,
          afterDataJson: JSON.stringify(payload),
        },
      });

      return perm;
    });
  }

  /**
   * Admin grants or revokes a permission for a role (`RolePermission`).
   */
  static async toggleRolePermission(
    actor: AuthenticatedActor,
    payload: { role: RoleType; permissionId: string; granted: boolean }
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can modify role permissions.');
    }

    await prisma.$transaction(async (tx) => {
      if (payload.granted) {
        await tx.rolePermission.upsert({
          where: {
            role_permissionId: {
              role: payload.role,
              permissionId: payload.permissionId,
            },
          },
          update: {},
          create: {
            role: payload.role,
            permissionId: payload.permissionId,
          },
        });
      } else {
        await tx.rolePermission.deleteMany({
          where: {
            role: payload.role,
            permissionId: payload.permissionId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: payload.granted ? 'RBAC_ROLE_PERMISSION_GRANTED' : 'RBAC_ROLE_PERMISSION_REVOKED',
          entityType: 'RolePermission',
          entityId: payload.permissionId,
          afterDataJson: JSON.stringify(payload),
        },
      });
    });

    return this.getRbacMatrix(actor);
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class CalendarProfileRbacController {
  static listEvents = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const events = await CalendarProfileRbacService.listCalendarEvents(req.user);
    return apiResponse(res, 200, 'Calendar events retrieved successfully', events);
  });

  static getProfile = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const profile = await CalendarProfileRbacService.getMyProfile(req.user);
    return apiResponse(res, 200, 'Profile retrieved successfully', profile);
  });

  static updateProfile = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await CalendarProfileRbacService.updateMyProfile(req.user, req.body);
    return apiResponse(res, 200, 'Profile updated and audited', updated);
  });

  static getRbacMatrix = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const matrix = await CalendarProfileRbacService.getRbacMatrix(req.user);
    return apiResponse(res, 200, 'RBAC permission matrix retrieved', matrix);
  });

  static createPermission = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await CalendarProfileRbacService.createPermission(req.user, req.body);
    return apiResponse(res, 201, 'RBAC permission created', created);
  });

  static toggleRolePermission = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const matrix = await CalendarProfileRbacService.toggleRolePermission(req.user, req.body);
    return apiResponse(res, 200, 'Role permission updated', matrix);
  });
}

export const calendarRouter = Router();
calendarRouter.use(authenticate);

calendarRouter.get('/events', CalendarProfileRbacController.listEvents);
calendarRouter.get('/profile', CalendarProfileRbacController.getProfile);
calendarRouter.patch(
  '/profile',
  validateRequest(updateProfileValidation),
  CalendarProfileRbacController.updateProfile
);
calendarRouter.get(
  '/rbac',
  authorizeRoles('ADMIN'),
  CalendarProfileRbacController.getRbacMatrix
);
calendarRouter.post(
  '/rbac/permissions',
  authorizeRoles('ADMIN'),
  validateRequest(createPermissionValidation),
  CalendarProfileRbacController.createPermission
);
calendarRouter.post(
  '/rbac/role-grants',
  authorizeRoles('ADMIN'),
  validateRequest(toggleRolePermissionValidation),
  CalendarProfileRbacController.toggleRolePermission
);
