import crypto from "crypto";
import bcrypt from "bcryptjs";
import { AccountStatus, Prisma, RoleType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AuthenticatedActor } from "../../types/express";
import { ApiError } from "../../utils/ApiError";
import {
  buildPaginationMeta,
  parsePaginationAndFilters,
} from "../../utils/pagination";
import { UserDirectoryItemDto } from "./users.types";

export class UsersService {
  /**
   * Lists users with allowlisted role/status filters for Admin User Management.
   */
  static async listUsers(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>,
  ) {
    if (actor.role !== "ADMIN") {
      throw ApiError.forbidden(
        "Only administrators can view the platform user directory.",
      );
    }

    const { page, limit, skip, sortBy, sortOrder, filters } =
      parsePaginationAndFilters(
        rawQuery,
        ["role", "status", "search"],
        ["createdAt", "fullName", "email"],
        "createdAt",
      );

    const where: Prisma.UserWhereInput = {};
    if (filters.role) {
      where.role = filters.role as RoleType;
    }
    if (filters.status) {
      where.status = filters.status as AccountStatus;
    }
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          studentProfile: true,
          teacherProfile: true,
          supportAgentProfile: true,
        },
      }),
    ]);

    const items: UserDirectoryItemDto[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      studentCode: u.studentProfile?.studentCode || null,
      teacherCode: u.teacherProfile?.teacherCode || null,
      specialization: u.teacherProfile?.specialization || null,
      defaultRevenueSharePercent: u.teacherProfile
        ? u.teacherProfile.defaultRevenueSharePercent.toFixed(2)
        : null,
      agentCode: u.supportAgentProfile?.agentCode || null,
      department: u.supportAgentProfile?.department || null,
    }));

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Lists all ACTIVE teachers so Admin can select a teacher from a dropdown when assigning to a course.
   */
  static async listActiveTeachers(
    actor: AuthenticatedActor,
  ): Promise<UserDirectoryItemDto[]> {
    if (actor.role !== "ADMIN") {
      throw ApiError.forbidden(
        "Only administrators can list teachers for course assignment.",
      );
    }

    const teachers = await prisma.user.findMany({
      where: { role: "TEACHER", status: "ACTIVE" },
      include: { teacherProfile: true },
      orderBy: { fullName: "asc" },
    });

    return teachers.map((t) => ({
      id: t.id,
      email: t.email,
      phone: t.phone,
      fullName: t.fullName,
      role: t.role,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      lastLoginAt: t.lastLoginAt ? t.lastLoginAt.toISOString() : null,
      teacherCode: t.teacherProfile?.teacherCode || null,
      specialization: t.teacherProfile?.specialization || null,
      defaultRevenueSharePercent: t.teacherProfile
        ? t.teacherProfile.defaultRevenueSharePercent.toFixed(2)
        : "30.00",
    }));
  }

  /**
   * Admin provisions a new Teacher, Support Agent, Student, or Admin account (O-005, C-025).
   */
  static async createUserByAdmin(
    actor: AuthenticatedActor,
    payload: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      role: RoleType;
      specialization?: string;
      defaultRevenueSharePercent?: number;
      department?: string;
    },
  ): Promise<UserDirectoryItemDto> {
    if (actor.role !== "ADMIN") {
      throw ApiError.forbidden(
        "Only administrators can provision user accounts.",
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("A user with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const codeSuffix = `${Date.now().toString().slice(-5)}${crypto.randomInt(10, 99)}`;

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.email.toLowerCase(),
          phone: payload.phone || null,
          passwordHash,
          fullName: payload.fullName,
          role: payload.role,
          status: "ACTIVE",
          ...(payload.role === "TEACHER"
            ? {
                teacherProfile: {
                  create: {
                    teacherCode: `TCH-${codeSuffix}`,
                    specialization: payload.specialization || "General Faculty",
                    defaultRevenueSharePercent: new Prisma.Decimal(
                      (payload.defaultRevenueSharePercent ?? 30).toFixed(2),
                    ),
                  },
                },
              }
            : {}),
          ...(payload.role === "STUDENT"
            ? {
                studentProfile: {
                  create: {
                    studentCode: `STU-${codeSuffix}`,
                  },
                },
                wallet: {
                  create: {
                    currency: "INR",
                    availableBalance: 0,
                    reservedBalance: 0,
                  },
                },
                referralCode: {
                  create: {
                    code: `ARGON-${codeSuffix}`,
                    isActive: true,
                  },
                },
              }
            : {}),
          ...(payload.role === "SUPPORT"
            ? {
                supportAgentProfile: {
                  create: {
                    agentCode: `SUP-${codeSuffix}`,
                    department: payload.department || "GENERAL",
                  },
                },
              }
            : {}),
        },
        include: {
          studentProfile: true,
          teacherProfile: true,
          supportAgentProfile: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "USER_PROVISIONED_BY_ADMIN",
          entityType: "User",
          entityId: user.id,
          afterDataJson: JSON.stringify({
            email: user.email,
            role: user.role,
          }),
        },
      });

      return user;
    });

    return {
      id: created.id,
      email: created.email,
      phone: created.phone,
      fullName: created.fullName,
      role: created.role,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      lastLoginAt: null,
      studentCode: created.studentProfile?.studentCode || null,
      teacherCode: created.teacherProfile?.teacherCode || null,
      specialization: created.teacherProfile?.specialization || null,
      defaultRevenueSharePercent: created.teacherProfile
        ? created.teacherProfile.defaultRevenueSharePercent.toFixed(2)
        : null,
      agentCode: created.supportAgentProfile?.agentCode || null,
      department: created.supportAgentProfile?.department || null,
    };
  }

  static async updateUserStatus(
    actor: AuthenticatedActor,
    userId: string,
    status: AccountStatus,
  ) {
    if (actor.role !== "ADMIN") {
      throw ApiError.forbidden(
        "Only administrators can update account status.",
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "USER_STATUS_UPDATED",
          entityType: "User",
          entityId: userId,
          afterDataJson: JSON.stringify({ status }),
        },
      });

      return updated;
    });
  }
}
