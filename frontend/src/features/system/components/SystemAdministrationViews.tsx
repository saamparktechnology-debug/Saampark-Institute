'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useAuditLogsQuery,
  useExecutiveReportsQuery,
  useExportDatasetMutation,
  usePlatformSettingsQuery,
  useUpdatePlatformSettingsMutation,
  useVpsReadinessQuery,
} from '../hooks/system.hook';
import {
  AUDIT_ENTITY_TYPES,
  EXPORTABLE_DATASETS,
} from '../system.constant';
import { DatasetExportResult } from '../types/system.types';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Search,
  Server,
  Settings,
  ShieldAlert,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
} from 'lucide-react';

const platformSettingsSchema = z.object({
  instituteName: z.string().trim().min(3).max(150),
  defaultCurrency: z.string().trim().length(3),
  defaultTimezone: z.string().trim().min(3).max(64),
  defaultReferralRewardInr: z.coerce.number().min(0).max(50000),
  minUpiRedemptionInr: z.coerce.number().min(10).max(100000),
  defaultInstallmentGraceDays: z.coerce.number().int().min(0).max(30),
  defaultAttendanceExpiryMinutes: z.coerce.number().int().min(1).max(120),
  defaultMinAttendancePercent: z.coerce.number().min(0).max(100),
  defaultMinPassMarksPercent: z.coerce.number().min(0).max(100),
  maintenanceMode: z.boolean().default(false),
});
type PlatformSettingsFormValues = z.infer<typeof platformSettingsSchema>;

