'use client';

import React from 'react';
import Link from 'next/link';
import { RolePanelShell } from './RolePanelShell';
import { RolePanelType } from '@/features/auth/types/auth.types';
import { ROLE_PORTAL_CONFIG } from '@/features/auth/auth.constant';
import { CheckCircle2, Layers, ArrowLeft } from 'lucide-react';

export function PhaseModuleStatusView({
  role,
  sectionSlug,
}: {
  role: RolePanelType;
  sectionSlug: string;
}) {
  const portalMeta = ROLE_PORTAL_CONFIG[role];

  return (
    <RolePanelShell
      role={role}
      operatorName={`${role} Portal`}
      operatorSubtitle="100% Roadmap Complete"
      headerTitle={sectionSlug}
    >
      <div className="max-w-4xl space-y-6">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> All 7 Phases Implemented & Active
            </span>
            <Link
              href={portalMeta.dashboardPath}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-500 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to {role} Dashboard
            </Link>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">
            Online Learning Platform — All 7 Phases Completed
          </h2>
          <p className="text-xs leading-relaxed opacity-85">
            Every module across the Admin, Student, Teacher Cockpit, and Support Command Center portals is live and connected to MySQL via Prisma.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" /> Complete 7-Phase Delivery Summary (`docs/PROJECT_PROGRESS.md` v1.0)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              {
                title: 'Phase 1 — Foundation & Identity (COMPLETE)',
                desc: '4 Login Portals, 5-Layer Auth/RBAC Middleware, 27-Model Prisma MySQL Schema, and 4 Role Dashboards.',
              },
              {
                title: 'Phase 2 — Academic Core (COMPLETE)',
                desc: 'Categories, Courses, Multi-Teacher Assignments, Installment Plan Templates, Curriculum Sections/Lessons, Enrollments, and Hostinger VPS Materials.',
              },
              {
                title: 'Phase 3 — Financial Engine (COMPLETE)',
                desc: 'Razorpay Order & Webhook Verification, Audited Refunds, Append-Only Wallet Ledger, Referral Rewards, AES-256-GCM UPI Redemptions, and Teacher Revenue-Share Payouts.',
              },
              {
                title: 'Phase 4 — Live Learning & Attendance (COMPLETE)',
                desc: '100ms Live Classroom Scheduling & Short-Lived Room Tokens, Participant Join/Leave Logs, Validated YouTube Unlisted Recordings, and Expiring 6-Digit Session Attendance Codes.',
              },
              {
                title: 'Phase 5 — Assessments, Results & Certificates (COMPLETE)',
                desc: 'Course Assignments, Student Submissions & Teacher Grading Queues, Timed Examinations with Answer-Reveal Protection, Performance Analytics, and Verifiable Course Certificates.',
              },
              {
                title: 'Phase 6 — Support, Notifications, Calendar & RBAC (COMPLETE)',
                desc: 'Support Ticket Queues, SLA Breach Monitoring, Internal Notes vs. Replies, Read-Only Financial Context Lookup, In-App Notifications, Unified Calendar, Profile, and Admin RBAC Matrix.',
              },
              {
                title: 'Phase 7 — Reports, Exports, Audit Viewer & Hardening (COMPLETE)',
                desc: 'Admin Financial & Academic CSV/JSON Exports, Full Append-Only Audit Log Explorer, Configurable Platform Settings, and Hostinger VPS PM2/Nginx/Backup Scripts.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-1"
              >
                <p className="font-bold text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {p.title}
                </p>
                <p className="opacity-80">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}
