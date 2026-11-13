'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { assessmentsService } from '../services/assessments.service';
import { ExamProctoringViolationEvent } from '../types/assessments.types';

export function useAssignmentsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.assessments.assignments(filters),
    queryFn: () => assessmentsService.listAssignments(filters),
  });
}

export function useCreateAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentsService.createAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useSubmitAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      submissionText,
      fileName,
    }: {
      assignmentId: string;
      submissionText: string;
      fileName?: string;
    }) =>
      assessmentsService.submitAssignment(assignmentId, {
        submissionText,
        fileName,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useGradeSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      marksAwarded,
      feedback,
      status,
    }: {
      submissionId: string;
      marksAwarded: number;
      feedback: string;
      status: 'GRADED' | 'RESUBMIT_REQUESTED';
    }) =>
      assessmentsService.gradeSubmission(submissionId, {
        marksAwarded,
        feedback,
        status,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useExamsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.assessments.exams(filters),
    queryFn: () => assessmentsService.listExams(filters),
  });
}

export function useCreateExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentsService.createExam,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
    },
  });
}

export function useSaveExamProgressMutation() {
  return useMutation({
    mutationFn: ({
      examId,
      answers,
      remainingSeconds,
      tabSwitchCount,
      fullscreenExits,
      copyPasteBlockedCount,
      violations,
    }: {
      examId: string;
      answers: Record<string, string>;
      remainingSeconds?: number | null;
      tabSwitchCount?: number;
      fullscreenExits?: number;
      copyPasteBlockedCount?: number;
      violations?: ExamProctoringViolationEvent[];
    }) =>
      assessmentsService.saveExamProgress(examId, {
        answers,
        remainingSeconds,
        tabSwitchCount,
        fullscreenExits,
        copyPasteBlockedCount,
        violations,
      }),
  });
}

export function useSubmitExamAttemptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      examId,
      answers,
      tabSwitchCount,
      fullscreenExits,
      copyPasteBlockedCount,
      autoSubmittedByProctor,
      violations,
    }: {
      examId: string;
      answers: Record<string, string>;
      tabSwitchCount?: number;
      fullscreenExits?: number;
      copyPasteBlockedCount?: number;
      autoSubmittedByProctor?: boolean;
      violations?: ExamProctoringViolationEvent[];
    }) =>
      assessmentsService.submitExamAttempt(examId, {
        answers,
        tabSwitchCount,
        fullscreenExits,
        copyPasteBlockedCount,
        autoSubmittedByProctor,
        violations,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useEvaluateExamAttemptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      score,
      publishResultsNow,
    }: {
      attemptId: string;
      score: number;
      publishResultsNow: boolean;
    }) =>
      assessmentsService.evaluateExamAttempt(attemptId, {
        score,
        publishResultsNow,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function usePerformanceAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.assessments.performance(),
    queryFn: () => assessmentsService.getPerformanceAnalytics(),
  });
}

export function useCertificatesQuery() {
  return useQuery({
    queryKey: queryKeys.assessments.certificates(),
    queryFn: () => assessmentsService.listCertificates(),
  });
}

export function useIssueCertificateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) => assessmentsService.issueCertificate(enrollmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
    },
  });
}

export function useRevokeCertificateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      certificateId,
      revocationReason,
    }: {
      certificateId: string;
      revocationReason: string;
    }) => assessmentsService.revokeCertificate(certificateId, revocationReason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
    },
  });
}

export function useVerifyCertificateQuery(certificateNumber: string) {
  return useQuery({
    queryKey: queryKeys.assessments.verifyCertificate(certificateNumber),
    queryFn: () => assessmentsService.verifyCertificate(certificateNumber),
    enabled: Boolean(certificateNumber.trim().length >= 8),
  });
}
