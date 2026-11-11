import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RoleType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import {
  AuthSessionResponseDto,
  LoginRequestDto,
  SafeUserDto,
  StudentSignupRequestDto,
} from "./auth.types";

const PANEL_REDIRECT_MAP: Record<RoleType, string> = {
  ADMIN: "/admin/dashboard",
  STUDENT: "/student/dashboard",
  TEACHER: "/teacher/dashboard",
  SUPPORT: "/support/dashboard",
};

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export class AuthService {
  /**
   * Resolves effective RBAC permissions for a user by merging role permissions and user overrides.
   */
  static async resolveUserPermissions(
    userId: string,
    role: RoleType,
  ): Promise<string[]> {
    const [rolePerms, userOverrides] = await Promise.all([
      prisma.rolePermission.findMany({
        where: { role },
        include: { permission: true },
      }),
      prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      }),
    ]);

    const effective = new Set<string>(
      rolePerms.map((rp) => rp.permission.code),
    );
    for (const override of userOverrides) {
      if (override.isGranted) {
        effective.add(override.permission.code);
      } else {
        effective.delete(override.permission.code);
      }
    }
    return Array.from(effective);
  }

  /**
   * Authenticates a user for a specific role panel (/admin/login, /student/login, /teacher/login, /support/login).
   * Enforces C-003 & C-025: rejects login if the user's primary role does not match the entry panel.
   */
  static async loginForPanel(
    dto: LoginRequestDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthSessionResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(
        403,
        "ACCOUNT_SUSPENDED",
        `Account is currently ${user.status}. Please contact administrator.`,
      );
    }

    if (user.role !== dto.rolePanel) {
      throw new ApiError(
        403,
        "ROLE_PANEL_MISMATCH",
        `This account belongs to the ${user.role} panel and cannot sign in via the ${dto.rolePanel} login portal.`,
      );
    }

    const permissions = await this.resolveUserPermissions(user.id, user.role);
    const rawRefreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash,
          rolePanel: dto.rolePanel,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent?.slice(0, 255),
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "AUTH_LOGIN_SUCCESS",
          entityType: "Session",
          entityId: createdSession.id,
          afterDataJson: JSON.stringify({ rolePanel: dto.rolePanel }),
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });

      return createdSession;
    });

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions,
        sessionId: session.id,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
    );

    const safeUser: SafeUserDto = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      permissions,
      lastLoginAt: new Date(),
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawRefreshToken,
      redirectTo: PANEL_REDIRECT_MAP[user.role],
    };
  }

  /**
   * Open Student Registration with atomic Wallet, StudentProfile, ReferralCode creation,
   * and optional Referral attribution (preventing self-referral and duplicate attribution per C-028).
   */
  static async registerStudent(
    dto: StudentSignupRequestDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthSessionResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const studentCode = `STU-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;
    const ownReferralCode = `ARGON-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone || null,
          passwordHash,
          fullName: dto.fullName,
          role: "STUDENT",
          status: "ACTIVE",
          studentProfile: {
            create: {
              studentCode,
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
              code: ownReferralCode,
              isActive: true,
            },
          },
        },
      });

      if (dto.referralCode) {
        const refCodeRecord = await tx.referralCode.findUnique({
          where: { code: dto.referralCode.toUpperCase() },
        });
        if (
          refCodeRecord &&
          refCodeRecord.isActive &&
          refCodeRecord.userId !== createdUser.id
        ) {
          await tx.referral.create({
            data: {
              referrerUserId: refCodeRecord.userId,
              referredUserId: createdUser.id,
              referralCodeId: refCodeRecord.id,
              status: "ATTRIBUTED",
              rewardAmountSnapshot: 500.0, // Default INR 500 snapshot upon 1st paid enrollment
              currency: "INR",
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: createdUser.id,
          action: "STUDENT_SELF_SIGNUP",
          entityType: "User",
          entityId: createdUser.id,
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });
    });

    return this.loginForPanel(
      {
        email: dto.email,
        password: dto.password,
        rolePanel: "STUDENT",
      },
      meta,
    );
  }

  /**
   * Rotates refresh token and issues a fresh access token.
   */
  static async refreshSession(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const existingSession = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (
      !existingSession ||
      existingSession.revokedAt ||
      existingSession.expiresAt < new Date() ||
      existingSession.user.status !== "ACTIVE"
    ) {
      throw ApiError.unauthorized(
        "Refresh session is invalid or expired",
        "AUTH_TOKEN_EXPIRED",
      );
    }

    const newRawRefreshToken = crypto.randomBytes(48).toString("hex");
    const newHash = hashRefreshToken(newRawRefreshToken);
    const permissions = await this.resolveUserPermissions(
      existingSession.user.id,
      existingSession.user.role,
    );

    await prisma.session.update({
      where: { id: existingSession.id },
      data: {
        refreshTokenHash: newHash,
        expiresAt: new Date(
          Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    const accessToken = jwt.sign(
      {
        sub: existingSession.user.id,
        email: existingSession.user.email,
        fullName: existingSession.user.fullName,
        role: existingSession.user.role,
        permissions,
        sessionId: existingSession.id,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
    );

    return { accessToken, refreshToken: newRawRefreshToken };
  }

  static async logoutSession(
    sessionId: string,
    actorUserId: string,
  ): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, userId: actorUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
