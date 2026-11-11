import { z } from "zod";
import { Request, Response, Router } from "express";
import { CourseStatus, Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AuthenticatedActor } from "../../types/express";
import { ApiError } from "../../utils/ApiError";
import { apiResponse } from "../../utils/apiResponse";
import { catchAsync } from "../../utils/catchAsync";
import {
  assertCourseAccessScope,
  authenticate,
  authorizeRoles,
} from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createAssignmentValidation = {
  body: z.object({
    courseId: z.string().uuid("Valid courseId UUID is required"),
    title: z.string().trim().min(3, "Assignment title is required").max(200),
    instructions: z
      .string()
      .trim()
      .min(10, "Detailed instructions are required"),
    maxMarks: z
      .number()
      .positive("maxMarks must be positive")
      .max(1000)
      .default(100),
    dueAt: z.string().min(10, "Valid dueAt timestamp is required"),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
  }),
};

export const submitAssignmentValidation = {
  params: z.object({
    assignmentId: z.string().uuid("Valid assignmentId UUID is required"),
  }),
  body: z.object({
    submissionText: z
      .string()
      .trim()
      .min(5, "Provide your solution text or repository/document notes")
      .max(10000),
    fileName: z.string().trim().max(255).optional(),
  }),
};

export const gradeSubmissionValidation = {
  params: z.object({
    submissionId: z.string().uuid("Valid submissionId UUID is required"),
  }),
  body: z.object({
    marksAwarded: z.number().min(0, "Marks cannot be negative"),
    feedback: z
      .string()
      .trim()
      .min(3, "Provide constructive grading feedback")
      .max(2000),
    status: z.enum(["GRADED", "RESUBMIT_REQUESTED"]).default("GRADED"),
  }),
};

