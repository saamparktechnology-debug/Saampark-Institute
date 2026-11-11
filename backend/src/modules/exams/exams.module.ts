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

// ----------------------------------------------------------------------------
// QUESTION BANK & ANSWER-REVEAL PROTECTION HELPERS (O-022, DATABASE_PLAN §2.6)
// ----------------------------------------------------------------------------

export interface ExamQuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ExamQuestionItem {
  id: string;
  questionType: 'MCQ_SINGLE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  prompt: string;
  marks: number;
  options: ExamQuestionOption[];
}

export interface ParsedExamPayload {
  summary: string;
  questions: ExamQuestionItem[];
}

export function encodeExamInstructions(summary: string, questions: ExamQuestionItem[]): string {
  return JSON.stringify({ summary, questions });
}

export function decodeExamInstructions(rawInstructions: string | null): ParsedExamPayload {
  if (!rawInstructions) {
    return { summary: 'Standard course examination.', questions: [] };
  }
  try {
    const parsed = JSON.parse(rawInstructions) as Partial<ParsedExamPayload>;
    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.questions)) {
      return {
        summary: parsed.summary,
        questions: parsed.questions,
      };
    }
  } catch {
    // Plain text fallback for legacy seeded instructions
  }
  return {
    summary: rawInstructions,
    questions: [
      {
        id: 'q-default-1',
        questionType: 'MCQ_SINGLE',
        prompt:
          'Which operator represents the total energy observable in the time-independent Schrödinger equation?',
        marks: 50,
        options: [
          { id: 'opt-1', text: 'Hamiltonian Operator (Ĥ)', isCorrect: true },
          { id: 'opt-2', text: 'Position Operator (x̂)', isCorrect: false },
          { id: 'opt-3', text: 'Momentum Operator (p̂)', isCorrect: false },
        ],
      },
      {
        id: 'q-default-2',
        questionType: 'TRUE_FALSE',
        prompt: 'Eigenvalues of a Hermitian operator are always real numbers.',
        marks: 50,
        options: [
          { id: 'opt-t', text: 'True', isCorrect: true },
          { id: 'opt-f', text: 'False', isCorrect: false },
        ],
      },
    ],
  };
}

/**
 * Strips `isCorrect` from all question options when serializing to a Student before `resultPublishAt` (O-022).
 */
export function sanitizeQuestionsForActor(
  questions: ExamQuestionItem[],
  actorRole: string,
  resultPublishAt: Date | null,
  now = new Date()
): ExamQuestionItem[] {
  const canRevealAnswers =
    actorRole === 'ADMIN' ||
    actorRole === 'TEACHER' ||
    (resultPublishAt !== null && now.getTime() >= resultPublishAt.getTime());

  return questions.map((q) => ({
    ...q,
    options: q.options.map((o) =>
      canRevealAnswers
        ? { id: o.id, text: o.text, isCorrect: Boolean(o.isCorrect) }
        : { id: o.id, text: o.text }
    ),
  }));
}

export function computeLetterGrade(scorePercent: number): string {
  if (scorePercent >= 90) return 'A+';
  if (scorePercent >= 80) return 'A';
  if (scorePercent >= 70) return 'B';
  if (scorePercent >= 60) return 'C';
  if (scorePercent >= 50) return 'D';
  return 'F';
}

// ----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

const questionSchema = z.object({
  id: z.string().min(1),
  questionType: z.enum(['MCQ_SINGLE', 'TRUE_FALSE', 'SHORT_ANSWER']).default('MCQ_SINGLE'),
  prompt: z.string().trim().min(3),
  marks: z.number().positive(),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().trim().min(1),
        isCorrect: z.boolean().default(false),
      })
    )
    .default([]),
});

export const createExamValidation = {
  body: z.object({
    courseId: z.string().uuid('Valid courseId UUID is required'),
    title: z.string().trim().min(3).max(200),
    summary: z.string().trim().min(5).max(1000),
    durationSeconds: z.number().int().min(300).max(18000).default(3600),
    totalMarks: z.number().positive().default(100),
    passMarks: z.number().nonnegative().default(50),
    attemptLimit: z.number().int().min(1).max(5).default(1),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
    resultPublishAt: z.string().min(10).optional().nullable(),
    questions: z.array(questionSchema).optional(),
  }),
};

export const submitExamAttemptValidation = {
  params: z.object({
    examId: z.string().uuid('Valid examId UUID is required'),
  }),
  body: z.object({
    answers: z.record(z.string(), z.string()).default({}),
  }),
};

