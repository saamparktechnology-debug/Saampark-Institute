'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import { useCoursesListQuery } from '@/features/courses/hooks/courses.hook';
import {
  useAttendanceSessionsQuery,
  useCreateLiveClassMutation,
  useCreateRecordingMutation,
  useGenerateAttendanceCodeMutation,
  useIssueLiveJoinTokenMutation,
  useLeaveLiveClassMutation,
  useLiveClassesQuery,
  useLiveClassParticipantsQuery,
  useManualAttendanceOverrideMutation,
  useRecordingsQuery,
  useSubmitAttendanceCodeMutation,
  useUpdateAttendanceSessionStatusMutation,
  useUpdateLiveClassStatusMutation,
  useUpdateRecordingStatusMutation,
} from '../hooks/live-learning.hook';
import {
  ATTENDANCE_EXPIRY_PRESETS,
  ATTENDANCE_MARK_STATUS_OPTIONS,
} from '../live-learning.constant';
import {
  GeneratedAttendanceCodeResult,
  LiveRoomJoinTicket,
} from '../types/live-learning.types';
import {
  Video,
  PlayCircle,
  KeyRound,
  Users,
  CheckCircle2,
  Clock,
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
  Radio,
  LogOut,
  Plus,
  Edit3,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 4 FORMS
// ----------------------------------------------------------------------------

const scheduleLiveClassSchema = z.object({
  courseId: z.string().uuid('Select a course'),
  title: z.string().trim().min(3, 'Session title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  scheduledStartAt: z.string().min(10, 'Start date/time is required'),
  scheduledEndAt: z.string().min(10, 'End date/time is required'),
});
type ScheduleLiveClassValues = z.infer<typeof scheduleLiveClassSchema>;

const createRecordingSchema = z.object({
  courseId: z.string().uuid('Select an assigned course'),
  liveClassId: z.string().optional(),
  title: z.string().trim().min(3, 'Recording title is required').max(200),
  youtubeUrlOrId: z
    .string()
    .trim()
    .min(11, 'Enter an 11-char YouTube ID (e.g. M7lc1UVf-VE) or watch URL'),
  durationSeconds: z.coerce.number().int().min(0).default(2700),
});
type CreateRecordingValues = z.infer<typeof createRecordingSchema>;

const generateAttendanceCodeSchema = z.object({
  courseId: z.string().uuid('Select an assigned course'),
  liveClassId: z.string().optional(),
  expiryMinutes: z.coerce.number().int().min(1).max(120).default(10),
});
type GenerateAttendanceCodeValues = z.infer<typeof generateAttendanceCodeSchema>;

const submitAttendanceCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit numeric attendance code'),
});
type SubmitAttendanceCodeValues = z.infer<typeof submitAttendanceCodeSchema>;

const manualOverrideSchema = z.object({
  studentId: z.string().uuid('Select an enrolled student'),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
  correctionReason: z
    .string()
    .trim()
    .min(5, 'Mandatory audit reason (min 5 characters) required'),
});
type ManualOverrideValues = z.infer<typeof manualOverrideSchema>;

// ============================================================================
// 1. LIVE CLASSES & 100MS ROOM WORKSPACE (ADMIN / TEACHER / STUDENT)
// ============================================================================

