'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { dashboardsService } from '../services/dashboards.service';

export function useAdminDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboards.admin(),
    queryFn: () => dashboardsService.getAdminSummary(),
  });
}

export function useStudentDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboards.student(),
    queryFn: () => dashboardsService.getStudentSummary(),
  });
}

export function useTeacherDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboards.teacher(),
    queryFn: () => dashboardsService.getTeacherSummary(),
  });
}

export function useSupportDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboards.support(),
    queryFn: () => dashboardsService.getSupportSummary(),
  });
}