export const evaluateExamAttemptValidation = {
  params: z.object({
    attemptId: z.string().uuid('Valid attemptId UUID is required'),
  }),
  body: z.object({
    score: z.number().min(0),
    publishResultsNow: z.boolean().default(true),
  }),
};

// ----------------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------------

export class ExamsService {
  /**
   * Lists exams strictly scoped by role (C-007, C-013, O-022):
   * - Enforces answer-reveal protection (`sanitizeQuestionsForActor`) so `isCorrect` and unpublished scores
   *   are never exposed to students before `exam.resultPublishAt`.
   */
  static async listExams(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
    const where: Prisma.ExamWhereInput = {};

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
      where.status = 'PUBLISHED';
      where.course = {
        enrollments: {
          some: {
            studentId: actor.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
        },
      };
    }

    const now = new Date();
    const exams = await prisma.exam.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true } },
        attempts: {
          where: actor.role === 'STUDENT' ? { studentId: actor.id } : undefined,
          include: {
            student: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    return exams.map((ex) => {
      const decoded = decodeExamInstructions(ex.instructions);
      const isResultPublished =
        !ex.resultPublishAt || now.getTime() >= ex.resultPublishAt.getTime();
      const safeQuestions = sanitizeQuestionsForActor(
        decoded.questions,
        actor.role,
        ex.resultPublishAt,
        now
      );

      return {
        id: ex.id,
        courseId: ex.courseId,
        courseCode: ex.course.code,
        courseTitle: ex.course.title,
        title: ex.title,
        summary: decoded.summary,
        durationSeconds: ex.durationSeconds,
        totalMarks: ex.totalMarks.toFixed(2),
        passMarks: ex.passMarks.toFixed(2),
        attemptLimit: ex.attemptLimit,
        startsAt: ex.startsAt.toISOString(),
        endsAt: ex.endsAt.toISOString(),
        resultPublishAt: ex.resultPublishAt ? ex.resultPublishAt.toISOString() : null,
        isResultPublished,
        status: ex.status,
        questions: safeQuestions,
        attempts: ex.attempts.map((att) => {
          const canSeeScore = actor.role !== 'STUDENT' || isResultPublished;
          return {
            id: att.id,
            examId: att.examId,
            studentId: att.studentId,
            studentName: att.student.fullName,
            studentEmail: att.student.email,
            attemptNumber: att.attemptNumber,
            status: att.status,
            score: canSeeScore && att.score !== null ? att.score.toFixed(2) : null,
            grade: canSeeScore ? att.grade : 'PENDING_PUBLISH',
            startedAt: att.startedAt.toISOString(),
            submittedAt: att.submittedAt ? att.submittedAt.toISOString() : null,
            evaluatedAt: att.evaluatedAt ? att.evaluatedAt.toISOString() : null,
          };
        }),
      };
    });
  }

  /**
   * Creates a new course exam with objective/subjective questions (Admin or assigned Teacher).
   */
  static async createExam(
    actor: AuthenticatedActor,
    payload: {
      courseId: string;
      title: string;
      summary: string;
      durationSeconds: number;
      totalMarks: number;
      passMarks: number;
      attemptLimit: number;
      startsAt: string;
      endsAt: string;
      resultPublishAt?: string | null;
      questions?: ExamQuestionItem[];
    }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can create exams.');
    }

    await assertCourseAccessScope(actor, payload.courseId);

    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw ApiError.unprocessable('Exam endsAt must be after startsAt.');
    }

    const defaultQuestions: ExamQuestionItem[] =
      payload.questions && payload.questions.length > 0
        ? payload.questions
        : decodeExamInstructions(null).questions;

    const encodedInstructions = encodeExamInstructions(payload.summary, defaultQuestions);

    return prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          courseId: payload.courseId,
          title: payload.title,
          instructions: encodedInstructions,
          durationSeconds: payload.durationSeconds,
          totalMarks: new Prisma.Decimal(payload.totalMarks.toFixed(2)),
          passMarks: new Prisma.Decimal(payload.passMarks.toFixed(2)),
          attemptLimit: payload.attemptLimit,
          startsAt,
          endsAt,
          resultPublishAt: payload.resultPublishAt ? new Date(payload.resultPublishAt) : endsAt,
          status: 'PUBLISHED' as CourseStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'EXAM_CREATED',
          entityType: 'Exam',
          entityId: created.id,
          afterDataJson: JSON.stringify({
            courseId: created.courseId,
            title: created.title,
            totalMarks: created.totalMarks.toFixed(2),
            questionCount: defaultQuestions.length,
          }),
        },
      });

      return created;
    });
  }

  /**
   * Student submits an exam attempt.
   * Auto-grades objective questions (`MCQ_SINGLE`, `TRUE_FALSE`) against the server-stored question bank,
   * computes letter grade, and enforces `resultPublishAt` visibility rules (O-022).
   */
  static async submitExamAttempt(
    actor: AuthenticatedActor,
    examId: string,
    payload: { answers: Record<string, string> }
  ) {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only enrolled students can submit exam attempts.');
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });
    if (!exam || exam.status !== 'PUBLISHED') {
      throw ApiError.notFound('Published exam not found.');
    }

    await assertCourseAccessScope(actor, exam.courseId);

    const existingAttemptsCount = await prisma.examAttempt.count({
      where: { examId: exam.id, studentId: actor.id },
    });
    if (existingAttemptsCount >= exam.attemptLimit) {
      throw ApiError.conflict(
        `You have already used all ${exam.attemptLimit} allowed attempt(s) for this examination.`
      );
    }

    const decoded = decodeExamInstructions(exam.instructions);
    let earnedMarks = 0;
    let totalQuestionMarks = 0;

    for (const q of decoded.questions) {
      totalQuestionMarks += q.marks;
      const selectedOptionId = payload.answers[q.id];
      const correctOption = q.options.find((o) => o.isCorrect);
      if (correctOption && selectedOptionId === correctOption.id) {
        earnedMarks += q.marks;
      }
    }

    const examTotal = Number(exam.totalMarks) || 100;
    const normalizedScore =
      totalQuestionMarks > 0
        ? Number(((earnedMarks / totalQuestionMarks) * examTotal).toFixed(2))
        : earnedMarks;
    const scorePercent = (normalizedScore / examTotal) * 100;
    const grade = computeLetterGrade(scorePercent);
    const now = new Date();

    const createdAttempt = await prisma.$transaction(async (tx) => {
      const att = await tx.examAttempt.create({
        data: {
          examId: exam.id,
          studentId: actor.id,
          attemptNumber: existingAttemptsCount + 1,
          status: 'EVALUATED',
          score: new Prisma.Decimal(normalizedScore.toFixed(2)),
          grade,
          startedAt: now,
          submittedAt: now,
          evaluatedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'EXAM_ATTEMPT_SUBMITTED_AND_AUTOGRADED',
          entityType: 'ExamAttempt',
          entityId: att.id,
          afterDataJson: JSON.stringify({
            examId: exam.id,
            attemptNumber: att.attemptNumber,
            status: att.status,
          }),
        },
      });

      return att;
    });

    const isResultPublished =
      !exam.resultPublishAt || now.getTime() >= exam.resultPublishAt.getTime();

    return {
      attemptId: createdAttempt.id,
      examId: exam.id,
      attemptNumber: createdAttempt.attemptNumber,
      status: createdAttempt.status,
      isResultPublished,
      score: isResultPublished ? createdAttempt.score?.toFixed(2) : null,
      grade: isResultPublished ? createdAttempt.grade : 'PENDING_PUBLISH',
      submittedAt: now.toISOString(),
    };
  }

  /**
   * Teacher or Admin manually evaluates/overrides an exam attempt score and optionally publishes results immediately.
   */
  static async evaluateAttempt(
    actor: AuthenticatedActor,
    attemptId: string,
    payload: { score: number; publishResultsNow: boolean }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can evaluate exam attempts.');
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) {
      throw ApiError.notFound('Exam attempt not found.');
    }

    await assertCourseAccessScope(actor, attempt.exam.courseId);

    const maxScore = Number(attempt.exam.totalMarks);
    if (payload.score < 0 || payload.score > maxScore) {
      throw ApiError.unprocessable(
        `Score (${payload.score}) cannot exceed exam totalMarks (${maxScore}).`
      );
    }

    const pct = maxScore > 0 ? (payload.score / maxScore) * 100 : 0;
    const grade = computeLetterGrade(pct);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      if (payload.publishResultsNow) {
        await tx.exam.update({
          where: { id: attempt.examId },
          data: { resultPublishAt: now },
        });
      }

      const updated = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          score: new Prisma.Decimal(payload.score.toFixed(2)),
          grade,
          status: 'EVALUATED',
          evaluatedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'EXAM_ATTEMPT_EVALUATED',
          entityType: 'ExamAttempt',
          entityId: attemptId,
          afterDataJson: JSON.stringify({
            score: updated.score?.toFixed(2),
            grade: updated.grade,
            publishResultsNow: payload.publishResultsNow,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * Role-scoped Academic Performance & Results Analytics (`GET /api/v1/exams/performance`, C-011, C-013).
   */
  static async getPerformanceAnalytics(actor: AuthenticatedActor) {
    const now = new Date();

    if (actor.role === 'STUDENT') {
      const [enrollments, submissions, attempts, attendanceRecords, certificates] =
        await Promise.all([
          prisma.enrollment.findMany({
            where: { studentId: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
            include: {
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
          }),
          prisma.assignmentSubmission.findMany({
            where: { studentId: actor.id, status: 'GRADED', marksAwarded: { not: null } },
            include: { assignment: { select: { courseId: true, title: true, maxMarks: true } } },
          }),
          prisma.examAttempt.findMany({
            where: { studentId: actor.id, status: 'EVALUATED', score: { not: null } },
            include: {
              exam: {
                select: {
                  courseId: true,
                  title: true,
                  totalMarks: true,
                  passMarks: true,
                  resultPublishAt: true,
                },
              },
            },
          }),
          prisma.attendanceRecord.findMany({
            where: { studentId: actor.id },
            include: { attendanceSession: { select: { courseId: true } } },
          }),
          prisma.certificate.findMany({
            where: { studentId: actor.id },
          }),
        ]);

      const courseProgressCards = enrollments.map((enr) => {
        const cId = enr.courseId;
        const cAtt = attendanceRecords.filter((r) => r.attendanceSession.courseId === cId);
        const present = cAtt.filter(
          (r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED'
        ).length;
        const attendancePercent =
          cAtt.length > 0 ? Number(((present / cAtt.length) * 100).toFixed(1)) : 0;

        const cSubs = submissions.filter((s) => s.assignment.courseId === cId);
        const assignmentAvgPercent =
          cSubs.length > 0
            ? Number(
                (
                  cSubs.reduce(
                    (acc, s) =>
                      acc + (Number(s.marksAwarded || 0) / Number(s.assignment.maxMarks || 100)) * 100,
                    0
                  ) / cSubs.length
                ).toFixed(1)
              )
            : 0;

        const publishedAttempts = attempts.filter(
          (a) =>
            a.exam.courseId === cId &&
            (!a.exam.resultPublishAt || now.getTime() >= a.exam.resultPublishAt.getTime())
        );
        const bestExamPercent =
          publishedAttempts.length > 0
            ? Number(
                Math.max(
                  ...publishedAttempts.map(
                    (a) => (Number(a.score || 0) / Number(a.exam.totalMarks || 100)) * 100
                  )
                ).toFixed(1)
              )
            : 0;

        const minAtt = Number(enr.course.minAttendancePercent);
        const minPass = Number(enr.course.minPassMarksPercent);
        const existingCert = certificates.find(
          (c) => c.courseId === cId && c.status === 'ISSUED'
        );

        return {
          enrollmentId: enr.id,
          courseId: cId,
          courseCode: enr.course.code,
          courseTitle: enr.course.title,
          attendancePercent,
          minAttendancePercent: minAtt,
          assignmentAvgPercent,
          bestExamPercent,
          minPassMarksPercent: minPass,
          eligibleForCertificate: attendancePercent >= minAtt && bestExamPercent >= minPass,
          certificateNumber: existingCert?.certificateNumber || null,
        };
      });

      return {
        role: 'STUDENT' as const,
        courseProgressCards,
        teacherMetrics: null,
        cohortStudentMatrix: [],
      };
    }

    // TEACHER or ADMIN Performance & Cohort Analytics
    const assignedCourses = await prisma.courseTeacherAssignment.findMany({
      where:
        actor.role === 'TEACHER'
          ? { teacherId: actor.id, status: 'ACTIVE' }
          : { status: 'ACTIVE' },
      include: { course: { select: { id: true, code: true, title: true } } },
    });
    const courseIds = Array.from(new Set(assignedCourses.map((a) => a.courseId)));

    const [enrollments, gradedSubs, evaluatedAttempts, liveClassesHosted] = await Promise.all([
      prisma.enrollment.findMany({
        where: {
          courseId: { in: courseIds },
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          course: { select: { id: true, code: true, title: true } },
        },
      }),
      prisma.assignmentSubmission.findMany({
        where: {
          assignment: { courseId: { in: courseIds } },
          status: 'GRADED',
        },
        include: { assignment: { select: { courseId: true, maxMarks: true } } },
      }),
      prisma.examAttempt.findMany({
        where: {
          exam: { courseId: { in: courseIds } },
          status: 'EVALUATED',
        },
        include: { exam: { select: { courseId: true, totalMarks: true } } },
      }),
      prisma.liveClass.count({
        where: actor.role === 'TEACHER' ? { teacherId: actor.id } : {},
      }),
    ]);

    const cohortStudentMatrix = enrollments.map((enr) => {
      const stuSubs = gradedSubs.filter(
        (s) => s.studentId === enr.studentId && s.assignment.courseId === enr.courseId
      );
      const stuAttempts = evaluatedAttempts.filter(
        (a) => a.studentId === enr.studentId && a.exam.courseId === enr.courseId
      );

      const assignmentAvg =
        stuSubs.length > 0
          ? Number(
              (
                stuSubs.reduce(
                  (acc, s) =>
                    acc + (Number(s.marksAwarded || 0) / Number(s.assignment.maxMarks || 100)) * 100,
                  0
                ) / stuSubs.length
              ).toFixed(1)
            )
          : 0;

      const examAvg =
        stuAttempts.length > 0
          ? Number(
              (
                stuAttempts.reduce(
                  (acc, a) =>
                    acc + (Number(a.score || 0) / Number(a.exam.totalMarks || 100)) * 100,
                  0
                ) / stuAttempts.length
              ).toFixed(1)
            )
          : 0;

      const combinedScore =
        stuSubs.length > 0 && stuAttempts.length > 0
          ? Number(((assignmentAvg + examAvg) / 2).toFixed(1))
          : Math.max(assignmentAvg, examAvg);

      return {
        enrollmentId: enr.id,
        studentId: enr.studentId,
        studentName: enr.student.fullName,
        studentEmail: enr.student.email,
        courseCode: enr.course.code,
        courseTitle: enr.course.title,
        assignmentAvgPercent: assignmentAvg,
        examAvgPercent: examAvg,
        combinedScorePercent: combinedScore,
        grade: computeLetterGrade(combinedScore),
      };
    });

    const overallCohortAvg =
      cohortStudentMatrix.length > 0
        ? Number(
            (
              cohortStudentMatrix.reduce((acc, s) => acc + s.combinedScorePercent, 0) /
              cohortStudentMatrix.length
            ).toFixed(1)
          )
        : 0;

    return {
      role: actor.role,
      courseProgressCards: [],
      teacherMetrics: {
        assignedCoursesCount: courseIds.length,
        activeStudentsCount: enrollments.length,
        gradedSubmissionsCount: gradedSubs.length,
        evaluatedExamsCount: evaluatedAttempts.length,
        liveClassesHostedCount: liveClassesHosted,
        overallCohortAveragePercent: overallCohortAvg,
      },
      cohortStudentMatrix,
    };
  }
}

// ----------------------------------------------------------------------------
// CONTROLLER & ROUTER
// ----------------------------------------------------------------------------

export class ExamsController {
  static list = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await ExamsService.listExams(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Examinations retrieved successfully', list);
  });

  static create = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await ExamsService.createExam(req.user, req.body);
    return apiResponse(res, 201, 'Examination and question bank created', created);
  });

  static submitAttempt = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await ExamsService.submitExamAttempt(
      req.user,
      String(req.params.examId),
      req.body
    );
    return apiResponse(res, 201, 'Examination attempt submitted and evaluated', result);
  });

  static evaluateAttempt = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await ExamsService.evaluateAttempt(
      req.user,
      String(req.params.attemptId),
      req.body
    );
    return apiResponse(res, 200, 'Exam attempt evaluated and results updated', updated);
  });

  static performance = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await ExamsService.getPerformanceAnalytics(req.user);
    return apiResponse(res, 200, 'Performance analytics retrieved', data);
  });
}

export const examsRouter = Router();
examsRouter.use(authenticate);

examsRouter.get('/', ExamsController.list);
examsRouter.get('/performance', ExamsController.performance);
examsRouter.post(
  '/',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createExamValidation),
  ExamsController.create
);
examsRouter.post(
  '/:examId/submit-attempt',
  authorizeRoles('STUDENT'),
  validateRequest(submitExamAttemptValidation),
  ExamsController.submitAttempt
);
examsRouter.patch(
  '/attempts/:attemptId/evaluate',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(evaluateExamAttemptValidation),
  ExamsController.evaluateAttempt
);
