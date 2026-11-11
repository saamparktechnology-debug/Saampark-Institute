'use client';

import React from 'react';
import Link from 'next/link';
import { RolePanelShell } from './RolePanelShell';
import {
  ChartCardShell,
  SvgAreaChart,
  SvgColumnChart,
  SvgDonutChart,
  SvgHeatmapGrid,
  SvgHorizontalBarChart,
  SvgLineChart,
  SvgPieChart,
  SvgRadarChart,
  SvgStackedAreaChart,
  SvgStackedBarChart,
  SvgSunburstChart,
} from './DashboardChartsSuite';
import {
  useAdminDashboardQuery,
  useStudentDashboardQuery,
  useSupportDashboardQuery,
  useTeacherDashboardQuery,
} from '../hooks/dashboards.hook';
import { useCurrentUser } from '@/features/auth/hooks/auth.hook';
import {
  Users,
  Video,
  IndianRupee,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  GraduationCap,
  RefreshCw,
  AlertOctagon,
  BookOpen,
} from 'lucide-react';

function ApiLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center space-y-3 animate-pulse">
      <div className="h-4 w-48 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function ApiErrorBanner({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const errObj = error as { message?: string; code?: string; statusCode?: number } | null;
  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
            API Error ({errObj?.code || 'REQUEST_FAILED'})
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {errObj?.message ||
              'Could not load live data from the Express/MySQL API. Verify that the backend server is running and you are signed in with the required role.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 transition flex items-center gap-1.5 shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry API Call
      </button>
    </div>
  );
}

// ============================================================================
// 1. ADMIN DASHBOARD VIEW (ALL 11 CHART TYPES POWERED BY MYSQL TELEMETRY)
// ============================================================================

