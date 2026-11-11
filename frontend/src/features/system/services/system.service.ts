import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  AuditLogItem,
  DatasetExportResult,
  ExecutiveReportsData,
  PlatformSettingsItem,
  VpsReadinessData,
} from '../types/system.types';

/**
 * 100% API-driven service for Phase 7 Executive Reports, CSV/JSON Exports,
 * Append-Only Audit Log Explorer, Configurable Platform Settings, and VPS Readiness.
 */
export const systemService = {
  async getExecutiveReports(): Promise<ExecutiveReportsData> {
    const res = await apiClient.get<ApiEnvelope<ExecutiveReportsData>>('/system/reports');
    return res.data.data;
  },

  async exportDataset(params: {
    dataset: 'payments' | 'enrollments' | 'payouts' | 'attendance' | 'audit_logs';
    format: 'csv' | 'json';
  }): Promise<DatasetExportResult> {
    const res = await apiClient.get<ApiEnvelope<DatasetExportResult>>(
      '/system/reports/export',
      { params }
    );
    return res.data.data;
  },

  async listAuditLogs(params?: Record<string, string | number>): Promise<{
    items: AuditLogItem[];
    meta: Record<string, unknown> | null;
  }> {
    const res = await apiClient.get<ApiEnvelope<AuditLogItem[]>>('/system/audit-logs', {
      params,
    });
    return { items: res.data.data, meta: res.data.meta };
  },

  async getPlatformSettings(): Promise<PlatformSettingsItem> {
    const res = await apiClient.get<ApiEnvelope<PlatformSettingsItem>>('/system/settings');
    return res.data.data;
  },

  async updatePlatformSettings(
    payload: Omit<PlatformSettingsItem, 'updatedAt' | 'updatedBy'>
  ): Promise<PlatformSettingsItem> {
    const res = await apiClient.patch<ApiEnvelope<PlatformSettingsItem>>(
      '/system/settings',
      payload
    );
    return res.data.data;
  },

  async getVpsReadiness(): Promise<VpsReadinessData> {
    const res = await apiClient.get<ApiEnvelope<VpsReadinessData>>('/system/vps-readiness');
    return res.data.data;
  },
};
