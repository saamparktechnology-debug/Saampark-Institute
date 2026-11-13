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
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';

// ----------------------------------------------------------------------------
// QUESTION BANK, PROCTORING & ANSWER-REVEAL PROTECTION HELPERS (O-022)
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
  maxTabSwitches?: number;
}

export interface ExamProctoringViolationEvent {
  type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY_PASTE_BLOCKED';
  occurredAt: string;
  detail?: string;
}

export interface ExamAttemptProctoringMeta {
  answers: Record<string, string>;
  remainingSeconds?: number | null;
  tabSwitchCount: number;
  fullscreenExits: number;
  copyPasteBlockedCount: number;
  autoSubmittedByProctor: boolean;
  integrityStatus: 'CLEAN' | 'WARNING' | 'FLAGGED_VIOLATION';
  violations: ExamProctoringViolationEvent[];
  updatedAt: string;
}

export const MAX_ALLOWED_EXAM_TAB_SWITCHES = 3;

export function computeExamIntegrityStatus(params: {
  tabSwitchCount: number;
  fullscreenExits: number;
  autoSubmittedByProctor: boolean;
  maxTabSwitches?: number;
}): 'CLEAN' | 'WARNING' | 'FLAGGED_VIOLATION' {
  const limit = params.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES;
  if (
    params.autoSubmittedByProctor ||
    params.tabSwitchCount >= limit ||
    params.fullscreenExits >= limit
  ) {
    return 'FLAGGED_VIOLATION';
  }
  if (params.tabSwitchCount > 0 || params.fullscreenExits > 0) {
    return 'WARNING';
  }
  return 'CLEAN';
}

export function encodeExamInstructions(
  summary: string,
  questions: ExamQuestionItem[],
  maxTabSwitches = MAX_ALLOWED_EXAM_TAB_SWITCHES
): string {
  return JSON.stringify({ summary, questions, maxTabSwitches });
}

