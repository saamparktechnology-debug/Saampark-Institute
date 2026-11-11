"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RolePanelShell } from "@/features/dashboards/components/RolePanelShell";
import {
  useCoursesListQuery,
  useEnrollmentsListQuery,
} from "@/features/courses/hooks/courses.hook";
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
  useSubmitAssignmentMutation,
  useSubmitExamAttemptMutation,
  useVerifyCertificateQuery,
} from "../hooks/assessments.hook";
import {
  EXAM_DURATION_PRESETS,
  SUBMISSION_DECISION_OPTIONS,
} from "../assessments.constant";
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
} from "lucide-react";

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 5 FORMS
// ----------------------------------------------------------------------------

const createAssignmentSchema = z.object({
  courseId: z.string().uuid("Select an assigned course"),
  title: z.string().trim().min(3, "Title is required").max(200),
  instructions: z.string().trim().min(10, "Detailed instructions required"),
  maxMarks: z.coerce.number().positive().max(1000).default(100),
  dueAt: z.string().min(10, "Due date is required"),
});
type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

const submitAssignmentSchema = z.object({
  submissionText: z
    .string()
    .trim()
    .min(5, "Enter your solution notes or derivation")
    .max(10000),
  fileName: z.string().trim().max(255).optional(),
});
type SubmitAssignmentValues = z.infer<typeof submitAssignmentSchema>;

const gradeSubmissionSchema = z.object({
  marksAwarded: z.coerce.number().min(0),
  feedback: z.string().trim().min(3, "Provide grading feedback").max(2000),
  status: z.enum(["GRADED", "RESUBMIT_REQUESTED"]).default("GRADED"),
});
type GradeSubmissionValues = z.infer<typeof gradeSubmissionSchema>;