function triggerBrowserDownload(exported: DatasetExportResult) {
  if (typeof window === 'undefined') return;
  const mime =
    exported.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
  const blob = new Blob([exported.content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exported.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 1. ADMIN REPORTS & CSV/JSON EXPORTS VIEW (/admin/reports)
// ============================================================================

export function AdminReportsAndExportsView() {
  const { data: reports, isLoading, refetch } = useExecutiveReportsQuery();
  const exportMutation = useExportDatasetMutation();

  const [selectedDataset, setSelectedDataset] = useState<
    'payments' | 'enrollments' | 'payouts' | 'attendance' | 'audit_logs'
  >('payments');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv');
  const [lastExport, setLastExport] = useState<DatasetExportResult | null>(null);

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Executive Reports & Exports"
      operatorSubtitle="CSV Formula-Injection Sanitized"
      headerTitle="Financial, Academic & Operational Reports + CSV/JSON Exports"
    >
      <div className="space-y-6">
        {/* Dataset Export Generator */}
        <div className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Platform Datasets (`GET /api/v1/system/reports/export`)
              </h2>
              <p className="text-xs text-slate-500">
                Generates formula-injection-sanitized CSV or structured JSON exports directly from MySQL and logs an `ADMIN_REPORT_EXPORTED` audit entry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedDataset}
              onChange={(e) =>
                setSelectedDataset(
                  e.target.value as
                    | 'payments'
                    | 'enrollments'
                    | 'payouts'
                    | 'attendance'
                    | 'audit_logs'
                )
              }
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {EXPORTABLE_DATASETS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as 'csv' | 'json')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="csv">CSV Spreadsheet (.csv)</option>
              <option value="json">Structured JSON (.json)</option>
            </select>

            <button
              type="button"
              disabled={exportMutation.isPending}
              onClick={() =>
                exportMutation.mutate(
                  { dataset: selectedDataset, format: selectedFormat },
                  {
                    onSuccess: (res) => {
                      setLastExport(res);
                      triggerBrowserDownload(res);
                    },
                  }
                )
              }
              className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />{' '}
              {exportMutation.isPending ? 'Generating Export...' : 'Generate & Download Export'}
            </button>
          </div>

          {lastExport && (
            <div className="p-4 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-400 font-mono">
                <span>
                  Generated: {lastExport.fileName} ({lastExport.rowCount} rows)
                </span>
                <span>{new Date(lastExport.generatedAt).toLocaleTimeString()}</span>
              </div>
              <pre className="overflow-x-auto max-h-40 text-[11px] font-mono text-slate-400">
                {lastExport.content.slice(0, 1200)}
              </pre>
            </div>
          )}
        </div>

        {isLoading && <p className="text-xs text-slate-500">Loading executive reports...</p>}

        {reports && (
          <>
            {/* Financial & Academic Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Total Captured Revenue</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1 flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {reports.financialSummary.totalCapturedRevenueInr}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {reports.financialSummary.capturedTransactionsCount} verified transaction(s)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Teacher Revenue-Share Payouts</p>
                <p className="text-2xl font-extrabold text-cyan-400 mt-1">
                  ₹{reports.financialSummary.totalTeacherPayoutsInr}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Outstanding Installments: ₹{reports.financialSummary.outstandingInstallmentsInr}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Active & Completed Enrollments</p>
                <p className="text-2xl font-extrabold mt-1">
                  {reports.academicSummary.activeEnrollmentsCount +
                    reports.academicSummary.completedEnrollmentsCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Certificates Issued: {reports.academicSummary.issuedCertificatesCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <p className="text-xs text-slate-500">Platform Attendance & Support SLA</p>
                <p className="text-2xl font-extrabold text-violet-400 mt-1">
                  {reports.academicSummary.overallAttendancePercent}% Att.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ticket Resolution Rate: {reports.academicSummary.ticketResolutionPercent}%
                </p>
              </div>
            </div>

            {/* Course-by-Course Financial & Academic Breakdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Course-by-Course Revenue & Enrollment Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 px-3">Course</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Base Price</th>
                      <th className="py-2 px-3">Enrollments</th>
                      <th className="py-2 px-3">Live Sessions</th>
                      <th className="py-2 px-3">Certificates</th>
                      <th className="py-2 px-3 text-right">Captured Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {reports.coursePerformanceBreakdown.map((c) => (
                      <tr key={c.courseId}>
                        <td className="py-2.5 px-3 font-semibold">
                          <span className="font-mono text-cyan-400 mr-1.5">{c.courseCode}</span>
                          {c.courseTitle}
                        </td>
                        <td className="py-2.5 px-3">{c.status}</td>
                        <td className="py-2.5 px-3 font-mono">₹{c.basePriceInr}</td>
                        <td className="py-2.5 px-3 font-mono">{c.enrollmentsCount}</td>
                        <td className="py-2.5 px-3 font-mono">{c.liveClassesCount}</td>
                        <td className="py-2.5 px-3 font-mono">{c.certificatesIssuedCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          ₹{c.capturedRevenueInr}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. APPEND-ONLY AUDIT LOG EXPLORER VIEW (/admin/audit-logs)
// ============================================================================

export function AdminAuditLogsExplorerView() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string>('');

  const filters: Record<string, string> = {};
  if (entityTypeFilter) filters.entityType = entityTypeFilter;
  if (searchQuery.trim()) filters.search = searchQuery.trim();

  const { data, isLoading, refetch } = useAuditLogsQuery(filters);

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Security & Compliance Auditor"
      operatorSubtitle="Append-Only Immutable Ledger"
      headerTitle="Append-Only Audit Log Explorer (`audit_logs`)"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action, entityId, or reason..."
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">All Entity Types</option>
              {AUDIT_ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Ledger
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" /> Immutable Audit Events (`GET /api/v1/system/audit-logs`)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading audit events...</p>}

          <div className="space-y-2.5">
            {data?.items.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono font-bold">
                      {log.action}
                    </span>
                    <span className="font-mono text-slate-400">
                      {log.entityType} ({log.entityId.slice(0, 12)})
                    </span>
                    <span className="text-slate-500">
                      Actor: <strong>{log.actorName}</strong> ({log.actorRole})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    {(log.beforeDataJson || log.afterDataJson) && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expandedId === log.id ? '' : log.id)
                        }
                        className="text-violet-400 font-semibold hover:underline"
                      >
                        {expandedId === log.id ? 'Hide JSON' : 'Inspect JSON'}
                      </button>
                    )}
                  </div>
                </div>

                {log.reason && (
                  <p className="text-[11px] text-amber-400">
                    Audit Reason: {log.reason}
                  </p>
                )}

                {expandedId === log.id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                    <div className="p-2.5 rounded-lg bg-slate-950 text-slate-300 overflow-x-auto">
                      <p className="text-slate-500 mb-1">Before Snapshot:</p>
                      <pre>{log.beforeDataJson || 'null'}</pre>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 text-emerald-300 overflow-x-auto">
                      <p className="text-slate-500 mb-1">After Snapshot:</p>
                      <pre>{log.afterDataJson || 'null'}</pre>
                    </div>
                  </div>
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
// 3. PLATFORM SETTINGS & HOSTINGER VPS READINESS VIEW (/admin/settings)
// ============================================================================

export function AdminPlatformSettingsView() {
  const { data: settings, isLoading } = usePlatformSettingsQuery();
  const { data: vpsHealth } = useVpsReadinessQuery();
  const updateMutation = useUpdatePlatformSettingsMutation();

  const form = useForm<PlatformSettingsFormValues>({
    resolver: zodResolver(platformSettingsSchema),
    values: settings
      ? {
          instituteName: settings.instituteName,
          defaultCurrency: settings.defaultCurrency,
          defaultTimezone: settings.defaultTimezone,
          defaultReferralRewardInr: settings.defaultReferralRewardInr,
          minUpiRedemptionInr: settings.minUpiRedemptionInr,
          defaultInstallmentGraceDays: settings.defaultInstallmentGraceDays,
          defaultAttendanceExpiryMinutes: settings.defaultAttendanceExpiryMinutes,
          defaultMinAttendancePercent: settings.defaultMinAttendancePercent,
          defaultMinPassMarksPercent: settings.defaultMinPassMarksPercent,
          maintenanceMode: settings.maintenanceMode,
        }
      : undefined,
  });

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Platform Configuration"
      operatorSubtitle="Single-Institute Operational Thresholds"
      headerTitle="Platform Settings & Hostinger VPS Production Readiness"
    >
      <div className="space-y-6">
        {/* Hostinger VPS Live Telemetry Card */}
        {vpsHealth && (
          <div className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" /> Hostinger VPS Runtime & Adapter Readiness (`GET /api/v1/system/vps-readiness`)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500">Node.js Runtime</p>
                <p className="font-mono font-bold text-sm mt-0.5">{vpsHealth.nodeVersion}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500">Timezone</p>
                <p className="font-mono font-bold text-sm mt-0.5">{vpsHealth.timezone}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500">Memory RSS / Heap</p>
                <p className="font-mono font-bold text-sm mt-0.5">
                  {vpsHealth.rssMemoryMb} MB / {vpsHealth.heapUsedMb} MB
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500">Storage Driver</p>
                <p className="font-mono font-bold text-sm text-cyan-400 mt-0.5">
                  {vpsHealth.storageDriver}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(vpsHealth.adapters).map(([key, status]) => (
                <span
                  key={key}
                  className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {key}: {status}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Configurable Operational Settings Form */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" /> Institute Operational Thresholds (`GET/PATCH /api/v1/system/settings`)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading platform settings...</p>}

          <form
            onSubmit={form.handleSubmit((vals) => updateMutation.mutate(vals))}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
          >
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1">Institute Display Name</label>
              <input
                type="text"
                {...form.register('instituteName')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Default Timezone</label>
              <input
                type="text"
                {...form.register('defaultTimezone')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Default Referral Reward (INR ₹)
              </label>
              <input
                type="number"
                {...form.register('defaultReferralRewardInr')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Minimum UPI Redemption (INR ₹)
              </label>
              <input
                type="number"
                {...form.register('minUpiRedemptionInr')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Default Installment Grace Days
              </label>
              <input
                type="number"
                {...form.register('defaultInstallmentGraceDays')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Attendance Code Expiry (Minutes)
              </label>
              <input
                type="number"
                {...form.register('defaultAttendanceExpiryMinutes')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Certificate Min Attendance %
              </label>
              <input
                type="number"
                {...form.register('defaultMinAttendancePercent')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Certificate Min Exam Pass %
              </label>
              <input
                type="number"
                {...form.register('defaultMinPassMarksPercent')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="md:col-span-3 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">
                Last audited update: {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'} by{' '}
                <strong>{settings?.updatedBy || 'System'}</strong>
              </span>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500"
              >
                {updateMutation.isPending
                  ? 'Saving & Auditing Settings...'
                  : 'Save Platform Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RolePanelShell>
  );
}
