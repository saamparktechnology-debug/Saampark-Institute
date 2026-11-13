'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { operationsService } from '../services/operations.service';
import { TicketPriorityType, TicketStatusType } from '../types/operations.types';

export function useSupportTicketsQuery(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.operations.tickets(filters),
    queryFn: () => operationsService.listTickets(filters),
  });
}

export function useCreateSupportTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.createTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useTriageTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      status,
      priority,
      assignedToId,
      escalatedTo,
    }: {
      ticketId: string;
      status?: TicketStatusType;
      priority?: TicketPriorityType;
      assignedToId?: string | null;
      escalatedTo?: string | null;
    }) =>
      operationsService.triageTicket(ticketId, {
        status,
        priority,
        assignedToId,
        escalatedTo,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function usePostTicketMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      message,
      isInternalNote,
    }: {
      ticketId: string;
      message: string;
      isInternalNote: boolean;
    }) =>
      operationsService.postTicketMessage(ticketId, {
        message,
        isInternalNote,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });
}

export function useSupportAgentsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.supportAgents(),
    queryFn: () => operationsService.listSupportAgents(),
  });
}

export function useSupportContextLookupQuery() {
  return useQuery({
    queryKey: queryKeys.operations.supportContextLookup(),
    queryFn: () => operationsService.getSupportContextLookup(),
  });
}

export function useSupportResolutionReportsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.supportReports(),
    queryFn: () => operationsService.getSupportResolutionReports(),
  });
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.notifications(),
    queryFn: () => operationsService.listNotifications(),
  });
}

export function useDispatchNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.dispatchNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.deliveryLogs() });
    },
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      operationsService.markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => operationsService.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}

export function useOmnichannelSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.omnichannelSettings(),
    queryFn: () => operationsService.getOmnichannelSettings(),
  });
}

export function useUpdateOmnichannelSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.updateOmnichannelSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.omnichannelSettings(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.notifications(),
      });
    },
  });
}

export function useOmnichannelDeliveryLogsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.deliveryLogs(),
    queryFn: () => operationsService.listOmnichannelDeliveryLogs(),
  });
}

export function useTestOmnichannelDispatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.sendTestOmnichannelAlert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.deliveryLogs() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}

export function useNudgeStudentOmnichannelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.nudgeStudentOmnichannel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.deliveryLogs() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.notifications() });
    },
  });
}

export function useCalendarEventsQuery() {
  return useQuery({
    queryKey: queryKeys.operations.calendarEvents(),
    queryFn: () => operationsService.listCalendarEvents(),
  });
}

export function useMyProfileQuery() {
  return useQuery({
    queryKey: queryKeys.operations.profile(),
    queryFn: () => operationsService.getMyProfile(),
  });
}

export function useUpdateMyProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.updateMyProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.profile() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useRbacMatrixQuery() {
  return useQuery({
    queryKey: queryKeys.operations.rbacMatrix(),
    queryFn: () => operationsService.getRbacMatrix(),
  });
}

export function useCreateRbacPermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.createRbacPermission,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.rbacMatrix() });
    },
  });
}

export function useToggleRolePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operationsService.toggleRolePermission,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.rbacMatrix() });
    },
  });
}
