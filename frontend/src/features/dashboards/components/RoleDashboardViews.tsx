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
// 2. STUDENT DASHBOARD VIEW (MY LEARNING + ALL 11 INTERACTIVE CHARTS)
// ============================================================================

export function StudentDashboardView() {
  const { data, isLoading, isError, error, refetch } = useStudentDashboardQuery();
  const [activeTab, setActiveTab] = React.useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'DEADLINES'>('ALL');
  const charts = data?.analyticsCharts;

  const enrolledCourses = data?.enrolledCourses || [];
  const primaryCourse =
    enrolledCourses.find((c) => c.progressPercent < 100) || enrolledCourses[0] || null;

  const filteredCourses = enrolledCourses.filter((c) => {
    if (activeTab === 'IN_PROGRESS') return c.progressPercent < 100;
    if (activeTab === 'COMPLETED') return c.progressPercent >= 100;
    return true;
  });

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName={data ? data.studentProfile.fullName : 'Student'}
      operatorSubtitle={data?.studentProfile.studentCode || 'Student Learner'}
      headerTitle={
        data ? `Welcome back, ${data.studentProfile.fullName.split(' ')[0]}!` : 'Student Dashboard'
      }
    >
      {isLoading && (
        <ApiLoadingSkeleton label="Loading your courses, learning progress, and dashboard charts..." />
      )}
      {isError && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 1. UDEMY / UDACITY "CONTINUE LEARNING" HERO CARD */}
          {primaryCourse ? (
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 text-white p-6 sm:p-8 shadow-xl border border-violet-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-500/30 text-violet-200 border border-violet-400/30">
                    Continue Where You Left Off
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                    {primaryCourse.status === 'ACTIVE' ? 'Enrolled & Active' : primaryCourse.status}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {primaryCourse.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  {primaryCourse.subtitle}
                </p>

                {/* Clean Progress Bar */}
                <div className="pt-1 space-y-1.5 max-w-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Course Progress</span>
                    <span className="font-bold text-cyan-300">
                      {primaryCourse.progressPercent}% Completed
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, primaryCourse.progressPercent)}%` }}
                      className="h-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-300"
                    />
                  </div>
                </div>

                {primaryCourse.nextLiveClassAt && (
                  <p className="text-xs text-cyan-300 flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    Next Live Session: <strong>{primaryCourse.nextLiveClassAt}</strong>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <Link
                  href={`/student/courses?courseId=${encodeURIComponent(primaryCourse.courseId)}`}
                  className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-white hover:bg-slate-100 shadow-lg text-center transition"
                >
                  Resume Course →
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/student/live-classes?courseId=${encodeURIComponent(primaryCourse.courseId)}`}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 text-center transition"
                  >
                    Live Classroom
                  </Link>
                  <Link
                    href={`/student/recorded-classes?courseId=${encodeURIComponent(primaryCourse.courseId)}`}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 text-center transition"
                  >
                    Recorded Videos
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-8 text-center space-y-3 shadow-lg">
              <BookOpen className="w-8 h-8 text-cyan-300 mx-auto" />
              <h2 className="text-lg font-extrabold">Start Your Learning Journey</h2>
              <p className="text-xs text-slate-200 max-w-md mx-auto">
                Browse our course catalog and enroll with a single payment or easy installment plan.
              </p>
              <Link
                href="/student/courses"
                className="inline-block px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-950 shadow"
              >
                Explore Course Catalog →
              </Link>
            </div>
          )}

          {/* 2. UDEMY-STYLE COURSE TABS */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `All My Courses (${enrolledCourses.length})` },
                  {
                    id: 'IN_PROGRESS',
                    label: `In Progress (${enrolledCourses.filter((c) => c.progressPercent < 100).length})`,
                  },
                  {
                    id: 'COMPLETED',
                    label: `Completed (${enrolledCourses.filter((c) => c.progressPercent >= 100).length})`,
                  },
                  {
                    id: 'DEADLINES',
                    label: `Upcoming Tasks (${data.submissionCountdowns.length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Link
              href="/student/courses"
              className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
            >
              + Browse More Courses
            </Link>
          </div>

          {/* 3. COURSE CARDS WITH COURSE-SCOPED LINKS (?courseId=...) */}
          {activeTab === 'DEADLINES' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.submissionCountdowns.length === 0 ? (
                <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-8 text-center text-xs text-slate-500">
                  🎉 You are all caught up! No pending assignment deadlines right now.
                </div>
              ) : (
                data.submissionCountdowns.map((item) => (
                  <div
                    key={item.assignmentId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-5 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase text-pink-500">
                        {item.courseTitle}
                      </span>
                      <h3 className="text-sm font-bold mt-0.5">{item.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Time Remaining:{' '}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {item.remainingFormatted}
                        </span>
                      </p>
                    </div>
                    <Link
                      href="/student/assignments"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white shrink-0"
                    >
                      Open Assignment →
                    </Link>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => (
                <div
                  key={course.enrollmentId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="h-24 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 p-4 flex items-start justify-between text-white">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/30 backdrop-blur-sm">
                        {course.status === 'ACTIVE' ? 'In Progress' : course.status}
                      </span>
                      <BookOpen className="w-5 h-5 text-white/80" />
                    </div>

                    <div className="p-5 space-y-2">
                      <h3 className="text-base font-bold leading-snug">{course.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {course.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">Completed</span>
                        <span className="font-bold text-violet-600 dark:text-violet-400">
                          {course.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(3, course.progressPercent)}%` }}
                          className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={`/student/courses?courseId=${encodeURIComponent(course.courseId)}`}
                        className="py-2 px-3 rounded-xl text-xs font-bold text-center bg-violet-600 hover:bg-violet-500 text-white transition"
                      >
                        Go to Course
                      </Link>
                      <Link
                        href={`/student/recorded-classes?courseId=${encodeURIComponent(course.courseId)}`}
                        className="py-2 px-3 rounded-xl text-xs font-semibold text-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Videos & Notes
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. QUICK KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/student/attendance"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-4 flex items-center justify-between hover:border-cyan-500/50 transition"
            >
              <div>
                <p className="text-xs text-slate-500">Attendance Rate</p>
                <p className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5">
                  {data.studentProfile.attendancePercent}%
                </p>
                <p className="text-[11px] text-slate-400">75% required for certificate</p>
              </div>
              <GraduationCap className="w-7 h-7 text-cyan-500 shrink-0" />
            </Link>

            <Link
              href="/student/examinations"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-4 flex items-center justify-between hover:border-violet-500/50 transition"
            >
              <div>
                <p className="text-xs text-slate-500">Exams & Assignments</p>
                <p className="text-sm font-bold mt-1 truncate">
                  {data.submissionCountdowns[0]?.title || 'View Quizzes & Grades'}
                </p>
                <p className="text-[11px] text-violet-500 font-semibold mt-0.5">
                  Open Practice & Exams →
                </p>
              </div>
              <Clock className="w-7 h-7 text-violet-500 shrink-0" />
            </Link>

            <Link
              href="/student/wallet"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-4 flex items-center justify-between hover:border-emerald-500/50 transition"
            >
              <div>
                <p className="text-xs text-slate-500">Learning Wallet & Referrals</p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ₹{data.studentProfile.walletAvailableInr}
                </p>
                <p className="text-[11px] text-slate-400">
                  Referral Code: <strong>{data.studentProfile.referralCode || 'Invite Friends'}</strong>
                </p>
              </div>
              <Wallet className="w-7 h-7 text-emerald-500 shrink-0" />
            </Link>
          </div>

          {/* ==================================================================
              5. ALL 11 INTERACTIVE DASHBOARD CHARTS SUITE
             ================================================================== */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
            <div>
              <h2 className="text-base font-extrabold">Learning, Attendance & Finance Analytics</h2>
              <p className="text-xs text-slate-500">
                Visual breakdown of your course progress, session attendance, assessment scores, and fee installments
              </p>
            </div>

            {/* ROW 1: Donut Chart, Pie Chart & Sunburst Diagram */}
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

            {/* ROW 2: Column Chart, Horizontal Bar Chart & Stacked Bar Chart */}
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

            {/* ROW 3: Line Chart, Area Chart & Stacked Area Chart */}
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

            {/* ROW 4: Weekly Attendance Heatmap & 5-Axis Mastery Radar */}
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
