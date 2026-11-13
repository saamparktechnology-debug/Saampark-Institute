'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useActiveSessionsQuery,
  useChangePasswordMutation,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from '@/features/auth/hooks/auth.hook';
import { RolePanelType } from '@/features/auth/types/auth.types';
import {
  useCalendarEventsQuery,
  useCreateRbacPermissionMutation,
  useCreateSupportTicketMutation,
  useDispatchNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyProfileQuery,
  useNotificationsQuery,
  usePostTicketMessageMutation,
  useRbacMatrixQuery,
  useSupportAgentsQuery,
  useSupportContextLookupQuery,
  useSupportResolutionReportsQuery,
  useSupportTicketsQuery,
  useToggleRolePermissionMutation,
  useTriageTicketMutation,
  useUpdateMyProfileMutation,
} from '../hooks/operations.hook';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../operations.constant';
import {
  TicketCategoryType,
  TicketPriorityType,
  TicketStatusType,
} from '../types/operations.types';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Shield,
  UserCheck,
  UserCog,
  BarChart3,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 6 FORMS
// ----------------------------------------------------------------------------

const createTicketSchema = z.object({
  category: z.enum([
    'STUDENT_QUERY',
    'TEACHER_QUERY',
    'PAYMENT_ISSUE',
    'ENROLLMENT_ISSUE',
    'COURSE_ISSUE',
    'LIVE_CLASS_ISSUE',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT_RED']).default('MEDIUM'),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().trim().min(10, 'Detailed description is required').max(5000),
});
type CreateTicketValues = z.infer<typeof createTicketSchema>;

const createPermissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9._-]+$/, 'Lowercase dot/underscore format (e.g. support.ticket.escalate)'),
  module: z.string().trim().min(2).max(64),
  description: z.string().trim().min(5).max(255),
});
type CreatePermissionValues = z.infer<typeof createPermissionSchema>;

// ============================================================================
// 1. SUPPORT COMMAND WORKSPACE VIEW (ALL 13 /support/* ROUTES)
// ============================================================================

