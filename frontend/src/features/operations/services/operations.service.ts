import { apiClient } from '@/lib/axios';
import { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  CalendarEventItem,
  NotificationsData,
  OmnichannelDeliveryLogItem,
  OmnichannelEventType,
  OmnichannelSettingsData,
  RbacPermissionItem,
  SupportAgentItem,
  SupportContextLookupData,
  SupportResolutionReportData,
  SupportTicketItem,
  TicketCategoryType,
  TicketPriorityType,
  TicketStatusType,
  UserProfileDetailData,
} from '../types/operations.types';

/**
 * 100% API-driven service for Support Ticket Queues, SLA Monitoring,
 * Omnichannel (Email + WhatsApp + In-App) Notifications, Unified Calendar, Profile & RBAC Matrix.
 */
export const operationsService = {
  // 1. Support Tickets & Triage
  async listTickets(params?: Record<string, string | number>): Promise<SupportTicketItem[]> {
    const res = await apiClient.get<ApiEnvelope<SupportTicketItem[]>>('/support/tickets', {
      params,
    });
    return res.data.data;
  },

  async createTicket(payload: {
    category: TicketCategoryType;
    priority: TicketPriorityType;
    subject: string;
    description: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/support/tickets', payload);
    return res.data.data;
  },

  async triageTicket(
    ticketId: string,
    payload: {
      status?: TicketStatusType;
      priority?: TicketPriorityType;
      assignedToId?: string | null;
      escalatedTo?: string | null;
    }
  ) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/support/tickets/${ticketId}/triage`,
      payload
    );
    return res.data.data;
  },

  async postTicketMessage(
    ticketId: string,
    payload: { message: string; isInternalNote: boolean }
  ) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      `/support/tickets/${ticketId}/messages`,
      payload
    );
    return res.data.data;
  },

  async listSupportAgents(): Promise<SupportAgentItem[]> {
    const res = await apiClient.get<ApiEnvelope<SupportAgentItem[]>>('/support/agents');
    return res.data.data;
  },

  async getSupportContextLookup(): Promise<SupportContextLookupData> {
    const res = await apiClient.get<ApiEnvelope<SupportContextLookupData>>(
      '/support/context-lookup'
    );
    return res.data.data;
  },

  async getSupportResolutionReports(): Promise<SupportResolutionReportData> {
    const res = await apiClient.get<ApiEnvelope<SupportResolutionReportData>>('/support/reports');
    return res.data.data;
  },

  // 2. Notifications & Omnichannel (Email + WhatsApp + In-App) Controls
  async listNotifications(): Promise<NotificationsData> {
    const res = await apiClient.get<ApiEnvelope<NotificationsData>>('/notifications');
    return res.data.data;
  },

  async dispatchNotification(payload: {
    targetRole?: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
    title: string;
    body: string;
    channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/notifications', payload);
    return res.data.data;
  },

  async markNotificationRead(notificationId: string) {
    const res = await apiClient.patch<ApiEnvelope<unknown>>(
      `/notifications/${notificationId}/read`
    );
    return res.data.data;
  },

  async markAllNotificationsRead() {
    const res = await apiClient.post<ApiEnvelope<unknown>>('/notifications/read-all');
    return res.data.data;
  },

  async getOmnichannelSettings(): Promise<OmnichannelSettingsData> {
    const res = await apiClient.get<ApiEnvelope<OmnichannelSettingsData>>(
      '/notifications/settings'
    );
    return res.data.data;
  },

  async updateOmnichannelSettings(
    payload: Partial<Omit<OmnichannelSettingsData, 'updatedAt' | 'updatedBy'>>
  ): Promise<OmnichannelSettingsData> {
    const res = await apiClient.patch<ApiEnvelope<OmnichannelSettingsData>>(
      '/notifications/settings',
      payload
    );
    return res.data.data;
  },

  async listOmnichannelDeliveryLogs(): Promise<OmnichannelDeliveryLogItem[]> {
    const res = await apiClient.get<ApiEnvelope<OmnichannelDeliveryLogItem[]>>(
      '/notifications/delivery-logs'
    );
    return res.data.data;
  },

  async sendTestOmnichannelAlert(payload: {
    eventType: OmnichannelEventType;
    courseId?: string;
    title?: string;
    body?: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      '/notifications/test-dispatch',
      payload
    );
    return res.data.data;
  },

  async nudgeStudentOmnichannel(payload: {
    studentId: string;
    courseCode?: string;
    eventType?: OmnichannelEventType;
    title: string;
    body: string;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      '/notifications/nudge-student',
      payload
    );
    return res.data.data;
  },

  // 3. Calendar, Profile & RBAC Matrix
  async listCalendarEvents(): Promise<CalendarEventItem[]> {
    const res = await apiClient.get<ApiEnvelope<CalendarEventItem[]>>('/calendar/events');
    return res.data.data;
  },

  async getMyProfile(): Promise<UserProfileDetailData> {
    const res = await apiClient.get<ApiEnvelope<UserProfileDetailData>>('/calendar/profile');
    return res.data.data;
  },

  async updateMyProfile(payload: {
    fullName?: string;
    phone?: string | null;
    gradeLevel?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    address?: string | null;
    pinCode?: string | null;
    city?: string | null;
    state?: string | null;
    highestQualification?: string | null;
    institutionOrCompany?: string | null;
    graduationYear?: string | null;
    careerGoal?: string | null;
    referralSource?: string | null;
    qualification?: string | null;
    specialization?: string | null;
    biography?: string | null;
    department?: string | null;
  }): Promise<UserProfileDetailData> {
    const res = await apiClient.patch<ApiEnvelope<UserProfileDetailData>>(
      '/calendar/profile',
      payload
    );
    return res.data.data;
  },

  async getRbacMatrix(): Promise<RbacPermissionItem[]> {
    const res = await apiClient.get<ApiEnvelope<RbacPermissionItem[]>>('/calendar/rbac');
    return res.data.data;
  },

  async createRbacPermission(payload: {
    code: string;
    module: string;
    description: string;
    roles: Array<'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT'>;
  }) {
    const res = await apiClient.post<ApiEnvelope<unknown>>(
      '/calendar/rbac/permissions',
      payload
    );
    return res.data.data;
  },

  async toggleRolePermission(payload: {
    role: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
    permissionId: string;
    granted: boolean;
  }): Promise<RbacPermissionItem[]> {
    const res = await apiClient.post<ApiEnvelope<RbacPermissionItem[]>>(
      '/calendar/rbac/role-grants',
      payload
    );
    return res.data.data;
  },
};
