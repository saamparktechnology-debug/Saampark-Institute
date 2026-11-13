'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { liveLearningService } from '../services/live-learning.service';

export function useLiveClassesQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.liveLearning.liveClasses(filters),
    queryFn: () => liveLearningService.listLiveClasses(filters),
  });
}

export function useLiveClassParticipantsQuery(liveClassId: string) {
  return useQuery({
    queryKey: queryKeys.liveLearning.participants(liveClassId),
    queryFn: () => liveLearningService.listParticipants(liveClassId),
    enabled: Boolean(liveClassId),
  });
}

export function useCreateLiveClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: liveLearningService.createLiveClass,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useUpdateLiveClassStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      liveClassId,
      status,
    }: {
      liveClassId: string;
      status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
    }) => liveLearningService.updateLiveClassStatus(liveClassId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useIssueLiveJoinTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (liveClassId: string) => liveLearningService.issueJoinToken(liveClassId),
    onSuccess: (_data, liveClassId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liveLearning.participants(liveClassId),
      });
    },
  });
}

export function useLeaveLiveClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (liveClassId: string) => liveLearningService.leaveLiveClass(liveClassId),
    onSuccess: (_data, liveClassId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liveLearning.participants(liveClassId),
      });
    },
  });
}

export function useRecordingsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.liveLearning.recordings(filters),
    queryFn: () => liveLearningService.listRecordings(filters),
  });
}

export function useCreateRecordingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: liveLearningService.createRecording,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
    },
  });
}

export function useUpdateRecordingStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordingId,
      status,
    }: {
      recordingId: string;
      status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    }) => liveLearningService.updateRecordingStatus(recordingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
    },
  });
}

export function useSaveWatchProgressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordingId,
      lastPositionSeconds,
      watchedSeconds,
      completed,
    }: {
      recordingId: string;
      lastPositionSeconds: number;
      watchedSeconds: number;
      completed?: boolean;
    }) =>
      liveLearningService.saveWatchProgress(recordingId, {
        lastPositionSeconds,
        watchedSeconds,
        completed,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
    },
  });
}

export function useAttendanceSessionsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.liveLearning.attendanceSessions(filters),
    queryFn: () => liveLearningService.listAttendanceSessions(filters),
  });
}

export function useGenerateAttendanceCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: liveLearningService.generateSessionCode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useSubmitAttendanceCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, code }: { sessionId: string; code: string }) =>
      liveLearningService.submitAttendanceCode(sessionId, code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useManualAttendanceOverrideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      studentId,
      status,
      correctionReason,
    }: {
      sessionId: string;
      studentId: string;
      status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
      correctionReason: string;
    }) =>
      liveLearningService.manualOverrideAttendance(sessionId, {
        studentId,
        status,
        correctionReason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useUpdateAttendanceSessionStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: 'OPEN' | 'CLOSED' | 'FINALIZED';
    }) => liveLearningService.updateAttendanceSessionStatus(sessionId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useDispatchLowAttendanceAlertsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { courseId?: string }) =>
      liveLearningService.dispatchLowAttendanceAlerts(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.liveLearning.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}
