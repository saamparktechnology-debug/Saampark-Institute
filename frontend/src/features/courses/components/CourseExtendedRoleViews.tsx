'use client';

import React, { useState } from 'react';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useAdminAssignEnrollmentMutation,
  useBroadcastCourseAnnouncementMutation,
  useCourseDetailQuery,
  useCourseDoubtsQuery,
  useCourseMaterialsQuery,
  useCreateCourseDoubtMutation,
  useDownloadMaterialMutation,
  useReplyCourseDoubtMutation,
  useCoursesListQuery,
  useEnrollmentsListQuery,
  useTeacherStudentsRosterQuery,
  useToggleLessonCompleteMutation,
  useUpdateOnboardingStateMutation,
  useUsersListQuery,
  useVerifyInstallmentPaymentMutation,
} from '../hooks/courses.hook';
import {
  useNudgeStudentOmnichannelMutation,
  useOmnichannelSettingsQuery,
} from '@/features/operations/hooks/operations.hook';
import { RazorpayInstallmentPayButton } from '@/features/finance/components/RazorpayCheckoutModal';
import {
  MaterialFileUploadZone,
  triggerMaterialBinaryDownload,
} from './MaterialFileUploadZone';
import { EnrollmentItem, MaterialDownloadPayload } from '../types/courses.types';
import {
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  MessageSquare,
  Mail,
  Send,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Search,
  ShieldCheck,
  PlayCircle,
} from 'lucide-react';

// ============================================================================
// 1. REUSABLE 4-STEP GUIDED STUDENT COURSE ONBOARDING WIZARD CARD
// ============================================================================