export function RoleLiveClassesView({
  role,
}: {
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
}) {
  const { data: coursesData } = useCoursesListQuery();
  const {
    data: liveClasses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useLiveClassesQuery();

  const createLiveMutation = useCreateLiveClassMutation();
  const updateStatusMutation = useUpdateLiveClassStatusMutation();
  const joinTokenMutation = useIssueLiveJoinTokenMutation();
  const leaveClassMutation = useLeaveLiveClassMutation();

  const [activeTicket, setActiveTicket] = useState<LiveRoomJoinTicket | null>(null);
  const [selectedLogClassId, setSelectedLogClassId] = useState<string>('');
  const { data: participants = [] } = useLiveClassParticipantsQuery(selectedLogClassId);

  const defaultStart = new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16);

  const scheduleForm = useForm<ScheduleLiveClassValues>({
    resolver: zodResolver(scheduleLiveClassSchema),
    defaultValues: {
      title: '',
      description: '',
      scheduledStartAt: defaultStart,
      scheduledEndAt: defaultEnd,
    },
  });

  const canSchedule = role === 'ADMIN' || role === 'TEACHER';

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Live Classroom`}
      operatorSubtitle="100ms Provider Adapter (HMS_100MS)"
      headerTitle={
        role === 'STUDENT'
          ? 'Live Classes & 100ms Interactive Rooms'
          : 'Live Class Scheduling, 100ms Rooms & Participant Logs'
      }
    >
      <div className="space-y-6">
        {/* Schedule New 100ms Live Class (Admin & Assigned Teacher) */}
        {canSchedule && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" /> Schedule 100ms Live Classroom (`POST /api/v1/live-classes`)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Automatically provisions an isolated `HMS_100MS` room ID and logs an audit entry.
            </p>

            <form
              onSubmit={scheduleForm.handleSubmit((vals) =>
                createLiveMutation.mutate(
                  {
                    courseId: vals.courseId,
                    title: vals.title,
                    description: vals.description,
                    scheduledStartAt: new Date(vals.scheduledStartAt).toISOString(),
                    scheduledEndAt: new Date(vals.scheduledEndAt).toISOString(),
                  },
                  {
                    onSuccess: () =>
                      scheduleForm.reset({
                        courseId: vals.courseId,
                        title: '',
                        description: '',
                        scheduledStartAt: defaultStart,
                        scheduledEndAt: defaultEnd,
                      }),
                  }
                )
              )}
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <div>
                <label className="block text-xs font-semibold mb-1">Course</label>
                <select
                  {...scheduleForm.register('courseId')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="">Select Course</option>
                  {coursesData?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                {scheduleForm.formState.errors.courseId && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    {scheduleForm.formState.errors.courseId.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Session Title</label>
                <input
                  type="text"
                  placeholder="e.g. Live Problem Solving: Quantum Perturbation Theory"
                  {...scheduleForm.register('title')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  {...scheduleForm.register('scheduledStartAt')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">End Time</label>
                <input
                  type="datetime-local"
                  {...scheduleForm.register('scheduledEndAt')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={createLiveMutation.isPending}
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500"
                >
                  {createLiveMutation.isPending
                    ? 'Provisioning 100ms Room...'
                    : '+ Schedule Live Class'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active 100ms Classroom Token Stage */}
        {activeTicket && (
          <div className="rounded-2xl border-2 border-emerald-500/60 bg-slate-900 text-white p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white flex items-center gap-1.5 animate-pulse">
                  <Radio className="w-3.5 h-3.5" /> 100MS LIVE ROOM CONNECTED
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  Room ID: {activeTicket.providerRoomId} • Role: {activeTicket.roomRole}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  leaveClassMutation.mutate(activeTicket.liveClassId, {
                    onSuccess: () => setActiveTicket(null),
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Classroom & Log Duration
              </button>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">{activeTicket.title}</h3>
              <p className="text-xs text-slate-300">{activeTicket.courseTitle}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono space-y-1">
              <p className="text-emerald-400 font-sans font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Server-Generated Short-Lived 100ms Room Token (Expires: {activeTicket.expiresAt})
              </p>
              <p className="break-all text-[11px] text-slate-400">{activeTicket.token}</p>
            </div>
          </div>
        )}

        {/* Live Classes List */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-500" /> Scheduled & Active Live Classes (`GET /api/v1/live-classes`)
            </h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {isLoading && <p className="text-xs text-slate-500">Loading live classes from MySQL...</p>}
          {isError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              {(error as { message?: string })?.message || 'Failed to load live classes.'}
            </div>
          )}

          {!isLoading && liveClasses.length === 0 && (
            <p className="text-xs text-slate-500 py-4">
              No live classes scheduled for your current scope.
            </p>
          )}

          <div className="space-y-3">
            {liveClasses.map((lc) => (
              <div
                key={lc.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-mono font-bold">
                      {lc.courseCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        lc.status === 'LIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : lc.status === 'SCHEDULED'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {lc.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Room: <code className="font-mono">{lc.providerRoomId || 'Pending'}</code>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold">{lc.title}</h3>
                  <p className="text-xs text-slate-500">
                    {lc.courseTitle} • Instructor: <strong>{lc.teacherName}</strong>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Starts: {new Date(lc.scheduledStartAt).toLocaleString()} • Ends:{' '}
                    {new Date(lc.scheduledEndAt).toLocaleString()} • Participants Logged:{' '}
                    <strong>{lc.participantCount}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {lc.status !== 'ENDED' && lc.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() =>
                        joinTokenMutation.mutate(lc.id, {
                          onSuccess: (ticket) => setActiveTicket(ticket),
                        })
                      }
                      disabled={joinTokenMutation.isPending}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow"
                    >
                      {role === 'STUDENT' ? 'Join 100ms Classroom' : 'Launch 100ms Host Room'}
                    </button>
                  )}

                  {canSchedule && (
                    <>
                      {lc.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              liveClassId: lc.id,
                              status: 'LIVE',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                        >
                          Mark LIVE
                        </button>
                      )}
                      {lc.status === 'LIVE' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              liveClassId: lc.id,
                              status: 'ENDED',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white"
                        >
                          End Session
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedLogClassId(lc.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700"
                      >
                        Participant Logs ({lc.participantCount})
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Participant Join/Leave Log Drawer (Admin & Teacher) */}
        {canSchedule && selectedLogClassId && (
          <div className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" /> Participant Join/Leave Intervals (`GET /api/v1/live-classes/:id/participants`)
            </h3>
            {participants.length === 0 ? (
              <p className="text-xs text-slate-500">No participants have joined this session yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 px-3">Participant</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Joined At</th>
                      <th className="py-2 px-3">Left At</th>
                      <th className="py-2 px-3 text-right">Duration (sec)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {participants.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-semibold">
                          {p.fullName} <span className="text-slate-500">({p.email})</span>
                        </td>
                        <td className="py-2 px-3">{p.participantRole}</td>
                        <td className="py-2 px-3">{new Date(p.joinedAt).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          {p.leftAt ? new Date(p.leftAt).toLocaleString() : 'Active in room'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{p.durationSeconds}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. YOUTUBE RECORDED CLASSES VIEW (TEACHER & STUDENT — C-022)
// ============================================================================

export function RoleRecordedClassesView({
  role,
}: {
  role: 'TEACHER' | 'STUDENT';
}) {
  const { data: coursesData } = useCoursesListQuery();
  const { data: liveClasses = [] } = useLiveClassesQuery();
  const { data: recordings = [], isLoading, isError, error } = useRecordingsQuery();

  const createRecMutation = useCreateRecordingMutation();
  const updateRecStatusMutation = useUpdateRecordingStatusMutation();

  const [selectedRecId, setSelectedRecId] = useState<string>('');
  const activeRecording =
    recordings.find((r) => r.id === selectedRecId) || recordings[0] || null;

  const recForm = useForm<CreateRecordingValues>({
    resolver: zodResolver(createRecordingSchema),
    defaultValues: {
      title: '',
      youtubeUrlOrId: 'M7lc1UVf-VE',
      durationSeconds: 2700,
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Recorded Library`}
      operatorSubtitle="Server-Validated YouTube Safe Embeds (C-022)"
      headerTitle="Recorded Classes & On-Demand Video Library"
    >
      <div className="space-y-6">
        {role === 'TEACHER' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-indigo-500" /> Publish YouTube Class Recording (`POST /api/v1/recordings`)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Stores only the validated 11-character YouTube Video ID and renders via `youtube-nocookie.com` (raw iframe HTML is blocked per C-022).
            </p>

            <form
              onSubmit={recForm.handleSubmit((vals) =>
                createRecMutation.mutate(
                  {
                    courseId: vals.courseId,
                    liveClassId: vals.liveClassId || null,
                    title: vals.title,
                    youtubeUrlOrId: vals.youtubeUrlOrId,
                    durationSeconds: vals.durationSeconds,
                    status: 'PUBLISHED',
                  },
                  {
                    onSuccess: () =>
                      recForm.reset({
                        courseId: vals.courseId,
                        title: '',
                        youtubeUrlOrId: '',
                        durationSeconds: 2700,
                      }),
                  }
                )
              )}
              className="grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              <select
                {...recForm.register('courseId')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">Select Assigned Course</option>
                {coursesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>

              <select
                {...recForm.register('liveClassId')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">Link to Live Session (Optional)</option>
                {liveClasses.map((lc) => (
                  <option key={lc.id} value={lc.id}>
                    {lc.title}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Recording Title"
                {...recForm.register('title')}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="YouTube ID or Watch URL"
                  {...recForm.register('youtubeUrlOrId')}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={createRecMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shrink-0"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Privacy-Enhanced YouTube Player + Recording Playlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
            {activeRecording ? (
              <>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <iframe
                    src={activeRecording.safeEmbedUrl}
                    title={activeRecording.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-mono font-bold">
                      {activeRecording.courseCode} • YouTube ID: {activeRecording.youtubeVideoId}
                    </span>
                    <h3 className="text-base font-bold mt-1">{activeRecording.title}</h3>
                    <p className="text-xs text-slate-500">
                      {activeRecording.courseTitle} • Duration:{' '}
                      {Math.round(activeRecording.durationSeconds / 60)} mins
                    </p>
                  </div>
                  {role === 'TEACHER' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateRecStatusMutation.mutate({
                          recordingId: activeRecording.id,
                          status:
                            activeRecording.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED',
                        })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700"
                    >
                      Status: {activeRecording.status} (Toggle)
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-12 text-center">
                {isLoading
                  ? 'Loading recorded classes from MySQL...'
                  : 'No recorded classes published yet for your courses.'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">
              Course Recordings (`GET /api/v1/recordings` — {recordings.length})
            </h3>
            {isError && (
              <p className="text-xs text-rose-500">
                {(error as { message?: string })?.message || 'Failed to load recordings.'}
              </p>
            )}
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {recordings.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedRecId(rec.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition ${
                    activeRecording?.id === rec.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-cyan-400">{rec.courseCode}</span>
                    <span>{Math.round(rec.durationSeconds / 60)}m</span>
                  </div>
                  <p className="text-xs font-bold mt-1">{rec.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{rec.courseTitle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. TEACHER ATTENDANCE CODE GENERATOR & AUDITED OVERRIDE WORKSPACE
// ============================================================================

export function TeacherAttendanceWorkspaceView() {
  const { data: coursesData } = useCoursesListQuery();
  const { data: liveClasses = [] } = useLiveClassesQuery();
  const { data: sessions = [], isLoading } = useAttendanceSessionsQuery();

  const generateCodeMutation = useGenerateAttendanceCodeMutation();
  const overrideMutation = useManualAttendanceOverrideMutation();
  const updateStatusMutation = useUpdateAttendanceSessionStatusMutation();

  const [latestGenerated, setLatestGenerated] =
    useState<GeneratedAttendanceCodeResult | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;

  const codeForm = useForm<GenerateAttendanceCodeValues>({
    resolver: zodResolver(generateAttendanceCodeSchema),
    defaultValues: {
      expiryMinutes: 10,
    },
  });

  const overrideForm = useForm<ManualOverrideValues>({
    resolver: zodResolver(manualOverrideSchema),
    defaultValues: {
      status: 'PRESENT',
      correctionReason: '',
    },
  });

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Attendance & Session Codes"
      operatorSubtitle="SHA-256 Code Hashing & Audited Overrides (O-021)"
      headerTitle="Daily Attendance Code Generator & Roster Management"
    >
      <div className="space-y-6">
        {/* Generate Expiring 6-Digit Session Attendance Code */}
        <div className="rounded-2xl border border-indigo-500/40 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" /> Generate 6-Digit Session Attendance Code (`POST /api/v1/attendance/sessions`)
          </h2>
          <p className="text-xs text-slate-500">
            Generates a random 6-digit code for your class. Only the SHA-256 hash (`codeHash`) is stored in MySQL; the plaintext code is displayed below for you to share with students before expiry.
          </p>

          <form
            onSubmit={codeForm.handleSubmit((vals) =>
              generateCodeMutation.mutate(
                {
                  courseId: vals.courseId,
                  liveClassId: vals.liveClassId || null,
                  expiryMinutes: vals.expiryMinutes,
                },
                {
                  onSuccess: (res) => {
                    setLatestGenerated(res);
                    setSelectedSessionId(res.sessionId);
                  },
                }
              )
            )}
            className="grid grid-cols-1 md:grid-cols-4 gap-3"
          >
            <select
              {...codeForm.register('courseId')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Assigned Course</option>
              {coursesData?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <select
              {...codeForm.register('liveClassId')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Link to Live Session (Optional)</option>
              {liveClasses.map((lc) => (
                <option key={lc.id} value={lc.id}>
                  {lc.title}
                </option>
              ))}
            </select>

            <select
              {...codeForm.register('expiryMinutes')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {ATTENDANCE_EXPIRY_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  Expires in {p.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={generateCodeMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500"
            >
              {generateCodeMutation.isPending
                ? 'Generating SHA-256 Code...'
                : 'Generate 6-Digit Code'}
            </button>
          </form>

          {latestGenerated && (
            <div className="p-5 rounded-2xl bg-indigo-950/90 border border-indigo-500/50 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  ACTIVE 6-DIGIT ATTENDANCE CODE ({latestGenerated.courseCode})
                </span>
                <p className="text-3xl font-mono font-extrabold tracking-widest text-emerald-400 mt-1">
                  {latestGenerated.generatedCode}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Valid for {latestGenerated.expiryMinutes} minutes (Expires:{' '}
                  {new Date(latestGenerated.codeExpiresAt).toLocaleTimeString()})
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SHA-256 Hashed at Rest
              </span>
            </div>
          )}
        </div>

        {/* Attendance Sessions List & Audited Manual Override */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-bold">
              Attendance Sessions (`GET /api/v1/attendance/sessions`)
            </h3>
            {isLoading && <p className="text-xs text-slate-500">Loading sessions...</p>}
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    activeSession?.id === s.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-indigo-400">{s.courseCode}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'OPEN'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-1">{s.courseTitle}</p>
                  <p className="text-[11px] text-slate-500">
                    Date: {s.sessionDate} • Marked Records: {s.records.length}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {activeSession ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold">
                      Session Roster & Manual Override — {activeSession.courseTitle} ({activeSession.sessionDate})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Code Expires: {new Date(activeSession.codeExpiresAt).toLocaleTimeString()} • Status:{' '}
                      <strong>{activeSession.status}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {activeSession.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            sessionId: activeSession.id,
                            status: 'FINALIZED',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white"
                      >
                        Finalize Session (Auto-Mark Remaining Absent)
                      </button>
                    )}
                  </div>
                </div>

                {/* Audited Manual Teacher Override Form (O-021) */}
                <form
                  onSubmit={overrideForm.handleSubmit((vals) =>
                    overrideMutation.mutate(
                      {
                        sessionId: activeSession.id,
                        ...vals,
                      },
                      { onSuccess: () => overrideForm.reset() }
                    )
                  )}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Audited Manual Attendance Override (`PATCH /api/v1/attendance/sessions/:id/override`)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      {...overrideForm.register('studentId')}
                      className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Select Enrolled Student</option>
                      {activeSession.enrolledRoster.map((stu) => (
                        <option key={stu.id} value={stu.id}>
                          {stu.fullName} ({stu.email})
                        </option>
                      ))}
                    </select>

                    <select
                      {...overrideForm.register('status')}
                      className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    >
                      {ATTENDANCE_MARK_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Mandatory Audit Reason (min 5 chars)"
                      {...overrideForm.register('correctionReason')}
                      className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  {overrideForm.formState.errors.correctionReason && (
                    <p className="text-[11px] text-rose-500">
                      {overrideForm.formState.errors.correctionReason.message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={overrideMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                  >
                    {overrideMutation.isPending
                      ? 'Saving Override & Audit Log...'
                      : 'Apply Manual Override'}
                  </button>
                </form>

                {/* Attendance Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Source</th>
                        <th className="py-2 px-3">Audit Reason / Corrected By</th>
                        <th className="py-2 px-3 text-right">Marked At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                      {activeSession.records.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 font-semibold">
                            {r.studentName}{' '}
                            <span className="text-slate-500 font-normal">({r.studentEmail})</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                r.status === 'PRESENT' || r.status === 'EXCUSED'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : r.status === 'LATE'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{r.source}</td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {r.correctionReason
                              ? `${r.correctionReason} (${r.correctedByName || 'Teacher'})`
                              : 'Verified via 6-digit code'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {new Date(r.markedAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Select or generate an attendance session to inspect records.
              </p>
            )}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. STUDENT ATTENDANCE CODE SUBMISSION & HISTORY VIEW (/student/attendance)
// ============================================================================

export function StudentAttendanceView() {
  const { data: sessions = [], isLoading } = useAttendanceSessionsQuery();
  const submitCodeMutation = useSubmitAttendanceCodeMutation();
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const codeForm = useForm<SubmitAttendanceCodeValues>({
    resolver: zodResolver(submitAttendanceCodeSchema),
    defaultValues: { code: '' },
  });

  const openSessions = sessions.filter((s) => s.status === 'OPEN' && !s.myRecord);
  const activeOpenSessionId = selectedSessionId || openSessions[0]?.id || '';

  const totalCount = sessions.length;
  const attendedCount = sessions.filter(
    (s) =>
      s.myRecord &&
      (s.myRecord.status === 'PRESENT' ||
        s.myRecord.status === 'LATE' ||
        s.myRecord.status === 'EXCUSED')
  ).length;
  const overallPercent =
    totalCount > 0 ? ((attendedCount / totalCount) * 100).toFixed(1) : '0.0';

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Student Attendance Portal"
      operatorSubtitle="Own-Record Scope (C-008, O-021)"
      headerTitle="Submit 6-Digit Session Attendance Code & Attendance History"
    >
      <div className="space-y-6">
        {/* KPI & 6-Digit Code Submission Box */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-cyan-500/30 bg-white dark:bg-[#131127] p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-500">Overall Session Attendance</p>
              <p className="text-3xl font-extrabold text-cyan-400 mt-1">{overallPercent}%</p>
              <p className="text-xs text-slate-500 mt-1">
                {attendedCount} of {totalCount} sessions marked Present/Excused
              </p>
            </div>
            <p className="text-[11px] text-emerald-400 mt-4 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Minimum Certificate Requirement: 75.0%
            </p>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-violet-500/40 bg-white dark:bg-[#131127] p-6 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-violet-400" /> Submit 6-Digit Session Attendance Code (`POST /api/v1/attendance/sessions/:id/submit-code`)
            </h2>
            <p className="text-xs text-slate-500">
              Enter the 6-digit code announced by your instructor during the live session. Rate-limited to 5 attempts/minute.
            </p>

            {submitCodeMutation.isError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                {(submitCodeMutation.error as { message?: string })?.message ||
                  'Invalid or expired attendance code.'}
              </div>
            )}

            <form
              onSubmit={codeForm.handleSubmit((vals) => {
                if (!activeOpenSessionId) return;
                submitCodeMutation.mutate(
                  { sessionId: activeOpenSessionId, code: vals.code },
                  { onSuccess: () => codeForm.reset() }
                );
              })}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <select
                value={activeOpenSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">Select Open Attendance Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.courseCode} — {s.sessionDate} ({s.status})
                  </option>
                ))}
              </select>

              <input
                type="text"
                maxLength={6}
                placeholder="6-Digit Code (e.g. 482910)"
                {...codeForm.register('code')}
                className="px-3 py-2.5 rounded-xl text-sm font-mono tracking-widest bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />

              <button
                type="submit"
                disabled={!activeOpenSessionId || submitCodeMutation.isPending}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
              >
                {submitCodeMutation.isPending ? 'Verifying Code...' : 'Submit Attendance Code'}
              </button>
            </form>
          </div>
        </div>

        {/* Student's Attendance Ledger */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" /> Your Session Attendance History (`GET /api/v1/attendance/sessions`)
          </h3>
          {isLoading && <p className="text-xs text-slate-500">Loading your attendance records...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Instructor</th>
                  <th className="py-2.5 px-3">Session Status</th>
                  <th className="py-2.5 px-3">Your Mark</th>
                  <th className="py-2.5 px-3 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-mono">{s.sessionDate}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {s.courseCode} — {s.courseTitle}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{s.teacherName}</td>
                    <td className="py-2.5 px-3">{s.status}</td>
                    <td className="py-2.5 px-3">
                      {s.myRecord ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">
                          {s.myRecord.status}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400">
                          NOT MARKED YET
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {s.myRecord ? s.myRecord.source : '—'}
                    </td>
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
