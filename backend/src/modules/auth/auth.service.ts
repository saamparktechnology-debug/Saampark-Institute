import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RoleType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import {
  ActiveDeviceSessionDto,
  AuthSessionResponseDto,
  LoginRequestDto,
  LoginWithOtpDto,
  RequestOtpDto,
  ResetPasswordWithOtpDto,
  SafeUserDto,
  StudentSignupRequestDto,
} from './auth.types';

const PANEL_REDIRECT_MAP: Record<RoleType, string> = {
  ADMIN: '/admin/dashboard',
  STUDENT: '/student/dashboard',
  TEACHER: '/teacher/dashboard',
  SUPPORT: '/support/dashboard',
};

export const MAX_STUDENT_CONCURRENT_SESSIONS = 2;

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function hashOtpCode(email: string, otpCode: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.trim().toLowerCase()}:${otpCode.trim()}:${env.JWT_ACCESS_SECRET}`)
    .digest('hex');
}

/**
 * Pure helper to determine which existing active session IDs must be revoked before creating a new session
 * so the student never exceeds `maxConcurrentSessions` (default 2: 1 Web + 1 Mobile).
 */
export function computeSessionsToRevokeForConcurrentLimit(
  activeSessionIdsOldestFirst: string[],
  maxConcurrentSessions: number = MAX_STUDENT_CONCURRENT_SESSIONS
): string[] {
  if (maxConcurrentSessions < 1) return activeSessionIdsOldestFirst;
  const keepCount = maxConcurrentSessions - 1;
  if (activeSessionIdsOldestFirst.length <= keepCount) {
    return [];
  }
  const revokeCount = activeSessionIdsOldestFirst.length - keepCount;
  return activeSessionIdsOldestFirst.slice(0, revokeCount);
}

// In-memory rate-limit window for OTP requests & verification attempts (5 attempts/minute per email)
const otpRateTracker = new Map<string, number[]>();

export function checkOtpRateLimit(key: string, maxPerMinute = 5): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  const existing = (otpRateTracker.get(key) || []).filter((ts) => ts > windowStart);
  if (existing.length >= maxPerMinute) {
    throw new ApiError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many OTP attempts. Please wait 60 seconds before trying again.'
    );
  }
  existing.push(now);
  otpRateTracker.set(key, existing);
}

export class AuthService {
  /**
   * Resolves effective RBAC permissions for a user by merging role permissions and user overrides.
   */
  static async resolveUserPermissions(userId: string, role: RoleType): Promise<string[]> {
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

    const effective = new Set<string>(rolePerms.map((rp) => rp.permission.code));
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
   * Internal session issuer that enforces the Max-2 Concurrent Device Session Guard for STUDENT accounts.
   */
  private static async issueSessionForVerifiedUser(
    user: {
      id: string;
      email: string;
      phone: string | null;
      fullName: string;
      avatarUrl: string | null;
      role: RoleType;
      status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
    },
    rolePanel: RoleType,
    auditAction: 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_VIA_OTP_SUCCESS',
    meta: { ipAddress?: string; userAgent?: string; requestId?: string }
  ): Promise<AuthSessionResponseDto> {
    const permissions = await this.resolveUserPermissions(user.id, user.role);
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    let evictedOldestSessionsCount = 0;

    const session = await prisma.$transaction(async (tx) => {
      // Enforce Max-2 Concurrent Active Device Sessions for STUDENT role
      if (user.role === 'STUDENT') {
        const activeSessions = await tx.session.findMany({
          where: {
            userId: user.id,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

        const sessionIdsToRevoke = computeSessionsToRevokeForConcurrentLimit(
          activeSessions.map((s) => s.id),
          MAX_STUDENT_CONCURRENT_SESSIONS
        );

        if (sessionIdsToRevoke.length > 0) {
          evictedOldestSessionsCount = sessionIdsToRevoke.length;
          await tx.session.updateMany({
            where: { id: { in: sessionIdsToRevoke } },
            data: { revokedAt: now },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              action: 'STUDENT_CONCURRENT_SESSION_LIMIT_ENFORCED',
              entityType: 'Session',
              entityId: sessionIdsToRevoke[0],
              afterDataJson: JSON.stringify({
                maxAllowedSessions: MAX_STUDENT_CONCURRENT_SESSIONS,
                revokedSessionIds: sessionIdsToRevoke,
              }),
              ipAddress: meta.ipAddress,
              requestId: meta.requestId,
            },
          });
        }
      }

      const createdSession = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash,
          rolePanel,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent?.slice(0, 255),
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: auditAction,
          entityType: 'Session',
          entityId: createdSession.id,
          afterDataJson: JSON.stringify({
            rolePanel,
            evictedOldestSessionsCount,
          }),
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
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
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
      lastLoginAt: now,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawRefreshToken,
      redirectTo: PANEL_REDIRECT_MAP[user.role],
      evictedOldestSessionsCount,
    };
  }

  /**
   * Authenticates a user for a specific role panel (/admin/login, /student/login, /teacher/login, /support/login).
   * Enforces C-003, C-025 & Student Max-2 Concurrent Device Session Guard.
   */
  static async loginForPanel(
    dto: LoginRequestDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string }
  ): Promise<AuthSessionResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(
        403,
        'ACCOUNT_SUSPENDED',
        `Account is currently ${user.status}. Please contact administrator.`
      );
    }

    if (user.role !== dto.rolePanel) {
      throw new ApiError(
        403,
        'ROLE_PANEL_MISMATCH',
        `This account belongs to the ${user.role} panel and cannot sign in via the ${dto.rolePanel} login portal.`
      );
    }

    return this.issueSessionForVerifiedUser(
      user,
      dto.rolePanel,
      'AUTH_LOGIN_SUCCESS',
      meta
    );
  }

  /**
   * Unauthenticated self-service OTP generation for Forgot Password or Passwordless OTP Login.
   * Dispatches a 6-digit OTP via Email + WhatsApp + DLT SMS (when toggled ON) with a 10-minute expiry.
   */
  static async requestPasswordOrLoginOtp(
    dto: RequestOtpDto,
    meta: { ipAddress?: string; requestId?: string }
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    checkOtpRateLimit(`req:${normalizedEmail}`, 5);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw ApiError.notFound('No account found with that email address.');
    }
    if (user.role !== dto.rolePanel) {
      throw new ApiError(
        403,
        'ROLE_PANEL_MISMATCH',
        `This email belongs to the ${user.role} portal, not the ${dto.rolePanel} portal.`
      );
    }
    if (user.status !== 'ACTIVE') {
      throw new ApiError(
        403,
        'ACCOUNT_SUSPENDED',
        `Account is currently ${user.status}. Please contact support.`
      );
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const otpHash = hashOtpCode(normalizedEmail, otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const purpose = dto.purpose || 'PASSWORD_RESET';

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'AUTH_OTP_ISSUED',
        entityType: 'UserOtp',
        entityId: user.id,
        afterDataJson: JSON.stringify({
          email: normalizedEmail,
          rolePanel: dto.rolePanel,
          purpose,
          otpHash,
          expiresAt: expiresAt.toISOString(),
        }),
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
      },
    });

    const dispatchRes = await OmnichannelMessagingService.dispatchDirectOtp({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      otpCode,
      purpose,
    });

    return {
      email: normalizedEmail,
      rolePanel: dto.rolePanel,
      purpose,
      expiresAt: expiresAt.toISOString(),
      channelsDispatched: dispatchRes.channelsDispatched,
      // Returned in development/test mode so local testing without live SMTP/WhatsApp credentials works seamlessly
      devOtpPreview: env.NODE_ENV === 'test' ? otpCode : undefined,
    };
  }

  /**
   * Verifies the latest unconsumed 6-digit OTP for a user and marks it consumed.
   */
  private static async verifyAndConsumeOtp(params: {
    email: string;
    rolePanel: RoleType;
    otp: string;
    ipAddress?: string;
    requestId?: string;
  }) {
    const normalizedEmail = params.email.trim().toLowerCase();
    checkOtpRateLimit(`verify:${normalizedEmail}`, 5);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new ApiError(400, 'OTP_EXPIRED_OR_INVALID', 'Invalid email or OTP.');
    }
    if (user.role !== params.rolePanel) {
      throw new ApiError(
        403,
        'ROLE_PANEL_MISMATCH',
        `This account belongs to the ${user.role} panel.`
      );
    }

    const latestOtpLog = await prisma.auditLog.findFirst({
      where: {
        action: 'AUTH_OTP_ISSUED',
        entityType: 'UserOtp',
        entityId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtpLog || !latestOtpLog.afterDataJson) {
      throw new ApiError(
        400,
        'OTP_EXPIRED_OR_INVALID',
        'No active OTP found. Please request a new 6-digit OTP.'
      );
    }

    // Check if this OTP was already consumed
    const consumedLog = await prisma.auditLog.findFirst({
      where: {
        action: 'AUTH_OTP_CONSUMED',
        entityType: 'UserOtp',
        entityId: latestOtpLog.id,
      },
    });
    if (consumedLog) {
      throw new ApiError(
        400,
        'OTP_EXPIRED_OR_INVALID',
        'This OTP has already been used. Please request a new 6-digit OTP.'
      );
    }

    let parsed: { otpHash?: string; expiresAt?: string } = {};
    try {
      parsed = JSON.parse(latestOtpLog.afterDataJson) as {
        otpHash?: string;
        expiresAt?: string;
      };
    } catch {
      throw new ApiError(400, 'OTP_EXPIRED_OR_INVALID', 'Corrupted OTP state.');
    }

    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() < Date.now()) {
      throw new ApiError(
        400,
        'OTP_EXPIRED_OR_INVALID',
        'This 6-digit OTP has expired (10-minute limit). Please request a new code.'
      );
    }

    const candidateHash = hashOtpCode(normalizedEmail, params.otp);
    if (candidateHash !== parsed.otpHash) {
      throw new ApiError(
        400,
        'OTP_EXPIRED_OR_INVALID',
        'Incorrect 6-digit OTP code. Please check your Email/WhatsApp and try again.'
      );
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'AUTH_OTP_CONSUMED',
        entityType: 'UserOtp',
        entityId: latestOtpLog.id,
        ipAddress: params.ipAddress,
        requestId: params.requestId,
      },
    });

    return user;
  }

  /**
   * Unauthenticated self-service password reset using a verified 6-digit OTP.
   * Updates `passwordHash` and revokes all existing sessions so stolen devices are signed out immediately.
   */
  static async resetPasswordWithOtp(
    dto: ResetPasswordWithOtpDto,
    meta: { ipAddress?: string; requestId?: string }
  ) {
    const user = await this.verifyAndConsumeOtp({
      email: dto.email,
      rolePanel: dto.rolePanel,
      otp: dto.otp,
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'AUTH_PASSWORD_RESET_VIA_OTP',
          entityType: 'User',
          entityId: user.id,
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });
    });

    return {
      email: user.email,
      rolePanel: dto.rolePanel,
      passwordReset: true,
      sessionsRevoked: true,
      resetAt: new Date().toISOString(),
    };
  }

  /**
   * Passwordless 6-digit OTP Sign-In for any role panel (`/student/login`, `/teacher/login`, etc.).
   */
  static async loginWithOtp(
    dto: LoginWithOtpDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string }
  ): Promise<AuthSessionResponseDto> {
    const user = await this.verifyAndConsumeOtp({
      email: dto.email,
      rolePanel: dto.rolePanel,
      otp: dto.otp,
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });

    if (user.status !== 'ACTIVE') {
      throw new ApiError(
        403,
        'ACCOUNT_SUSPENDED',
        `Account is currently ${user.status}. Please contact administrator.`
      );
    }

    return this.issueSessionForVerifiedUser(
      user,
      dto.rolePanel,
      'AUTH_LOGIN_VIA_OTP_SUCCESS',
      meta
    );
  }

  /**
   * Open Student Registration with atomic Wallet, StudentProfile, ReferralCode creation,
   * and optional Referral attribution (preventing self-referral and duplicate attribution per C-028).
   */
  static async registerStudent(
    dto: StudentSignupRequestDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string }
  ): Promise<AuthSessionResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const studentCode = `STU-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;
    const ownReferralCode = `ARGON-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const newUserId = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone || null,
          passwordHash,
          fullName: dto.fullName,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentProfile: {
            create: {
              studentCode,
            },
          },
          wallet: {
            create: {
              currency: 'INR',
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
          where: { code: dto.referralCode.trim().toUpperCase() },
        });
        if (refCodeRecord && refCodeRecord.isActive && refCodeRecord.userId !== createdUser.id) {
          await tx.referral.create({
            data: {
              referrerUserId: refCodeRecord.userId,
              referredUserId: createdUser.id,
              referralCodeId: refCodeRecord.id,
              status: 'ATTRIBUTED',
              rewardAmountSnapshot: 500.0,
              currency: 'INR',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: createdUser.id,
          action: 'STUDENT_SELF_SIGNUP',
          entityType: 'User',
          entityId: createdUser.id,
          afterDataJson: JSON.stringify({
            studentCode,
            ownReferralCode,
            appliedReferralCode: dto.referralCode || null,
          }),
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });

      return createdUser.id;
    });

    await OmnichannelMessagingService.dispatchToUsers({
      actorId: newUserId,
      eventType: 'ONBOARDING_WELCOME',
      courseCode: 'WELCOME',
      title: `Welcome to Saampark Institute, ${dto.fullName}!`,
      body: `Your Student Portal account (${studentCode}) and Wallet are active. Your personal referral code is ${ownReferralCode}. Browse My Courses to start your first course onboarding!`,
      recipientUserIds: [newUserId],
    });

    return this.loginForPanel(
      {
        email: dto.email,
        password: dto.password,
        rolePanel: 'STUDENT',
      },
      meta
    );
  }

  /**
   * Changes the authenticated user's password after verifying `currentPassword`.
   */
  static async changePassword(
    actor: AuthenticatedActor,
    payload: { currentPassword: string; newPassword: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!user) {
      throw ApiError.notFound('User account not found.');
    }

    const valid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!valid) {
      throw ApiError.badRequest('Current password is incorrect.', 'AUTH_INVALID_CREDENTIALS');
    }

    const newPasswordHash = await bcrypt.hash(payload.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { passwordHash: newPasswordHash },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'USER_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: actor.id,
        },
      });
    });

    return { updatedAt: new Date().toISOString() };
  }

  /**
   * Lists all active (non-revoked, non-expired) login sessions for `actor.id`.
   */
  static async listActiveSessions(
    actor: AuthenticatedActor
  ): Promise<ActiveDeviceSessionDto[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId: actor.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return sessions.map((s) => ({
      id: s.id,
      rolePanel: s.rolePanel,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrentSession: s.id === actor.sessionId,
    }));
  }

  /**
   * Revokes a specific login session belonging to `actor.id`.
   */
  static async revokeSessionById(actor: AuthenticatedActor, targetSessionId: string) {
    const existing = await prisma.session.findFirst({
      where: { id: targetSessionId, userId: actor.id },
    });
    if (!existing) {
      throw ApiError.notFound('Session not found for your account.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: targetSessionId },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'AUTH_SESSION_REVOKED',
          entityType: 'Session',
          entityId: targetSessionId,
        },
      });
    });

    return { revokedSessionId: targetSessionId };
  }

  /**
   * Revokes all other active device sessions for `actor.id` while keeping the current session active.
   */
  static async revokeOtherSessions(actor: AuthenticatedActor) {
    const res = await prisma.session.updateMany({
      where: {
        userId: actor.id,
        id: { not: actor.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'AUTH_OTHER_SESSIONS_REVOKED',
        entityType: 'User',
        entityId: actor.id,
        afterDataJson: JSON.stringify({ revokedCount: res.count }),
      },
    });

    return { revokedCount: res.count };
  }

  /**
   * Rotates refresh token and issues a fresh access token.
   */
  static async refreshSession(
    rawRefreshToken: string
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
      existingSession.user.status !== 'ACTIVE'
    ) {
      throw ApiError.unauthorized('Refresh session is invalid or expired', 'AUTH_TOKEN_EXPIRED');
    }

    const newRawRefreshToken = crypto.randomBytes(48).toString('hex');
    const newHash = hashRefreshToken(newRawRefreshToken);
    const permissions = await this.resolveUserPermissions(
      existingSession.user.id,
      existingSession.user.role
    );

    await prisma.session.update({
      where: { id: existingSession.id },
      data: {
        refreshTokenHash: newHash,
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
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
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return { accessToken, refreshToken: newRawRefreshToken };
  }

  static async logoutSession(sessionId: string, actorUserId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, userId: actorUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
