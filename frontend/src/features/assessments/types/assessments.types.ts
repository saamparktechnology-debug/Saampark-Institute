export interface AssignmentSubmissionItem {
  id: string;
  assignmentId?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  submissionText: string | null;
  fileStorageKey: string | null;
  attemptNumber: number;
  status: 'SUBMITTED' | 'LATE' | 'GRADED' | 'RESUBMIT_REQUESTED';
  marksAwarded: string | null;
  feedback: string | null;
  gradedByName: string | null;
  submittedAt: string;
  gradedAt: string | null;
}

export interface AssignmentItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  instructions: string;
  maxMarks: string;
  dueAt: string;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  pendingCount: number;
  gradedCount: number;
  mySubmission: AssignmentSubmissionItem | null;
  submissions: AssignmentSubmissionItem[];
}

export interface ExamQuestionOptionItem {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ExamQuestionDto {
  id: string;
  questionType: 'MCQ_SINGLE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  prompt: string;
  marks: number;
  options: ExamQuestionOptionItem[];
}

export type ExamQuestionItem = ExamQuestionDto;

export interface ExamProctoringViolationEvent {
  type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY_PASTE_BLOCKED';
  occurredAt: string;
  detail?: string;
}

export interface ExamAttemptItem {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED';
  score: string | null;
  grade: string | null;
  startedAt: string;
  submittedAt: string | null;
  evaluatedAt: string | null;
  savedAnswers?: Record<string, string>;
  remainingSeconds?: number | null;
  tabSwitchCount?: number;
  fullscreenExits?: number;
  copyPasteBlockedCount?: number;
  autoSubmittedByProctor?: boolean;
  integrityStatus?: 'CLEAN' | 'WARNING' | 'FLAGGED_VIOLATION';
  violations?: ExamProctoringViolationEvent[];
}

export interface ExamItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  summary: string;
  maxTabSwitches?: number;
  durationSeconds: number;
  totalMarks: string;
  passMarks: string;
  attemptLimit: number;
  startsAt: string;
  endsAt: string;
  resultPublishAt: string | null;
  isResultPublished: boolean;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  questions: ExamQuestionDto[];
  attempts: ExamAttemptItem[];
}

export interface PerformanceAnalyticsData {
  role: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  courseProgressCards: Array<{
    enrollmentId: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    attendancePercent: number;
    minAttendancePercent: number;
    assignmentAvgPercent: number;
    bestExamPercent: number;
    minPassMarksPercent: number;
    eligibleForCertificate: boolean;
    certificateNumber: string | null;
  }>;
  teacherMetrics: {
    assignedCoursesCount: number;
    activeStudentsCount: number;
    gradedSubmissionsCount: number;
    evaluatedExamsCount: number;
    liveClassesHostedCount: number;
    overallCohortAveragePercent: number;
  } | null;
  cohortStudentMatrix: Array<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    courseCode: string;
    courseTitle: string;
    assignmentAvgPercent: number;
    examAvgPercent: number;
    combinedScorePercent: number;
    grade: string;
  }>;
}

export interface CertificateItem {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentCode: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  certificateNumber: string;
  status: 'ISSUED' | 'REVOKED';
  fileReference: string | null;
  publicVerificationPath?: string;
  issuedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface CertificateVerificationResult {
  valid: boolean;
  certificateNumber: string;
  status: 'ISSUED' | 'REVOKED';
  studentName: string;
  studentCode?: string | null;
  courseCode: string;
  courseTitle: string;
  courseLevel?: string;
  minAttendancePercent?: string;
  minPassMarksPercent?: string;
  publicVerificationPath?: string;
  issuedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
}