export const STANDARD_DEFAULT_EXAM_QUESTIONS: ExamQuestionItem[] = [
  {
    id: 'q1',
    questionType: 'MCQ_SINGLE',
    prompt:
      'Which operator represents the total energy observable in the time-independent Schrödinger equation?',
    marks: 20,
    options: [
      { id: 'q1-a', text: 'Hamiltonian Operator (Ĥ = T̂ + V̂)', isCorrect: true },
      { id: 'q1-b', text: 'Position Operator (x̂)', isCorrect: false },
      { id: 'q1-c', text: 'Linear Momentum Operator (p̂ = -iħ∇)', isCorrect: false },
      { id: 'q1-d', text: 'Parity Inversion Operator (P̂)', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    questionType: 'TRUE_FALSE',
    prompt: 'All eigenvalues of a Hermitian (self-adjoint) quantum observable operator are strictly real numbers.',
    marks: 20,
    options: [
      { id: 'q2-t', text: 'True — Hermitian operators always yield real observable eigenvalues', isCorrect: true },
      { id: 'q2-f', text: 'False — Eigenvalues can be complex for bound states', isCorrect: false },
    ],
  },
  {
    id: 'q3',
    questionType: 'MCQ_SINGLE',
    prompt:
      'What is the canonical fundamental commutation relation [x̂, p̂_x] between the position and momentum operators?',
    marks: 20,
    options: [
      { id: 'q3-a', text: '[x̂, p̂_x] = 0 (Operators commute)', isCorrect: false },
      { id: 'q3-b', text: '[x̂, p̂_x] = iħ', isCorrect: true },
      { id: 'q3-c', text: '[x̂, p̂_x] = -ħ² ∂²/∂x²', isCorrect: false },
      { id: 'q3-d', text: '[x̂, p̂_x] = iħ / 2π', isCorrect: false },
    ],
  },
  {
    id: 'q4',
    questionType: 'MCQ_SINGLE',
    prompt:
      'For a quantum particle confined in a 1D infinite square potential well of width L, how do the quantized energy levels E_n scale with the principal quantum number n?',
    marks: 20,
    options: [
      { id: 'q4-a', text: 'Linearly proportional to n (E_n ∝ n)', isCorrect: false },
      { id: 'q4-b', text: 'Proportional to n² (E_n = n²π²ħ² / 2mL²)', isCorrect: true },
      { id: 'q4-c', text: 'Inversely proportional to n² (E_n ∝ -1/n²)', isCorrect: false },
      { id: 'q4-d', text: 'Independent of the quantum number n', isCorrect: false },
    ],
  },
  {
    id: 'q5',
    questionType: 'MCQ_SINGLE',
    prompt:
      'According to Max Born’s statistical interpretation of the wave function Ψ(x, t), what physical quantity does |Ψ(x, t)|² dx represent?',
    marks: 20,
    options: [
      { id: 'q5-a', text: 'The instantaneous kinetic energy density at position x', isCorrect: false },
      { id: 'q5-b', text: 'The group velocity of the de Broglie wave packet', isCorrect: false },
      {
        id: 'q5-c',
        text: 'The probability of finding the particle in the infinitesimal interval [x, x + dx] at time t',
        isCorrect: true,
      },
      { id: 'q5-d', text: 'The expectation value of the Hamiltonian operator', isCorrect: false },
    ],
  },
];

export function decodeExamInstructions(rawInstructions: string | null): ParsedExamPayload {
  if (!rawInstructions) {
    return {
      summary: 'Standard proctored computer-based course examination.',
      questions: STANDARD_DEFAULT_EXAM_QUESTIONS,
      maxTabSwitches: MAX_ALLOWED_EXAM_TAB_SWITCHES,
    };
  }
  try {
    const parsed = JSON.parse(rawInstructions) as Partial<ParsedExamPayload>;
    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.questions)) {
      const isLegacyTwoQuestionSeed =
        parsed.questions.length === 2 &&
        parsed.questions[0]?.id === 'q1' &&
        parsed.questions[1]?.id === 'q2';
      return {
        summary: parsed.summary,
        questions: isLegacyTwoQuestionSeed
          ? STANDARD_DEFAULT_EXAM_QUESTIONS
          : parsed.questions.length > 0
          ? parsed.questions
          : STANDARD_DEFAULT_EXAM_QUESTIONS,
        maxTabSwitches: parsed.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES,
      };
    }
  } catch {
    // Plain text instructions from initial seed
  }
  return {
    summary: rawInstructions,
    questions: STANDARD_DEFAULT_EXAM_QUESTIONS,
    maxTabSwitches: MAX_ALLOWED_EXAM_TAB_SWITCHES,
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

const violationEventSchema = z.object({
  type: z.enum(['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_PASTE_BLOCKED']),
  occurredAt: z.string(),
  detail: z.string().optional(),
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
    maxTabSwitches: z.number().int().min(1).max(10).default(MAX_ALLOWED_EXAM_TAB_SWITCHES),
  }),
};

export const saveExamProgressValidation = {
  params: z.object({
    examId: z.string().uuid('Valid examId UUID is required'),
  }),
  body: z.object({
    answers: z.record(z.string(), z.string()).default({}),
    remainingSeconds: z.number().int().min(0).optional().nullable(),
    tabSwitchCount: z.number().int().min(0).default(0),
    fullscreenExits: z.number().int().min(0).default(0),
    copyPasteBlockedCount: z.number().int().min(0).default(0),
    violations: z.array(violationEventSchema).default([]),
  }),
};

export const submitExamAttemptValidation = {
  params: z.object({
    examId: z.string().uuid('Valid examId UUID is required'),
  }),
  body: z.object({
    answers: z.record(z.string(), z.string()).default({}),
    tabSwitchCount: z.number().int().min(0).default(0),
    fullscreenExits: z.number().int().min(0).default(0),
    copyPasteBlockedCount: z.number().int().min(0).default(0),
    autoSubmittedByProctor: z.boolean().default(false),
    violations: z.array(violationEventSchema).default([]),
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
   * - Hydrates in-progress saved drafts & proctoring violation telemetry per attempt.
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

    const attemptIds = exams.flatMap((ex) => ex.attempts.map((a) => a.id));
    const proctoringLogs =
      attemptIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'ExamAttempt',
              entityId: { in: attemptIds },
              action: {
                in: [
                  'EXAM_PROGRESS_AND_PROCTORING_SYNC',
                  'EXAM_ATTEMPT_SUBMITTED_AND_AUTOGRADED',
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const proctoringByAttemptId = new Map<string, ExamAttemptProctoringMeta>();
    for (const log of proctoringLogs) {
      if (!log.entityId || proctoringByAttemptId.has(log.entityId) || !log.afterDataJson) {
        continue;
      }
      try {
        const parsed = JSON.parse(log.afterDataJson) as Partial<ExamAttemptProctoringMeta>;
        proctoringByAttemptId.set(log.entityId, {
          answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
          remainingSeconds:
            typeof parsed.remainingSeconds === 'number' ? parsed.remainingSeconds : null,
          tabSwitchCount: Number(parsed.tabSwitchCount || 0),
          fullscreenExits: Number(parsed.fullscreenExits || 0),
          copyPasteBlockedCount: Number(parsed.copyPasteBlockedCount || 0),
          autoSubmittedByProctor: Boolean(parsed.autoSubmittedByProctor),
          integrityStatus:
            parsed.integrityStatus ||
            computeExamIntegrityStatus({
              tabSwitchCount: Number(parsed.tabSwitchCount || 0),
              fullscreenExits: Number(parsed.fullscreenExits || 0),
              autoSubmittedByProctor: Boolean(parsed.autoSubmittedByProctor),
            }),
          violations: Array.isArray(parsed.violations) ? parsed.violations : [],
          updatedAt: parsed.updatedAt || log.createdAt.toISOString(),
        });
      } catch {
        // Ignore malformed legacy audit JSON
      }
    }

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
        maxTabSwitches: decoded.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES,
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
          const procMeta = proctoringByAttemptId.get(att.id);
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
            savedAnswers:
              actor.role === 'STUDENT' && att.status === 'IN_PROGRESS'
                ? procMeta?.answers || {}
                : undefined,
            remainingSeconds:
              actor.role === 'STUDENT' && att.status === 'IN_PROGRESS'
                ? procMeta?.remainingSeconds ?? null
                : undefined,
            tabSwitchCount: procMeta?.tabSwitchCount ?? 0,
            fullscreenExits: procMeta?.fullscreenExits ?? 0,
            copyPasteBlockedCount: procMeta?.copyPasteBlockedCount ?? 0,
            autoSubmittedByProctor: procMeta?.autoSubmittedByProctor ?? false,
            integrityStatus: procMeta?.integrityStatus ?? 'CLEAN',
            violations: procMeta?.violations ?? [],
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
      maxTabSwitches?: number;
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

    const encodedInstructions = encodeExamInstructions(
      payload.summary,
      defaultQuestions,
      payload.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES
    );

    const createdExam = await prisma.$transaction(async (tx) => {
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
            maxTabSwitches: payload.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES,
          }),
        },
      });

      return created;
    });

    await OmnichannelMessagingService.dispatchToCourseCohort({
      actorId: actor.id,
      courseId: createdExam.courseId,
      eventType: 'EXAM_PUBLISHED',
      title: `New Examination Scheduled: ${createdExam.title}`,
      body: `A new timed examination (${createdExam.title}) has been scheduled starting ${createdExam.startsAt.toISOString()}.`,
    });

    return createdExam;
  }

  /**
   * Real-time in-progress exam auto-save & anti-cheat proctoring heartbeat (`POST /api/v1/exams/:examId/save-progress`).
   * Ensures students never lose selected answers if their browser refreshes or disconnects mid-exam,
   * while recording tab-switch/blur/fullscreen proctoring violations on the server.
   */
  static async saveExamProgress(
    actor: AuthenticatedActor,
    examId: string,
    payload: {
      answers: Record<string, string>;
      remainingSeconds?: number | null;
      tabSwitchCount?: number;
      fullscreenExits?: number;
      copyPasteBlockedCount?: number;
      violations?: ExamProctoringViolationEvent[];
    }
  ) {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only enrolled students can save in-progress exam attempts.');
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });
    if (!exam || exam.status !== 'PUBLISHED') {
      throw ApiError.notFound('Published exam not found.');
    }

    await assertCourseAccessScope(actor, exam.courseId);

    const decoded = decodeExamInstructions(exam.instructions);
    const maxTabSwitches = decoded.maxTabSwitches ?? MAX_ALLOWED_EXAM_TAB_SWITCHES;

    const existingAttempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, studentId: actor.id },
      orderBy: { attemptNumber: 'desc' },
    });

    let activeAttempt = existingAttempts.find((a) => a.status === 'IN_PROGRESS') || null;
    const completedCount = existingAttempts.filter((a) => a.status !== 'IN_PROGRESS').length;

    if (!activeAttempt && completedCount >= exam.attemptLimit) {
      throw ApiError.conflict(
        `You have already completed all ${exam.attemptLimit} allowed attempt(s) for this examination.`
      );
    }

    const tabSwitchCount = Number(payload.tabSwitchCount || 0);
    const fullscreenExits = Number(payload.fullscreenExits || 0);
    const copyPasteBlockedCount = Number(payload.copyPasteBlockedCount || 0);
    const integrityStatus = computeExamIntegrityStatus({
      tabSwitchCount,
      fullscreenExits,
      autoSubmittedByProctor: false,
      maxTabSwitches,
    });

    const nowIso = new Date().toISOString();
    const metaPayload: ExamAttemptProctoringMeta = {
      answers: payload.answers || {},
      remainingSeconds:
        typeof payload.remainingSeconds === 'number' ? payload.remainingSeconds : null,
      tabSwitchCount,
      fullscreenExits,
      copyPasteBlockedCount,
      autoSubmittedByProctor: false,
      integrityStatus,
      violations: payload.violations || [],
      updatedAt: nowIso,
    };

    const savedAttempt = await prisma.$transaction(async (tx) => {
      const att =
        activeAttempt ||
        (await tx.examAttempt.create({
          data: {
            examId: exam.id,
            studentId: actor.id,
            attemptNumber: existingAttempts.length + 1,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        }));

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'EXAM_PROGRESS_AND_PROCTORING_SYNC',
          entityType: 'ExamAttempt',
          entityId: att.id,
          afterDataJson: JSON.stringify(metaPayload),
        },
      });

      return att;
    });

    return {
      attemptId: savedAttempt.id,
      examId: exam.id,
      attemptNumber: savedAttempt.attemptNumber,
      status: savedAttempt.status,
      savedQuestionCount: Object.keys(metaPayload.answers).length,
      remainingSeconds: metaPayload.remainingSeconds,
      tabSwitchCount,
      maxTabSwitches,
      integrityStatus,
      shouldAutoSubmit: tabSwitchCount >= maxTabSwitches || fullscreenExits >= maxTabSwitches,
      savedAt: nowIso,
    };
  }

  /**
   * Student submits an exam attempt (`POST /api/v1/exams/:examId/submit-attempt`).
   * Auto-grades objective questions (`MCQ_SINGLE`, `TRUE_FALSE`) against the server-stored question bank,
   * finalizes any `IN_PROGRESS` attempt, records proctoring integrity telemetry,
   * and enforces `resultPublishAt` visibility rules (O-022).
   */
  static async submitExamAttempt(
    actor: AuthenticatedActor,
    examId: string,
    payload: {
      answers: Record<string, string>;
      tabSwitchCount?: number;
      fullscreenExits?: number;
      copyPasteBlockedCount?: number;
      autoSubmittedByProctor?: boolean;
      violations?: ExamProctoringViolationEvent[];
    }
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

    const existingAttempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, studentId: actor.id },
      orderBy: { attemptNumber: 'desc' },
    });

    const inProgressAttempt = existingAttempts.find((a) => a.status === 'IN_PROGRESS') || null;
    const completedAttemptsCount = existingAttempts.filter(
      (a) => a.status !== 'IN_PROGRESS'
    ).length;

    if (!inProgressAttempt && completedAttemptsCount >= exam.attemptLimit) {
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

    const tabSwitchCount = Number(payload.tabSwitchCount || 0);
    const fullscreenExits = Number(payload.fullscreenExits || 0);
    const copyPasteBlockedCount = Number(payload.copyPasteBlockedCount || 0);
    const autoSubmittedByProctor = Boolean(payload.autoSubmittedByProctor);
    const integrityStatus = computeExamIntegrityStatus({
      tabSwitchCount,
      fullscreenExits,
      autoSubmittedByProctor,
      maxTabSwitches: decoded.maxTabSwitches,
    });

    const proctoringMeta: ExamAttemptProctoringMeta = {
      answers: payload.answers || {},
      remainingSeconds: 0,
      tabSwitchCount,
      fullscreenExits,
      copyPasteBlockedCount,
      autoSubmittedByProctor,
      integrityStatus,
      violations: payload.violations || [],
      updatedAt: now.toISOString(),
    };

    const finalizedAttempt = await prisma.$transaction(async (tx) => {
      const att = inProgressAttempt
        ? await tx.examAttempt.update({
            where: { id: inProgressAttempt.id },
            data: {
              status: 'EVALUATED',
              score: new Prisma.Decimal(normalizedScore.toFixed(2)),
              grade,
              submittedAt: now,
              evaluatedAt: now,
            },
          })
        : await tx.examAttempt.create({
            data: {
              examId: exam.id,
              studentId: actor.id,
              attemptNumber: existingAttempts.length + 1,
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
          reason: autoSubmittedByProctor
            ? `Auto-submitted by anti-cheat proctor (tabSwitches=${tabSwitchCount}, fullscreenExits=${fullscreenExits})`
            : 'Submitted by student',
          afterDataJson: JSON.stringify({
            examId: exam.id,
            attemptNumber: att.attemptNumber,
            status: att.status,
            ...proctoringMeta,
          }),
        },
      });

      return att;
    });

    const isResultPublished =
      !exam.resultPublishAt || now.getTime() >= exam.resultPublishAt.getTime();

    return {
      attemptId: finalizedAttempt.id,
      examId: exam.id,
      attemptNumber: finalizedAttempt.attemptNumber,
      status: finalizedAttempt.status,
      isResultPublished,
      score: isResultPublished ? finalizedAttempt.score?.toFixed(2) : null,
      grade: isResultPublished ? finalizedAttempt.grade : 'PENDING_PUBLISH',
      tabSwitchCount,
      fullscreenExits,
      copyPasteBlockedCount,
      autoSubmittedByProctor,
      integrityStatus,
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

  static saveProgress = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await ExamsService.saveExamProgress(
      req.user,
      String(req.params.examId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'Exam progress and proctoring telemetry saved',
      result
    );
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
  '/:examId/save-progress',
  authorizeRoles('STUDENT'),
  validateRequest(saveExamProgressValidation),
  ExamsController.saveProgress
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
