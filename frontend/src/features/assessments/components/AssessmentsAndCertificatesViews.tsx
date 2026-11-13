'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useCoursesListQuery,
  useEnrollmentsListQuery,
} from '@/features/courses/hooks/courses.hook';
import {
  useAssignmentsQuery,
  useCertificatesQuery,
  useCreateAssignmentMutation,
  useCreateExamMutation,
  useEvaluateExamAttemptMutation,
  useExamsQuery,
  useGradeSubmissionMutation,
  useIssueCertificateMutation,
  usePerformanceAnalyticsQuery,
  useRevokeCertificateMutation,
  useSaveExamProgressMutation,
  useSubmitAssignmentMutation,
  useSubmitExamAttemptMutation,
  useVerifyCertificateQuery,
} from '../hooks/assessments.hook';
import { CertificateItem, ExamQuestionItem } from '../types/assessments.types';
import {
  EXAM_DURATION_PRESETS,
  SUBMISSION_DECISION_OPTIONS,
} from '../assessments.constant';
import {
  ClipboardList,
  FileCheck,
  Award,
  BarChart3,
  CheckCircle2,
  AlertOctagon,
  Plus,
  Send,
  ShieldCheck,
  Search,
  Lock,
  Clock,
  Flag,
  Trash2,
  Printer,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// STANDALONE A4 LANDSCAPE CERTIFICATE PRINT ENGINE
// Prints ONLY the official Certificate inside an isolated print iframe (1 sheet)
// Never prints the browser window, sidebar, or background cards.
// ============================================================================

export function printVerifiableCertificateDocument(cert: CertificateItem): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const issuedDate = new Date(cert.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const verifyUrl = `${window.location.origin}/verify-certificate?code=${encodeURIComponent(
    cert.certificateNumber
  )}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Certificate of Completion — ${cert.certificateNumber}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Georgia', 'Times New Roman', serif;
    }
    .cert-outer {
      width: 100%;
      min-height: 180mm;
      border: 4px solid #b45309;
      border-radius: 14px;
      padding: 10px;
      background: #fffbeb;
      display: flex;
      align-items: stretch;
    }
    .cert-inner {
      width: 100%;
      border: 2px dashed #d97706;
      border-radius: 10px;
      padding: 32px 44px;
      background: #ffffff;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .inst-badge {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #b45309;
    }
    .cert-title {
      font-size: 36px;
      font-weight: 800;
      color: #0f172a;
      margin: 10px 0 6px 0;
      letter-spacing: -0.01em;
    }
    .cert-subtitle {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #475569;
      margin: 0;
    }
    .recipient-name {
      font-size: 32px;
      font-weight: 800;
      color: #0284c7;
      margin: 16px auto;
      padding-bottom: 6px;
      border-bottom: 2px solid #f59e0b;
      display: inline-block;
      min-width: 320px;
    }
    .course-line {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #334155;
      max-width: 640px;
      margin: 0 auto;
      line-height: 1.5;
    }
    .course-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 12px 0 4px 0;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .meta-footer {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 18px;
      margin-top: 26px;
      padding-top: 18px;
      border-top: 1px solid #cbd5e1;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      text-align: center;
    }
    .meta-label {
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 10px;
      margin-bottom: 4px;
    }
    .meta-value {
      font-weight: 800;
      color: #0f172a;
      font-size: 12px;
    }
    .verify-line {
      margin-top: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="cert-outer">
    <div class="cert-inner">
      <div>
        <div class="inst-badge">SAAMPARK INSTITUTE • VERIFIABLE ACADEMIC CREDENTIAL</div>
        <h1 class="cert-title">Certificate of Course Completion</h1>
        <p class="cert-subtitle">This official academic credential is proudly presented to</p>
      </div>

      <div>
        <div class="recipient-name">${cert.studentName}</div>
        <p class="course-line">
          for successfully completing the curriculum, satisfying all live session attendance requirements (&ge;75%),
          and demonstrating examination proficiency (&ge;50%) in the course
        </p>
        <div class="course-title">${cert.courseTitle} (${cert.courseCode})</div>
      </div>

      <div>
        <div class="meta-footer">
          <div>
            <div class="meta-label">Certificate Number</div>
            <div class="meta-value" style="color: #047857; font-family: monospace;">${cert.certificateNumber}</div>
          </div>
          <div>
            <div class="meta-label">Date of Issuance</div>
            <div class="meta-value">${issuedDate}</div>
          </div>
          <div>
            <div class="meta-label">Academic Director &amp; Seal</div>
            <div class="meta-value">Saampark Institute Examination Board (${cert.status} &#10003;)</div>
          </div>
        </div>
        <div class="verify-line">
          Verify Credential Online: ${verifyUrl}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    }, 250);
  }
}

// ----------------------------------------------------------------------------
// DEFAULT 5-QUESTION TEMPLATE FOR TEACHER QUESTION BANK BUILDER
// ----------------------------------------------------------------------------

const DEFAULT_BUILDER_QUESTIONS: ExamQuestionItem[] = [
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
    prompt:
      'All eigenvalues of a Hermitian (self-adjoint) quantum observable operator are strictly real numbers.',
    marks: 20,
    options: [
      {
        id: 'q2-t',
        text: 'True — Hermitian operators always yield real observable eigenvalues',
        isCorrect: true,
      },
      {
        id: 'q2-f',
        text: 'False — Eigenvalues can be complex for bound states',
        isCorrect: false,
      },
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
];

function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 5 FORMS
// ----------------------------------------------------------------------------

const createAssignmentSchema = z.object({
  courseId: z.string().uuid('Select an assigned course'),
  title: z.string().trim().min(3, 'Title is required').max(200),
  instructions: z.string().trim().min(10, 'Detailed instructions required'),
  maxMarks: z.coerce.number().positive().max(1000).default(100),
  dueAt: z.string().min(10, 'Due date is required'),
});
type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

const submitAssignmentSchema = z.object({
  submissionText: z
    .string()
    .trim()
    .min(5, 'Enter your solution notes or derivation')
    .max(10000),
  fileName: z.string().trim().max(255).optional(),
});
type SubmitAssignmentValues = z.infer<typeof submitAssignmentSchema>;

const gradeSubmissionSchema = z.object({
  marksAwarded: z.coerce.number().min(0),
  feedback: z.string().trim().min(3, 'Provide grading feedback').max(2000),
  status: z.enum(['GRADED', 'RESUBMIT_REQUESTED']).default('GRADED'),
});
type GradeSubmissionValues = z.infer<typeof gradeSubmissionSchema>;

const createExamSchema = z.object({
  courseId: z.string().uuid('Select an assigned course'),
  title: z.string().trim().min(3, 'Exam title is required').max(200),
  summary: z.string().trim().min(5, 'Exam instructions summary required').max(1000),
  durationSeconds: z.coerce.number().int().min(300).default(3600),
  passMarks: z.coerce.number().nonnegative().default(50),
  attemptLimit: z.coerce.number().int().min(1).max(5).default(2),
  maxTabSwitches: z.coerce.number().int().min(1).max(10).default(3),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  resultPublishAt: z.string().optional(),
});
type CreateExamValues = z.infer<typeof createExamSchema>;

// ============================================================================
// 1. ASSIGNMENTS & GRADING QUEUE WORKSPACE (TEACHER & STUDENT)
// ============================================================================

export function RoleAssignmentsWorkspaceView({
  role,
}: {
  role: 'TEACHER' | 'STUDENT';
}) {
  const { data: coursesData } = useCoursesListQuery();
  const { data: assignments = [], isLoading, isError, error } = useAssignmentsQuery();

  const createAssignmentMutation = useCreateAssignmentMutation();
  const submitAssignmentMutation = useSubmitAssignmentMutation();
  const gradeSubmissionMutation = useGradeSubmissionMutation();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');

  const activeAssignment =
    assignments.find((a) => a.id === selectedAssignmentId) || assignments[0] || null;

  const defaultDue = new Date(Date.now() + 5 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);

  const createForm = useForm<CreateAssignmentValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      title: '',
      instructions: '',
      maxMarks: 100,
      dueAt: defaultDue,
    },
  });

  const submitForm = useForm<SubmitAssignmentValues>({
    resolver: zodResolver(submitAssignmentSchema),
    defaultValues: {
      submissionText: '',
      fileName: 'solution_writeup.pdf',
    },
  });

  const gradeForm = useForm<GradeSubmissionValues>({
    resolver: zodResolver(gradeSubmissionSchema),
    defaultValues: {
      marksAwarded: 90,
      feedback: 'Well-structured derivation and complete boundary conditions.',
      status: 'GRADED',
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Assignments & Grading`}
      operatorSubtitle="Scoped Course Assessments (C-007)"
      headerTitle={
        role === 'TEACHER'
          ? 'Assignments & Student Evaluation Queues'
          : 'My Course Assignments & Submissions'
      }
    >
      <div className="space-y-6">
        {role === 'TEACHER' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" /> Create Course Assignment (`POST /api/v1/assignments`)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Publishes a new assignment to enrolled students in your assigned course.
            </p>

            <form
              onSubmit={createForm.handleSubmit((vals) =>
                createAssignmentMutation.mutate(
                  {
                    ...vals,
                    dueAt: new Date(vals.dueAt).toISOString(),
                  },
                  {
                    onSuccess: () =>
                      createForm.reset({
                        courseId: vals.courseId,
                        title: '',
                        instructions: '',
                        maxMarks: 100,
                        dueAt: defaultDue,
                      }),
                  }
                )
              )}
              className="grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              <select
                {...createForm.register('courseId')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">Select Assigned Course</option>
                {coursesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Assignment Title"
                {...createForm.register('title')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <input
                type="datetime-local"
                {...createForm.register('dueAt')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Max Marks"
                  {...createForm.register('maxMarks')}
                  className="w-24 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={createAssignmentMutation.isPending}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                >
                  + Publish
                </button>
              </div>

              <div className="md:col-span-4">
                <textarea
                  rows={2}
                  placeholder="Assignment instructions, grading rubric, and problem details..."
                  {...createForm.register('instructions')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Assignment List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-cyan-400" /> Assignments (`GET /api/v1/assignments`)
            </h3>
            {isLoading && <p className="text-xs text-slate-500">Loading assignments...</p>}
            {isError && (
              <p className="text-xs text-rose-500">
                {(error as { message?: string })?.message || 'Failed to load assignments.'}
              </p>
            )}

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {assignments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAssignmentId(a.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition ${
                    activeAssignment?.id === a.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-400">{a.courseCode}</span>
                    <span className="text-slate-400">Max: {a.maxMarks} pts</span>
                  </div>
                  <p className="text-xs font-bold mt-1">{a.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Due: {new Date(a.dueAt).toLocaleDateString()}
                  </p>
                  {role === 'STUDENT' && a.mySubmission && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                      {a.mySubmission.status}{' '}
                      {a.mySubmission.marksAwarded
                        ? `• ${a.mySubmission.marksAwarded}/${a.maxMarks}`
                        : ''}
                    </span>
                  )}
                  {role === 'TEACHER' && (
                    <span className="inline-block mt-1.5 text-[11px] text-indigo-400 font-semibold">
                      {a.pendingCount} Pending • {a.gradedCount} Graded
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Student Submission OR Teacher Evaluation Queue */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {activeAssignment ? (
              <>
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-mono font-bold">
                    {activeAssignment.courseCode} • Max Marks: {activeAssignment.maxMarks}
                  </span>
                  <h3 className="text-base font-bold mt-1">{activeAssignment.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{activeAssignment.instructions}</p>
                </div>

                {role === 'STUDENT' ? (
                  <div className="space-y-4">
                    {activeAssignment.mySubmission && (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400">
                            Attempt #{activeAssignment.mySubmission.attemptNumber} —{' '}
                            {activeAssignment.mySubmission.status}
                          </span>
                          <span className="font-mono font-bold">
                            Score:{' '}
                            {activeAssignment.mySubmission.marksAwarded
                              ? `${activeAssignment.mySubmission.marksAwarded} / ${activeAssignment.maxMarks}`
                              : 'Pending Teacher Evaluation'}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          {activeAssignment.mySubmission.submissionText}
                        </p>
                        {activeAssignment.mySubmission.feedback && (
                          <p className="text-cyan-400 font-semibold pt-1">
                            Instructor Feedback: {activeAssignment.mySubmission.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    <form
                      onSubmit={submitForm.handleSubmit((vals) =>
                        submitAssignmentMutation.mutate(
                          {
                            assignmentId: activeAssignment.id,
                            ...vals,
                          },
                          { onSuccess: () => submitForm.reset() }
                        )
                      )}
                      className="space-y-3"
                    >
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-violet-400" /> Submit / Resubmit Assignment (`POST /api/v1/assignments/:id/submit`)
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Write your derivation, answer summary, or notes..."
                        {...submitForm.register('submissionText')}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      />
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Attached File Name (e.g. problem_set_solution.pdf)"
                          {...submitForm.register('fileName')}
                          className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <button
                          type="submit"
                          disabled={submitAssignmentMutation.isPending}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
                        >
                          {submitAssignmentMutation.isPending
                            ? 'Submitting...'
                            : 'Submit Assignment'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold">
                      Student Submissions Queue ({activeAssignment.submissions.length})
                    </h4>
                    {activeAssignment.submissions.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No student submissions received yet for this assignment.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {activeAssignment.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-bold">{sub.studentName}</span>{' '}
                                <span className="text-slate-500">({sub.studentEmail})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">
                                  {sub.status}
                                </span>
                                {sub.marksAwarded && (
                                  <span className="font-mono font-bold text-emerald-400">
                                    {sub.marksAwarded} / {activeAssignment.maxMarks}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubmissionId(sub.id)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]"
                                >
                                  Evaluate / Grade
                                </button>
                              </div>
                            </div>
                            <p className="text-slate-400">{sub.submissionText}</p>

                            {selectedSubmissionId === sub.id && (
                              <form
                                onSubmit={gradeForm.handleSubmit((vals) =>
                                  gradeSubmissionMutation.mutate(
                                    {
                                      submissionId: sub.id,
                                      ...vals,
                                    },
                                    { onSuccess: () => setSelectedSubmissionId('') }
                                  )
                                )}
                                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-indigo-500/40 grid grid-cols-1 sm:grid-cols-4 gap-2.5"
                              >
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder={`Marks (Max ${activeAssignment.maxMarks})`}
                                  {...gradeForm.register('marksAwarded')}
                                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                                />
                                <select
                                  {...gradeForm.register('status')}
                                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                                >
                                  {SUBMISSION_DECISION_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Feedback"
                                  {...gradeForm.register('feedback')}
                                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                                />
                                <button
                                  type="submit"
                                  disabled={gradeSubmissionMutation.isPending}
                                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                                >
                                  Save Grade
                                </button>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Select an assignment to inspect details.
              </p>
            )}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. HIGH-LEVEL STANDARD COMPUTER-BASED TEST (CBT) EXAMINATION ENGINE
// (TEACHER DYNAMIC QUESTION BUILDER & STUDENT PROCTORED CBT CONSOLE — O-022)
// ============================================================================

export function RoleExamsAndResultsView({
  role,
}: {
  role: 'TEACHER' | 'STUDENT';
}) {
  const { data: coursesData } = useCoursesListQuery();
  const { data: exams = [], isLoading } = useExamsQuery();

  const createExamMutation = useCreateExamMutation();
  const saveProgressMutation = useSaveExamProgressMutation();
  const submitAttemptMutation = useSubmitExamAttemptMutation();
  const evaluateAttemptMutation = useEvaluateExamAttemptMutation();

  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Student CBT State: 'LOBBY' | 'ACTIVE_CBT' | 'SUBMIT_CONFIRM'
  const [cbtStage, setCbtStage] = useState<'LOBBY' | 'ACTIVE_CBT'>('LOBBY');
  const [agreedToRules, setAgreedToRules] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Anti-cheat proctoring counters
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [copyPasteBlockedCount, setCopyPasteBlockedCount] = useState<number>(0);
  const [proctoringBanner, setProctoringBanner] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);

  // Teacher Dynamic Question Bank Builder State
  const [builderQuestions, setBuilderQuestions] = useState<ExamQuestionItem[]>(
    DEFAULT_BUILDER_QUESTIONS
  );

  const activeExam = exams.find((e) => e.id === selectedExamId) || exams[0] || null;
  const maxTabSwitches = activeExam?.maxTabSwitches ?? 3;
  const questions = activeExam?.questions || [];
  const currentQuestion = questions[currentQuestionIdx] || questions[0] || null;

  // Hydrate saved draft answers, remaining timer & proctoring counters when switching exam
  useEffect(() => {
    if (!activeExam) return;
    setCurrentQuestionIdx(0);
    setShowSubmitModal(false);
    setProctoringBanner(null);

    if (role === 'STUDENT') {
      const inProg = activeExam.attempts.find((a) => a.status === 'IN_PROGRESS');
      if (inProg) {
        setSelectedAnswers(inProg.savedAnswers || {});
        setRemainingSeconds(
          typeof inProg.remainingSeconds === 'number' && inProg.remainingSeconds > 0
            ? inProg.remainingSeconds
            : activeExam.durationSeconds
        );
        setTabSwitchCount(inProg.tabSwitchCount ?? 0);
        setCopyPasteBlockedCount(inProg.copyPasteBlockedCount ?? 0);
        setAgreedToRules(true);
      } else {
        setSelectedAnswers({});
        setRemainingSeconds(activeExam.durationSeconds || 3600);
        setTabSwitchCount(0);
        setCopyPasteBlockedCount(0);
        setAgreedToRules(false);
      }
      setMarkedForReview({});
      setVisitedQuestions(
        activeExam.questions[0] ? { [activeExam.questions[0].id]: true } : {}
      );
      setCbtStage('LOBBY');
    }
  }, [activeExam?.id, role]);

  // Mark current question as visited whenever currentQuestionIdx changes in ACTIVE_CBT
  useEffect(() => {
    if (cbtStage === 'ACTIVE_CBT' && currentQuestion) {
      setVisitedQuestions((prev) => ({ ...prev, [currentQuestion.id]: true }));
    }
  }, [cbtStage, currentQuestion?.id]);

  // Live ticking 1-second CBT countdown timer with auto-submission at 00:00:00
  useEffect(() => {
    if (role !== 'STUDENT' || cbtStage !== 'ACTIVE_CBT' || !activeExam) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setProctoringBanner('Time expired (00:00:00). Automatically submitting your examination attempt...');
          submitAttemptMutation.mutate(
            {
              examId: activeExam.id,
              answers: selectedAnswers,
              tabSwitchCount,
              copyPasteBlockedCount,
              autoSubmittedByProctor: false,
            },
            {
              onSuccess: () => {
                setCbtStage('LOBBY');
                setShowSubmitModal(false);
              },
            }
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    role,
    cbtStage,
    activeExam?.id,
    selectedAnswers,
    tabSwitchCount,
    copyPasteBlockedCount,
  ]);

  // Anti-cheat visibilitychange / window blur proctoring listener during ACTIVE_CBT
  useEffect(() => {
    if (role !== 'STUDENT' || cbtStage !== 'ACTIVE_CBT' || !activeExam) return;

    const handleTabViolation = () => {
      setTabSwitchCount((prev) => {
        const next = prev + 1;
        if (next >= maxTabSwitches) {
          setProctoringBanner(
            `CRITICAL PROCTORING VIOLATION (${next}/${maxTabSwitches} tab switches): Auto-submitting your examination attempt now.`
          );
          submitAttemptMutation.mutate(
            {
              examId: activeExam.id,
              answers: selectedAnswers,
              tabSwitchCount: next,
              copyPasteBlockedCount,
              autoSubmittedByProctor: true,
              violations: [
                {
                  type: 'TAB_SWITCH',
                  occurredAt: new Date().toISOString(),
                  detail: `Exceeded maxTabSwitches (${next}/${maxTabSwitches})`,
                },
              ],
            },
            {
              onSuccess: () => {
                setCbtStage('LOBBY');
                setShowSubmitModal(false);
              },
            }
          );
        } else {
          setProctoringBanner(
            `Proctoring Warning (${next}/${maxTabSwitches}): Tab switching or leaving the exam window is monitored. At ${maxTabSwitches} violations, your exam will auto-submit.`
          );
          saveProgressMutation.mutate({
            examId: activeExam.id,
            answers: selectedAnswers,
            remainingSeconds,
            tabSwitchCount: next,
            copyPasteBlockedCount,
            violations: [
              {
                type: 'TAB_SWITCH',
                occurredAt: new Date().toISOString(),
              },
            ],
          });
        }
        return next;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleTabViolation();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    role,
    cbtStage,
    activeExam?.id,
    maxTabSwitches,
    selectedAnswers,
    remainingSeconds,
    copyPasteBlockedCount,
  ]);

  const defaultStart = new Date().toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);

  const examForm = useForm<CreateExamValues>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      title: '',
      summary:
        'Standard Computer-Based Test (CBT) covering core concepts, derivations, and problem solving.',
      durationSeconds: 3600,
      passMarks: 50,
      attemptLimit: 2,
      maxTabSwitches: 3,
      startsAt: defaultStart,
      endsAt: defaultEnd,
    },
  });

  // Teacher Question Builder Helpers
  const totalBuilderMarks = builderQuestions.reduce((acc, q) => acc + Number(q.marks || 0), 0);

  const addBuilderQuestion = (qType: 'MCQ_SINGLE' | 'TRUE_FALSE') => {
    const nextIdx = builderQuestions.length + 1;
    const qId = `q-${Date.now()}-${nextIdx}`;
    const newQ: ExamQuestionItem =
      qType === 'TRUE_FALSE'
        ? {
            id: qId,
            questionType: 'TRUE_FALSE',
            prompt: `Question ${nextIdx}: Enter True/False statement...`,
            marks: 20,
            options: [
              { id: `${qId}-t`, text: 'True', isCorrect: true },
              { id: `${qId}-f`, text: 'False', isCorrect: false },
            ],
          }
        : {
            id: qId,
            questionType: 'MCQ_SINGLE',
            prompt: `Question ${nextIdx}: Enter multiple-choice question prompt...`,
            marks: 20,
            options: [
              { id: `${qId}-a`, text: 'Option A', isCorrect: true },
              { id: `${qId}-b`, text: 'Option B', isCorrect: false },
              { id: `${qId}-c`, text: 'Option C', isCorrect: false },
              { id: `${qId}-d`, text: 'Option D', isCorrect: false },
            ],
          };
    setBuilderQuestions((prev) => [...prev, newQ]);
  };

  // Student CBT Palette Summary Counts
  const answeredCount = questions.filter((q) => Boolean(selectedAnswers[q.id])).length;
  const markedReviewCount = questions.filter((q) => Boolean(markedForReview[q.id])).length;
  const visitedUnansweredCount = questions.filter(
    (q) => Boolean(visitedQuestions[q.id]) && !selectedAnswers[q.id]
  ).length;
  const notVisitedCount = Math.max(
    0,
    questions.length - Object.keys(visitedQuestions).length
  );

  const completedStudentAttempts = activeExam
    ? activeExam.attempts.filter((a) => a.status !== 'IN_PROGRESS')
    : [];
  const inProgressStudentAttempt = activeExam
    ? activeExam.attempts.find((a) => a.status === 'IN_PROGRESS')
    : null;
  const attemptsRemaining = activeExam
    ? Math.max(0, activeExam.attemptLimit - completedStudentAttempts.length)
    : 0;

  const syncDraftToServer = (nextAnswers: Record<string, string>) => {
    if (!activeExam || role !== 'STUDENT') return;
    saveProgressMutation.mutate(
      {
        examId: activeExam.id,
        answers: nextAnswers,
        remainingSeconds,
        tabSwitchCount,
        copyPasteBlockedCount,
      },
      {
        onSuccess: () => setLastAutoSavedAt(new Date().toISOString()),
      }
    );
  };

  return (
    <RolePanelShell
      role={role}
      operatorName={
        role === 'TEACHER'
          ? 'Examination & Question Bank Builder'
          : 'Standard CBT Examination Portal'
      }
      operatorSubtitle="Timed Computer-Based Testing, Palette Navigation & Proctoring (O-022)"
      headerTitle={
        role === 'TEACHER'
          ? 'Examination Question Bank Builder, Proctoring Telemetry & Result Publishing'
          : 'Computer-Based Examinations (CBT), Live Timer & Published Results'
      }
    >
      <div className="space-y-6">
        {/* ====================================================================
            TEACHER ONLY: INTERACTIVE MULTI-QUESTION CBT EXAM BUILDER
           ==================================================================== */}
        {role === 'TEACHER' && (
          <div className="rounded-2xl border border-indigo-500/40 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-500" /> Standard CBT Examination &amp; Question Bank Builder (`POST /api/v1/exams`)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure examination timing, proctoring strike limits, and build a custom multi-question objective question bank (`MCQ_SINGLE` &amp; `TRUE_FALSE`). Correct answers (`isCorrect`) are automatically stripped from student responses until `resultPublishAt`.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-xl font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  {builderQuestions.length} Questions • Total: {totalBuilderMarks} Marks
                </span>
              </div>
            </div>

            <form
              onSubmit={examForm.handleSubmit((vals) =>
                createExamMutation.mutate(
                  {
                    courseId: vals.courseId,
                    title: vals.title,
                    summary: vals.summary,
                    durationSeconds: vals.durationSeconds,
                    totalMarks: Math.max(10, totalBuilderMarks),
                    passMarks: vals.passMarks,
                    attemptLimit: vals.attemptLimit,
                    maxTabSwitches: vals.maxTabSwitches,
                    startsAt: new Date(vals.startsAt).toISOString(),
                    endsAt: new Date(vals.endsAt).toISOString(),
                    resultPublishAt: vals.resultPublishAt
                      ? new Date(vals.resultPublishAt).toISOString()
                      : null,
                    questions: builderQuestions,
                  },
                  {
                    onSuccess: () => {
                      examForm.reset();
                    },
                  }
                )
              )}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  {...examForm.register('courseId')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="">Select Assigned Course</option>
                  {coursesData?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Examination Title (e.g. Final Proctored CBT Assessment)"
                  {...examForm.register('title')}
                  className="md:col-span-2 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />

                <select
                  {...examForm.register('durationSeconds')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  {EXAM_DURATION_PRESETS.map((d) => (
                    <option key={d.value} value={d.value}>
                      Duration: {d.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 shrink-0">Pass Marks:</span>
                  <input
                    type="number"
                    {...examForm.register('passMarks')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 shrink-0">Max Attempts:</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    {...examForm.register('attemptLimit')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 shrink-0">Max Tab Switches:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    {...examForm.register('maxTabSwitches')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>

                <input
                  type="datetime-local"
                  {...examForm.register('startsAt')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Dynamic Question Bank Editor */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Question Bank Items ({builderQuestions.length})
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addBuilderQuestion('MCQ_SINGLE')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white cursor-pointer"
                    >
                      + Add 4-Option MCQ Question
                    </button>
                    <button
                      type="button"
                      onClick={() => addBuilderQuestion('TRUE_FALSE')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 text-white cursor-pointer"
                    >
                      + Add True/False Question
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {builderQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-bold text-indigo-400">
                          Question #{qIdx + 1} ({q.questionType})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            value={q.marks}
                            onChange={(e) => {
                              const nextMarks = Math.max(1, Number(e.target.value) || 10);
                              setBuilderQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === qIdx ? { ...item, marks: nextMarks } : item
                                )
                              );
                            }}
                            className="w-20 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                          />
                          {builderQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setBuilderQuestions((prev) =>
                                  prev.filter((_, i) => i !== qIdx)
                                )
                              }
                              className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                              title="Remove question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={q.prompt}
                        onChange={(e) => {
                          const nextPrompt = e.target.value;
                          setBuilderQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, prompt: nextPrompt } : item
                            )
                          );
                        }}
                        placeholder="Enter question stem / problem statement..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-lg border flex items-center gap-2 ${
                              opt.isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`builder_correct_${q.id}`}
                              checked={Boolean(opt.isCorrect)}
                              onChange={() => {
                                setBuilderQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx
                                      ? {
                                          ...item,
                                          options: item.options.map((o, j) => ({
                                            ...o,
                                            isCorrect: j === oIdx,
                                          })),
                                        }
                                      : item
                                  )
                                );
                              }}
                              title="Mark as correct option"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const nextText = e.target.value;
                                setBuilderQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx
                                      ? {
                                          ...item,
                                          options: item.options.map((o, j) =>
                                            j === oIdx ? { ...o, text: nextText } : o
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="flex-1 bg-transparent focus:outline-none text-xs"
                            />
                            {opt.isCorrect && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold shrink-0">
                                Correct ✓
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createExamMutation.isPending}
                  className="py-2.5 px-6 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 text-white cursor-pointer shadow"
                >
                  {createExamMutation.isPending
                    ? 'Publishing CBT Exam...'
                    : `+ Publish Proctored CBT Exam (${builderQuestions.length} Questions • ${totalBuilderMarks} Marks)`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ====================================================================
            MAIN EXAMINATION WORKSPACE: LEFT EXAM SELECTOR + RIGHT CBT STAGE
           ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (3 cols): Scheduled Course Examinations List */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" /> Scheduled Exams ({exams.length})
            </h3>
            {isLoading && <p className="text-xs text-slate-500">Loading exams...</p>}
            <div className="space-y-2.5">
              {exams.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExamId(ex.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    activeExam?.id === ex.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-400">{ex.courseCode}</span>
                    <span className="font-mono text-slate-400">
                      {ex.questions.length} Qs • {ex.totalMarks} Pts
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-1">{ex.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                    <span>⏱ {Math.round(ex.durationSeconds / 60)} mins</span>
                    <span
                      className={
                        ex.isResultPublished ? 'text-emerald-400 font-bold' : 'text-amber-400'
                      }
                    >
                      {ex.isResultPublished ? 'Results Live' : 'Results Locked'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column (9 cols): Student CBT Lobby / Live CBT Console OR Teacher Overview */}
          <div className="lg:col-span-9 space-y-6">
            {activeExam ? (
              <>
                {/* ============================================================
                    STUDENT MODE: STAGE 1 (LOBBY) OR STAGE 2 (ACTIVE CBT CONSOLE)
                   ============================================================ */}
                {role === 'STUDENT' && cbtStage === 'LOBBY' && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div>
                        <span className="px-2.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-mono text-xs font-bold">
                          {activeExam.courseCode} — Standard Proctored Computer-Based Test (CBT)
                        </span>
                        <h2 className="text-lg sm:text-xl font-extrabold mt-1.5">
                          {activeExam.title}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">{activeExam.summary}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          activeExam.isResultPublished
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {activeExam.isResultPublished ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Answer Key &amp; Results Published
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" /> Answers Protected Until Publish
                          </>
                        )}
                      </span>
                    </div>

                    {/* Exam KPI Specifications Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-400">Total Duration</p>
                        <p className="text-base font-extrabold text-cyan-400 mt-0.5">
                          {Math.round(activeExam.durationSeconds / 60)} Mins
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-400">Total Questions</p>
                        <p className="text-base font-extrabold text-violet-400 mt-0.5">
                          {questions.length} Questions
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-400">Maximum Marks</p>
                        <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                          {activeExam.totalMarks} Pts
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-400">Passing Threshold</p>
                        <p className="text-base font-extrabold text-amber-400 mt-0.5">
                          {activeExam.passMarks} Pts
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-400">Attempts Remaining</p>
                        <p className="text-base font-extrabold mt-0.5">
                          {attemptsRemaining} / {activeExam.attemptLimit}
                        </p>
                      </div>
                    </div>

                    {/* Standard CBT Instructions & Color Legend */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Anti-Cheat Proctoring &amp; CBT Rules
                        </h4>
                        <ul className="space-y-1.5 text-slate-500 dark:text-slate-400 list-disc pl-4">
                          <li>
                            The countdown timer in the top-right corner ticks in real time. When the timer reaches <strong>00:00:00</strong>, your examination will submit automatically.
                          </li>
                          <li>
                            Switching browser tabs or minimizing the window triggers a recorded proctoring violation. Reaching <strong>{maxTabSwitches} tab switches</strong> automatically submits your attempt.
                          </li>
                          <li>
                            Clicking <strong>Save &amp; Next</strong> automatically syncs your selected response to the server so you can resume seamlessly if disconnected.
                          </li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200">
                          Question Palette Symbols &amp; Color Legend
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-[11px]">
                              1
                            </span>
                            <span>Answered &amp; Saved</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px]">
                              2
                            </span>
                            <span>Marked for Review</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold flex items-center justify-center text-[11px]">
                              3
                            </span>
                            <span>Visited, Not Answered</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 font-bold flex items-center justify-center text-[11px]">
                              4
                            </span>
                            <span>Not Visited Yet</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Candidate Declaration & Launch Button */}
                    {(inProgressStudentAttempt || attemptsRemaining > 0) ? (
                      <div className="p-4 rounded-xl border border-violet-500/40 bg-violet-500/10 space-y-3">
                        <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={agreedToRules}
                            onChange={(e) => setAgreedToRules(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            <strong>Candidate Declaration:</strong> I have read and understood all computer-based examination instructions, timer rules, and anti-cheat proctoring policies. I confirm that I am taking this assessment independently without unauthorized assistance.
                          </span>
                        </label>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={!agreedToRules}
                            onClick={() => {
                              setCbtStage('ACTIVE_CBT');
                              if (questions[0]) {
                                setVisitedQuestions((prev) => ({
                                  ...prev,
                                  [questions[0].id]: true,
                                }));
                              }
                            }}
                            className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-violet-600 to-cyan-600 hover:opacity-95 disabled:opacity-40 cursor-pointer inline-flex items-center gap-2 shadow-lg"
                          >
                            <Play className="w-4 h-4" />
                            {inProgressStudentAttempt
                              ? 'Resume In-Progress CBT Examination →'
                              : 'Start Proctored CBT Examination Now →'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 font-semibold">
                        ✓ You have completed all {activeExam.attemptLimit} allowed attempt(s) for this examination. Review your scorecard and question solutions below.
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================
                    STUDENT MODE: STAGE 2 — ACTIVE FULL CBT EXAMINATION CONSOLE
                   ============================================================ */}
                {role === 'STUDENT' && cbtStage === 'ACTIVE_CBT' && currentQuestion && (
                  <div
                    onCopy={(e) => {
                      e.preventDefault();
                      setCopyPasteBlockedCount((c) => c + 1);
                      setProctoringBanner('Copy/Paste is disabled during proctored CBT examinations.');
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      setCopyPasteBlockedCount((c) => c + 1);
                      setProctoringBanner('Copy/Paste is disabled during proctored CBT examinations.');
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="space-y-4 select-none"
                  >
                    {/* Top CBT Header Bar with Live HH:MM:SS Countdown Timer */}
                    <div className="rounded-2xl bg-slate-950 text-white border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 block">
                          {activeExam.courseCode} • Live Proctored CBT Console
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold">{activeExam.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <span className="px-2.5 py-1 rounded-lg font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          🛡️ Proctor Active
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg font-mono font-bold ${
                            tabSwitchCount > 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}
                        >
                          Tab Switches: {tabSwitchCount}/{maxTabSwitches}
                        </span>
                        <div
                          className={`px-3.5 py-1.5 rounded-xl font-mono text-sm font-extrabold flex items-center gap-2 border ${
                            remainingSeconds <= 300
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                              : 'bg-indigo-950 text-cyan-300 border-indigo-500/40'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          <span>Time Left: {formatTimerClock(remainingSeconds)}</span>
                        </div>
                      </div>
                    </div>

                    {proctoringBanner && (
                      <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                        ⚠️ {proctoringBanner}
                      </div>
                    )}

                    {/* Split-Pane CBT Workspace: Left 8 Cols Question Stage + Right 4 Cols Question Palette */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* LEFT 8 COLS: SINGLE QUESTION STAGE */}
                      <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-extrabold">
                              Question {currentQuestionIdx + 1} of {questions.length}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-mono text-[11px] font-bold">
                              {currentQuestion.questionType === 'TRUE_FALSE'
                                ? 'True / False'
                                : 'Single-Choice MCQ'}
                            </span>
                            {markedForReview[currentQuestion.id] && (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-[11px] font-bold flex items-center gap-1">
                                <Flag className="w-3 h-3" /> Marked for Review
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-mono">
                            <span className="text-emerald-400 font-bold">
                              +{currentQuestion.marks} Marks
                            </span>{' '}
                            <span className="text-slate-500">| 0.00 Negative</span>
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <div className="py-2">
                          <p className="text-sm sm:text-base font-bold leading-relaxed">
                            {currentQuestion.prompt}
                          </p>
                        </div>

                        {/* Options List */}
                        <div className="space-y-3">
                          {currentQuestion.options.map((opt, oIdx) => {
                            const optionLetter = String.fromCharCode(65 + oIdx);
                            const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                            return (
                              <label
                                key={opt.id}
                                onClick={() => {
                                  const nextAns = {
                                    ...selectedAnswers,
                                    [currentQuestion.id]: opt.id,
                                  };
                                  setSelectedAnswers(nextAns);
                                }}
                                className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                                  isSelected
                                    ? 'border-violet-500 bg-violet-500/15 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3 text-xs sm:text-sm">
                                  <span
                                    className={`w-7 h-7 rounded-lg font-mono font-extrabold flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}
                                  >
                                    {optionLetter}
                                  </span>
                                  <input
                                    type="radio"
                                    name={`cbt_q_${currentQuestion.id}`}
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedAnswers((prev) => ({
                                        ...prev,
                                        [currentQuestion.id]: opt.id,
                                      }));
                                    }}
                                    className="sr-only"
                                  />
                                  <span className="font-medium">{opt.text}</span>
                                </div>

                                {isSelected && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold shrink-0">
                                    Selected ✓
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>

                        {/* Standard CBT Bottom Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-200 dark:border-slate-800 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={currentQuestionIdx === 0}
                              onClick={() =>
                                setCurrentQuestionIdx((idx) => Math.max(0, idx - 1))
                              }
                              className="px-3.5 py-2 rounded-xl font-bold border border-slate-300 dark:border-slate-700 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" /> Previous
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const nextAns = { ...selectedAnswers };
                                delete nextAns[currentQuestion.id];
                                setSelectedAnswers(nextAns);
                              }}
                              className="px-3.5 py-2 rounded-xl font-semibold border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Clear Response
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMarkedForReview((prev) => ({
                                  ...prev,
                                  [currentQuestion.id]: !prev[currentQuestion.id],
                                }));
                                syncDraftToServer(selectedAnswers);
                                if (currentQuestionIdx < questions.length - 1) {
                                  setCurrentQuestionIdx((idx) => idx + 1);
                                }
                              }}
                              className="px-3.5 py-2 rounded-xl font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              {markedForReview[currentQuestion.id]
                                ? 'Unmark Review & Next'
                                : 'Mark for Review & Next'}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              syncDraftToServer(selectedAnswers);
                              if (currentQuestionIdx < questions.length - 1) {
                                setCurrentQuestionIdx((idx) => idx + 1);
                              } else {
                                setShowSubmitModal(true);
                              }
                            }}
                            className="px-5 py-2 rounded-xl font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 cursor-pointer shadow"
                          >
                            <span>
                              {currentQuestionIdx < questions.length - 1
                                ? 'Save & Next'
                                : 'Save & Review Submit'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* RIGHT 4 COLS: QUESTION PALETTE & SUBMISSION SIDEBAR */}
                      <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-5 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider">
                            Question Palette
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {lastAutoSavedAt
                              ? `Synced ${new Date(lastAutoSavedAt).toLocaleTimeString()}`
                              : 'Auto-Sync Active'}
                          </span>
                        </div>

                        {/* Live Status Summary Counters */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                            <span className="text-emerald-400 font-semibold">Answered</span>
                            <span className="font-mono font-extrabold text-emerald-400">
                              {answeredCount}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                            <span className="text-amber-400 font-semibold">Marked Review</span>
                            <span className="font-mono font-extrabold text-amber-400">
                              {markedReviewCount}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                            <span className="text-rose-400 font-semibold">Unanswered</span>
                            <span className="font-mono font-extrabold text-rose-400">
                              {visitedUnansweredCount}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-slate-400 font-semibold">Not Visited</span>
                            <span className="font-mono font-extrabold text-slate-400">
                              {notVisitedCount}
                            </span>
                          </div>
                        </div>

                        {/* Numbered Question Grid */}
                        <div className="grid grid-cols-5 gap-2">
                          {questions.map((q, idx) => {
                            const isCurrent = idx === currentQuestionIdx;
                            const isAnswered = Boolean(selectedAnswers[q.id]);
                            const isMarked = Boolean(markedForReview[q.id]);
                            const isVisited = Boolean(visitedQuestions[q.id]);

                            let paletteClass =
                              'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-300 dark:border-slate-800';
                            if (isMarked) {
                              paletteClass =
                                'bg-amber-500 text-slate-950 border-amber-400 font-extrabold';
                            } else if (isAnswered) {
                              paletteClass =
                                'bg-emerald-600 text-white border-emerald-500 font-extrabold';
                            } else if (isVisited) {
                              paletteClass =
                                'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold';
                            }

                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => setCurrentQuestionIdx(idx)}
                                className={`h-10 rounded-xl border text-xs font-mono transition cursor-pointer ${paletteClass} ${
                                  isCurrent ? 'ring-2 ring-cyan-400 ring-offset-2 dark:ring-offset-slate-950' : ''
                                }`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => syncDraftToServer(selectedAnswers)}
                            disabled={saveProgressMutation.isPending}
                            className="w-full py-2 px-4 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {saveProgressMutation.isPending
                              ? 'Saving Progress to Server...'
                              : '💾 Save Progress & Pause'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowSubmitModal(true)}
                            className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-violet-600 to-cyan-600 hover:opacity-95 cursor-pointer shadow-lg"
                          >
                            Submit Final Examination →
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Final Submission Summary Confirmation Modal */}
                    {showSubmitModal && (
                      <div className="rounded-2xl border-2 border-violet-500 bg-slate-950 text-white p-6 space-y-4 shadow-2xl">
                        <h4 className="text-base font-extrabold">
                          Confirm Final Examination Submission
                        </h4>
                        <p className="text-xs text-slate-300">
                          Please verify your question attempt summary before final submission and automated grading:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <p className="text-slate-400">Total Questions</p>
                            <p className="text-lg font-extrabold mt-0.5">{questions.length}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                            <p className="text-emerald-300">Answered</p>
                            <p className="text-lg font-extrabold text-emerald-400 mt-0.5">
                              {answeredCount}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30">
                            <p className="text-amber-300">Marked for Review</p>
                            <p className="text-lg font-extrabold text-amber-400 mt-0.5">
                              {markedReviewCount}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30">
                            <p className="text-rose-300">Unanswered</p>
                            <p className="text-lg font-extrabold text-rose-400 mt-0.5">
                              {questions.length - answeredCount}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowSubmitModal(false)}
                            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 cursor-pointer"
                          >
                            ← Return to Questions
                          </button>
                          <button
                            type="button"
                            disabled={submitAttemptMutation.isPending}
                            onClick={() =>
                              submitAttemptMutation.mutate(
                                {
                                  examId: activeExam.id,
                                  answers: selectedAnswers,
                                  tabSwitchCount,
                                  copyPasteBlockedCount,
                                  autoSubmittedByProctor: false,
                                },
                                {
                                  onSuccess: () => {
                                    setShowSubmitModal(false);
                                    setCbtStage('LOBBY');
                                  },
                                }
                              )
                            }
                            className="px-6 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          >
                            {submitAttemptMutation.isPending
                              ? 'Submitting & Grading...'
                              : '✓ Confirm & Submit Final Exam'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================
                    TEACHER QUESTION BANK INSPECTOR OR STUDENT POST-PUBLISH KEY
                   ============================================================ */}
                {(role === 'TEACHER' ||
                  (role === 'STUDENT' &&
                    cbtStage === 'LOBBY' &&
                    completedStudentAttempts.length > 0 &&
                    activeExam.isResultPublished)) && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">
                        {role === 'TEACHER'
                          ? `Published Question Bank for ${activeExam.title} (${questions.length} Questions)`
                          : `Published Answer Key & Solution Review (${questions.length} Questions)`}
                      </h3>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        Total Marks: {activeExam.totalMarks}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">
                              Q{idx + 1}. {q.prompt}
                            </span>
                            <span className="font-mono text-slate-400">{q.marks} Marks</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={opt.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                  opt.isCorrect
                                    ? 'border-emerald-500/50 bg-emerald-500/10'
                                    : 'border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <span>
                                  <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt.text}
                                </span>
                                {opt.isCorrect && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                    Correct Answer ✓
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ============================================================
                    EVALUATED EXAM ATTEMPTS & PROCTORING SCORECARD TABLE
                   ============================================================ */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
                  <h4 className="text-sm font-bold mb-3">
                    Examination Attempts, Proctoring Integrity &amp; Results ({activeExam.attempts.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-2 px-3">Student</th>
                          <th className="py-2 px-3">Attempt #</th>
                          <th className="py-2 px-3">Proctoring Integrity</th>
                          <th className="py-2 px-3">Score</th>
                          <th className="py-2 px-3">Grade</th>
                          <th className="py-2 px-3 text-right">Status / Teacher Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {activeExam.attempts.map((att) => (
                          <tr key={att.id}>
                            <td className="py-2.5 px-3 font-semibold">{att.studentName}</td>
                            <td className="py-2.5 px-3">#{att.attemptNumber}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  att.integrityStatus === 'FLAGGED_VIOLATION'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : att.integrityStatus === 'WARNING'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/15 text-emerald-400'
                                }`}
                              >
                                {att.integrityStatus || 'CLEAN'} (Tabs: {att.tabSwitchCount ?? 0}
                                {att.autoSubmittedByProctor ? ' • Auto-Submitted' : ''})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {att.score !== null
                                ? `${att.score} / ${activeExam.totalMarks}`
                                : 'Locked until Publish'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                                {att.grade || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {role === 'TEACHER' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    evaluateAttemptMutation.mutate({
                                      attemptId: att.id,
                                      score: Number(att.score || activeExam.totalMarks),
                                      publishResultsNow: true,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  Publish Result Now
                                </button>
                              ) : (
                                <span className="font-mono font-semibold">{att.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                No examinations scheduled yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. ROLE PERFORMANCE ANALYTICS VIEW (STUDENT & TEACHER — C-011, C-013)
// ============================================================================

export function RolePerformanceAnalyticsView({
  role,
}: {
  role: 'STUDENT' | 'TEACHER';
}) {
  const { data, isLoading } = usePerformanceAnalyticsQuery();
  const issueCertMutation = useIssueCertificateMutation();

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Performance Analytics`}
      operatorSubtitle="Real-Time Academic Telemetry (C-011, C-013)"
      headerTitle={
        role === 'STUDENT'
          ? 'My Academic Performance & Certificate Eligibility'
          : 'Student Cohort Performance & Instructor Metrics'
      }
    >
      <div className="space-y-6">
        {isLoading && <p className="text-xs text-slate-500">Loading performance metrics...</p>}

        {role === 'STUDENT' && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.courseProgressCards.map((card) => (
              <div
                key={card.enrollmentId}
                className="rounded-2xl border border-violet-500/30 bg-white dark:bg-[#131127] p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-xs font-mono font-bold">
                    {card.courseCode}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      card.eligibleForCertificate
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {card.eligibleForCertificate
                      ? 'Certificate Eligible'
                      : 'In Progress Toward Thresholds'}
                  </span>
                </div>

                <h3 className="text-base font-bold">{card.courseTitle}</h3>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <p className="text-slate-500 text-[11px]">Attendance</p>
                    <p className="text-base font-extrabold text-cyan-400">
                      {card.attendancePercent}%
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Min {card.minAttendancePercent}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <p className="text-slate-500 text-[11px]">Assignment Avg</p>
                    <p className="text-base font-extrabold text-violet-400">
                      {card.assignmentAvgPercent}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <p className="text-slate-500 text-[11px]">Best Exam</p>
                    <p className="text-base font-extrabold text-emerald-400">
                      {card.bestExamPercent}%
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Min {card.minPassMarksPercent}%
                    </p>
                  </div>
                </div>

                {card.certificateNumber ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-400">
                      Issued: {card.certificateNumber}
                    </span>
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : (
                  card.eligibleForCertificate && (
                    <button
                      type="button"
                      onClick={() => issueCertMutation.mutate(card.enrollmentId)}
                      disabled={issueCertMutation.isPending}
                      className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500"
                    >
                      Claim Verifiable Course Certificate
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {role === 'TEACHER' && data?.teacherMetrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Assigned Courses</p>
                <p className="text-2xl font-extrabold mt-1">
                  {data.teacherMetrics.assignedCoursesCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Active Cohort Students</p>
                <p className="text-2xl font-extrabold mt-1">
                  {data.teacherMetrics.activeStudentsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Submissions Graded</p>
                <p className="text-2xl font-extrabold text-indigo-400 mt-1">
                  {data.teacherMetrics.gradedSubmissionsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Cohort Average Score</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {data.teacherMetrics.overallCohortAveragePercent}%
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Assigned-Course Student Performance Matrix (`GET /api/v1/exams/performance`)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Course</th>
                      <th className="py-2 px-3">Assignment Avg</th>
                      <th className="py-2 px-3">Exam Avg</th>
                      <th className="py-2 px-3">Combined %</th>
                      <th className="py-2 px-3 text-right">Letter Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {data.cohortStudentMatrix.map((row) => (
                      <tr key={row.enrollmentId}>
                        <td className="py-2.5 px-3 font-semibold">
                          {row.studentName}{' '}
                          <span className="text-slate-500 font-normal">({row.studentEmail})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{row.courseCode}</td>
                        <td className="py-2.5 px-3 font-mono">{row.assignmentAvgPercent}%</td>
                        <td className="py-2.5 px-3 font-mono">{row.examAvgPercent}%</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                          {row.combinedScorePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                            {row.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. VERIFIABLE CERTIFICATES VIEW (ADMIN & STUDENT — O-023)
// + PUBLIC UNAUTHENTICATED VERIFICATION PORTAL (/verify-certificate)
// ============================================================================

export function PublicCertificateVerificationPortal({
  initialCode = '',
}: {
  initialCode?: string;
}) {
  const [codeInput, setCodeInput] = useState<string>(initialCode);
  const [origin, setOrigin] = useState<string>('http://localhost:3000');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location?.origin) {
        setOrigin(window.location.origin);
      }
      const params = new URLSearchParams(window.location.search);
      const urlCode = (params.get('code') || params.get('verify') || initialCode || '').trim();
      if (urlCode) {
        setCodeInput(urlCode.toUpperCase());
      }
    }
  }, [initialCode]);

  const {
    data: verificationResult,
    isFetching,
    isError,
  } = useVerifyCertificateQuery(codeInput);

  const publicShareUrl = codeInput.trim()
    ? `${origin}/verify-certificate?code=${encodeURIComponent(codeInput.trim().toUpperCase())}`
    : `${origin}/verify-certificate`;

  const copyShareUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(publicShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
      <header className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-extrabold shadow-lg">
            GA
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg text-white">
              Saampark Institute • Gemini Argon LMS
            </span>
            <span className="block text-xs text-slate-400">
              Official Public Academic Credential Verification Registry (No Login Required)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <a
            href="/student/login"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 font-semibold text-slate-200"
          >
            Student Portal →
          </a>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto my-auto py-8 space-y-6">
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Public Credential Verification Portal
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white pt-1">
              Verify Course Completion Certificate
            </h1>
            <p className="text-xs text-slate-400">
              Employers, universities, and credential evaluators can verify any Saampark Institute certificate by entering its Certificate Number below or opening its direct verification URL.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter Certificate Number (e.g. CERT-ARGON-2026-PHYS401-0042)"
              className="flex-1 px-4 py-3 rounded-xl text-xs sm:text-sm font-mono bg-slate-950 border border-slate-700 text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="button"
              onClick={copyShareUrl}
              className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer shrink-0"
            >
              {copiedLink ? '✓ Verification URL Copied!' : '🔗 Copy Direct Verify Link'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Sample Seeded Certificate:</span>
            <button
              type="button"
              onClick={() => setCodeInput('CERT-ARGON-2026-PHYS401-0042')}
              className="px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono font-bold hover:bg-cyan-500/25 cursor-pointer"
            >
              CERT-ARGON-2026-PHYS401-0042
            </button>
          </div>

          {isFetching && (
            <p className="text-xs text-cyan-400 font-mono">
              Querying live certificate registry (`GET /api/v1/certificates/verify/{codeInput}`)...
            </p>
          )}

          {isError && codeInput.trim().length >= 8 && !isFetching && (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>
                No matching certificate found in the registry for <strong>{codeInput}</strong>. Please check the Certificate Number and try again.
              </span>
            </div>
          )}

          {verificationResult && !isError && (
            <div
              className={`rounded-2xl border-2 p-6 space-y-5 ${
                verificationResult.valid
                  ? 'border-emerald-500/60 bg-emerald-950/20'
                  : 'border-rose-500/60 bg-rose-950/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                    Saampark Institute • Verified Digital Credential
                  </p>
                  <h2 className="text-lg font-extrabold text-white mt-0.5">
                    {verificationResult.courseTitle} ({verificationResult.courseCode})
                  </h2>
                </div>
                <span
                  className={`px-3.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                    verificationResult.valid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {verificationResult.valid
                    ? 'AUTHENTIC & ACTIVE (ISSUED)'
                    : `INVALID (${verificationResult.status})`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Awarded Student (Legal Name)</span>
                  <strong className="text-base text-cyan-300 font-extrabold">
                    {verificationResult.studentName}
                  </strong>
                  {verificationResult.studentCode && (
                    <span className="block font-mono text-[11px] text-slate-400 mt-0.5">
                      Student ID: {verificationResult.studentCode}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Certificate Serial Number</span>
                  <strong className="text-sm font-mono text-emerald-400">
                    {verificationResult.certificateNumber}
                  </strong>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Issued On: {new Date(verificationResult.issuedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400">
                  Public Verification Permalink:{' '}
                  <code className="text-cyan-300 font-mono">{publicShareUrl}</code>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    printVerifiableCertificateDocument({
                      id: verificationResult.certificateNumber,
                      enrollmentId: '',
                      studentId: '',
                      studentName: verificationResult.studentName,
                      studentEmail: '',
                      studentCode: verificationResult.studentCode || null,
                      courseId: '',
                      courseCode: verificationResult.courseCode,
                      courseTitle: verificationResult.courseTitle,
                      certificateNumber: verificationResult.certificateNumber,
                      status: verificationResult.status,
                      fileReference: publicShareUrl,
                      issuedAt: verificationResult.issuedAt,
                      revokedAt: verificationResult.revokedAt,
                      revocationReason: verificationResult.revocationReason,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Official A4 Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 border-t border-slate-900 pt-4">
        Saampark Institute Public Credential Registry • Real-Time MySQL Verification (`GET /api/v1/certificates/verify/:certificateNumber`)
      </footer>
    </div>
  );
}

export function RoleCertificatesView({
  role,
}: {
  role: 'ADMIN' | 'STUDENT';
}) {
  const { data: certificates = [], isLoading } = useCertificatesQuery();
  const { data: enrollments = [] } = useEnrollmentsListQuery();
  const issueMutation = useIssueCertificateMutation();
  const revokeMutation = useRevokeCertificateMutation();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [verifyCodeInput, setVerifyCodeInput] = useState<string>('');
  const [printableCertId, setPrintableCertId] = useState<string>('');
  const [origin, setOrigin] = useState<string>('http://localhost:3000');
  const [copiedCertId, setCopiedCertId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const printableCert = certificates.find((c) => c.id === printableCertId) || null;
  const { data: verificationResult, isError: verifyError } =
    useVerifyCertificateQuery(verifyCodeInput);

  const buildPublicVerifyUrl = (certificateNumber: string) =>
    `${origin}/verify-certificate?code=${encodeURIComponent(certificateNumber)}`;

  const copyPublicVerifyLink = (cert: CertificateItem) => {
    const url = buildPublicVerifyUrl(cert.certificateNumber);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      setCopiedCertId(cert.id);
      setTimeout(() => setCopiedCertId(''), 2200);
    }
  };

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Certificate Registry`}
      operatorSubtitle="Public Verification URL & Standalone A4 Print (O-023)"
      headerTitle={
        role === 'ADMIN'
          ? 'Platform Certificate Issuance, Revocation & Public Verification Links'
          : 'My Verifiable Course Certificates & Public Verification Links'
      }
    >
      <div className="space-y-6">
        {/* Public / Live Certificate Verification Lookup */}
        <div className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" /> Verify Certificate Authenticity (`GET /api/v1/certificates/verify/:code`)
            </h2>
            <a
              href="/verify-certificate?code=CERT-ARGON-2026-PHYS401-0042"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25"
            >
              ↗ Open Public Verification Page (No Login Required)
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={verifyCodeInput}
              onChange={(e) => setVerifyCodeInput(e.target.value)}
              placeholder="Enter Certificate Number (e.g. CERT-ARGON-2026-PHYS401-0042)"
              className="flex-1 px-3.5 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
          </div>

          {verificationResult && !verifyError && (
            <div
              className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                verificationResult.valid
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              <div>
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Certificate {verificationResult.certificateNumber} —{' '}
                  {verificationResult.status}
                </p>
                <p className="mt-1">
                  Recipient: <strong>{verificationResult.studentName}</strong> • Course:{' '}
                  <strong>
                    {verificationResult.courseCode} ({verificationResult.courseTitle})
                  </strong>
                </p>
              </div>
              <span className="font-mono text-[11px]">
                Issued: {new Date(verificationResult.issuedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Admin Direct Certificate Issuance */}
        {role === 'ADMIN' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" /> Issue Certificate for Enrollment (`POST /api/v1/certificates/issue`)
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">Select Active/Completed Student Enrollment</option>
                {enrollments.map((enr) => (
                  <option key={enr.id} value={enr.id}>
                    {enr.studentFullName} — {enr.courseCode} ({enr.status})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedEnrollmentId || issueMutation.isPending}
                onClick={() => issueMutation.mutate(selectedEnrollmentId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
              >
                {issueMutation.isPending ? 'Issuing...' : 'Issue Verifiable Certificate'}
              </button>
            </div>
          </div>
        )}

        {/* Certificates Directory */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h3 className="text-sm font-bold mb-4">
            Issued Certificates &amp; Public Verification URLs (`GET /api/v1/certificates`)
          </h3>
          {isLoading && <p className="text-xs text-slate-500">Loading certificates...</p>}
          {!isLoading && certificates.length === 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" /> No certificates issued yet.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => {
              const publicVerifyUrl = buildPublicVerifyUrl(cert.certificateNumber);
              return (
                <div
                  key={cert.id}
                  className="p-5 rounded-2xl border border-emerald-500/30 bg-slate-50 dark:bg-slate-900/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {cert.certificateNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        cert.status === 'ISSUED'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {cert.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{cert.courseTitle}</h4>
                    <p className="text-xs text-slate-500">
                      Awarded to: <strong>{cert.studentName}</strong> ({cert.studentEmail})
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Shareable Public Verification Link Box */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px]">
                    <span className="text-slate-400 font-semibold block">
                      Public Verification Link (Share with Employers / LinkedIn):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={publicVerifyUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] text-cyan-400 border border-slate-300 dark:border-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => copyPublicVerifyLink(cert)}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold cursor-pointer shrink-0"
                      >
                        {copiedCertId === cert.id ? '✓ Copied!' : 'Copy Link'}
                      </button>
                      <a
                        href={`/verify-certificate?code=${encodeURIComponent(cert.certificateNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 font-semibold shrink-0"
                      >
                        ↗ Open
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPrintableCertId(cert.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-white cursor-pointer"
                    >
                      Preview Certificate
                    </button>

                    <button
                      type="button"
                      onClick={() => printVerifiableCertificateDocument(cert)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Standalone A4 Certificate
                    </button>

                    {role === 'ADMIN' && cert.status === 'ISSUED' && (
                      <button
                        type="button"
                        onClick={() =>
                          revokeMutation.mutate({
                            certificateId: cert.id,
                            revocationReason: 'Admin compliance audit revocation',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white cursor-pointer"
                      >
                        Revoke Certificate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Printable Verifiable Certificate of Completion Modal */}
        {printableCert && (
          <div className="rounded-2xl border-2 border-amber-500/60 bg-white dark:bg-[#111827] p-8 shadow-2xl space-y-6 text-center relative">
            <div className="max-w-2xl mx-auto space-y-3 border-2 border-dashed border-amber-500/40 rounded-2xl p-8">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
                Saampark Institute • Verifiable Academic Credential
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Certificate of Course Completion
              </h2>
              <p className="text-xs text-slate-500">This is to certify that</p>
              <p className="text-xl font-extrabold text-cyan-500 underline decoration-amber-500/50 underline-offset-8">
                {printableCert.studentName}
              </p>
              <p className="text-xs text-slate-500 pt-1">
                has successfully satisfied all attendance (≥75%) and examination proficiency (≥50%) requirements for
              </p>
              <p className="text-lg font-bold">
                {printableCert.courseTitle} ({printableCert.courseCode})
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-[11px] font-mono border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block">Certificate No.</span>
                  <strong className="text-emerald-400">{printableCert.certificateNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Issue Date</span>
                  <strong>{new Date(printableCert.issuedAt).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Verification Status</span>
                  <strong className="text-emerald-400">{printableCert.status} ✓</strong>
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-slate-400">
                Public Verification Link:{' '}
                <a
                  href={`/verify-certificate?code=${encodeURIComponent(printableCert.certificateNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 underline"
                >
                  {buildPublicVerifyUrl(printableCert.certificateNumber)}
                </a>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => printVerifiableCertificateDocument(printableCert)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Save Standalone A4 Certificate (PDF)
              </button>
              <button
                type="button"
                onClick={() => setPrintableCertId('')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}
