import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AttendanceSessionItem,
  ClassRecordingItem,
  GeneratedAttendanceCodeResult,
  LiveClassItem,
  LiveClassParticipantItem,
  LiveRoomJoinTicket,
} from '../types/live-learning.types';

/**
 * 100% API-driven service for Phase 4 Live Learning (100ms), YouTube Recordings & Session Attendance.
 * Zero hardcoded mock arrays.
 */
export const liveLearningService = {
  // 1. Live Classes (100ms Adapter)
  async listLiveClasses(params?: Record<string, string | number>): Promise<LiveClassItem[]> {
    const res = await apiClient.get<ApiEnvelope<LiveClassItem[]>>('/live-classes', { params });
    return res.data.data;
  },

  async createLiveClass(payload: {
    courseId: string;
    teacherId?: string;
    title: string;
    description?: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
  }): Promise<LiveClassItem> {
    const res = await apiClient.post<ApiEnvelope<LiveClassItem>>('/live-classes', payload);
    return res.data.data;
  },

  async updateLiveClassStatus(
    liveClassId: string,
    status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
  ): Promise<LiveClassItem> {
    const res = await apiClient.patch<ApiEnvelope<LiveClassItem>>(
      `/live-classes/${liveClassId}/status`,
      { status }
    );
    return res.data.data;
  },

  async issueJoinToken(liveClassId: string): Promise<LiveRoomJoinTicket> {
    const res = await apiClient.post<ApiEnvelope<LiveRoomJoinTicket>>(
      `/live-classes/${liveClassId}/join-token`
    );
    return res.data.data;
  },

  async leaveLiveClass(liveClassId: string): Promise<{
    participantId: string;
    liveClassId: string;
    joinedAt: string;
    leftAt: string;
    durationSeconds: number;
  }> {
    const res = await apiClient.post<
      ApiEnvelope<{
        participantId: string;
        liveClassId: string;
        joinedAt: string;
        leftAt: string;
        durationSeconds: number;
      }>
    >(`/live-classes/${liveClassId}/leave`);
    return res.data.data;
  },

  async listParticipants(liveClassId: string): Promise<LiveClassParticipantItem[]> {
    const res = await apiClient.get<ApiEnvelope<LiveClassParticipantItem[]>>(
      `/live-classes/${liveClassId}/participants`
    );
    return res.data.data;
  },

  // 2. YouTube Recorded Classes
  async listRecordings(params?: Record<string, string | number>): Promise<ClassRecordingItem[]> {
    const res = await apiClient.get<ApiEnvelope<ClassRecordingItem[]>>('/recordings', { params });
    return res.data.data;
  },

  async createRecording(payload: {
    courseId: string;
    liveClassId?: string | null;
    title: string;
    youtubeUrlOrId: string;
    durationSeconds: number;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  }): Promise<ClassRecordingItem> {
    const res = await apiClient.post<ApiEnvelope<ClassRecordingItem>>('/recordings', payload);
    return res.data.data;
  },

  async updateRecordingStatus(
    recordingId: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  ): Promise<ClassRecordingItem> {
    const res = await apiClient.patch<ApiEnvelope<ClassRecordingItem>>(
      `/recordings/${recordingId}/status`,
      { status }
    );
    return res.data.data;
  },

  // 3. Session Attendance Codes & Audited Manual Overrides
  async listAttendanceSessions(
    params?: Record<string, string | number>
  ): Promise<AttendanceSessionItem[]> {
    const res = await apiClient.get<ApiEnvelope<AttendanceSessionItem[]>>('/attendance/sessions', {
      params,
    });
    return res.data.data;
  },

  async generateSessionCode(payload: {
    courseId: string;
    liveClassId?: string | null;
    expiryMinutes: number;
  }): Promise<GeneratedAttendanceCodeResult> {
    const res = await apiClient.post<ApiEnvelope<GeneratedAttendanceCodeResult>>(
      '/attendance/sessions',
      payload
    );
    return res.data.data;
  },

  async submitAttendanceCode(
    sessionId: string,
    code: string
  ): Promise<{
    recordId: string;
    attendanceSessionId: string;
    courseTitle: string;
    status: string;
    source: string;
    markedAt: string;
  }> {
    const res = await apiClient.post<
      ApiEnvelope<{
        recordId: string;
        attendanceSessionId: string;
        courseTitle: string;
        status: string;
        source: string;
        markedAt: string;
      }>
    >(`/attendance/sessions/${sessionId}/submit-code`, { code });
    return res.data.data;
  },

  async manualOverrideAttendance(
    sessionId: string,
    payload: {
      studentId: string;
      status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
      correctionReason: string;
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/attendance/sessions/${sessionId}/override`,
      payload
    );
    return res.data.data;
  },

  async updateAttendanceSessionStatus(
    sessionId: string,
    status: 'OPEN' | 'CLOSED' | 'FINALIZED'
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/attendance/sessions/${sessionId}/status`,
      { status }
    );
    return res.data.data;
  },
};