const createExamSchema = z.object({
  courseId: z.string().uuid("Select an assigned course"),
  title: z.string().trim().min(3, "Exam title is required").max(200),
  summary: z
    .string()
    .trim()
    .min(5, "Exam instructions summary required")
    .max(1000),
  durationSeconds: z.coerce.number().int().min(300).default(3600),
  totalMarks: z.coerce.number().positive().default(100),
  passMarks: z.coerce.number().nonnegative().default(50),
  attemptLimit: z.coerce.number().int().min(1).max(5).default(1),
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
  role: "TEACHER" | "STUDENT";
}) {
  const { data: coursesData } = useCoursesListQuery();
  const {
    data: assignments = [],
    isLoading,
    isError,
    error,
  } = useAssignmentsQuery();

  const createAssignmentMutation = useCreateAssignmentMutation();
  const submitAssignmentMutation = useSubmitAssignmentMutation();
  const gradeSubmissionMutation = useGradeSubmissionMutation();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");

  const activeAssignment =
    assignments.find((a) => a.id === selectedAssignmentId) ||
    assignments[0] ||
    null;

  const defaultDue = new Date(Date.now() + 5 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);

  const createForm = useForm<CreateAssignmentValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      title: "",
      instructions: "",
      maxMarks: 100,
      dueAt: defaultDue,
    },
  });

  const submitForm = useForm<SubmitAssignmentValues>({
    resolver: zodResolver(submitAssignmentSchema),
    defaultValues: {
      submissionText: "",
      fileName: "solution_writeup.pdf",
    },
  });

  const gradeForm = useForm<GradeSubmissionValues>({
    resolver: zodResolver(gradeSubmissionSchema),
    defaultValues: {
      marksAwarded: 90,
      feedback: "Well-structured derivation and complete boundary conditions.",
      status: "GRADED",
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Assignments & Grading`}
      operatorSubtitle="Scoped Course Assessments (C-007)"
      headerTitle={
        role === "TEACHER"
          ? "Assignments & Student Evaluation Queues"
          : "My Course Assignments & Submissions"
      }
    >
      <div className="space-y-6">
        {role === "TEACHER" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" /> Create Course
              Assignment (`POST /api/v1/assignments`)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Publishes a new assignment to enrolled students in your assigned
              course.
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
                        title: "",
                        instructions: "",
                        maxMarks: 100,
                        dueAt: defaultDue,
                      }),
                  },
                ),
              )}
              className="grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              <select
                {...createForm.register("courseId")}
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
                {...createForm.register("title")}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <input
                type="datetime-local"
                {...createForm.register("dueAt")}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Max Marks"
                  {...createForm.register("maxMarks")}
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
                  {...createForm.register("instructions")}
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
              <ClipboardList className="w-4 h-4 text-cyan-400" /> Assignments
              (`GET /api/v1/assignments`)
            </h3>
            {isLoading && (
              <p className="text-xs text-slate-500">Loading assignments...</p>
            )}
            {isError && (
              <p className="text-xs text-rose-500">
                {(error as { message?: string })?.message ||
                  "Failed to load assignments."}
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
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-400">
                      {a.courseCode}
                    </span>
                    <span className="text-slate-400">
                      Max: {a.maxMarks} pts
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-1">{a.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Due: {new Date(a.dueAt).toLocaleDateString()}
                  </p>
                  {role === "STUDENT" && a.mySubmission && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                      {a.mySubmission.status}{" "}
                      {a.mySubmission.marksAwarded
                        ? `• ${a.mySubmission.marksAwarded}/${a.maxMarks}`
                        : ""}
                    </span>
                  )}
                  {role === "TEACHER" && (
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
                    {activeAssignment.courseCode} • Max Marks:{" "}
                    {activeAssignment.maxMarks}
                  </span>
                  <h3 className="text-base font-bold mt-1">
                    {activeAssignment.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeAssignment.instructions}
                  </p>
                </div>

                {role === "STUDENT" ? (
                  <div className="space-y-4">
                    {activeAssignment.mySubmission && (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400">
                            Attempt #
                            {activeAssignment.mySubmission.attemptNumber} —{" "}
                            {activeAssignment.mySubmission.status}
                          </span>
                          <span className="font-mono font-bold">
                            Score:{" "}
                            {activeAssignment.mySubmission.marksAwarded
                              ? `${activeAssignment.mySubmission.marksAwarded} / ${activeAssignment.maxMarks}`
                              : "Pending Teacher Evaluation"}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          {activeAssignment.mySubmission.submissionText}
                        </p>
                        {activeAssignment.mySubmission.feedback && (
                          <p className="text-cyan-400 font-semibold pt-1">
                            Instructor Feedback:{" "}
                            {activeAssignment.mySubmission.feedback}
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
                          { onSuccess: () => submitForm.reset() },
                        ),
                      )}
                      className="space-y-3"
                    >
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-violet-400" /> Submit
                        / Resubmit Assignment (`POST
                        /api/v1/assignments/:id/submit`)
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Write your derivation, answer summary, or notes..."
                        {...submitForm.register("submissionText")}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      />
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Attached File Name (e.g. problem_set_solution.pdf)"
                          {...submitForm.register("fileName")}
                          className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <button
                          type="submit"
                          disabled={submitAssignmentMutation.isPending}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
                        >
                          {submitAssignmentMutation.isPending
                            ? "Submitting..."
                            : "Submit Assignment"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold">
                      Student Submissions Queue (
                      {activeAssignment.submissions.length})
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
                                <span className="font-bold">
                                  {sub.studentName}
                                </span>{" "}
                                <span className="text-slate-500">
                                  ({sub.studentEmail})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">
                                  {sub.status}
                                </span>
                                {sub.marksAwarded && (
                                  <span className="font-mono font-bold text-emerald-400">
                                    {sub.marksAwarded} /{" "}
                                    {activeAssignment.maxMarks}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSubmissionId(sub.id)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]"
                                >
                                  Evaluate / Grade
                                </button>
                              </div>
                            </div>
                            <p className="text-slate-400">
                              {sub.submissionText}
                            </p>

                            {selectedSubmissionId === sub.id && (
                              <form
                                onSubmit={gradeForm.handleSubmit((vals) =>
                                  gradeSubmissionMutation.mutate(
                                    {
                                      submissionId: sub.id,
                                      ...vals,
                                    },
                                    {
                                      onSuccess: () =>
                                        setSelectedSubmissionId(""),
                                    },
                                  ),
                                )}
                                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-indigo-500/40 grid grid-cols-1 sm:grid-cols-4 gap-2.5"
                              >
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder={`Marks (Max ${activeAssignment.maxMarks})`}
                                  {...gradeForm.register("marksAwarded")}
                                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                                />
                                <select
                                  {...gradeForm.register("status")}
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
                                  {...gradeForm.register("feedback")}
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
// 2. EXAMINATIONS & RESULTS WORKSPACE (TEACHER & STUDENT — O-022)
// ============================================================================

export function RoleExamsAndResultsView({
  role,
}: {
  role: "TEACHER" | "STUDENT";
}) {
  const { data: coursesData } = useCoursesListQuery();
  const { data: exams = [], isLoading } = useExamsQuery();

  const createExamMutation = useCreateExamMutation();
  const submitAttemptMutation = useSubmitExamAttemptMutation();
  const evaluateAttemptMutation = useEvaluateExamAttemptMutation();

  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});

  const activeExam =
    exams.find((e) => e.id === selectedExamId) || exams[0] || null;

  const defaultStart = new Date().toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);

  const examForm = useForm<CreateExamValues>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      title: "",
      summary:
        "Timed examination covering core quantum operators and wavefunctions.",
      durationSeconds: 3600,
      totalMarks: 100,
      passMarks: 50,
      attemptLimit: 2,
      startsAt: defaultStart,
      endsAt: defaultEnd,
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Examinations & Results`}
      operatorSubtitle="Answer-Reveal Protection before resultPublishAt (O-022)"
      headerTitle={
        role === "TEACHER"
          ? "Examination Management, Question Banks & Result Publishing"
          : "Course Examinations, Timed Attempts & Published Results"
      }
    >
      <div className="space-y-6">
        {role === "TEACHER" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-500" /> Create Timed
              Examination (`POST /api/v1/exams`)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Correct option flags (`isCorrect`) are automatically stripped from
              student payloads until `resultPublishAt`.
            </p>

            <form
              onSubmit={examForm.handleSubmit((vals) =>
                createExamMutation.mutate(
                  {
                    ...vals,
                    startsAt: new Date(vals.startsAt).toISOString(),
                    endsAt: new Date(vals.endsAt).toISOString(),
                    resultPublishAt: vals.resultPublishAt
                      ? new Date(vals.resultPublishAt).toISOString()
                      : null,
                  },
                  { onSuccess: () => examForm.reset() },
                ),
              )}
              className="grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              <select
                {...examForm.register("courseId")}
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
                placeholder="Exam Title"
                {...examForm.register("title")}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <select
                {...examForm.register("durationSeconds")}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                {EXAM_DURATION_PRESETS.map((d) => (
                  <option key={d.value} value={d.value}>
                    Duration: {d.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={createExamMutation.isPending}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                + Publish Exam
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-bold">
              Examinations (`GET /api/v1/exams`)
            </h3>
            {isLoading && (
              <p className="text-xs text-slate-500">Loading exams...</p>
            )}
            <div className="space-y-2.5">
              {exams.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExamId(ex.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition ${
                    activeExam?.id === ex.id
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-400">
                      {ex.courseCode}
                    </span>
                    <span>
                      Pass: {ex.passMarks}/{ex.totalMarks}
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-1">{ex.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {ex.isResultPublished
                      ? "Results Published"
                      : "Results Locked until Publish Time"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {activeExam ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold">{activeExam.title}</h3>
                    <p className="text-xs text-slate-500">
                      {activeExam.summary}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      activeExam.isResultPublished
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {activeExam.isResultPublished ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Results
                        Published
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Answers Hidden Until
                        Publish
                      </>
                    )}
                  </span>
                </div>

                {/* Question Bank / Student Interactive Attempt */}
                <div className="space-y-3">
                  <p className="text-xs font-bold">
                    Examination Questions ({activeExam.questions.length})
                  </p>
                  {activeExam.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          Q{idx + 1}. {q.prompt}
                        </span>
                        <span className="font-mono text-slate-400">
                          {q.marks} Marks
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer ${
                              selectedAnswers[q.id] === opt.id
                                ? "border-violet-500 bg-violet-500/10"
                                : "border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {role === "STUDENT" && (
                                <input
                                  type="radio"
                                  name={`question_${q.id}`}
                                  checked={selectedAnswers[q.id] === opt.id}
                                  onChange={() =>
                                    setSelectedAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: opt.id,
                                    }))
                                  }
                                />
                              )}
                              <span>{opt.text}</span>
                            </span>
                            {opt.isCorrect && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                Correct Answer
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {role === "STUDENT" && (
                    <button
                      type="button"
                      onClick={() =>
                        submitAttemptMutation.mutate({
                          examId: activeExam.id,
                          answers: selectedAnswers,
                        })
                      }
                      disabled={submitAttemptMutation.isPending}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
                    >
                      {submitAttemptMutation.isPending
                        ? "Submitting & Auto-Grading..."
                        : "Submit Examination Attempt"}
                    </button>
                  )}
                </div>

                {/* Evaluated Exam Attempts / Results Table */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold mb-3">
                    Examination Attempts & Results ({activeExam.attempts.length}
                    )
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-2 px-3">Student</th>
                          <th className="py-2 px-3">Attempt #</th>
                          <th className="py-2 px-3">Score</th>
                          <th className="py-2 px-3">Grade</th>
                          <th className="py-2 px-3 text-right">
                            Status / Teacher Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {activeExam.attempts.map((att) => (
                          <tr key={att.id}>
                            <td className="py-2.5 px-3 font-semibold">
                              {att.studentName}
                            </td>
                            <td className="py-2.5 px-3">
                              #{att.attemptNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {att.score !== null
                                ? `${att.score} / ${activeExam.totalMarks}`
                                : "Locked until Publish"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                                {att.grade || "—"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {role === "TEACHER" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    evaluateAttemptMutation.mutate({
                                      attemptId: att.id,
                                      score: Number(
                                        att.score || activeExam.totalMarks,
                                      ),
                                      publishResultsNow: true,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]"
                                >
                                  Publish Result Now
                                </button>
                              ) : (
                                <span>{att.status}</span>
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
  role: "STUDENT" | "TEACHER";
}) {
  const { data, isLoading } = usePerformanceAnalyticsQuery();
  const issueCertMutation = useIssueCertificateMutation();

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Performance Analytics`}
      operatorSubtitle="Real-Time Academic Telemetry (C-011, C-013)"
      headerTitle={
        role === "STUDENT"
          ? "My Academic Performance & Certificate Eligibility"
          : "Student Cohort Performance & Instructor Metrics"
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <p className="text-xs text-slate-500">
            Loading performance metrics...
          </p>
        )}

        {role === "STUDENT" && data && (
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
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {card.eligibleForCertificate
                      ? "Certificate Eligible"
                      : "In Progress Toward Thresholds"}
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
                      onClick={() =>
                        issueCertMutation.mutate(card.enrollmentId)
                      }
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

        {role === "TEACHER" && data?.teacherMetrics && (
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
                <BarChart3 className="w-4 h-4 text-indigo-400" />{" "}
                Assigned-Course Student Performance Matrix (`GET
                /api/v1/exams/performance`)
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
                          {row.studentName}{" "}
                          <span className="text-slate-500 font-normal">
                            ({row.studentEmail})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {row.courseCode}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {row.assignmentAvgPercent}%
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {row.examAvgPercent}%
                        </td>
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
// ============================================================================

export function RoleCertificatesView({ role }: { role: "ADMIN" | "STUDENT" }) {
  const { data: certificates = [], isLoading } = useCertificatesQuery();
  const { data: enrollments = [] } = useEnrollmentsListQuery();
  const issueMutation = useIssueCertificateMutation();
  const revokeMutation = useRevokeCertificateMutation();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [verifyCodeInput, setVerifyCodeInput] = useState<string>(
    "CERT-ARGON-2026-PHYS401-0042",
  );
  const { data: verificationResult, isError: verifyError } =
    useVerifyCertificateQuery(verifyCodeInput);

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Certificate Registry`}
      operatorSubtitle="Verifiable Certificate Numbers (O-023)"
      headerTitle={
        role === "ADMIN"
          ? "Platform Certificate Issuance, Revocation & Verification"
          : "My Verifiable Course Certificates"
      }
    >
      <div className="space-y-6">
        {/* Public / Live Certificate Verification Lookup */}
        <div className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" /> Live Certificate
            Authenticity Verifier (`GET
            /api/v1/certificates/verify/:certificateNumber`)
          </h2>
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
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              <div>
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Certificate{" "}
                  {verificationResult.certificateNumber} —{" "}
                  {verificationResult.status}
                </p>
                <p className="mt-1">
                  Recipient: <strong>{verificationResult.studentName}</strong> •
                  Course:{" "}
                  <strong>
                    {verificationResult.courseCode} (
                    {verificationResult.courseTitle})
                  </strong>
                </p>
              </div>
              <span className="font-mono text-[11px]">
                Issued:{" "}
                {new Date(verificationResult.issuedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Admin Direct Certificate Issuance */}
        {role === "ADMIN" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" /> Issue Certificate
              for Enrollment (`POST /api/v1/certificates/issue`)
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">
                  Select Active/Completed Student Enrollment
                </option>
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
              >
                {issueMutation.isPending
                  ? "Issuing..."
                  : "Issue Verifiable Certificate"}
              </button>
            </div>
          </div>
        )}

        {/* Certificates Directory */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h3 className="text-sm font-bold mb-4">
            Issued Certificates (`GET /api/v1/certificates`)
          </h3>
          {isLoading && (
            <p className="text-xs text-slate-500">Loading certificates...</p>
          )}
          {!isLoading && certificates.length === 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" /> No certificates issued yet.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
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
                      cert.status === "ISSUED"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {cert.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">{cert.courseTitle}</h4>
                  <p className="text-xs text-slate-500">
                    Awarded to: <strong>{cert.studentName}</strong> (
                    {cert.studentEmail})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                  </p>
                </div>

                {role === "ADMIN" && cert.status === "ISSUED" && (
                  <button
                    type="button"
                    onClick={() =>
                      revokeMutation.mutate({
                        certificateId: cert.id,
                        revocationReason: "Admin compliance audit revocation",
                      })
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white"
                  >
                    Revoke Certificate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}
