import crypto from 'crypto';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
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

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const issueCertificateValidation = {
  body: z.object({
    enrollmentId: z.string().uuid('Valid enrollmentId UUID is required'),
  }),
};

export const revokeCertificateValidation = {
  params: z.object({
    certificateId: z.string().uuid('Valid certificateId UUID is required'),
  }),
  body: z.object({
    revocationReason: z
      .string()
      .trim()
      .min(5, 'Mandatory revocation reason is required for audit trail')
      .max(255),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE (C-007, O-023)
// ----------------------------------------------------------------------------

export class CertificatesService {
  /**
   * Lists issued/revoked course certificates strictly scoped by role (C-013, O-023):
   * - STUDENT: Strictly own certificates (`studentId = actor.id`).
   * - TEACHER: Certificates for courses actively assigned to `actor.id`.
   * - ADMIN: All platform certificates.
   */
  static async listCertificates(actor: AuthenticatedActor) {
    const where: Prisma.CertificateWhereInput = {};

    if (actor.role === 'STUDENT') {
      where.studentId = actor.id;
    } else if (actor.role === 'TEACHER') {
      where.course = {
        teacherAssignments: {
          some: {
            teacherId: actor.id,
            status: 'ACTIVE',
          },
        },
      };
    }

    const rows = await prisma.certificate.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            minAttendancePercent: true,
            minPassMarksPercent: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return rows.map((c) => ({
      id: c.id,
      enrollmentId: c.enrollmentId,
      studentId: c.studentId,
      studentName: c.student.fullName,
      studentEmail: c.student.email,
      studentCode: c.student.studentProfile?.studentCode || null,
      courseId: c.courseId,
      courseCode: c.course.code,
      courseTitle: c.course.title,
      certificateNumber: c.certificateNumber,
      status: c.status,
      fileReference: c.fileReference,
      publicVerificationPath: `/verify-certificate?code=${encodeURIComponent(c.certificateNumber)}`,
      issuedAt: c.issuedAt.toISOString(),
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
      revocationReason: c.revocationReason,
    }));
  }

  /**
   * Verifies eligibility (`O-023`: attendance >= minAttendancePercent and exam score >= minPassMarksPercent)
   * and issues a unique verifiable certificate for an enrollment.
   * Admins may issue directly with audit logging.
   */
  static async issueCertificate(
    actor: AuthenticatedActor,
    payload: { enrollmentId: string }
  ) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: payload.enrollmentId },
      include: {
        course: true,
        certificate: true,
      },
    });

    if (!enrollment) {
      throw ApiError.notFound('Enrollment not found.');
    }

    if (actor.role === 'STUDENT' && enrollment.studentId !== actor.id) {
      throw ApiError.forbidden('Students may only claim certificates for their own enrollments.');
    }
    if (actor.role === 'TEACHER') {
      await assertCourseAccessScope(actor, enrollment.courseId);
    }

    if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'COMPLETED') {
      throw ApiError.unprocessable(
        `Cannot issue certificate for enrollment in ${enrollment.status} status.`
      );
    }

    if (enrollment.certificate && enrollment.certificate.status === 'ISSUED') {
      return enrollment.certificate;
    }

    // Evaluate attendance % and best exam score % against course thresholds (O-023)
    const [attendanceRecords, examAttempts] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          studentId: enrollment.studentId,
          attendanceSession: { courseId: enrollment.courseId },
        },
      }),
      prisma.examAttempt.findMany({
        where: {
          studentId: enrollment.studentId,
          exam: { courseId: enrollment.courseId },
          status: 'EVALUATED',
          score: { not: null },
        },
        include: { exam: { select: { totalMarks: true } } },
      }),
    ]);

    const presentCount = attendanceRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED'
    ).length;
    const attendancePercent =
      attendanceRecords.length > 0 ? (presentCount / attendanceRecords.length) * 100 : 0;

    const bestExamPercent =
      examAttempts.length > 0
        ? Math.max(
            ...examAttempts.map(
              (a) => (Number(a.score || 0) / Number(a.exam.totalMarks || 100)) * 100
            )
          )
        : 0;

    const minAttendance = Number(enrollment.course.minAttendancePercent);
    const minPassMarks = Number(enrollment.course.minPassMarksPercent);

    if (actor.role !== 'ADMIN') {
      if (attendancePercent < minAttendance) {
        throw ApiError.unprocessable(
          `Certificate requires at least ${minAttendance}% attendance (Current: ${attendancePercent.toFixed(
            1
          )}%).`
        );
      }
      if (bestExamPercent < minPassMarks) {
        throw ApiError.unprocessable(
          `Certificate requires at least ${minPassMarks}% exam score (Current best: ${bestExamPercent.toFixed(
            1
          )}%).`
        );
      }
    }

    const certSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const certificateNumber = `CERT-ARGON-${new Date().getFullYear()}-${enrollment.course.code}-${certSuffix}`;
    const fileReference = `/verify-certificate?code=${encodeURIComponent(certificateNumber)}`;

    return prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'COMPLETED',
          progressPercent: new Prisma.Decimal('100.00'),
          completedAt: new Date(),
        },
      });

      const cert = await tx.certificate.upsert({
        where: { enrollmentId: enrollment.id },
        update: {
          certificateNumber,
          status: 'ISSUED',
          fileReference,
          issuedAt: new Date(),
          revokedAt: null,
          revocationReason: null,
        },
        create: {
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          enrollmentId: enrollment.id,
          certificateNumber,
          status: 'ISSUED',
          fileReference,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'CERTIFICATE_ISSUED',
          entityType: 'Certificate',
          entityId: cert.id,
          afterDataJson: JSON.stringify({
            certificateNumber: cert.certificateNumber,
            studentId: cert.studentId,
            courseId: cert.courseId,
            attendancePercent: Number(attendancePercent.toFixed(1)),
            bestExamPercent: Number(bestExamPercent.toFixed(1)),
          }),
        },
      });

      return cert;
    });
  }

  /**
   * Admin revokes a certificate with mandatory `revocationReason` and audit logging.
   */
  static async revokeCertificate(
    actor: AuthenticatedActor,
    certificateId: string,
    revocationReason: string
  ) {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Administrators can revoke issued certificates.');
    }

    const existing = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });
    if (!existing) {
      throw ApiError.notFound('Certificate not found.');
    }

    return prisma.$transaction(async (tx) => {
      const revoked = await tx.certificate.update({
        where: { id: certificateId },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revocationReason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'CERTIFICATE_REVOKED',
          entityType: 'Certificate',
          entityId: certificateId,
          reason: revocationReason,
          afterDataJson: JSON.stringify({
            certificateNumber: revoked.certificateNumber,
            status: revoked.status,
          }),
        },
      });

      return revoked;
    });
  }

  /**
   * Publicly verifies a certificate by its unique `certificateNumber` (`O-023`).
   * Accessible without authentication for public verification URLs and QR codes.
   */
  static async verifyByCertificateNumber(certificateNumber: string) {
    const normalized = decodeURIComponent(certificateNumber).trim().toUpperCase();
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: normalized },
      include: {
        student: {
          select: {
            fullName: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
        course: {
          select: {
            code: true,
            title: true,
            level: true,
            minAttendancePercent: true,
            minPassMarksPercent: true,
          },
        },
      },
    });

    if (!cert) {
      throw ApiError.notFound('No matching certificate found for the provided certificate number.');
    }

    return {
      valid: cert.status === 'ISSUED',
      certificateNumber: cert.certificateNumber,
      status: cert.status,
      studentName: cert.student.fullName,
      studentCode: cert.student.studentProfile?.studentCode || null,
      courseCode: cert.course.code,
      courseTitle: cert.course.title,
      courseLevel: cert.course.level,
      minAttendancePercent: cert.course.minAttendancePercent.toFixed(0),
      minPassMarksPercent: cert.course.minPassMarksPercent.toFixed(0),
      publicVerificationPath: `/verify-certificate?code=${encodeURIComponent(cert.certificateNumber)}`,
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
      revocationReason: cert.revocationReason,
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class CertificatesController {
  static list = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await CertificatesService.listCertificates(req.user);
    return apiResponse(res, 200, 'Certificates retrieved successfully', list);
  });

  static issue = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const cert = await CertificatesService.issueCertificate(req.user, req.body);
    return apiResponse(res, 201, 'Course completion certificate verified and issued', cert);
  });

  static revoke = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const revoked = await CertificatesService.revokeCertificate(
      req.user,
      String(req.params.certificateId),
      req.body.revocationReason
    );
    return apiResponse(res, 200, 'Certificate revoked and audited', revoked);
  });

  static verify = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificatesService.verifyByCertificateNumber(
      String(req.params.certificateNumber)
    );
    return apiResponse(res, 200, 'Certificate verification lookup completed', result);
  });
}

export const certificatesRouter = Router();

// Public verification endpoint for QR/URL certificate verification (O-023)
certificatesRouter.get('/verify/:certificateNumber', CertificatesController.verify);

certificatesRouter.use(authenticate);
certificatesRouter.get('/', CertificatesController.list);
certificatesRouter.post(
  '/issue',
  authorizeRoles('ADMIN', 'TEACHER', 'STUDENT'),
  validateRequest(issueCertificateValidation),
  CertificatesController.issue
);
certificatesRouter.patch(
  '/:certificateId/revoke',
  authorizeRoles('ADMIN'),
  validateRequest(revokeCertificateValidation),
  CertificatesController.revoke
);
