import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AssignmentItem,
  CertificateItem,
  CertificateVerificationResult,
  ExamItem,
  ExamProctoringViolationEvent,
  ExamQuestionItem,
  PerformanceAnalyticsData,
} from '../types/assessments.types';

/**
 * 100% API-driven service for Phase 5, Phase 10 & Phase 11 Assignments,
 * Standard CBT Examinations (with Dynamic Question Bank Builder, Proctoring & Auto-Save),
 * Performance Analytics & Verifiable Certificates.
 * Zero hardcoded mock arrays.
 */
export const assessmentsService = {
  // 1. Assignments & Grading Queues
  async listAssignments(params?: Record<string, string | number>): Promise<AssignmentItem[]> {
    const res = await apiClient.get<ApiEnvelope<AssignmentItem[]>>('/assignments', { params });
    return res.data.data;
  },

  async createAssignment(payload: {
    courseId: string;
    title: string;
    instructions: string;
    maxMarks: number;
    dueAt: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/assignments', payload);
    return res.data.data;
  },

  async submitAssignment(
    assignmentId: string,
    payload: { submissionText: string; fileName?: string }
  ) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/assignments/${assignmentId}/submit`,
      payload
    );
    return res.data.data;
  },

  async gradeSubmission(
    submissionId: string,
    payload: {
      marksAwarded: number;
      feedback: string;
      status: 'GRADED' | 'RESUBMIT_REQUESTED';
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/assignments/submissions/${submissionId}/grade`,
      payload
    );
    return res.data.data;
  },

  // 2. Examinations, Dynamic Question Bank, Proctoring Auto-Save & Results
  async listExams(params?: Record<string, string | number>): Promise<ExamItem[]> {
    const res = await apiClient.get<ApiEnvelope<ExamItem[]>>('/exams', { params });
    return res.data.data;
  },

  async createExam(payload: {
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
    maxTabSwitches?: number;
    questions?: ExamQuestionItem[];
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/exams', payload);
    return res.data.data;
  },

  async saveExamProgress(
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
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/exams/${examId}/save-progress`,
      payload
    );
    return res.data.data;
  },

  async submitExamAttempt(
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
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/exams/${examId}/submit-attempt`,
      payload
    );
    return res.data.data;
  },

  async evaluateExamAttempt(
    attemptId: string,
    payload: { score: number; publishResultsNow: boolean }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/exams/attempts/${attemptId}/evaluate`,
      payload
    );
    return res.data.data;
  },

  async getPerformanceAnalytics(): Promise<PerformanceAnalyticsData> {
    const res = await apiClient.get<ApiEnvelope<PerformanceAnalyticsData>>('/exams/performance');
    return res.data.data;
  },

  // 3. Verifiable Course Certificates
  async listCertificates(): Promise<CertificateItem[]> {
    const res = await apiClient.get<ApiEnvelope<CertificateItem[]>>('/certificates');
    return res.data.data;
  },

  async issueCertificate(enrollmentId: string) {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/certificates/issue', {
      enrollmentId,
    });
    return res.data.data;
  },

  async revokeCertificate(certificateId: string, revocationReason: string) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/certificates/${certificateId}/revoke`,
      { revocationReason }
    );
    return res.data.data;
  },

  async verifyCertificate(certificateNumber: string): Promise<CertificateVerificationResult> {
    const res = await apiClient.get<ApiEnvelope<CertificateVerificationResult>>(
      `/certificates/verify/${encodeURIComponent(certificateNumber)}`
    );
    return res.data.data;
  },
};