export const assignmentIdParamValidation = {
  params: z.object({
    assignmentId: z.string().uuid("Valid assignmentId UUID is required"),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class AssignmentsService {
  /**
   * Lists assignments strictly scoped by role (C-007, C-013, C-026, C-027):
   * - ADMIN: All platform assignments.
   * - TEACHER: Assignments for courses actively assigned to `actor.id`, including submission queue counts.
   * - STUDENT: PUBLISHED assignments for courses where `actor.id` holds an ACTIVE or COMPLETED enrollment,
   *   including only the student's own `mySubmission` record.
   */
  static async listAssignments(
    actor: AuthenticatedActor,
    rawQuery: Record<string, unknown>,
  ) {
    const where: Prisma.AssignmentWhereInput = {};

    if (typeof rawQuery.courseId === "string" && rawQuery.courseId.trim()) {
      await assertCourseAccessScope(actor, rawQuery.courseId.trim());
      where.courseId = rawQuery.courseId.trim();
    }

    if (actor.role === "TEACHER") {
      where.course = {
        teacherAssignments: {
          some: {
            teacherId: actor.id,
            status: "ACTIVE",
          },
        },
      };
    } else if (actor.role === "STUDENT") {
      where.status = "PUBLISHED";
      where.course = {
        enrollments: {
          some: {
            studentId: actor.id,
            status: { in: ["ACTIVE", "COMPLETED"] },
          },
        },
      };
    }

    const rows = await prisma.assignment.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true } },
        submissions: {
          where: actor.role === "STUDENT" ? { studentId: actor.id } : undefined,
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            gradedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    return rows.map((a) => {
      if (actor.role === "STUDENT") {
        const own = a.submissions[0] || null;
        return {
          id: a.id,
          courseId: a.courseId,
          courseCode: a.course.code,
          courseTitle: a.course.title,
          title: a.title,
          instructions: a.instructions,
          maxMarks: a.maxMarks.toFixed(2),
          dueAt: a.dueAt.toISOString(),
          status: a.status,
          createdAt: a.createdAt.toISOString(),
          pendingCount: 0,
          gradedCount: own?.status === "GRADED" ? 1 : 0,
          mySubmission: own
            ? {
                id: own.id,
                submissionText: own.submissionText,
                fileStorageKey: own.fileStorageKey,
                attemptNumber: own.attemptNumber,
                status: own.status,
                marksAwarded: own.marksAwarded
                  ? own.marksAwarded.toFixed(2)
                  : null,
                feedback: own.feedback,
                gradedByName: own.gradedBy?.fullName || null,
                submittedAt: own.submittedAt.toISOString(),
                gradedAt: own.gradedAt ? own.gradedAt.toISOString() : null,
              }
            : null,
          submissions: [],
        };
      }

      const pendingCount = a.submissions.filter(
        (s) => s.status === "SUBMITTED" || s.status === "LATE",
      ).length;
      const gradedCount = a.submissions.filter(
        (s) => s.status === "GRADED",
      ).length;

      return {
        id: a.id,
        courseId: a.courseId,
        courseCode: a.course.code,
        courseTitle: a.course.title,
        title: a.title,
        instructions: a.instructions,
        maxMarks: a.maxMarks.toFixed(2),
        dueAt: a.dueAt.toISOString(),
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        pendingCount,
        gradedCount,
        mySubmission: null,
        submissions: a.submissions.map((s) => ({
          id: s.id,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          studentName: s.student.fullName,
          studentEmail: s.student.email,
          submissionText: s.submissionText,
          fileStorageKey: s.fileStorageKey,
          attemptNumber: s.attemptNumber,
          status: s.status,
          marksAwarded: s.marksAwarded ? s.marksAwarded.toFixed(2) : null,
          feedback: s.feedback,
          gradedByName: s.gradedBy?.fullName || null,
          submittedAt: s.submittedAt.toISOString(),
          gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
        })),
      };
    });
  }

  /**
   * Creates a new course assignment (Admin or assigned Teacher).
   */
  static async createAssignment(
    actor: AuthenticatedActor,
    payload: {
      courseId: string;
      title: string;
      instructions: string;
      maxMarks: number;
      dueAt: string;
      status: CourseStatus;
    },
  ) {
    if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
      throw ApiError.forbidden(
        "Only Administrators or assigned Teachers can create assignments.",
      );
    }

    await assertCourseAccessScope(actor, payload.courseId);

    const dueDate = new Date(payload.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      throw ApiError.badRequest("Invalid dueAt date format.");
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          courseId: payload.courseId,
          title: payload.title,
          instructions: payload.instructions,
          maxMarks: new Prisma.Decimal(payload.maxMarks.toFixed(2)),
          dueAt: dueDate,
          status: payload.status,
          createdById: actor.id,
        },
        include: {
          course: { select: { code: true, title: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ASSIGNMENT_CREATED",
          entityType: "Assignment",
          entityId: created.id,
          afterDataJson: JSON.stringify({
            courseId: created.courseId,
            title: created.title,
            maxMarks: created.maxMarks.toFixed(2),
            dueAt: created.dueAt.toISOString(),
          }),
        },
      });

      return created;
    });
  }

  /**
   * Student submits work for an assignment in an active enrolled course (C-007, C-027).
   * Automatically tags status as `LATE` if submitted after `assignment.dueAt`.
   */
  static async submitAssignment(
    actor: AuthenticatedActor,
    assignmentId: string,
    payload: { submissionText: string; fileName?: string },
  ) {
    if (actor.role !== "STUDENT") {
      throw ApiError.forbidden(
        "Only enrolled students can submit assignments.",
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      throw ApiError.notFound("Published assignment not found.");
    }

    await assertCourseAccessScope(actor, assignment.courseId);

    const now = new Date();
    const isLate = now.getTime() > assignment.dueAt.getTime();
    const status: SubmissionStatus = isLate ? "LATE" : "SUBMITTED";
    const sanitizedFile = payload.fileName
      ? payload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
      : null;
    const fileStorageKey = sanitizedFile
      ? `courses/${assignment.courseId}/assignments/${assignment.id}/${actor.id}-${sanitizedFile}`
      : null;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.assignmentSubmission.findFirst({
        where: { assignmentId: assignment.id, studentId: actor.id },
        orderBy: { attemptNumber: "desc" },
      });

      const submission = existing
        ? await tx.assignmentSubmission.update({
            where: { id: existing.id },
            data: {
              submissionText: payload.submissionText,
              fileStorageKey: fileStorageKey || existing.fileStorageKey,
              attemptNumber: existing.attemptNumber + 1,
              status,
              submittedAt: now,
            },
          })
        : await tx.assignmentSubmission.create({
            data: {
              assignmentId: assignment.id,
              studentId: actor.id,
              submissionText: payload.submissionText,
              fileStorageKey,
              attemptNumber: 1,
              status,
              submittedAt: now,
            },
          });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ASSIGNMENT_SUBMITTED",
          entityType: "AssignmentSubmission",
          entityId: submission.id,
          afterDataJson: JSON.stringify({
            assignmentId: assignment.id,
            attemptNumber: submission.attemptNumber,
            status: submission.status,
          }),
        },
      });

      return submission;
    });
  }

  /**
   * Teacher or Admin evaluates a student assignment submission, awards marks, and logs grade audit.
   */
  static async gradeSubmission(
    actor: AuthenticatedActor,
    submissionId: string,
    payload: {
      marksAwarded: number;
      feedback: string;
      status: "GRADED" | "RESUBMIT_REQUESTED";
    },
  ) {
    if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
      throw ApiError.forbidden(
        "Only Administrators or assigned Teachers can grade submissions.",
      );
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });

    if (!submission) {
      throw ApiError.notFound("Assignment submission not found.");
    }

    await assertCourseAccessScope(actor, submission.assignment.courseId);

    const maxMarksNum = Number(submission.assignment.maxMarks);
    if (payload.marksAwarded < 0 || payload.marksAwarded > maxMarksNum) {
      throw ApiError.unprocessable(
        `Awarded marks (${payload.marksAwarded}) cannot exceed assignment maxMarks (${maxMarksNum}).`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          marksAwarded: new Prisma.Decimal(payload.marksAwarded.toFixed(2)),
          feedback: payload.feedback,
          status: payload.status,
          gradedById: actor.id,
          gradedAt: new Date(),
        },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          assignment: { select: { id: true, title: true, maxMarks: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ASSIGNMENT_SUBMISSION_GRADED",
          entityType: "AssignmentSubmission",
          entityId: submissionId,
          beforeDataJson: submission.marksAwarded
            ? JSON.stringify({
                marksAwarded: submission.marksAwarded.toFixed(2),
              })
            : null,
          afterDataJson: JSON.stringify({
            marksAwarded: updated.marksAwarded?.toFixed(2),
            status: updated.status,
          }),
        },
      });

      return updated;
    });
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class AssignmentsController {
  static list = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await AssignmentsService.listAssignments(
      req.user,
      req.query as Record<string, unknown>,
    );
    return apiResponse(res, 200, "Assignments retrieved successfully", list);
  });

  static create = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await AssignmentsService.createAssignment(
      req.user,
      req.body,
    );
    return apiResponse(res, 201, "Assignment created successfully", created);
  });

  static submit = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await AssignmentsService.submitAssignment(
      req.user,
      String(req.params.assignmentId),
      req.body,
    );
    return apiResponse(res, 201, "Assignment submission recorded", result);
  });

  static grade = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await AssignmentsService.gradeSubmission(
      req.user,
      String(req.params.submissionId),
      req.body,
    );
    return apiResponse(
      res,
      200,
      "Assignment submission graded and audited",
      updated,
    );
  });
}

export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate);

assignmentsRouter.get("/", AssignmentsController.list);
assignmentsRouter.post(
  "/",
  authorizeRoles("ADMIN", "TEACHER"),
  validateRequest(createAssignmentValidation),
  AssignmentsController.create,
);
assignmentsRouter.post(
  "/:assignmentId/submit",
  authorizeRoles("STUDENT"),
  validateRequest(submitAssignmentValidation),
  AssignmentsController.submit,
);
assignmentsRouter.patch(
  "/submissions/:submissionId/grade",
  authorizeRoles("ADMIN", "TEACHER"),
  validateRequest(gradeSubmissionValidation),
  AssignmentsController.grade,
);
