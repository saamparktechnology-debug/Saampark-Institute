'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import { useCoursesListQuery, useEnrollmentsListQuery } from '@/features/courses/hooks/courses.hook';
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
  useDispatchLowAttendanceAlertsMutation,
  useRecordingsQuery,
  useSaveWatchProgressMutation,
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
  ExternalLink,
} from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        width?: string | number;
        height?: string | number;
        parentNode?: HTMLElement | null;
        userInfo?: {
          displayName?: string;
          email?: string;
        };
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      }
    ) => {
      dispose: () => void;
      executeCommand: (command: string, ...args: unknown[]) => void;
    };
  }
}

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR PHASE 4 & PHASE 12 FORMS
// ----------------------------------------------------------------------------

const scheduleLiveClassSchema = z.object({
  courseId: z.string().uuid('Select a course'),
  title: z.string().trim().min(3, 'Session title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  scheduledStartAt: z.string().min(10, 'Start date/time is required'),
  scheduledEndAt: z.string().min(10, 'End date/time is required'),
  provider: z.enum(['JITSI_MEET', 'YOUTUBE_LIVE', 'HMS_100MS']).default('JITSI_MEET'),
  youtubeLiveUrlOrId: z.string().trim().max(255).optional(),
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

const JITSI_PUBLIC_SERVERS = [
  {
    domain: 'meet.ffmuc.net',
    label: 'meet.ffmuc.net (Recommended for Localhost — No 5-Min Limit, No Login)',
  },
  {
    domain: 'jitsi.riot.im',
    label: 'jitsi.riot.im (Community Jitsi — No Credit Card Required)',
  },
  {
    domain: 'meet.jit.si',
    label: 'meet.jit.si (Official Jitsi Server)',
  },
];

// ============================================================================
// INTERACTIVE JITSI MEET IFRAME API (`external_api.js`) & YOUTUBE LIVE STUDIO
// Zero credit card required; works out-of-the-box on http://localhost:3000 & VPS
// ============================================================================

function InteractiveJitsiAndYouTubeStudioStage({
  ticket,
  role,
  courseId,
  onLeave,
  isLeaving,
}: {
  ticket: LiveRoomJoinTicket;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  courseId?: string;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  const jitsiMountRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<{
    dispose: () => void;
    executeCommand: (cmd: string, ...args: unknown[]) => void;
  } | null>(null);

  const [selectedJitsiDomain, setSelectedJitsiDomain] = useState<string>(
    ticket.jitsiDomain || 'meet.ffmuc.net'
  );
  const [useDirectIframeFallback, setUseDirectIframeFallback] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // In-room Attendance integration
  const { data: sessions = [] } = useAttendanceSessionsQuery();
  const generateCodeMutation = useGenerateAttendanceCodeMutation();
  const submitCodeMutation = useSubmitAttendanceCodeMutation();
  const [inRoomGeneratedCode, setInRoomGeneratedCode] = useState<string | null>(null);
  const [inRoomCodeInput, setInRoomCodeInput] = useState('');
  const [inRoomAttendanceMsg, setInRoomAttendanceMsg] = useState<string | null>(null);

  const jitsiRoomName =
    ticket.jitsiRoomName ||
    `SaamparkLMS_${(ticket.courseCode || 'COURSE').replace(/[^a-zA-Z0-9]/g, '')}_${ticket.providerRoomId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const displayName =
    ticket.participantDisplayName ||
    (role === 'TEACHER' ? 'Course Instructor' : role === 'ADMIN' ? 'Platform Admin' : 'Student');
  const participantEmail = ticket.participantEmail || '';

  const directJitsiEmbedUrl = `https://${selectedJitsiDomain}/${encodeURIComponent(
    jitsiRoomName
  )}#userInfo.displayName="${encodeURIComponent(
    displayName
  )}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=${
    role === 'STUDENT' ? 'true' : 'false'
  }`;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // Load Jitsi Meet IFrame API (`external_api.js`) dynamically when in JITSI_MEET mode
  useEffect(() => {
    if (
      ticket.provider === 'YOUTUBE_LIVE' ||
      useDirectIframeFallback ||
      typeof window === 'undefined' ||
      !jitsiMountRef.current
    ) {
      return;
    }

    let cancelled = false;

    const mountJitsiWidget = () => {
      if (cancelled || !jitsiMountRef.current || !window.JitsiMeetExternalAPI) return;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch {
          // ignore dispose error
        }
        jitsiApiRef.current = null;
      }
      jitsiMountRef.current.innerHTML = '';

      try {
        jitsiApiRef.current = new window.JitsiMeetExternalAPI(selectedJitsiDomain, {
          roomName: jitsiRoomName,
          width: '100%',
          height: 500,
          parentNode: jitsiMountRef.current,
          userInfo: {
            displayName,
            email: participantEmail,
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: role === 'STUDENT',
            startWithVideoMuted: role === 'STUDENT',
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Class Participant',
          },
        });
      } catch {
        setUseDirectIframeFallback(true);
      }
    };

    const scriptId = `jitsi-external-api-${selectedJitsiDomain.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (window.JitsiMeetExternalAPI && existingScript) {
      mountJitsiWidget();
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://${selectedJitsiDomain}/external_api.js`;
      script.async = true;
      script.onload = () => mountJitsiWidget();
      script.onerror = () => setUseDirectIframeFallback(true);
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch {
          // ignore dispose error
        }
        jitsiApiRef.current = null;
      }
    };
  }, [
    ticket.provider,
    selectedJitsiDomain,
    jitsiRoomName,
    displayName,
    participantEmail,
    role,
    useDirectIframeFallback,
  ]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const openSession = sessions.find(
    (s) => s.status === 'OPEN' && (!courseId || s.courseId === courseId)
  );

  return (
    <div className="rounded-2xl border-2 border-emerald-500/60 bg-slate-950 text-white p-5 sm:p-6 shadow-2xl space-y-5">
      {/* Studio Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3.5 h-3.5" /> LIVE • {formatElapsed(elapsedSeconds)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
            {ticket.provider === 'YOUTUBE_LIVE'
              ? 'YouTube Live Broadcast'
              : `Jitsi Meet (${selectedJitsiDomain})`}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            Room: {jitsiRoomName}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold">
            {displayName} ({ticket.roomRole.toUpperCase()})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ticket.provider !== 'YOUTUBE_LIVE' && (
            <a
              href={`https://${selectedJitsiDomain}/${encodeURIComponent(jitsiRoomName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Pop Out Fullscreen Tab
            </a>
          )}

          <button
            type="button"
            disabled={isLeaving}
            onClick={() => {
              if (jitsiApiRef.current) {
                try {
                  jitsiApiRef.current.dispose();
                } catch {
                  // ignore
                }
                jitsiApiRef.current = null;
              }
              onLeave();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLeaving ? 'Leaving & Logging Duration...' : 'Leave Classroom & Save Attendance'}
          </button>
        </div>
      </div>

      {/* Localhost Jitsi Server Switcher Bar (for JITSI_MEET sessions) */}
      {ticket.provider !== 'YOUTUBE_LIVE' && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-300">Jitsi Server (Localhost &amp; VPS Ready):</span>
            <select
              value={selectedJitsiDomain}
              onChange={(e) => {
                setUseDirectIframeFallback(false);
                setSelectedJitsiDomain(e.target.value);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-xs"
            >
              {JITSI_PUBLIC_SERVERS.map((srv) => (
                <option key={srv.domain} value={srv.domain}>
                  {srv.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setUseDirectIframeFallback((v) => !v)}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
          >
            {useDirectIframeFallback
              ? 'Switch to Jitsi External API Mode'
              : 'Switch to Direct IFrame Embed'}
          </button>
        </div>
      )}

      {/* Main Embedded Classroom Stage (2/3) + In-Room Live Attendance Sidebar (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-inner">
          {ticket.provider === 'YOUTUBE_LIVE' && ticket.youtubeEmbedUrl ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={ticket.youtubeEmbedUrl}
                title={ticket.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : useDirectIframeFallback ? (
            <iframe
              src={directJitsiEmbedUrl}
              title={`Jitsi Classroom — ${ticket.title}`}
              className="w-full h-[500px] border-0"
              allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
              allowFullScreen
            />
          ) : (
            <div
              ref={jitsiMountRef}
              className="w-full min-h-[500px] bg-slate-950 flex items-center justify-center text-xs text-slate-400"
            >
              Loading Jitsi Meet Interactive Classroom ({selectedJitsiDomain}/{jitsiRoomName})...
            </div>
          )}
        </div>

        {/* 1/3 Sidebar: In-Room Live Attendance Verification & Session Info */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between space-y-4 text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-cyan-400">
              <KeyRound className="w-4 h-4" /> In-Room Live Attendance
            </h4>

            {role === 'TEACHER' || role === 'ADMIN' ? (
              <div className="space-y-2.5">
                <p className="text-slate-400 text-[11px]">
                  Generate an instant 6-digit attendance code for students currently inside this live session:
                </p>
                {courseId ? (
                  <button
                    type="button"
                    disabled={generateCodeMutation.isPending}
                    onClick={() =>
                      generateCodeMutation.mutate(
                        {
                          courseId,
                          liveClassId: ticket.liveClassId,
                          expiryMinutes: 15,
                        },
                        {
                          onSuccess: (res) => {
                            setInRoomGeneratedCode(res.generatedCode);
                            setInRoomAttendanceMsg(
                              `6-digit code ${res.generatedCode} active for 15 minutes.`
                            );
                          },
                        }
                      )
                    }
                    className="w-full py-2 px-3 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white cursor-pointer"
                  >
                    {generateCodeMutation.isPending
                      ? 'Generating Code...'
                      : '⚡ Broadcast 6-Digit Attendance Code'}
                  </button>
                ) : null}

                {inRoomGeneratedCode && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-300">
                      Share With Class Now
                    </span>
                    <p className="text-2xl font-mono font-extrabold tracking-widest text-emerald-400 mt-0.5">
                      {inRoomGeneratedCode}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-slate-400 text-[11px]">
                  Enter the 6-digit code shared by your instructor to mark your live attendance without leaving the room:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={inRoomCodeInput}
                    onChange={(e) => setInRoomCodeInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-mono tracking-widest text-white"
                  />
                  <button
                    type="button"
                    disabled={
                      inRoomCodeInput.length !== 6 ||
                      !openSession ||
                      submitCodeMutation.isPending
                    }
                    onClick={() => {
                      if (!openSession) return;
                      submitCodeMutation.mutate(
                        { sessionId: openSession.id, code: inRoomCodeInput },
                        {
                          onSuccess: () => {
                            setInRoomAttendanceMsg('Attendance marked PRESENT ✓');
                            setInRoomCodeInput('');
                          },
                        }
                      );
                    }}
                    className="px-3 py-1.5 rounded-xl font-bold bg-emerald-600 text-white cursor-pointer disabled:opacity-50"
                  >
                    Verify
                  </button>
                </div>
                {!openSession && (
                  <p className="text-[11px] text-amber-400">
                    Waiting for instructor to open today&apos;s attendance code window.
                  </p>
                )}
              </div>
            )}

            {inRoomAttendanceMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px]">
                {inRoomAttendanceMsg}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
            <p className="text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Zero-Card WebRTC Classroom
            </p>
            <p className="text-slate-400">
              Allow browser camera &amp; microphone permissions when prompted. Your join and leave timestamps are automatically logged in MySQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 1. LIVE CLASSES & JITSI MEET / YOUTUBE LIVE WORKSPACE (ADMIN / TEACHER / STUDENT)
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
  const [activeCourseId, setActiveCourseId] = useState<string>('');
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
      provider: 'JITSI_MEET',
      youtubeLiveUrlOrId: '',
    },
  });

  const selectedProvider = scheduleForm.watch('provider');
  const canSchedule = role === 'ADMIN' || role === 'TEACHER';

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Live Classroom`}
      operatorSubtitle="Jitsi Meet IFrame API & YouTube Live (Zero Card)"
      headerTitle={
        role === 'STUDENT'
          ? 'Live Classes & Interactive Jitsi Classroom'
          : 'Live Class Scheduling, Jitsi / YouTube Studio & Participant Logs'
      }
    >
      <div className="space-y-6">
        {/* Schedule New Jitsi Meet or YouTube Live Class (Admin & Assigned Teacher) */}
        {canSchedule && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" /> Schedule Live Classroom (`POST /api/v1/live-classes` — Jitsi Meet or YouTube Live)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Provisions an embedded <strong>Jitsi Meet</strong> interactive classroom (₹0 cost, no credit card, works on <code>localhost:3000</code> and Hostinger VPS) or an <strong>Unlisted YouTube Live</strong> broadcast, and notifies enrolled students via Email + WhatsApp.
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
                    provider: vals.provider,
                    youtubeLiveUrlOrId:
                      vals.provider === 'YOUTUBE_LIVE' ? vals.youtubeLiveUrlOrId : undefined,
                  },
                  {
                    onSuccess: () =>
                      scheduleForm.reset({
                        courseId: vals.courseId,
                        title: '',
                        description: '',
                        scheduledStartAt: defaultStart,
                        scheduledEndAt: defaultEnd,
                        provider: vals.provider,
                        youtubeLiveUrlOrId: '',
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

              <div>
                <label className="block text-xs font-semibold mb-1">Session Title</label>
                <input
                  type="text"
                  placeholder="e.g. Live Problem Solving: Quantum Perturbation Theory"
                  {...scheduleForm.register('title')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Live Video Provider</label>
                <select
                  {...scheduleForm.register('provider')}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  <option value="JITSI_MEET">
                    Jitsi Meet Interactive Room (Free • No Card • Localhost Ready)
                  </option>
                  <option value="YOUTUBE_LIVE">
                    YouTube Live Broadcast (Unlisted 11-Char Video ID / URL)
                  </option>
                </select>
              </div>

              {selectedProvider === 'YOUTUBE_LIVE' && (
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold mb-1">
                    YouTube Live Video ID or Watch URL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. M7lc1UVf-VE or https://www.youtube.com/watch?v=M7lc1UVf-VE"
                    {...scheduleForm.register('youtubeLiveUrlOrId')}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              )}

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
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 cursor-pointer"
                >
                  {createLiveMutation.isPending
                    ? 'Provisioning Classroom...'
                    : '+ Schedule Live Class'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Jitsi Meet / YouTube Live Interactive Classroom Studio Stage */}
        {activeTicket && (
          <InteractiveJitsiAndYouTubeStudioStage
            ticket={activeTicket}
            role={role}
            courseId={activeCourseId}
            isLeaving={leaveClassMutation.isPending}
            onLeave={() => {
              leaveClassMutation.mutate(activeTicket.liveClassId, {
                onSuccess: () => setActiveTicket(null),
              });
            }}
          />
        )}

        {/* Live Classes List */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-500" /> Scheduled &amp; Active Live Classes (`GET /api/v1/live-classes`)
            </h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
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
                    <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[10px] font-mono font-bold">
                      {lc.provider === 'YOUTUBE_LIVE' ? 'YOUTUBE_LIVE' : 'JITSI_MEET'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Room: <code className="font-mono">{lc.providerRoomId || 'Ready'}</code>
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
                      onClick={() => {
                        setActiveCourseId(lc.courseId);
                        joinTokenMutation.mutate(lc.id, {
                          onSuccess: (ticket) => setActiveTicket(ticket),
                        });
                      }}
                      disabled={joinTokenMutation.isPending}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow cursor-pointer"
                    >
                      {role === 'STUDENT'
                        ? '🎥 Join Live Classroom (Jitsi / Live)'
                        : '🎥 Launch Host Classroom (Jitsi / Live)'}
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
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white cursor-pointer"
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
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white cursor-pointer"
                        >
                          End Session
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedLogClassId(lc.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
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
// 2. YOUTUBE RECORDED CLASSES VIEW (COURSE-SCOPED PLAYLIST & CLEAN YOUTUBE PLAYER)
// ============================================================================

export function RoleRecordedClassesView({
  role,
}: {
  role: 'TEACHER' | 'STUDENT';
}) {
  const { data: coursesData } = useCoursesListQuery();
  const { data: enrollments = [] } = useEnrollmentsListQuery();
  const { data: liveClasses = [] } = useLiveClassesQuery();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [urlInitialized, setUrlInitialized] = useState<boolean>(false);
  const [selectedRecId, setSelectedRecId] = useState<string>('');

  // Read ?courseId=... from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get('courseId');
      if (cid) {
        setSelectedCourseId(cid);
      }
      setUrlInitialized(true);
    }
  }, []);

  // Build the list of courses available to filter by
  const courseOptions =
    role === 'STUDENT' && enrollments.length > 0
      ? enrollments.map((e) => ({
          id: e.courseId,
          code: e.courseCode,
          title: e.courseTitle,
        }))
      : (coursesData?.items || []).map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
        }));

  // Default to the first enrolled/assigned course if none was specified in the URL
  const effectiveCourseId =
    selectedCourseId === 'ALL'
      ? ''
      : selectedCourseId || (urlInitialized && courseOptions[0]?.id ? courseOptions[0].id : '');

  const {
    data: allRecordings = [],
    isLoading,
    isError,
    error,
  } = useRecordingsQuery(effectiveCourseId ? { courseId: effectiveCourseId } : undefined);

  // Strictly filter client-side as well so switching courses immediately scopes the playlist
  const recordings = effectiveCourseId
    ? allRecordings.filter((r) => r.courseId === effectiveCourseId)
    : allRecordings;

  const createRecMutation = useCreateRecordingMutation();
  const updateRecStatusMutation = useUpdateRecordingStatusMutation();
  const saveProgressMutation = useSaveWatchProgressMutation();

  const activeRecording =
    recordings.find((r) => r.id === selectedRecId) || recordings[0] || null;

  const activeCourseMeta = courseOptions.find((c) => c.id === effectiveCourseId) || null;

  const recForm = useForm<CreateRecordingValues>({
    resolver: zodResolver(createRecordingSchema),
    defaultValues: {
      title: '',
      youtubeUrlOrId: '',
      durationSeconds: 2700,
    },
  });

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Recorded Library`}
      operatorSubtitle="Course-Scoped Video Lectures"
      headerTitle={
        activeCourseMeta
          ? `Recorded Videos — ${activeCourseMeta.title}`
          : 'Recorded Classes & Video Library'
      }
    >
      <div className="space-y-6">
        {/* Course Selector Filter Bar so selecting a course shows ONLY that course's recorded videos */}
        {courseOptions.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Select Course:</span>
              {courseOptions.map((c) => {
                const isSelected = effectiveCourseId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(c.id);
                      setSelectedRecId('');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-violet-500/50 border border-transparent'
                    }`}
                  >
                    {c.code} — {c.title}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId('ALL');
                  setSelectedRecId('');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedCourseId === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Courses
              </button>
            </div>

            <span className="text-xs font-semibold text-slate-400">
              Showing {recordings.length} video(s)
              {activeCourseMeta ? ` for ${activeCourseMeta.code}` : ''}
            </span>
          </div>
        )}

        {role === 'TEACHER' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-indigo-500" /> Publish YouTube Class Recording
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Select the target course and paste a YouTube Video ID or Watch URL to publish a recorded lecture.
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
                    onSuccess: () => {
                      setSelectedCourseId(vals.courseId);
                      recForm.reset({
                        courseId: vals.courseId,
                        title: '',
                        youtubeUrlOrId: '',
                        durationSeconds: 2700,
                      });
                    },
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shrink-0 cursor-pointer"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clean Unobstructed YouTube Player + Course-Filtered Recording Playlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
            {activeRecording ? (
              <>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <iframe
                    key={activeRecording.id}
                    src={`https://www.youtube.com/embed/${activeRecording.youtubeVideoId}?rel=0&modestbranding=1`}
                    title={activeRecording.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                {/* Watch Progress & Bookmark Bar (No moving overlay on video screen) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-500">
                        {activeRecording.courseCode} — {activeRecording.courseTitle}
                      </span>
                      {activeRecording.myWatchProgress && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono text-[11px] font-bold">
                          Watched: {activeRecording.myWatchProgress.completionPercent}%
                        </span>
                      )}
                    </div>
                    {role === 'TEACHER' && activeRecording.watchAnalytics && (
                      <p className="text-[11px] text-slate-500">
                        Cohort Telemetry: {activeRecording.watchAnalytics.uniqueViewersCount} unique student viewer(s) •{' '}
                        {activeRecording.watchAnalytics.completedViewersCount} completed •{' '}
                        {activeRecording.watchAnalytics.averageCompletionPercent}% avg completion
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saveProgressMutation.isPending}
                      onClick={() =>
                        saveProgressMutation.mutate({
                          recordingId: activeRecording.id,
                          lastPositionSeconds: Math.min(
                            activeRecording.durationSeconds || 1800,
                            (activeRecording.myWatchProgress?.lastPositionSeconds || 0) + 300
                          ),
                          watchedSeconds: Math.min(
                            activeRecording.durationSeconds || 1800,
                            (activeRecording.myWatchProgress?.watchedSeconds || 0) + 300
                          ),
                          completed: false,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Save Progress (+5m)
                    </button>
                    <button
                      type="button"
                      disabled={saveProgressMutation.isPending}
                      onClick={() =>
                        saveProgressMutation.mutate({
                          recordingId: activeRecording.id,
                          lastPositionSeconds: activeRecording.durationSeconds || 1800,
                          watchedSeconds: activeRecording.durationSeconds || 1800,
                          completed: true,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                    >
                      {activeRecording.myWatchProgress?.completed
                        ? '✓ Completed (100%)'
                        : 'Mark Lecture Completed'}
                    </button>
                  </div>
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
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer"
                    >
                      Status: {activeRecording.status} (Toggle)
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center space-y-2">
                <PlayCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-bold text-slate-300">
                  {isLoading
                    ? 'Loading recorded classes...'
                    : activeCourseMeta
                    ? `No recorded videos uploaded for "${activeCourseMeta.title}" (${activeCourseMeta.code}) yet.`
                    : 'No recorded classes published yet for your courses.'}
                </p>
                {activeCourseMeta && (
                  <p className="text-xs text-slate-500">
                    Select another course above or check back once your instructor publishes a recording for {activeCourseMeta.code}.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">
              {activeCourseMeta
                ? `${activeCourseMeta.code} Video Playlist (${recordings.length})`
                : `Course Video Playlist (${recordings.length})`}
            </h3>
            {isError && (
              <p className="text-xs text-rose-500">
                {(error as { message?: string })?.message || 'Failed to load recordings.'}
              </p>
            )}
            {recordings.length === 0 && !isLoading ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No videos in this course playlist yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedRecId(rec.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
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
            )}
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
  const lowAttendanceAlertMutation = useDispatchLowAttendanceAlertsMutation();

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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={lowAttendanceAlertMutation.isPending}
                      onClick={() =>
                        lowAttendanceAlertMutation.mutate({ courseId: activeSession.courseId })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                    >
                      {lowAttendanceAlertMutation.isPending
                        ? 'Scanning <75% Roster...'
                        : '⚠️ Send <75% Low-Attendance Alerts'}
                    </button>
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
              <KeyRound className="w-4 h-4 text-violet-400" /> Attendance Check-In (Enter 6-Digit Class Code)
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
            <Clock className="w-4 h-4 text-cyan-400" /> Your Attendance History
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