export function StudentCourseOnboardingWizardCard({
  enrollment,
  onOpenClassroom,
}: {
  enrollment: EnrollmentItem;
  onOpenClassroom?: (courseId: string) => void;
}) {
  const updateOnboardingMutation = useUpdateOnboardingStateMutation();
  const onboarding = enrollment.onboarding || {
    enrollmentId: enrollment.id,
    step1PlanAndPaymentVerified:
      enrollment.status === 'ACTIVE' || enrollment.status === 'COMPLETED',
    step2AcademicPolicyAccepted: false,
    step3WhatsappAlertsOptIn: Boolean(enrollment.studentPhone),
    whatsappNumber: enrollment.studentPhone || '',
    step4StarterKitAndFirstLesson: false,
    completedStepsCount:
      enrollment.status === 'ACTIVE' || enrollment.status === 'COMPLETED' ? 1 : 0,
    isCompleted: false,
    completedAt: null,
  };

  const [whatsappInput, setWhatsappInput] = useState<string>(
    onboarding.whatsappNumber || enrollment.studentPhone || '+91-'
  );

  return (
    <div className="rounded-2xl border border-violet-500/40 bg-slate-50/70 dark:bg-[#181534] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-bold">
            Guided Course Onboarding Checklist ({onboarding.completedStepsCount}/4 Completed)
          </span>
          {onboarding.isCompleted ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
              Onboarded ✓
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
              Action Required
            </span>
          )}
        </div>

        <span className="text-[11px] font-mono text-cyan-400">
          Course Progress: {enrollment.progressPercent}%
        </span>
      </div>

      {/* 4-Step Progress Bar */}
      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          style={{ width: `${(onboarding.completedStepsCount / 4) * 100}%` }}
          className="h-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-300"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
        {/* Step 1: Plan & 1st Installment Verification */}
        <div
          className={`p-3 rounded-xl border ${
            onboarding.step1PlanAndPaymentVerified
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          } space-y-1.5`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase">Step 1 of 4</span>
            {onboarding.step1PlanAndPaymentVerified && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <p className="font-bold">1st Installment / Full Fee Verified</p>
          <p className="text-[11px] text-slate-500">
            {onboarding.step1PlanAndPaymentVerified
              ? 'Verified via Razorpay! Full course curriculum & materials unlocked.'
              : 'Complete your 1st installment via Razorpay below to unlock full course access.'}
          </p>
        </div>

        {/* Step 2: Academic & Attendance Policy Sign-Off */}
        <div
          className={`p-3 rounded-xl border ${
            onboarding.step2AcademicPolicyAccepted
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          } flex flex-col justify-between gap-2`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-cyan-400">
                Step 2 of 4
              </span>
              {onboarding.step2AcademicPolicyAccepted && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="font-bold mt-1">Academic & Attendance Pledge</p>
            <p className="text-[11px] text-slate-500">
              Acknowledge ≥75% session attendance & ≥50% exam pass threshold for certification.
            </p>
          </div>
          <button
            type="button"
            disabled={updateOnboardingMutation.isPending}
            onClick={() =>
              updateOnboardingMutation.mutate({
                enrollmentId: enrollment.id,
                step2AcademicPolicyAccepted: !onboarding.step2AcademicPolicyAccepted,
              })
            }
            className={`w-full py-1.5 px-2.5 rounded-lg font-bold text-[11px] cursor-pointer ${
              onboarding.step2AcademicPolicyAccepted
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-violet-600 text-white'
            }`}
          >
            {onboarding.step2AcademicPolicyAccepted
              ? 'Policy Accepted ✓'
              : 'Accept Academic Policy'}
          </button>
        </div>

        {/* Step 3: WhatsApp & Email Study Alerts Opt-In */}
        <div
          className={`p-3 rounded-xl border ${
            onboarding.step3WhatsappAlertsOptIn
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          } flex flex-col justify-between gap-2`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-emerald-400">
                Step 3 of 4
              </span>
              {onboarding.step3WhatsappAlertsOptIn && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="font-bold mt-1">WhatsApp & Email Study Alerts</p>
            <input
              type="text"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              placeholder="+91-9876543210"
              className="w-full mt-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
            />
          </div>
          <button
            type="button"
            disabled={updateOnboardingMutation.isPending}
            onClick={() =>
              updateOnboardingMutation.mutate({
                enrollmentId: enrollment.id,
                step3WhatsappAlertsOptIn: true,
                whatsappNumber: whatsappInput,
              })
            }
            className="w-full py-1.5 px-2.5 rounded-lg font-bold text-[11px] bg-emerald-600 text-white cursor-pointer"
          >
            {onboarding.step3WhatsappAlertsOptIn
              ? 'WhatsApp Opt-In Saved ✓'
              : 'Save WhatsApp & Opt-In'}
          </button>
        </div>

        {/* Step 4: Starter Kit & First Lesson Launch */}
        <div
          className={`p-3 rounded-xl border ${
            onboarding.step4StarterKitAndFirstLesson
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          } flex flex-col justify-between gap-2`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-violet-400">
                Step 4 of 4
              </span>
              {onboarding.step4StarterKitAndFirstLesson && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="font-bold mt-1">Launch Classroom & Lesson 1</p>
            <p className="text-[11px] text-slate-500">
              Complete orientation, open your course syllabus, and start Lesson 1.
            </p>
          </div>
          <button
            type="button"
            disabled={updateOnboardingMutation.isPending}
            onClick={() => {
              updateOnboardingMutation.mutate({
                enrollmentId: enrollment.id,
                step4StarterKitAndFirstLesson: true,
              });
              if (onOpenClassroom) {
                onOpenClassroom(enrollment.courseId);
              }
            }}
            className="w-full py-1.5 px-2.5 rounded-lg font-bold text-[11px] bg-gradient-to-r from-violet-500 to-cyan-500 text-white cursor-pointer"
          >
            {onboarding.step4StarterKitAndFirstLesson
              ? 'Classroom Launched ✓'
              : 'Complete & Open Lesson 1 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. ADMIN ENROLLMENTS & DIRECT STUDENT ADMISSION VIEW (/admin/enrollments)
// ============================================================================

export function AdminEnrollmentsManagementView() {
  const { data: enrollments = [], isLoading } = useEnrollmentsListQuery();
  const { data: coursesData } = useCoursesListQuery();
  const { data: usersData } = useUsersListQuery({ role: 'STUDENT' });

  const adminAssignMutation = useAdminAssignEnrollmentMutation();
  const verifyPaymentMutation = useVerifyInstallmentPaymentMutation();

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [admissionMode, setAdmissionMode] = useState<
    'VERIFY_FIRST_INSTALLMENT' | 'FULL_SCHOLARSHIP' | 'PENDING_PAYMENT'
  >('VERIFY_FIRST_INSTALLMENT');
  const [notes] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const students = (usersData?.items || []).filter((u) => u.role === 'STUDENT');
  const courses = coursesData?.items || [];
  const chosenCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const filteredEnrollments = enrollments.filter((e) =>
    statusFilter === 'ALL' ? true : e.status === statusFilter
  );

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Enrollment & Admissions Desk"
      operatorSubtitle="Onboarding, Scholarships & Installments"
      headerTitle="Enrollment Management, Direct Admission & Onboarding Tracker"
    >
      <div className="space-y-6">
        {/* Admin Direct Student Admission & Scholarship Onboarding Card */}
        <div className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" /> Direct Student Admission & Scholarship Onboarding (`POST /api/v1/enrollments/admin-assign`)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Directly enroll a student into a course (Offline Cash/NEFT 1st Installment Verified, 100% Scholarship Waiver, or Pending Payment) and automatically dispatch their Email + WhatsApp Onboarding Welcome alert.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email})
                </option>
              ))}
            </select>

            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedPlanId('');
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">Select Payment Plan...</option>
              {(chosenCourse?.paymentPlanTemplates || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{p.totalAmount} • {p.installmentCount}x)
                </option>
              ))}
            </select>

            <select
              value={admissionMode}
              onChange={(e) =>
                setAdmissionMode(
                  e.target.value as
                    | 'VERIFY_FIRST_INSTALLMENT'
                    | 'FULL_SCHOLARSHIP'
                    | 'PENDING_PAYMENT'
                )
              }
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="VERIFY_FIRST_INSTALLMENT">
                Verify 1st Installment (Activate + Welcome Alert)
              </option>
              <option value="FULL_SCHOLARSHIP">
                100% Scholarship Waiver (Activate + Welcome Alert)
              </option>
              <option value="PENDING_PAYMENT">
                Pending Student Payment
              </option>
            </select>

            <button
              type="button"
              disabled={
                !selectedStudentId ||
                !(selectedCourseId || chosenCourse?.id) ||
                !(selectedPlanId || chosenCourse?.paymentPlanTemplates[0]?.id) ||
                adminAssignMutation.isPending
              }
              onClick={() => {
                const cId = selectedCourseId || chosenCourse?.id || '';
                const pId =
                  selectedPlanId || chosenCourse?.paymentPlanTemplates[0]?.id || '';
                adminAssignMutation.mutate({
                  studentId: selectedStudentId,
                  courseId: cId,
                  paymentPlanTemplateId: pId,
                  admissionMode,
                  notes: notes || 'Admin Direct Admission',
                });
              }}
              className="py-2 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 cursor-pointer"
            >
              {adminAssignMutation.isPending ? 'Enrolling...' : '+ Enroll & Onboard Student'}
            </button>
          </div>
        </div>

        {/* Platform Enrollments, Installments & Onboarding Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-cyan-400" /> Platform Enrollments, Installments & Onboarding Status (`GET /api/v1/enrollments`)
            </h2>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(['ALL', 'ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED_OVERDUE', 'COMPLETED'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                      statusFilter === st
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          {isLoading && <p className="text-xs text-slate-500">Loading enrollments...</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Plan & Snapshot</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Onboarding</th>
                  <th className="py-2.5 px-3">Lesson Progress</th>
                  <th className="py-2.5 px-3 text-right">Admin Offline Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {filteredEnrollments.map((enr) => {
                  const nextPending = enr.installments.find((i) => i.status === 'PENDING');
                  const onb = enr.onboarding;
                  return (
                    <tr key={enr.id}>
                      <td className="py-3 px-3">
                        <p className="font-bold">{enr.studentFullName}</p>
                        <p className="text-[11px] text-slate-500">{enr.studentEmail}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-cyan-400 font-bold mr-1.5">
                          {enr.courseCode}
                        </span>
                        {enr.courseTitle}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {enr.planTypeSnapshot} • ₹{enr.purchasedPriceSnapshot}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            enr.status === 'ACTIVE' || enr.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {enr.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            onb?.isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-violet-500/15 text-violet-400'
                          }`}
                        >
                          {onb ? `${onb.completedStepsCount}/4 Steps` : '1/4 Steps'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Number(enr.progressPercent))}%` }}
                              className="h-full bg-cyan-400"
                            />
                          </div>
                          <span className="font-mono text-[11px]">{enr.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {nextPending ? (
                          <button
                            type="button"
                            disabled={verifyPaymentMutation.isPending}
                            onClick={() =>
                              verifyPaymentMutation.mutate({
                                enrollmentId: enr.id,
                                installmentSequenceNumber: nextPending.sequenceNumber,
                                provider: 'MANUAL',
                                providerPaymentId: `adm_ver_${nextPending.id.slice(0, 8)}`,
                                idempotencyKey: `adm_idem_${nextPending.id}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Mark Offline Paid Inst #{nextPending.sequenceNumber} (₹{nextPending.amount})
                          </button>
                        ) : (
                          <span className="text-emerald-400 font-semibold text-[11px]">
                            All Paid ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. STUDENT INSTALLMENTS, DUES & ONBOARDING VIEW (/student/enrollments)
// ============================================================================

export function StudentInstallmentsAndDuesView() {
  const { data: enrollments = [], isLoading } = useEnrollmentsListQuery();

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Installments & Onboarding"
      operatorSubtitle="Razorpay Checkout + Immutable Schedule (C-027)"
      headerTitle="My Course Installments, Razorpay Checkout & Onboarding Status"
    >
      <div className="space-y-6">
        {isLoading && <p className="text-xs text-slate-500">Loading your installment schedules...</p>}

        {enrollments.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-8 text-center text-xs text-slate-500">
            You have no active or pending course installment schedules yet. Visit My Courses to enroll.
          </div>
        )}

        {enrollments.map((enr) => (
          <div
            key={enr.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-cyan-400">{enr.courseCode}</span>
                <h2 className="text-base font-bold">{enr.courseTitle}</h2>
                <p className="text-xs text-slate-500">
                  Plan: <strong>{enr.planTypeSnapshot}</strong> • Total Snapshot: ₹{enr.purchasedPriceSnapshot}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  enr.status === 'ACTIVE' || enr.status === 'COMPLETED'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                Status: {enr.status}
              </span>
            </div>

            {/* 4-Step Guided Onboarding Wizard */}
            <StudentCourseOnboardingWizardCard enrollment={enr} />

            {/* Installment Breakdown Cards */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> Installment Schedule & Razorpay Instant Checkout
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {enr.installments.map((inst) => (
                  <div
                    key={inst.id}
                    className={`p-4 rounded-xl border text-xs flex flex-col justify-between gap-3 ${
                      inst.status === 'PAID' || inst.status === 'WAIVED'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-amber-500/40 bg-amber-500/5'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Installment #{inst.sequenceNumber}</span>
                        <span className="font-mono font-extrabold text-sm">₹{inst.amount}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Due Date: {new Date(inst.dueAt).toLocaleDateString()} • Grace Ends:{' '}
                        {new Date(inst.graceEndsAt).toLocaleDateString()}
                      </p>
                      <p className="text-[11px] font-semibold mt-1">
                        Status:{' '}
                        <span
                          className={
                            inst.status === 'PAID' || inst.status === 'WAIVED'
                              ? 'text-emerald-400 font-bold'
                              : 'text-amber-400 font-bold'
                          }
                        >
                          {inst.status === 'PAID' ? 'PAID ✓' : inst.status}
                        </span>
                      </p>
                    </div>

                    {inst.status !== 'PAID' && inst.status !== 'WAIVED' ? (
                      <RazorpayInstallmentPayButton
                        enrollmentId={enr.id}
                        installmentId={inst.id}
                        sequenceNumber={inst.sequenceNumber}
                        amount={inst.amount}
                        currency={inst.currency}
                        courseTitle={`${enr.courseCode} — ${enr.courseTitle}`}
                        studentName={enr.studentFullName}
                        studentEmail={enr.studentEmail}
                        studentPhone={enr.studentPhone}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          PAID ✓ • Verified on{' '}
                          {inst.paidAt ? new Date(inst.paidAt).toLocaleDateString() : 'Admission'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3B. REUSABLE COURSE DOUBTS & Q&A DISCUSSION FORUM COMPONENT
// ============================================================================

export function CourseDoubtsForumSection({
  courseId,
  role,
}: {
  courseId: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}) {
  const { data: doubts = [], isLoading } = useCourseDoubtsQuery(courseId);
  const createDoubtMutation = useCreateCourseDoubtMutation();
  const replyDoubtMutation = useReplyCourseDoubtMutation();

  const [lessonTitle, setLessonTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [replyByDoubtId, setReplyByDoubtId] = useState<Record<string, string>>({});

  if (!courseId) return null;

  return (
    <div className="rounded-2xl border border-violet-500/40 bg-white dark:bg-[#131127] p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" /> Course Q&A & Discussion Forum
          </h2>
          <p className="text-xs text-slate-500">
            Post lesson-specific academic doubts. When an instructor replies, the student automatically receives a WhatsApp + Email alert.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Lesson / Topic (e.g. Lesson 2 Wave Packet)"
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
        />
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Doubt Subject / Headline"
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
        />
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Describe your question or formula step..."
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
        />
        <button
          type="button"
          disabled={!subject.trim() || !question.trim() || createDoubtMutation.isPending}
          onClick={() =>
            createDoubtMutation.mutate(
              {
                courseId,
                lessonTitle: lessonTitle || undefined,
                subject,
                question,
              },
              {
                onSuccess: () => {
                  setLessonTitle('');
                  setSubject('');
                  setQuestion('');
                },
              }
            )
          }
          className="py-2 px-4 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-white cursor-pointer"
        >
          {createDoubtMutation.isPending ? 'Posting...' : '+ Post Academic Doubt'}
        </button>
      </div>

      {isLoading && <p className="text-xs text-slate-500">Loading course doubt threads...</p>}

      <div className="space-y-3">
        {doubts.map((d) => (
          <div
            key={d.id}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    d.status === 'RESOLVED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {d.status}
                </span>
                {d.lessonTitle && (
                  <span className="font-mono text-[11px] text-cyan-400">[{d.lessonTitle}]</span>
                )}
                <span className="font-bold text-sm">{d.subject}</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Asked by <strong>{d.studentName}</strong>
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300">{d.question}</p>

            {d.replies.length > 0 && (
              <div className="pl-4 border-l-2 border-violet-500/40 space-y-1.5 pt-1">
                {d.replies.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-[11px]"
                  >
                    <span className="font-bold text-cyan-400">
                      {r.senderName} ({r.senderRole}):
                    </span>{' '}
                    <span>{r.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={replyByDoubtId[d.id] || ''}
                onChange={(e) =>
                  setReplyByDoubtId((prev) => ({ ...prev, [d.id]: e.target.value }))
                }
                placeholder={
                  role === 'STUDENT'
                    ? 'Add follow-up comment...'
                    : 'Post verified faculty answer (triggers WhatsApp + Email alert to student)...'
                }
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              <button
                type="button"
                disabled={!replyByDoubtId[d.id]?.trim() || replyDoubtMutation.isPending}
                onClick={() => {
                  const msg = replyByDoubtId[d.id]?.trim();
                  if (!msg) return;
                  replyDoubtMutation.mutate(
                    { courseId, doubtId: d.id, message: msg },
                    {
                      onSuccess: () =>
                        setReplyByDoubtId((prev) => ({ ...prev, [d.id]: '' })),
                    }
                  );
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold bg-indigo-600 text-white cursor-pointer"
              >
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 4. STUDENT STUDY MATERIALS VAULT VIEW (/student/materials)
// ============================================================================

export function StudentMaterialsVaultView() {
  const { data: enrollments = [] } = useEnrollmentsListQuery();
  const activeEnrollments = enrollments.filter(
    (e) => e.status === 'ACTIVE' || e.status === 'COMPLETED'
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const resolvedCourseId = selectedCourseId || activeEnrollments[0]?.courseId || '';
  const { data: materials = [], isLoading } = useCourseMaterialsQuery(resolvedCourseId);
  const { data: courseDetail } = useCourseDetailQuery(resolvedCourseId);
  const toggleLessonMutation = useToggleLessonCompleteMutation();
  const downloadMaterialMutation = useDownloadMaterialMutation();
  const [previewPayload, setPreviewPayload] = useState<MaterialDownloadPayload | null>(null);

  const filteredMaterials = materials.filter((m) =>
    searchQuery.trim()
      ? m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Learning Materials Vault"
      operatorSubtitle="Signed Binary File Downloads"
      headerTitle="Study Materials Vault & Interactive Lesson Progress"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={resolvedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {activeEnrollments.length === 0 && (
                <option value="">No Active Enrolled Courses</option>
              )}
              {activeEnrollments.map((e) => (
                <option key={e.courseId} value={e.courseId}>
                  {e.courseCode} — {e.courseTitle} (Progress: {e.progressPercent}%)
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PDF notes, slides..."
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {courseDetail?.studentProgressPercent && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400">
              Course Completion: {courseDetail.studentProgressPercent}%
            </span>
          )}
        </div>

        {/* Downloadable Study Materials */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" /> Downloadable Course Notes & PDFs
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading study materials...</p>}
          {filteredMaterials.length === 0 && !isLoading ? (
            <p className="text-xs text-slate-500">
              No study materials found for the selected course.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMaterials.map((mat) => (
                <div
                  key={mat.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 font-mono text-[10px]">
                      {mat.mimeType}
                    </span>
                    <p className="font-bold text-sm mt-1">{mat.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {mat.fileName} • {Math.max(1, Math.round(mat.sizeBytes / 1024))} KB
                    </p>
                    {mat.description ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">{mat.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={downloadMaterialMutation.isPending}
                    onClick={() =>
                      downloadMaterialMutation.mutate(mat.id, {
                        onSuccess: (payload) => {
                          setPreviewPayload(payload);
                          if (typeof window !== 'undefined') {
                            triggerMaterialBinaryDownload(payload);
                          }
                        },
                      })
                    }
                    className="px-3.5 py-2 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download File
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Lesson Completion Checklist */}
        {courseDetail?.sections && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-emerald-400" /> Course Curriculum & Lesson Checklist
            </h2>
            <div className="space-y-3">
              {courseDetail.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                >
                  <p className="font-bold text-sm">
                    Section {sec.sortOrder}: {sec.title}
                  </p>
                  <div className="space-y-1.5">
                    {sec.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold">{lesson.title}</span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({lesson.contentType} • {Math.round(lesson.durationSeconds / 60)} min)
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={toggleLessonMutation.isPending}
                          onClick={() =>
                            toggleLessonMutation.mutate({
                              courseId: courseDetail.id,
                              lessonId: lesson.id,
                              completed: !lesson.isCompleted,
                            })
                          }
                          className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                            lesson.isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-violet-600 text-white'
                          }`}
                        >
                          {lesson.isCompleted ? 'Completed ✓' : 'Mark Complete'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {previewPayload && (
          <div className="rounded-2xl border-2 border-cyan-500/50 bg-slate-950 text-slate-100 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-cyan-400">
                Downloaded: {previewPayload.title} ({previewPayload.fileName})
                {previewPayload.fileBase64 ? ' [Binary File Saved]' : ' [Study Guide Saved]'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPayload(null)}
                className="text-xs text-rose-400 font-bold cursor-pointer"
              >
                Close Preview ✕
              </button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-slate-300 max-h-60 overflow-y-auto">
              {previewPayload.studyGuideText}
            </pre>
          </div>
        )}

        <CourseDoubtsForumSection courseId={resolvedCourseId} role="STUDENT" />
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 5. TEACHER COHORT STUDENTS & PROGRESS ROSTER VIEW (/teacher/students)
// ============================================================================

export function TeacherCohortStudentsView() {
  const { data: roster = [], isLoading } = useTeacherStudentsRosterQuery();
  const { data: coursesData } = useCoursesListQuery();
  const nudgeMutation = useNudgeStudentOmnichannelMutation();
  const announceMutation = useBroadcastCourseAnnouncementMutation();

  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [announceCourseId, setAnnounceCourseId] = useState<string>('');
  const [announceTitle, setAnnounceTitle] = useState<string>('');
  const [announceBody, setAnnounceBody] = useState<string>('');

  const filteredRoster = roster.filter((r) =>
    courseFilter === 'ALL' ? true : r.courseId === courseFilter
  );

  const assignedCourses = coursesData?.items || [];

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Cohort Student Roster"
      operatorSubtitle="Progress, Onboarding & WhatsApp/Email Nudges"
      headerTitle="My Enrolled Students, Onboarding Status & Batch Broadcasts"
    >
      <div className="space-y-6">
        {/* Batch Course Announcement Broadcast (Email + WhatsApp + In-App) */}
        <div className="rounded-2xl border border-indigo-500/40 bg-white dark:bg-[#111827] p-6 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-400" /> Broadcast Batch Announcement via WhatsApp + Email + In-App (`POST /api/v1/courses/:courseId/announcements`)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <select
              value={announceCourseId || assignedCourses[0]?.id || ''}
              onChange={(e) => setAnnounceCourseId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {assignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Announcement Headline (e.g. Extra Doubt Session)"
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <input
              type="text"
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              placeholder="Message sent to students on WhatsApp & Email..."
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <button
              type="button"
              disabled={!announceTitle.trim() || !announceBody.trim() || announceMutation.isPending}
              onClick={() => {
                const targetCourseId = announceCourseId || assignedCourses[0]?.id || '';
                if (!targetCourseId) return;
                announceMutation.mutate(
                  {
                    courseId: targetCourseId,
                    title: announceTitle,
                    body: announceBody,
                  },
                  {
                    onSuccess: () => {
                      setAnnounceTitle('');
                      setAnnounceBody('');
                    },
                  }
                );
              }}
              className="py-2 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 cursor-pointer"
            >
              {announceMutation.isPending ? 'Broadcasting...' : 'Broadcast to Batch'}
            </button>
          </div>
        </div>

        {/* Enrolled Student Roster Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" /> Enrolled Students Across Assigned Courses (`GET /api/v1/courses/teacher/students`)
            </h2>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="ALL">All Assigned Courses ({roster.length})</option>
              {assignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {isLoading && <p className="text-xs text-slate-500">Loading cohort student roster...</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">WhatsApp / Phone</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Onboarding</th>
                  <th className="py-2.5 px-3">Lesson Progress</th>
                  <th className="py-2.5 px-3">Installments</th>
                  <th className="py-2.5 px-3 text-right">1-Click Nudge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {filteredRoster.map((st) => (
                  <tr key={st.enrollmentId}>
                    <td className="py-3 px-3">
                      <p className="font-bold">{st.studentName}</p>
                      <p className="text-[11px] text-slate-500">
                        {st.studentCode || 'STU'} • {st.studentEmail}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {st.studentPhone || 'Not set'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-indigo-400 font-bold mr-1">
                        {st.courseCode}
                      </span>
                      {st.courseTitle}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          st.onboardingCompleted
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {st.onboardingCompleted ? 'Onboarded ✓' : 'Onboarding Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Number(st.progressPercent))}%` }}
                            className="h-full bg-indigo-500"
                          />
                        </div>
                        <span className="font-mono">{st.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {st.paidInstallmentsCount}/{st.totalInstallmentsCount} Paid
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={nudgeMutation.isPending}
                        onClick={() =>
                          nudgeMutation.mutate({
                            studentId: st.studentId,
                            courseCode: st.courseCode,
                            eventType: 'COURSE_ANNOUNCEMENT',
                            title: `Academic Check-In (${st.courseCode})`,
                            body: `Hi ${st.studentName}, your current progress in ${st.courseTitle} is ${st.progressPercent}%. Please complete your upcoming lessons and assignments on time!`,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 transition cursor-pointer"
                      >
                        📲 Send WhatsApp + Email Nudge
                      </button>
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

// ============================================================================
// 6. TEACHER STUDY MATERIALS UPLOAD & OMNICHANNEL BROADCAST HUB (/teacher/materials)
// ============================================================================

export function TeacherMaterialsBroadcastView() {
  const { data: coursesData } = useCoursesListQuery();
  const { data: omniSettings } = useOmnichannelSettingsQuery();
  const assignedCourses = coursesData?.items || [];

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const resolvedCourseId = selectedCourseId || assignedCourses[0]?.id || '';
  const selectedCourseObj = assignedCourses.find((c) => c.id === resolvedCourseId);

  const { data: materials = [], isLoading } = useCourseMaterialsQuery(resolvedCourseId);
  const downloadMaterialMutation = useDownloadMaterialMutation();

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Materials & Study Vault"
      operatorSubtitle="Real File Upload + Auto WhatsApp & Email Cohort Notification"
      headerTitle="Course Study Materials Upload & Automated Cohort Alerts"
    >
      <div className="space-y-6">
        {/* Omnichannel Auto-Dispatch Status Banner */}
        <div className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#111827] p-5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="font-bold">
                Automatic Study Material Upload Notification (`STUDY_MATERIAL_UPLOADED`)
              </p>
              <p className="text-slate-500">
                Uploading a real file (PDF, ZIP, PPTX, DOCX, Video, Image) below saves it to the server storage and alerts all enrolled students via In-App, Email, and WhatsApp.
              </p>
            </div>
          </div>

          {omniSettings && (
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  omniSettings.whatsappEnabled &&
                  omniSettings.eventToggles.STUDY_MATERIAL_UPLOADED?.whatsapp
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                <MessageSquare className="w-3 h-3 inline mr-1" />
                WhatsApp:{' '}
                {omniSettings.whatsappEnabled &&
                omniSettings.eventToggles.STUDY_MATERIAL_UPLOADED?.whatsapp
                  ? 'AUTO-ON'
                  : 'OFF'}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  omniSettings.emailEnabled &&
                  omniSettings.eventToggles.STUDY_MATERIAL_UPLOADED?.email
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                <Mail className="w-3 h-3 inline mr-1" />
                Email:{' '}
                {omniSettings.emailEnabled &&
                omniSettings.eventToggles.STUDY_MATERIAL_UPLOADED?.email
                  ? 'AUTO-ON'
                  : 'OFF'}
              </span>
            </div>
          )}
        </div>

        {/* Upload New Study Material Card with Real Drag-and-Drop File Picker */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" /> Upload Course Material File & Notify Batch (`POST /api/v1/materials/courses/:courseId`)
            </h2>

            <select
              value={resolvedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {assignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <MaterialFileUploadZone
            courseId={resolvedCourseId}
            courseLabel={
              selectedCourseObj
                ? `${selectedCourseObj.code} — ${selectedCourseObj.title}`
                : undefined
            }
          />
        </div>

        {/* Uploaded Materials List */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" /> Uploaded Course Materials ({materials.length})
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading course materials...</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {materials.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono text-[10px]">
                    {m.mimeType}
                  </span>
                  <p className="font-bold mt-1">{m.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.fileName} • {Math.max(1, Math.round(m.sizeBytes / 1024))} KB •{' '}
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloadMaterialMutation.isPending}
                  onClick={() =>
                    downloadMaterialMutation.mutate(m.id, {
                      onSuccess: (payload) => triggerMaterialBinaryDownload(payload),
                    })
                  }
                  className="px-3 py-1.5 rounded-xl font-bold bg-cyan-500/15 text-cyan-400 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            ))}
          </div>
        </div>

        <CourseDoubtsForumSection courseId={resolvedCourseId} role="TEACHER" />
      </div>
    </RolePanelShell>
  );
}