export function AdminDashboardView() {
  const { data: meData } = useCurrentUser();
  const { data, isLoading, isError, error, refetch } = useAdminDashboardQuery();

  const operatorName = meData?.user.fullName || 'Authenticated Admin';
  const operatorEmail = meData?.user.email || 'ADMIN Role';
  const charts = data?.analyticsCharts;

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName={operatorName}
      operatorSubtitle={operatorEmail}
      headerTitle="Admin Executive Telemetry & Multi-Chart Analytics"
    >
      {isLoading && (
        <ApiLoadingSkeleton label="Fetching live platform metrics & multi-chart telemetry from MySQL via /api/v1/dashboards/admin/summary..." />
      )}
      {isError && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live database telemetry from MySQL (`users`, `courses`, `enrollments`, `payment_transactions`, `wallets`, `audit_logs`)
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/reports"
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-400"
              >
                Export CSV / JSON Reports
              </Link>
              <Link
                href="/admin/courses"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow"
              >
                Manage Courses & Teachers →
              </Link>
            </div>
          </div>

          {/* 4 Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Total Users</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                  {data.kpis.userGrowthPercent >= 0
                    ? `+${data.kpis.userGrowthPercent}%`
                    : `${data.kpis.userGrowthPercent}%`}
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight">
                {data.kpis.totalUsers.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" /> Live DB count (`users`)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Active Live Classes (100ms)</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                  • LIVE
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight">{data.kpis.activeLiveClasses}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-emerald-400" /> Live DB count (`live_classes`)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Verified Revenue Today</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-semibold">
                  CAPTURED
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight flex items-center">
                <IndianRupee className="w-5 h-5" />
                {Number(data.kpis.revenueTodayInr).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Aggregated from `payment_transactions`
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Hostinger VPS Health</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                  OK
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight">
                {data.kpis.systemHealthPercent}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Prisma MySQL Pool Connected
              </p>
            </div>
          </div>

          {/* ROW 1: Line Chart, Area Chart & Stacked Area Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Monthly Revenue Growth Trajectory"
              subtitle="Verified CAPTURED payments over time (INR)"
              chartTypeBadge="Line Chart"
            >
              <SvgLineChart
                data={data.growthTrends.map((g) => ({
                  label: g.month,
                  primary: g.revenueInr,
                }))}
                lineColor="#10B981"
                unitSuffix=""
              />
            </ChartCardShell>

            <ChartCardShell
              title="Platform User Acquisition Curve"
              subtitle="Monthly account signups across all roles"
              chartTypeBadge="Area Chart"
            >
              <SvgAreaChart
                data={data.growthTrends.map((g) => ({
                  label: g.month,
                  value: g.users,
                }))}
                strokeColor="#06B6D4"
                gradientId="adminUsersArea"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Cumulative Platform Cashflow Stack"
              subtitle="Captured Revenue vs. Teacher Payouts vs. Redemptions"
              chartTypeBadge="Stacked Area Chart"
            >
              <SvgStackedAreaChart
                data={
                  charts?.cashflowStackedTrend.map((c) => ({
                    label: c.label,
                    s1: c.capturedInr,
                    s2: c.payoutsInr,
                    s3: c.redemptionsInr,
                  })) || []
                }
                seriesMeta={[
                  { label: 'Captured (₹)', color: '#10B981' },
                  { label: 'Teacher Payouts (₹)', color: '#06B6D4' },
                  { label: 'UPI Redemptions (₹)', color: '#8B5CF6' },
                ]}
              />
            </ChartCardShell>
          </div>

          {/* ROW 2: Donut Chart, Pie Chart & Sunburst Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Treasury & Payout Allocation"
              subtitle="Net Retained vs. Teacher Share vs. Wallet Redemptions"
              chartTypeBadge="Donut Chart"
            >
              <SvgDonutChart
                data={
                  charts?.financialTreasurySplit || [
                    { label: 'Net Treasury', value: 4500, color: '#10B981' },
                  ]
                }
                centerTitle="TREASURY"
                centerValue={`₹${data.kpis.revenueTodayInr}`}
              />
            </ChartCardShell>

            <ChartCardShell
              title="Enrollment Status Distribution"
              subtitle="Active, Completed, Pending Payment & Overdue"
              chartTypeBadge="Pie Chart"
            >
              <SvgPieChart
                data={
                  charts?.enrollmentStatusBreakdown || [
                    { label: 'Active', value: 1, color: '#10B981' },
                  ]
                }
              />
            </ChartCardShell>

            <ChartCardShell
              title="Category & Course Revenue Hierarchy"
              subtitle="Inner ring: Categories • Outer ring: Courses (INR)"
              chartTypeBadge="Sunburst Diagram"
            >
              <SvgSunburstChart
                nodes={
                  charts?.revenueSunburst || [
                    { label: 'Sciences', value: 13500, color: '#10B981' },
                  ]
                }
              />
            </ChartCardShell>
          </div>

          {/* ROW 3: Column Chart, Horizontal Bar Chart & Stacked Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Monthly Revenue Columns"
              subtitle="Vertical column comparison of monthly collections"
              chartTypeBadge="Column Chart"
            >
              <SvgColumnChart
                data={data.growthTrends.map((g) => ({
                  label: g.month,
                  value: g.revenueInr,
                  color: '#10B981',
                }))}
              />
            </ChartCardShell>

            <ChartCardShell
              title="Platform User Directory by Role"
              subtitle="Students, Teachers, Support Agents & Admins"
              chartTypeBadge="Bar Chart"
            >
              <SvgHorizontalBarChart
                data={
                  charts?.roleDistribution || [
                    { label: 'Users', value: data.kpis.totalUsers, color: '#06B6D4' },
                  ]
                }
              />
            </ChartCardShell>

            <ChartCardShell
              title="Course Installment Collection Breakdown"
              subtitle="Paid vs. Pending vs. Overdue Installments per Course"
              chartTypeBadge="Stacked Bar Chart"
            >
              <SvgStackedBarChart
                rows={charts?.courseRevenueAndInstallments || []}
                unitPrefix="₹"
              />
            </ChartCardShell>
          </div>

          {/* ROW 4: Heatmap, Radar Chart & System Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="RBAC Audit Activity Heatmap"
              subtitle="Role × Entity mutation intensity from audit_logs"
              chartTypeBadge="Heatmap"
            >
              <SvgHeatmapGrid
                cells={charts?.auditActivityHeatmap || []}
                accentRgb="6, 182, 212"
              />
            </ChartCardShell>

            <ChartCardShell
              title="5-Axis Platform Operational Radar"
              subtitle="VPS Health, Attendance, Catalog, Support SLA & Enrollments"
              chartTypeBadge="Radar Chart"
            >
              <SvgRadarChart
                axes={charts?.platformHealthRadar || []}
                strokeColor="#10B981"
              />
            </ChartCardShell>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <h2 className="text-sm font-bold mb-3">Database System Alerts</h2>
              {data.systemAlerts.length === 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  No overdue installments or pending UPI redemptions in database.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.systemAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          {alert.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/50 text-slate-200">
                          {alert.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {alert.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Audit Log Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
            <h2 className="text-sm font-bold mb-4">Live Audit Log & User Activity (`audit_logs`)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                  {data.liveAuditLogs.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-500 font-semibold mr-2">
                          {row.actorLabel}
                        </span>
                        {row.event}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{row.timestamp}</td>
                      <td className="py-3 px-3 font-medium">{row.operator}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RolePanelShell>
  );
}

// ============================================================================
// 2. STUDENT DASHBOARD VIEW (PROGRESS, ATTENDANCE, FEES, WALLET & ALL 11 CHARTS)
// ============================================================================

export function StudentDashboardView() {
  const { data, isLoading, isError, error, refetch } = useStudentDashboardQuery();
  const charts = data?.analyticsCharts;

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName={data ? `Student: ${data.studentProfile.fullName}` : 'Student Portal'}
      operatorSubtitle={data?.studentProfile.studentCode || 'Authenticated Student'}
      headerTitle={
        data
          ? `Welcome back, ${data.studentProfile.fullName} — Learning & Finance Telemetry`
          : 'Student Dashboard'
      }
    >
      {isLoading && (
        <ApiLoadingSkeleton label="Fetching your live progress, attendance, fee installments, wallet ledger & multi-chart analytics..." />
      )}
      {isError && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scoped strictly to your authenticated Student ID (`enrollments`, `installments`, `attendance_records`, `wallets`, `assignments`, `exams`)
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/student/performance"
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-cyan-500/40 text-cyan-400"
              >
                Certificate Eligibility →
              </Link>
              <Link
                href="/student/courses"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500 shadow"
              >
                Browse Course Catalog & Enroll →
              </Link>
            </div>
          </div>

          {/* Top 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-violet-500/30 bg-white dark:bg-[#131127] p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Available Wallet Balance</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                  ₹{data.studentProfile.walletAvailableInr}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Referral Code:{' '}
                  <strong className="text-cyan-500">
                    {data.studentProfile.referralCode || 'N/A'}
                  </strong>
                </p>
              </div>
              <Wallet className="w-8 h-8 text-violet-500" />
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-white dark:bg-[#131127] p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Session Attendance Rate</p>
                <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
                  {data.studentProfile.attendancePercent}%
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Computed from `attendance_records` (Min 75% required)
                </p>
              </div>
              <GraduationCap className="w-8 h-8 text-cyan-500" />
            </div>

            <div className="rounded-2xl border border-pink-500/30 bg-white dark:bg-[#131127] p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Next Assignment Countdown</p>
                <p className="text-2xl font-extrabold text-pink-500 font-mono">
                  {data.submissionCountdowns[0]?.remainingFormatted || '00:00:00'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {data.submissionCountdowns[0]?.title || 'All assignments up to date'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-pink-500" />
            </div>
          </div>

          {/* STUDENT CHARTS ROW 1: Donut Chart (Fees & Wallet), Pie Chart (Attendance) & Sunburst Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Fees, Installments & Wallet Split"
              subtitle="Paid Fees vs. Pending Installments vs. Wallet Balance (INR)"
              chartTypeBadge="Donut Chart"
            >
              <SvgDonutChart
                data={
                  charts?.feeBreakdownDonut || [
                    { label: 'Paid Fees', value: 4500, color: '#10B981' },
                    { label: 'Pending Dues', value: 9000, color: '#8B5CF6' },
                  ]
                }
                centerTitle="WALLET"
                centerValue={`₹${data.studentProfile.walletAvailableInr}`}
              />
            </ChartCardShell>

            <ChartCardShell
              title="Session Attendance Breakdown"
              subtitle="Present, Late, Excused & Absent session records"
              chartTypeBadge="Pie Chart"
            >
              <SvgPieChart
                data={
                  charts?.attendanceBreakdownPie || [
                    { label: 'Present', value: 1, color: '#10B981' },
                  ]
                }
              />
            </ChartCardShell>

            <ChartCardShell
              title="Student Learning & Fee Sunburst"
              subtitle="Concentric breakdown of Fees, Wallet & Course Mastery"
              chartTypeBadge="Sunburst Diagram"
            >
              <SvgSunburstChart
                nodes={
                  charts?.learningHierarchySunburst || [
                    { label: 'Course Fees', value: 13500, color: '#8B5CF6' },
                  ]
                }
              />
            </ChartCardShell>
          </div>

          {/* STUDENT CHARTS ROW 2: Column Chart (Course Progress), Bar Chart (Scores) & Stacked Bar Chart (Installments) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Course Progress & Completion %"
              subtitle="Your module completion across enrolled courses"
              chartTypeBadge="Column Chart"
            >
              <SvgColumnChart
                data={data.enrolledCourses.map((c) => ({
                  label: c.title.slice(0, 12),
                  value: c.progressPercent,
                  color: '#8B5CF6',
                }))}
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Assignment & Exam Score Comparison"
              subtitle="Graded submissions & published exam percentages"
              chartTypeBadge="Bar Chart"
            >
              <SvgHorizontalBarChart
                data={
                  charts?.assessmentScoresComparison &&
                  charts.assessmentScoresComparison.length > 0
                    ? charts.assessmentScoresComparison
                    : [{ label: 'Overall Progress', value: 88, color: '#06B6D4' }]
                }
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Course Fee Installment Schedule"
              subtitle="Paid vs. Upcoming vs. Overdue Installments per Course"
              chartTypeBadge="Stacked Bar Chart"
            >
              <SvgStackedBarChart
                rows={charts?.courseInstallmentStacked || []}
                unitPrefix="₹"
              />
            </ChartCardShell>
          </div>

          {/* STUDENT CHARTS ROW 3: Line Chart (Score Trajectory), Area Chart (Study Minutes) & Stacked Area Chart (Wallet Ledger) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Assessment Score Trajectory"
              subtitle="Your scores (%) vs. minimum pass threshold (dashed)"
              chartTypeBadge="Line Chart"
            >
              <SvgLineChart
                data={
                  charts?.scoreTrajectoryLine.map((s) => ({
                    label: s.label,
                    primary: s.scorePercent,
                    secondary: s.passThreshold,
                  })) || [{ label: 'Midterm', primary: 94, secondary: 50 }]
                }
                lineColor="#06B6D4"
                secondaryColor="#F59E0B"
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Live Classroom Participation Minutes"
              subtitle="Verified 100ms live session duration across courses"
              chartTypeBadge="Area Chart"
            >
              <SvgAreaChart
                data={
                  charts?.studyEngagementArea.map((s) => ({
                    label: s.label,
                    value: s.liveMinutes,
                  })) || [{ label: 'PHYS-401', value: 30 }]
                }
                strokeColor="#10B981"
                gradientId="studentStudyArea"
                unitSuffix="m"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Append-Only Wallet Ledger Flow"
              subtitle="Referral Credits vs. Course Debits vs. UPI Reservations"
              chartTypeBadge="Stacked Area Chart"
            >
              <SvgStackedAreaChart
                data={
                  charts?.walletLedgerStackedArea.map((w) => ({
                    label: w.label,
                    s1: w.creditsInr,
                    s2: w.debitsInr,
                    s3: w.reservedInr,
                  })) || []
                }
                seriesMeta={[
                  { label: 'Credits (₹)', color: '#10B981' },
                  { label: 'Course Debits (₹)', color: '#06B6D4' },
                  { label: 'UPI Reserved (₹)', color: '#F59E0B' },
                ]}
              />
            </ChartCardShell>
          </div>

          {/* STUDENT CHARTS ROW 4: Weekly Attendance Heatmap & 5-Axis Mastery Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="Weekly Course Attendance Heatmap"
              subtitle="Course × Day-of-Week verified attendance intensity"
              chartTypeBadge="Heatmap"
            >
              <SvgHeatmapGrid
                cells={charts?.weeklyAttendanceHeatmap || []}
                accentRgb="139, 92, 246"
              />
            </ChartCardShell>

            <ChartCardShell
              title="5-Axis Student Mastery Profile"
              subtitle="Progress, Attendance, Assessments, Fee Completion & Live Participation"
              chartTypeBadge="Radar Chart"
            >
              <SvgRadarChart
                axes={charts?.masteryRadar || []}
                strokeColor="#8B5CF6"
              />
            </ChartCardShell>
          </div>

          {/* Enrolled Courses & Upcoming Installments Cards */}
          <div>
            <h2 className="text-sm font-bold mb-3">Your Enrolled Courses (`enrollments`)</h2>
            {data.enrolledCourses.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 text-center space-y-2">
                <BookOpen className="w-6 h-6 text-violet-500 mx-auto" />
                <p className="text-xs font-semibold">You have no active course enrollments yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {data.enrolledCourses.map((course) => (
                  <div
                    key={course.enrollmentId}
                    className="rounded-2xl border border-violet-500/30 dark:border-cyan-500/30 bg-white/95 dark:bg-[#15132B]/90 p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 mb-3">
                        {course.status}
                      </span>
                      <h3 className="text-base font-bold mb-1">{course.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                        {course.subtitle}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-500">Progress</span>
                        <span className="font-bold text-cyan-500">{course.progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
                        <div
                          style={{ width: `${course.progressPercent}%` }}
                          className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Next Live Class: {course.nextLiveClassAt || 'None scheduled'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </RolePanelShell>
  );
}

// ============================================================================
// 3. TEACHER COCKPIT DASHBOARD VIEW (ALL 11 CHART TYPES)
// ============================================================================

export function TeacherDashboardView() {
  const { data: meData } = useCurrentUser();
  const { data, isLoading, isError, error, refetch } = useTeacherDashboardQuery();
  const charts = data?.analyticsCharts;

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName={meData?.user.fullName || 'Authenticated Teacher'}
      operatorSubtitle={meData?.user.email || 'Assigned Instructor'}
      headerTitle="Teacher's Cockpit & Cohort Multi-Chart Analytics"
    >
      {isLoading && (
        <ApiLoadingSkeleton label="Fetching your assigned courses, schedules, student performance & multi-chart telemetry..." />
      )}
      {isError && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scoped strictly to courses assigned to you in `course_teacher_assignments`
            </p>
            <Link
              href="/teacher/courses"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow"
            >
              Manage Assigned Courses & Materials →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <p className="text-xs text-slate-500">Assigned Students</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.assignedStudentsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <p className="text-xs text-slate-500">Average Cohort Grade</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.averageGradeLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <p className="text-xs text-slate-500">Next Class</p>
              <p className="text-sm font-extrabold mt-1">{data.kpis.nextClassTitle}</p>
              <p className="text-[11px] text-indigo-500 mt-1">
                Starts in {data.kpis.nextClassStartsInMinutes} mins
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
              <p className="text-xs text-slate-500">Today&apos;s Attendance</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.todayAttendancePercent}%</p>
            </div>
          </div>

          {/* TEACHER CHARTS ROW 1: Donut, Pie & Sunburst */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Assignment Evaluation Queue Split"
              subtitle="Graded vs. Submitted vs. Late vs. Resubmit Requested"
              chartTypeBadge="Donut Chart"
            >
              <SvgDonutChart
                data={
                  charts?.submissionStatusDonut || [
                    { label: 'Graded', value: 1, color: '#10B981' },
                  ]
                }
                centerTitle="AVG GRADE"
                centerValue={data.kpis.averageGradeLabel}
              />
            </ChartCardShell>

            <ChartCardShell
              title="Student Performance Band Split"
              subtitle="Excellent (>=80%), On Track (60-79%) & Critical (<60%)"
              chartTypeBadge="Pie Chart"
            >
              <SvgPieChart
                data={
                  charts?.cohortBandPie || [
                    { label: 'Excellent', value: 1, color: '#10B981' },
                  ]
                }
              />
            </ChartCardShell>

            <ChartCardShell
              title="Assigned Course & Revenue-Share Sunburst"
              subtitle="Inner ring: Assigned Courses • Outer ring: Cohort & Share"
              chartTypeBadge="Sunburst Diagram"
            >
              <SvgSunburstChart
                nodes={
                  charts?.teachingSunburst || [
                    { label: 'PHYS-401', value: 1350, color: '#6366F1' },
                  ]
                }
              />
            </ChartCardShell>
          </div>

          {/* TEACHER CHARTS ROW 2: Line, Area & Stacked Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Semester Cohort Score Trend"
              subtitle="Monthly average examination score (%) for assigned courses"
              chartTypeBadge="Line Chart"
            >
              <SvgLineChart
                data={data.semesterScoreTrend.map((s) => ({
                  label: s.label,
                  primary: s.averageScore,
                  secondary: 50,
                }))}
                lineColor="#6366F1"
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Student Score Distribution Curve"
              subtitle="Evaluated student score percentages across cohort"
              chartTypeBadge="Area Chart"
            >
              <SvgAreaChart
                data={data.studentPerformance.map((sp) => ({
                  label: sp.fullName,
                  value: sp.scorePercent,
                }))}
                strokeColor="#06B6D4"
                gradientId="teacherCohortArea"
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Assignment Submissions Stacked Flow"
              subtitle="Graded vs. Pending vs. Late submissions per assignment"
              chartTypeBadge="Stacked Area Chart"
            >
              <SvgStackedAreaChart
                data={
                  charts?.submissionsStackedArea.map((s) => ({
                    label: s.label,
                    s1: s.gradedCount,
                    s2: s.pendingCount,
                    s3: s.lateCount,
                  })) || []
                }
                seriesMeta={[
                  { label: 'Graded', color: '#10B981' },
                  { label: 'Pending', color: '#6366F1' },
                  { label: 'Late', color: '#F59E0B' },
                ]}
              />
            </ChartCardShell>
          </div>

          {/* TEACHER CHARTS ROW 3: Column, Bar & Stacked Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Student Exam Score Columns"
              subtitle="Individual student score percentages in your cohort"
              chartTypeBadge="Column Chart"
            >
              <SvgColumnChart
                data={data.studentPerformance.map((s) => ({
                  label: s.fullName.split(' ')[0],
                  value: s.scorePercent,
                  color: '#6366F1',
                }))}
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Assigned Course Revenue-Share %"
              subtitle="Your configured instructor revenue-share percentage"
              chartTypeBadge="Bar Chart"
            >
              <SvgHorizontalBarChart
                data={
                  charts?.courseRevenueShareBar || [
                    { label: 'PHYS-401 (PRIMARY)', value: 30, color: '#6366F1' },
                  ]
                }
                unitSuffix="%"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Course Session Attendance Stack"
              subtitle="Present, Late, Excused & Absent counts per course"
              chartTypeBadge="Stacked Bar Chart"
            >
              <SvgStackedBarChart rows={charts?.courseAttendanceStacked || []} />
            </ChartCardShell>
          </div>

          {/* TEACHER CHARTS ROW 4: Heatmap & Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="Assigned Course Engagement Matrix"
              subtitle="Course × Enrolled Students, Assignments & Attendance Sessions"
              chartTypeBadge="Heatmap"
            >
              <SvgHeatmapGrid
                cells={charts?.courseEngagementHeatmap || []}
                accentRgb="99, 102, 241"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Instructor Cockpit Telemetry Radar"
              subtitle="Cohort Avg, Today Attendance, Grading Completion & Readiness"
              chartTypeBadge="Radar Chart"
            >
              <SvgRadarChart
                axes={charts?.cockpitRadar || []}
                strokeColor="#6366F1"
              />
            </ChartCardShell>
          </div>
        </div>
      )}
    </RolePanelShell>
  );
}

// ============================================================================
// 4. SUPPORT COMMAND CENTER DASHBOARD VIEW (ALL 11 CHART TYPES)
// ============================================================================

export function SupportDashboardView() {
  const { data: meData } = useCurrentUser();
  const { data, isLoading, isError, error, refetch } = useSupportDashboardQuery();
  const charts = data?.analyticsCharts;

  return (
    <RolePanelShell
      role="SUPPORT"
      operatorName={meData?.user.fullName || 'Support Agent'}
      operatorSubtitle={meData?.user.email || 'Read-Only Finance Context'}
      headerTitle="Support Command Center & SLA Multi-Chart Telemetry"
    >
      {isLoading && (
        <ApiLoadingSkeleton label="Fetching live support ticket queues & SLA multi-chart telemetry..." />
      )}
      {isError && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-500/10 p-5">
              <p className="text-xs font-semibold text-rose-500">
                SLA Breach Risk ({data.kpis.slaBreachRiskCount})
              </p>
              <p className="text-2xl font-extrabold mt-1 text-rose-500">
                {data.kpis.slaBreachRiskCount} Tickets
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Unassigned Tickets</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.unassignedTicketsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Average Handle Time</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.averageHandleTimeLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Active Agents</p>
              <p className="text-2xl font-extrabold mt-1">{data.kpis.activeAgentsCount}</p>
            </div>
          </div>

          {/* SUPPORT CHARTS ROW 1: Donut, Pie & Sunburst */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Ticket Queue Status Split"
              subtitle="Incoming vs. In Triage vs. Escalated vs. Resolved"
              chartTypeBadge="Donut Chart"
            >
              <SvgDonutChart
                data={
                  charts?.statusDistributionDonut || [
                    { label: 'Incoming', value: 1, color: '#06B6D4' },
                  ]
                }
                centerTitle="SLA RISK"
                centerValue={`${data.kpis.slaBreachRiskCount} Tkt`}
              />
            </ChartCardShell>

            <ChartCardShell
              title="Ticket Priority Distribution"
              subtitle="Urgent Red (2h), High (4h), Medium (12h) & Low (24h)"
              chartTypeBadge="Pie Chart"
            >
              <SvgPieChart
                data={
                  charts?.priorityDistributionPie || [
                    { label: 'High', value: 1, color: '#F59E0B' },
                  ]
                }
              />
            </ChartCardShell>

            <ChartCardShell
              title="Support Triage Hierarchy Sunburst"
              subtitle="Inner ring: Active vs. Resolved • Outer ring: Queue stages"
              chartTypeBadge="Sunburst Diagram"
            >
              <SvgSunburstChart
                nodes={
                  charts?.supportHierarchySunburst || [
                    { label: 'Active Triage', value: 3, color: '#F59E0B' },
                  ]
                }
              />
            </ChartCardShell>
          </div>

          {/* SUPPORT CHARTS ROW 2: Column, Bar & Stacked Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Ticket Volume by Category"
              subtitle="Student, Teacher, Payment, Enrollment, Course & Live Class"
              chartTypeBadge="Column Chart"
            >
              <SvgColumnChart data={charts?.categoryVolumeColumn || []} />
            </ChartCardShell>

            <ChartCardShell
              title="Support Agent Open Workload"
              subtitle="Currently assigned open tickets per active agent"
              chartTypeBadge="Bar Chart"
            >
              <SvgHorizontalBarChart data={charts?.agentWorkloadBar || []} />
            </ChartCardShell>

            <ChartCardShell
              title="Category × Queue Status Stack"
              subtitle="Incoming, In Triage, Escalated & Resolved per category"
              chartTypeBadge="Stacked Bar Chart"
            >
              <SvgStackedBarChart rows={charts?.categoryStatusStackedBar || []} />
            </ChartCardShell>
          </div>

          {/* SUPPORT CHARTS ROW 3: Line, Area & Stacked Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCardShell
              title="Category Ticket Load Curve"
              subtitle="Ticket distribution across operational categories"
              chartTypeBadge="Line Chart"
            >
              <SvgLineChart
                data={
                  charts?.categoryVolumeColumn.map((c) => ({
                    label: c.label,
                    primary: c.value,
                  })) || []
                }
                lineColor="#F59E0B"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Priority Urgency Area Profile"
              subtitle="Volume concentration across SLA priority tiers"
              chartTypeBadge="Area Chart"
            >
              <SvgAreaChart
                data={
                  charts?.priorityDistributionPie.map((p) => ({
                    label: p.label,
                    value: p.value,
                  })) || []
                }
                strokeColor="#EF4444"
                gradientId="supportPriorityArea"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Public Replies vs. Internal Notes Stack"
              subtitle="Support communication activity stream"
              chartTypeBadge="Stacked Area Chart"
            >
              <SvgStackedAreaChart
                data={
                  charts?.commActivityStackedArea.map((c) => ({
                    label: c.label,
                    s1: c.publicReplies,
                    s2: c.internalNotes,
                    s3: c.escalations,
                  })) || []
                }
                seriesMeta={[
                  { label: 'Public Replies', color: '#06B6D4' },
                  { label: 'Internal Notes', color: '#F59E0B' },
                  { label: 'Escalations', color: '#EF4444' },
                ]}
              />
            </ChartCardShell>
          </div>

          {/* SUPPORT CHARTS ROW 4: Heatmap & Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="Priority × Category SLA Risk Heatmap"
              subtitle="Cross-tabulation of ticket priority against issue category"
              chartTypeBadge="Heatmap"
            >
              <SvgHeatmapGrid
                cells={charts?.categoryPriorityHeatmap || []}
                accentRgb="245, 158, 11"
              />
            </ChartCardShell>

            <ChartCardShell
              title="Support Operations SLA Radar"
              subtitle="SLA Compliance, Assignment Coverage, Agent Availability & Velocity"
              chartTypeBadge="Radar Chart"
            >
              <SvgRadarChart
                axes={charts?.slaComplianceRadar || []}
                strokeColor="#F59E0B"
              />
            </ChartCardShell>
          </div>

          {/* Kanban Ticket Queue */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
            <h2 className="text-sm font-bold mb-4">Live Kanban Ticket Queue (`support_tickets`)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['incoming', 'inTriage', 'escalated'] as const).map((colKey) => {
                const items = data.ticketQueues[colKey];
                return (
                  <div key={colKey} className="space-y-2.5">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      {colKey} ({items.length})
                    </p>
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No tickets in this queue.</p>
                    ) : (
                      items.map((tkt) => (
                        <div
                          key={tkt.ticketId}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70"
                        >
                          <p className="text-xs font-bold">{tkt.subject}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {tkt.ticketNumber} • {tkt.ageLabel}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </RolePanelShell>
  );
}
