import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AdminSummaryData,
  StudentSummaryData,
  SupportSummaryData,
  TeacherSummaryData,
} from '../types/dashboards.types';

/**
 * Pure API service — zero hardcoded fallback data.
 * Errors propagate directly to TanStack Query error states.
 */
export const dashboardsService = {
  async getAdminSummary(): Promise<AdminSummaryData> {
    const res = await apiClient.get<ApiEnvelope<AdminSummaryData>>('/dashboards/admin/summary');
    return res.data.data;
  },

  async getStudentSummary(): Promise<StudentSummaryData> {
    const res = await apiClient.get<ApiEnvelope<StudentSummaryData>>('/dashboards/student/summary');
    return res.data.data;
  },

  async getTeacherSummary(): Promise<TeacherSummaryData> {
    const res = await apiClient.get<ApiEnvelope<TeacherSummaryData>>('/dashboards/teacher/summary');
    return res.data.data;
  },

  async getSupportSummary(): Promise<SupportSummaryData> {
    const res = await apiClient.get<ApiEnvelope<SupportSummaryData>>('/dashboards/support/summary');
    return res.data.data;
  },
};
