'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { systemService } from '../services/system.service';

export function useExecutiveReportsQuery() {
  return useQuery({
    queryKey: queryKeys.system.reports(),
    queryFn: () => systemService.getExecutiveReports(),
  });
}

export function useExportDatasetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: systemService.exportDataset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
    },
  });
}

export function useAuditLogsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.system.auditLogs(filters),
    queryFn: () => systemService.listAuditLogs(filters),
  });
}

export function usePlatformSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.system.settings(),
    queryFn: () => systemService.getPlatformSettings(),
  });
}

export function useUpdatePlatformSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: systemService.updatePlatformSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.settings() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
    },
  });
}

export function useVpsReadinessQuery() {
  return useQuery({
    queryKey: queryKeys.system.vpsReadiness(),
    queryFn: () => systemService.getVpsReadiness(),
  });
}

export function useSendInstallmentRemindersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.sendInstallmentReminders(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.deliveryLogs() });
    },
  });
}