export function SupportCommandWorkspaceView({
  initialCategory,
  initialStatus,
  viewMode = 'TRIAGE',
  headerTitle = 'Support Command & Ticket Triage Center',
}: {
  initialCategory?: TicketCategoryType;
  initialStatus?: TicketStatusType;
  viewMode?:
    | 'TRIAGE'
    | 'ASSIGNMENT'
    | 'INTERNAL_NOTES'
    | 'COMM_HISTORY'
    | 'ESCALATIONS'
    | 'REPORTS';
  headerTitle?: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || '');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || '');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isInternalNote, setIsInternalNote] = useState<boolean>(
    viewMode === 'INTERNAL_NOTES'
  );
  const [escalationTarget, setEscalationTarget] = useState<string>(
    'Finance & Academic Operations Lead'
  );

  const queryFilters: Record<string, string> = {};
  if (categoryFilter) queryFilters.category = categoryFilter;
  if (statusFilter) queryFilters.status = statusFilter;

  const { data: tickets = [], isLoading } = useSupportTicketsQuery(queryFilters);
  const { data: agents = [] } = useSupportAgentsQuery();
  const { data: contextLookup } = useSupportContextLookupQuery();
  const { data: reports } = useSupportResolutionReportsQuery();

  const triageMutation = useTriageTicketMutation();
  const postMessageMutation = usePostTicketMessageMutation();

  const activeTicket =
    tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null;

  return (
    <RolePanelShell
      role="SUPPORT"
      operatorName="Support Command Center"
      operatorSubtitle="SLA Triage & Read-Only Finance Context"
      headerTitle={headerTitle}
    >
      <div className="space-y-6">
        {/* Filter Bar & Quick Category/Status Switcher */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">All Ticket Categories</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">All Statuses</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Matching Tickets: <strong>{tickets.length}</strong>
            </span>
            <span className="text-rose-500 font-bold">
              SLA Breach Risks:{' '}
              {tickets.filter((t) => t.isSlaBreachRisk).length}
            </span>
          </div>
        </div>

        {/* Support Resolution & SLA Reports Section */}
        {reports && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Total Platform Tickets</p>
              <p className="text-2xl font-extrabold mt-1">{reports.totalTickets}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Resolved / Closed Tickets</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                {reports.resolvedTickets}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Average Resolution Time</p>
              <p className="text-2xl font-extrabold text-cyan-400 mt-1">
                {reports.averageResolutionMinutes} mins
              </p>
            </div>
          </div>
        )}

        {/* Main Ticket Triage & Internal Note Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Ticket Queue List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h2 className="text-sm font-bold">
              Support Queue (`GET /api/v1/support/tickets`)
            </h2>
            {isLoading && <p className="text-xs text-slate-500">Loading tickets...</p>}
            {!isLoading && tickets.length === 0 && (
              <p className="text-xs text-slate-500 py-6 text-center">
                No tickets match the selected filters.
              </p>
            )}

            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition ${
                    activeTicket?.id === t.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-amber-400">
                      {t.ticketNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        t.priority === 'URGENT_RED' || t.isSlaBreachRisk
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-cyan-500/15 text-cyan-400'
                      }`}
                    >
                      {t.priority} • {t.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-1">{t.subject}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t.createdByName} ({t.createdByRole}) • {t.category}
                  </p>
                  {t.isSlaBreachRisk && (
                    <p className="text-[11px] text-rose-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> SLA Due in {t.slaRemainingMinutes}m
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right 2 Columns: Active Ticket Triage, Agent Assignment, Escalation & Messages */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {activeTicket ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {activeTicket.ticketNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-semibold">
                        {activeTicket.category}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">
                        {activeTicket.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold mt-1">{activeTicket.subject}</h3>
                    <p className="text-xs text-slate-500 mt-1">{activeTicket.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Reporter: <strong>{activeTicket.createdByName}</strong> (
                      {activeTicket.createdByEmail}) • Assignee:{' '}
                      <strong>{activeTicket.assignedToName || 'Unassigned'}</strong>
                    </p>
                  </div>

                  {/* Quick Status & Agent Assignment Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={activeTicket.assignedToId || ''}
                      onChange={(e) =>
                        triageMutation.mutate({
                          ticketId: activeTicket.id,
                          assignedToId: e.target.value || null,
                          status: 'IN_TRIAGE',
                        })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Assign Support Agent...</option>
                      {agents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.fullName} ({ag.openAssignedTicketsCount}/
                          {ag.maxConcurrentTickets})
                        </option>
                      ))}
                    </select>

                    {(['IN_TRIAGE', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          triageMutation.mutate({
                            ticketId: activeTicket.id,
                            status: st,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700"
                      >
                        Mark {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Escalation Bar */}
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      Escalation Target:{' '}
                      <strong>{activeTicket.escalatedTo || 'Not escalated'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={escalationTarget}
                      onChange={(e) => setEscalationTarget(e.target.value)}
                      placeholder="Escalate to department/lead..."
                      className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        triageMutation.mutate({
                          ticketId: activeTicket.id,
                          status: 'ESCALATED',
                          priority: 'URGENT_RED',
                          escalatedTo: escalationTarget,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white shrink-0"
                    >
                      Escalate Ticket
                    </button>
                  </div>
                </div>

                {/* Conversation Thread & Internal Collaboration Notes */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> Communication History & Internal Notes ({activeTicket.messages.length})
                  </h4>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {activeTicket.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border text-xs ${
                          m.isInternalNote
                            ? 'border-amber-500/40 bg-amber-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold">
                            {m.senderName} ({m.senderRole})
                          </span>
                          <span className="flex items-center gap-1.5">
                            {m.isInternalNote && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Internal Support Note (Hidden from User)
                              </span>
                            )}
                            <span className="text-slate-400">
                              {new Date(m.createdAt).toLocaleString()}
                            </span>
                          </span>
                        </div>
                        <p>{m.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reply / Internal Note Composer */}
                  <div className="pt-2 space-y-2.5">
                    <textarea
                      rows={2}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? 'Write an internal triage note visible only to Support & Admin...'
                          : 'Write a reply to the student/teacher...'
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                        />
                        <span className="font-semibold text-amber-400">
                          Post as Internal Collaboration Note (`isInternalNote = true`)
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={!messageText.trim() || postMessageMutation.isPending}
                        onClick={() =>
                          postMessageMutation.mutate(
                            {
                              ticketId: activeTicket.id,
                              message: messageText,
                              isInternalNote,
                            },
                            { onSuccess: () => setMessageText('') }
                          )
                        }
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-500 text-white flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />{' '}
                        {isInternalNote ? 'Save Internal Note' : 'Send Public Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Select a ticket from the queue to inspect or triage.
              </p>
            )}
          </div>
        </div>

        {/* Read-Only Payment, Installment & Enrollment Context Lookup (C-013, C-014) */}
        {contextLookup && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" /> Read-Only Billing & Enrollment Reference Lookup (`GET /api/v1/support/context-lookup` — No Financial Mutation Access)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <p className="font-bold text-slate-400">Recent Enrollments & Installment Status</p>
                {contextLookup.enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800"
                  >
                    <span>
                      <strong>{e.studentName}</strong> — {e.courseCode} ({e.planType})
                    </span>
                    <span className="font-mono text-emerald-400">
                      {e.status} • ₹{e.purchasedPriceInr}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <p className="font-bold text-slate-400">
                  Recent Payment Receipts & Masked UPI Redemptions
                </p>
                {contextLookup.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800"
                  >
                    <span>
                      <strong>{p.studentName}</strong> ({p.provider}) —{' '}
                      <code className="text-cyan-400">{p.receiptNumber || p.providerPaymentId}</code>
                    </span>
                    <span className="font-mono">
                      ₹{p.amountInr} ({p.status})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. STUDENT & TEACHER HELP & SUPPORT PORTAL (/student/support & /teacher/support)
// ============================================================================

export function RoleHelpAndSupportView({
  role,
}: {
  role: 'STUDENT' | 'TEACHER';
}) {
  const { data: tickets = [], isLoading } = useSupportTicketsQuery();
  const createTicketMutation = useCreateSupportTicketMutation();
  const postMessageMutation = usePostTicketMessageMutation();

  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');

  const activeTicket =
    tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null;

  const ticketForm = useForm<CreateTicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      category: role === 'STUDENT' ? 'STUDENT_QUERY' : 'TEACHER_QUERY',
      priority: 'MEDIUM',
      subject: '',
      description: '',
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Help & Support`}
      operatorSubtitle="Own-Ticket Scope (Internal Notes Stripped)"
      headerTitle="Help Desk & Support Tickets"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-500" /> Raise a New Support Ticket (`POST /api/v1/support/tickets`)
          </h2>
          <form
            onSubmit={ticketForm.handleSubmit((vals) =>
              createTicketMutation.mutate(vals, {
                onSuccess: () => ticketForm.reset(),
              })
            )}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3"
          >
            <select
              {...ticketForm.register('category')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              {...ticketForm.register('priority')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Brief Subject"
              {...ticketForm.register('subject')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />

            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Describe your question, payment reference, or classroom issue..."
                {...ticketForm.register('description')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={createTicketMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
            >
              {createTicketMutation.isPending ? 'Submitting Ticket...' : 'Submit Support Ticket'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-bold">Your Tickets ({tickets.length})</h3>
            {isLoading && <p className="text-xs text-slate-500">Loading your tickets...</p>}
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTicketId(t.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition ${
                  activeTicket?.id === t.id
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-bold text-cyan-400">{t.ticketNumber}</span>
                  <span>{t.status}</span>
                </div>
                <p className="text-xs font-bold mt-1">{t.subject}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            {activeTicket ? (
              <>
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="font-mono text-xs text-cyan-400">
                    {activeTicket.ticketNumber} • {activeTicket.status}
                  </span>
                  <h3 className="text-base font-bold mt-1">{activeTicket.subject}</h3>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto">
                  {activeTicket.messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <p className="font-bold text-[11px] text-slate-400">
                        {m.senderName} ({m.senderRole})
                      </p>
                      <p className="mt-1">{m.message}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Add a reply to Support..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    disabled={!replyText.trim() || postMessageMutation.isPending}
                    onClick={() =>
                      postMessageMutation.mutate(
                        {
                          ticketId: activeTicket.id,
                          message: replyText,
                          isInternalNote: false,
                        },
                        { onSuccess: () => setReplyText('') }
                      )
                    }
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white"
                  >
                    Send Reply
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                No support tickets opened yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. NOTIFICATIONS CENTER VIEW (STUDENT / TEACHER / SUPPORT)
// ============================================================================

export function RoleNotificationsView({ role }: { role: RolePanelType }) {
  const { data, isLoading } = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllMutation = useMarkAllNotificationsReadMutation();
  const dispatchMutation = useDispatchNotificationMutation();

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Notifications`}
      operatorSubtitle="In-App & Email Alerts (C-010)"
      headerTitle="Notifications & System Alerts"
    >
      <div className="space-y-6">
        {role !== 'STUDENT' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" /> Dispatch Role Announcement (`POST /api/v1/notifications`)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Announcement Title"
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              <input
                type="text"
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Notification Body"
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              <button
                type="button"
                disabled={!broadcastTitle.trim() || !broadcastBody.trim()}
                onClick={() =>
                  dispatchMutation.mutate(
                    {
                      targetRole: 'STUDENT',
                      title: broadcastTitle,
                      body: broadcastBody,
                      channel: 'IN_APP',
                    },
                    {
                      onSuccess: () => {
                        setBroadcastTitle('');
                        setBroadcastBody('');
                      },
                    }
                  )
                }
                className="py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Broadcast to Students
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-400" /> Your Inbox (`GET /api/v1/notifications` — Unread: {data?.unreadCount ?? 0})
            </h2>
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white"
            >
              Mark All Read
            </button>
          </div>

          {isLoading && <p className="text-xs text-slate-500">Loading notifications...</p>}
          <div className="space-y-2.5">
            {data?.items.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
                  n.readAt
                    ? 'border-slate-200 dark:border-slate-800 opacity-75'
                    : 'border-violet-500/40 bg-violet-500/10'
                }`}
              >
                <div>
                  <span className="font-mono text-[10px] text-cyan-400">
                    {n.type} • {n.channel}
                  </span>
                  <p className="font-bold mt-0.5">{n.title}</p>
                  <p className="text-slate-500 dark:text-slate-300 mt-0.5">{n.body}</p>
                </div>
                {!n.readAt ? (
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate(n.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white shrink-0"
                  >
                    Mark Read
                  </button>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. UNIFIED SCHEDULE & CALENDAR VIEW (STUDENT & TEACHER — C-012)
// ============================================================================

export function RoleCalendarView({ role }: { role: 'STUDENT' | 'TEACHER' }) {
  const { data: events = [], isLoading } = useCalendarEventsQuery();

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Schedule & Calendar`}
      operatorSubtitle="Timezone: Asia/Kolkata (C-012)"
      headerTitle="Unified Academic & Financial Schedule"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" /> Chronological Schedule (`GET /api/v1/calendar/events`)
        </h2>
        {isLoading && <p className="text-xs text-slate-500">Loading schedule events...</p>}
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono font-bold text-[11px]">
                    {ev.eventType}
                  </span>
                  <span className="font-mono text-slate-400">{ev.courseCode}</span>
                </div>
                <p className="font-bold text-sm mt-1">{ev.title}</p>
                <p className="text-slate-500">{ev.courseTitle}</p>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-400">
                <p className="flex items-center sm:justify-end gap-1 text-emerald-400 font-semibold">
                  <Clock className="w-3.5 h-3.5" /> {new Date(ev.startsAt).toLocaleString()}
                </p>
                <p>Status: {ev.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 5. PROFILE, STUDENT ANALYTICS DEMOGRAPHICS & SECURITY VIEW (STUDENT & TEACHER)
// ============================================================================

const INDIAN_STATES_LIST = [
  'West Bengal',
  'Maharashtra',
  'Karnataka',
  'Delhi',
  'Tamil Nadu',
  'Telangana',
  'Gujarat',
  'Uttar Pradesh',
  'Rajasthan',
  'Kerala',
  'Haryana',
  'Punjab',
  'Bihar',
  'Odisha',
  'Assam',
  'Madhya Pradesh',
];

export function RoleProfileAndSettingsView({
  role,
}: {
  role: 'STUDENT' | 'TEACHER';
}) {
  const { data: profile, isLoading } = useMyProfileQuery();
  const updateProfileMutation = useUpdateMyProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const { data: activeSessions = [] } = useActiveSessionsQuery();
  const revokeSessionMutation = useRevokeSessionMutation();
  const revokeOthersMutation = useRevokeOtherSessionsMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');

  // Student Analytics & Demographic Fields (Privacy-Safe: No Aadhaar / PAN)
  const [pinCode, setPinCode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('West Bengal');
  const [highestQualification, setHighestQualification] = useState('');
  const [institutionOrCompany, setInstitutionOrCompany] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [careerGoal, setCareerGoal] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');

  React.useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setPhone(profile.phone || '');
      if (profile.studentProfile) {
        setPinCode(profile.studentProfile.pinCode || '');
        setCity(profile.studentProfile.city || '');
        setStateName(profile.studentProfile.state || 'West Bengal');
        setHighestQualification(
          profile.studentProfile.highestQualification ||
            profile.studentProfile.gradeLevel ||
            ''
        );
        setInstitutionOrCompany(profile.studentProfile.institutionOrCompany || '');
        setGraduationYear(profile.studentProfile.graduationYear || '');
        setCareerGoal(profile.studentProfile.careerGoal || '');
        setReferralSource(profile.studentProfile.referralSource || '');
        setGuardianName(profile.studentProfile.guardianName || '');
        setGuardianPhone(profile.studentProfile.guardianPhone || '');
        setAddress(profile.studentProfile.address || '');
      }
      if (profile.teacherProfile) {
        setSpecialization(profile.teacherProfile.specialization || '');
        setQualification(profile.teacherProfile.qualification || '');
      }
    }
  }, [profile]);

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Profile & Settings`}
      operatorSubtitle="Identity, Academic Analytics & Security"
      headerTitle="My Profile, Academic Background & Account Security"
    >
      <div className="max-w-4xl space-y-6">
        {isLoading && <p className="text-xs text-slate-500">Loading your profile...</p>}
        {profile && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold">{profile.fullName}</h2>
                <p className="text-xs text-slate-500">{profile.email}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400">
                {profile.studentProfile?.studentCode ||
                  profile.teacherProfile?.teacherCode ||
                  profile.role}
              </span>
            </div>

            {/* Identity & Contact Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">Registered Legal Name</label>
                  {role === 'STUDENT' && (
                    <span className="text-[10px] font-bold text-amber-500">
                      🔒 Locked (Admin Only)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={fullName}
                  readOnly={role === 'STUDENT'}
                  disabled={role === 'STUDENT'}
                  onChange={(e) => {
                    if (role !== 'STUDENT') setFullName(e.target.value);
                  }}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    role === 'STUDENT'
                      ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                  }`}
                />
                {role === 'STUDENT' && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your name appears on official certificates and tax invoices. Contact an Administrator if a correction is needed.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Mobile / WhatsApp Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-9876543210"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            {/* Student Academic, Regional & Career Analytics Fields (Zero Aadhaar/PAN) */}
            {role === 'STUDENT' ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <h3 className="text-sm font-bold">
                    Academic, Regional &amp; Career Profile (For Personalized Learning &amp; Cohort Insights)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Helps us tailor course cohorts, regional GST tax invoices, and placement/study support. We never ask for government IDs (no Aadhaar or PAN).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Postal PIN Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 700091"
                      className="w-full px-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">City / Town</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kolkata"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">State / Union Territory</label>
                    <select
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      {INDIAN_STATES_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Current / Highest Qualification</label>
                    <select
                      value={highestQualification}
                      onChange={(e) => setHighestQualification(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Select Qualification</option>
                      <option value="High School (10+2)">High School (10+2)</option>
                      <option value="Diploma">Diploma</option>
                      <option value="B.Tech / B.E.">B.Tech / B.E.</option>
                      <option value="B.Sc / BCA">B.Sc / BCA</option>
                      <option value="M.Tech / M.Sc / MCA">M.Tech / M.Sc / MCA</option>
                      <option value="MBA / PGDM">MBA / PGDM</option>
                      <option value="Ph.D. / Research Scholar">Ph.D. / Research Scholar</option>
                      <option value="Working Professional">Working Professional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">College / University / Organization</label>
                    <input
                      type="text"
                      value={institutionOrCompany}
                      onChange={(e) => setInstitutionOrCompany(e.target.value)}
                      placeholder="e.g. Jadavpur University"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Graduation Year</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 2026"
                      className="w-full px-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Primary Learning / Career Goal</label>
                    <select
                      value={careerGoal}
                      onChange={(e) => setCareerGoal(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Select Primary Goal</option>
                      <option value="Software & AI Engineering">Software &amp; AI Engineering</option>
                      <option value="Data Science & Analytics">Data Science &amp; Analytics</option>
                      <option value="Cyber Security & Cloud">Cyber Security &amp; Cloud</option>
                      <option value="Core Sciences & Research">Core Sciences &amp; Research</option>
                      <option value="Competitive Exams (GATE / NET / JEE)">
                        Competitive Exams (GATE / NET / JEE)
                      </option>
                      <option value="Career Transition / Job Readiness">
                        Career Transition / Job Readiness
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">How Did You Hear About Us?</label>
                    <select
                      value={referralSource}
                      onChange={(e) => setReferralSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Select Discovery Channel</option>
                      <option value="Friend / Student Referral">Friend / Student Referral</option>
                      <option value="YouTube Channel">YouTube Channel</option>
                      <option value="LinkedIn / Instagram">LinkedIn / Instagram</option>
                      <option value="Google Search">Google Search</option>
                      <option value="College Seminar / Workshop">College Seminar / Workshop</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Parent / Guardian Name</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent / Guardian Name"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Parent / Guardian Phone</label>
                    <input
                      type="text"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="+91-9876500000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold mb-1">Residential Address / Locality</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Apartment, Street, Locality"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block font-semibold mb-1">Faculty Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Faculty Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={updateProfileMutation.isPending}
                onClick={() => {
                  setProfileSavedMsg('');
                  updateProfileMutation.mutate(
                    role === 'STUDENT'
                      ? {
                          phone,
                          gradeLevel: highestQualification,
                          highestQualification,
                          pinCode,
                          city,
                          state: stateName,
                          institutionOrCompany,
                          graduationYear,
                          careerGoal,
                          referralSource,
                          guardianName,
                          guardianPhone,
                          address,
                        }
                      : {
                          fullName,
                          phone,
                          qualification,
                          specialization,
                        },
                    {
                      onSuccess: () =>
                        setProfileSavedMsg('Profile & analytics details saved successfully ✓'),
                    }
                  );
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-white cursor-pointer"
              >
                {updateProfileMutation.isPending ? 'Saving Profile...' : 'Save Profile Changes'}
              </button>
              {profileSavedMsg && (
                <span className="text-xs font-bold text-emerald-500">{profileSavedMsg}</span>
              )}
            </div>

            {/* Change Account Password Card */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Change Account Password
              </h3>
              {pwdSuccessMsg && (
                <p className="text-xs font-semibold text-emerald-400">{pwdSuccessMsg}</p>
              )}
              {changePasswordMutation.isError && (
                <p className="text-xs text-rose-400">
                  {(changePasswordMutation.error as { message?: string })?.message ||
                    'Password update failed. Check your current password.'}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current Password"
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (Min 8 chars, 1 upper, 1 digit)"
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  disabled={!currentPassword || newPassword.length < 8 || changePasswordMutation.isPending}
                  onClick={() =>
                    changePasswordMutation.mutate(
                      { currentPassword, newPassword },
                      {
                        onSuccess: () => {
                          setCurrentPassword('');
                          setNewPassword('');
                          setPwdSuccessMsg('Password updated successfully ✓');
                        },
                      }
                    )
                  }
                  className="py-2 px-4 rounded-xl font-bold bg-emerald-600 text-white cursor-pointer"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>

            {/* Active Device Login Sessions Manager */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  Active Login Sessions &amp; Device Security
                </h3>
                {activeSessions.length > 1 && (
                  <button
                    type="button"
                    disabled={revokeOthersMutation.isPending}
                    onClick={() => revokeOthersMutation.mutate()}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white cursor-pointer"
                  >
                    Revoke All Other Devices
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                {activeSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-cyan-400">
                          {sess.rolePanel} Session
                        </span>
                        {sess.isCurrentSession && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        IP: {sess.ipAddress || '127.0.0.1'} • Agent:{' '}
                        {(sess.userAgent || 'Browser').slice(0, 60)}
                      </p>
                    </div>
                    {!sess.isCurrentSession && (
                      <button
                        type="button"
                        onClick={() => revokeSessionMutation.mutate(sess.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 font-bold text-[11px] cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 6. ADMIN RBAC PERMISSION MATRIX VIEW (/admin/roles — C-025)
// ============================================================================

export function AdminRbacPermissionsView() {
  const { data: permissions = [], isLoading } = useRbacMatrixQuery();
  const createPermMutation = useCreateRbacPermissionMutation();
  const toggleRoleMutation = useToggleRolePermissionMutation();

  const permForm = useForm<CreatePermissionValues>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: {
      code: '',
      module: 'FINANCE',
      description: '',
    },
  });

  const allRoles: Array<'ADMIN' | 'TEACHER' | 'STUDENT' | 'SUPPORT'> = [
    'ADMIN',
    'TEACHER',
    'STUDENT',
    'SUPPORT',
  ];

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="RBAC Security Architect"
      operatorSubtitle="5-Layer Permission Guard (C-025)"
      headerTitle="Granular Role & Permission Matrix"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <UserCog className="w-4 h-4 text-emerald-500" /> Register Granular Permission Code (`POST /api/v1/calendar/rbac/permissions`)
          </h2>
          <form
            onSubmit={permForm.handleSubmit((vals) =>
              createPermMutation.mutate(
                { ...vals, roles: ['ADMIN'] },
                { onSuccess: () => permForm.reset() }
              )
            )}
            className="grid grid-cols-1 md:grid-cols-4 gap-3"
          >
            <input
              type="text"
              placeholder="Code (e.g. courses.publish)"
              {...permForm.register('code')}
              className="px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <input
              type="text"
              placeholder="Module (e.g. ACADEMICS)"
              {...permForm.register('module')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <input
              type="text"
              placeholder="Permission description"
              {...permForm.register('description')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <button
              type="submit"
              disabled={createPermMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 text-white"
            >
              + Create Permission
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" /> Role Permission Matrix (`GET/POST /api/v1/calendar/rbac`)
          </h3>
          {isLoading && <p className="text-xs text-slate-500">Loading RBAC matrix...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Permission Code</th>
                  <th className="py-2 px-3">Module</th>
                  <th className="py-2 px-3">Description</th>
                  {allRoles.map((r) => (
                    <th key={r} className="py-2 px-3 text-center">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {permissions.map((perm) => (
                  <tr key={perm.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                      {perm.code}
                    </td>
                    <td className="py-2.5 px-3">{perm.module}</td>
                    <td className="py-2.5 px-3 text-slate-500">{perm.description}</td>
                    {allRoles.map((role) => {
                      const isGranted = perm.assignedRoles.includes(role);
                      return (
                        <td key={role} className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isGranted}
                            onChange={(e) =>
                              toggleRoleMutation.mutate({
                                role,
                                permissionId: perm.id,
                                granted: e.target.checked,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}
