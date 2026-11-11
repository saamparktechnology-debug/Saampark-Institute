'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RolePanelShell } from '@/features/dashboards/components/RolePanelShell';
import {
  useActiveTeachersQuery,
  useAssignTeacherMutation,
  useCategoriesQuery,
  useCourseDetailQuery,
  useCourseMaterialsQuery,
  useCoursesListQuery,
  useCreateCategoryMutation,
  useCreateCourseMutation,
  useCreateLessonMutation,
  useCreateMaterialMutation,
  useCreatePaymentPlanTemplateMutation,
  useCreateSectionMutation,
  useCreateUserByAdminMutation,
  useEnrollmentsListQuery,
  useInitiateEnrollmentMutation,
  useUpdateCourseStatusMutation,
  useUsersListQuery,
  useVerifyInstallmentPaymentMutation,
} from '../hooks/courses.hook';
import {
  COURSE_LEVEL_OPTIONS,
  LESSON_CONTENT_TYPES,
  TEACHER_ASSIGNMENT_ROLES,
} from '../courses.constant';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  FileText,
  Download,
  Upload,
  AlertOctagon,
  RefreshCw,
  FolderPlus,
  UserPlus,
  CreditCard,
  Layers,
  Users,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS FOR ALL PHASE 2 FORMS
// ----------------------------------------------------------------------------

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().trim().max(1000).optional(),
});
type CreateCategoryValues = z.infer<typeof createCategorySchema>;

const createCourseFormSchema = z.object({
  categoryId: z.string().uuid('Select a category from the database'),
  code: z.string().trim().min(2).max(32),
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  shortDescription: z.string().trim().min(10).max(500),
  description: z.string().trim().min(20),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  language: z.string().trim().min(2).default('English'),
  basePrice: z.coerce.number().nonnegative(),
  minAttendancePercent: z.coerce.number().min(0).max(100),
  minPassMarksPercent: z.coerce.number().min(0).max(100),
});
type CreateCourseFormValues = z.infer<typeof createCourseFormSchema>;

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid('Select an active teacher'),
  assignmentRole: z.enum(['PRIMARY', 'CO_INSTRUCTOR', 'TEACHING_ASSISTANT']),
  revenueSharePercent: z.coerce.number().min(0).max(100),
});
type AssignTeacherValues = z.infer<typeof assignTeacherSchema>;

const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  planType: z.enum(['FULL', 'INSTALLMENT']),
  installmentCount: z.coerce.number().int().min(1).max(24),
  totalAmount: z.coerce.number().positive(),
  gracePeriodDays: z.coerce.number().int().min(0).max(30),
});
type CreatePlanValues = z.infer<typeof createPlanSchema>;

const createSectionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(1),
});
type CreateSectionValues = z.infer<typeof createSectionSchema>;

const createLessonSchema = z.object({
  sectionId: z.string().uuid('Select a curriculum section'),
  title: z.string().trim().min(2).max(200),
  contentType: z.enum(['VIDEO', 'DOCUMENT', 'QUIZ', 'LIVE_SESSION']),
  durationSeconds: z.coerce.number().int().min(0),
  sortOrder: z.coerce.number().int().min(1),
  isPreview: z.boolean().default(false),
});
type CreateLessonValues = z.infer<typeof createLessonSchema>;

const uploadMaterialSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  fileName: z.string().trim().min(3).max(255),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ]),
  sizeBytes: z.coerce.number().int().positive().max(50 * 1024 * 1024),
});
type UploadMaterialValues = z.infer<typeof uploadMaterialSchema>;

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(24).optional(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT']),
  specialization: z.string().trim().max(255).optional(),
  defaultRevenueSharePercent: z.coerce.number().min(0).max(100).optional(),
  department: z.string().trim().max(64).optional(),
});
type CreateUserValues = z.infer<typeof createUserSchema>;

function slugifyTitle(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// 1. ADMIN COURSES, CATEGORIES, MULTI-TEACHERS, PLANS & CURRICULUM VIEW
// ============================================================================

export function AdminCoursesView() {
  const { data: categories = [], isLoading: catsLoading } = useCategoriesQuery();
  const { data: teachers = [] } = useActiveTeachersQuery();
  const {
    data: coursesData,
    isLoading: coursesLoading,
    isError,
    error,
    refetch,
  } = useCoursesListQuery();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const { data: selectedCourseDetail } = useCourseDetailQuery(selectedCourseId);

  const createCategoryMutation = useCreateCategoryMutation();
  const createCourseMutation = useCreateCourseMutation();
  const updateStatusMutation = useUpdateCourseStatusMutation();
  const assignTeacherMutation = useAssignTeacherMutation();
  const createPlanMutation = useCreatePaymentPlanTemplateMutation();
  const createSectionMutation = useCreateSectionMutation();
  const createLessonMutation = useCreateLessonMutation();

  // Category Form
  const categoryForm = useForm<CreateCategoryValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '', slug: '', description: '' },
  });

  // Course Form
  const courseForm = useForm<CreateCourseFormValues>({
    resolver: zodResolver(createCourseFormSchema),
    defaultValues: {
      level: 'INTERMEDIATE',
      language: 'English',
      basePrice: 12000,
      minAttendancePercent: 75,
      minPassMarksPercent: 50,
    },
  });

  // Assign Teacher Form
  const teacherAssignForm = useForm<AssignTeacherValues>({
    resolver: zodResolver(assignTeacherSchema),
    defaultValues: {
      assignmentRole: 'PRIMARY',
      revenueSharePercent: 30,
    },
  });

  // Payment Plan Template Form
  const planForm = useForm<CreatePlanValues>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      name: '3-Month Equal Installment Plan',
      planType: 'INSTALLMENT',
      installmentCount: 3,
      totalAmount: 12000,
      gracePeriodDays: 5,
    },
  });

  // Section & Lesson Forms
  const sectionForm = useForm<CreateSectionValues>({
    resolver: zodResolver(createSectionSchema),
    defaultValues: { sortOrder: 1 },
  });

  const lessonForm = useForm<CreateLessonValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      contentType: 'VIDEO',
      durationSeconds: 1800,
      sortOrder: 1,
      isPreview: true,
    },
  });

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="Admin Course Architect"
      operatorSubtitle="Platform-Wide Scope"
      headerTitle="Categories, Courses, Multi-Teacher & Installment Plans"
    >
      <div className="space-y-6">
        {/* STEP 1: CREATE COURSE CATEGORY UI */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-cyan-500" /> 1. Course Categories (`GET/POST /api/v1/courses/categories`)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Create a category first so courses can be organized in the catalog. Existing categories in MySQL:{' '}
            <strong>{categories.length}</strong>
          </p>

          <form
            onSubmit={categoryForm.handleSubmit((vals) =>
              createCategoryMutation.mutate(vals, {
                onSuccess: () => categoryForm.reset(),
              })
            )}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
          >
            <div>
              <input
                type="text"
                placeholder="Category Name (e.g. Data Science)"
                {...categoryForm.register('name', {
                  onChange: (e) =>
                    categoryForm.setValue('slug', slugifyTitle(e.target.value)),
                })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              {categoryForm.formState.errors.name && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {categoryForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Slug (e.g. data-science)"
                {...categoryForm.register('slug')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              {categoryForm.formState.errors.slug && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {categoryForm.formState.errors.slug.message}
                </p>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Description (optional)"
                {...categoryForm.register('description')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={createCategoryMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-emerald-500"
            >
              {createCategoryMutation.isPending ? 'Creating Category...' : '+ Create Category'}
            </button>
          </form>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {cat.name} ({cat.courseCount ?? 0} courses)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* STEP 2: CREATE COURSE UI */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-500" /> 2. Create New Course (`POST /api/v1/courses`)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Creates the course in `DRAFT` status along with an automatic `FULL` payment plan template.
          </p>

          <form
            onSubmit={courseForm.handleSubmit((vals) =>
              createCourseMutation.mutate(vals, {
                onSuccess: () => courseForm.reset(),
              })
            )}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <select
                {...courseForm.register('categoryId')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="">
                  {catsLoading ? 'Loading categories...' : 'Select Category'}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {courseForm.formState.errors.categoryId && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {courseForm.formState.errors.categoryId.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Course Code</label>
              <input
                type="text"
                placeholder="e.g. PHYS-402"
                {...courseForm.register('code')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Base Price (INR ₹)</label>
              <input
                type="number"
                step="0.01"
                {...courseForm.register('basePrice')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Course Title</label>
              <input
                type="text"
                placeholder="e.g. Relativistic Electrodynamics"
                {...courseForm.register('title', {
                  onChange: (e) =>
                    courseForm.setValue('slug', slugifyTitle(e.target.value)),
                })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">URL Slug</label>
              <input
                type="text"
                placeholder="relativistic-electrodynamics"
                {...courseForm.register('slug')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold mb-1">Short Description</label>
              <input
                type="text"
                placeholder="1-sentence summary shown on course cards"
                {...courseForm.register('shortDescription')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold mb-1">Full Syllabus Description</label>
              <textarea
                rows={2}
                placeholder="Detailed course overview and learning outcomes..."
                {...courseForm.register('description')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Level</label>
              <select
                {...courseForm.register('level')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                {COURSE_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Min Attendance %</label>
              <input
                type="number"
                {...courseForm.register('minAttendancePercent')}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={createCourseMutation.isPending}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500"
              >
                {createCourseMutation.isPending ? 'Saving Course...' : '+ Create Course'}
              </button>
            </div>
          </form>
        </div>

        {/* STEP 3: COURSES DIRECTORY + CONFIGURE DRAWER TRIGGER */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">
              3. Database Courses (`GET /api/v1/courses`) — Click &quot;Configure Course&quot; to Assign Teachers, Plans & Curriculum
            </h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {coursesLoading && <p className="text-xs text-slate-500">Loading courses from MySQL...</p>}
          {isError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              {(error as { message?: string })?.message || 'Failed to load courses from API.'}
            </div>
          )}

          {coursesData && coursesData.items.length > 0 && (
            <div className="space-y-4">
              {coursesData.items.map((course) => (
                <div
                  key={course.id}
                  className={`p-4 rounded-xl border ${
                    selectedCourseId === course.id
                      ? 'border-cyan-500 bg-cyan-500/5'
                      : 'border-slate-200 dark:border-slate-800'
                  } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-mono font-bold">
                        {course.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">
                        {course.status}
                      </span>
                      <span className="text-xs text-slate-500">{course.category.name}</span>
                    </div>
                    <h3 className="text-sm font-bold mt-1">{course.title}</h3>
                    <p className="text-xs text-slate-500">{course.shortDescription}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Assigned Teachers:{' '}
                      {course.assignedTeachers.length === 0
                        ? 'None assigned'
                        : course.assignedTeachers
                            .map(
                              (t) =>
                                `${t.fullName} (${t.assignmentRole} • ${t.revenueSharePercent}%)`
                            )
                            .join(', ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold mr-2">₹{course.basePrice}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCourseId(course.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 text-white"
                    >
                      Configure Course
                    </button>
                    {course.status !== 'PUBLISHED' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            courseId: course.id,
                            status: 'PUBLISHED',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 4: SELECTED COURSE CONFIGURATION WORKSPACE (TEACHERS, INSTALLMENT PLANS, SECTIONS/LESSONS) */}
        {selectedCourseDetail && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Multi-Teacher Assignment Card (C-026, C-029) */}
            <div className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" /> Assign Teacher to {selectedCourseDetail.code} (`POST /api/v1/courses/:id/teachers`)
              </h3>
              <form
                onSubmit={teacherAssignForm.handleSubmit((vals) =>
                  assignTeacherMutation.mutate({
                    courseId: selectedCourseDetail.id,
                    ...vals,
                  })
                )}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <select
                  {...teacherAssignForm.register('teacherId')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="">Select Active Teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.email})
                    </option>
                  ))}
                </select>

                <select
                  {...teacherAssignForm.register('assignmentRole')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  {TEACHER_ASSIGNMENT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Rev Share %"
                    {...teacherAssignForm.register('revenueSharePercent')}
                    className="w-24 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={assignTeacherMutation.isPending}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white"
                  >
                    Assign
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                {selectedCourseDetail.assignedTeachers.map((at) => (
                  <div key={at.assignmentId} className="flex justify-between py-1">
                    <span>
                      <strong>{at.fullName}</strong> ({at.assignmentRole})
                    </span>
                    <span className="font-mono text-emerald-400">
                      {at.revenueSharePercent}% Revenue Share
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Installment Payment Plan Builder Card (C-009, C-027) */}
            <div className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Add Installment Plan Template (`POST /api/v1/courses/:id/payment-plans`)
              </h3>
              <form
                onSubmit={planForm.handleSubmit((vals) =>
                  createPlanMutation.mutate({
                    courseId: selectedCourseDetail.id,
                    ...vals,
                  })
                )}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <input
                  type="text"
                  placeholder="Plan Name"
                  {...planForm.register('name')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <select
                  {...planForm.register('planType')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="INSTALLMENT">INSTALLMENT Plan</option>
                  <option value="FULL">FULL Payment Plan</option>
                </select>
                <input
                  type="number"
                  placeholder="Installment Count (e.g. 3)"
                  {...planForm.register('installmentCount')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Total Amount INR"
                  {...planForm.register('totalAmount')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="number"
                  placeholder="Grace Period Days (e.g. 5)"
                  {...planForm.register('gracePeriodDays')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={createPlanMutation.isPending}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                >
                  + Add Payment Plan
                </button>
              </form>

              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                {selectedCourseDetail.paymentPlanTemplates.map((pt) => (
                  <div key={pt.id} className="flex justify-between py-1">
                    <span>
                      <strong>{pt.name}</strong> ({pt.planType} • {pt.installmentCount}x)
                    </span>
                    <span className="font-mono">₹{pt.totalAmount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Curriculum Sections & Lessons Builder (Admin / Teacher) */}
            <div className="lg:col-span-2 rounded-2xl border border-violet-500/40 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" /> Curriculum Sections & Lessons for {selectedCourseDetail.title}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form
                  onSubmit={sectionForm.handleSubmit((vals) =>
                    createSectionMutation.mutate(
                      { courseId: selectedCourseDetail.id, ...vals },
                      { onSuccess: () => sectionForm.reset() }
                    )
                  )}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <p className="text-xs font-bold">Add Curriculum Section</p>
                  <input
                    type="text"
                    placeholder="Section Title (e.g. Module 2: Quantum Entanglement)"
                    {...sectionForm.register('title')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Order"
                      {...sectionForm.register('sortOrder')}
                      className="w-24 px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    />
                    <button
                      type="submit"
                      disabled={createSectionMutation.isPending}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-violet-600 text-white"
                    >
                      + Add Section
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={lessonForm.handleSubmit((vals) =>
                    createLessonMutation.mutate(
                      { courseId: selectedCourseDetail.id, ...vals },
                      { onSuccess: () => lessonForm.reset() }
                    )
                  )}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <p className="text-xs font-bold">Add Lesson to Section</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      {...lessonForm.register('sectionId')}
                      className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">Select Section</option>
                      {selectedCourseDetail.sections?.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.title}
                        </option>
                      ))}
                    </select>
                    <select
                      {...lessonForm.register('contentType')}
                      className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                    >
                      {LESSON_CONTENT_TYPES.map((ct) => (
                        <option key={ct.value} value={ct.value}>
                          {ct.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Lesson Title"
                    {...lessonForm.register('title')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" {...lessonForm.register('isPreview')} />
                      Free Preview Lesson
                    </label>
                    <button
                      type="submit"
                      disabled={createLessonMutation.isPending}
                      className="py-1.5 px-4 rounded-xl font-bold bg-violet-600 text-white"
                    >
                      + Add Lesson
                    </button>
                  </div>
                </form>
              </div>

              {selectedCourseDetail.sections && selectedCourseDetail.sections.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  {selectedCourseDetail.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <p className="font-bold">
                        Section {sec.sortOrder}: {sec.title}
                      </p>
                      <ul className="mt-1.5 space-y-1 pl-4 list-disc text-slate-500">
                        {sec.lessons.map((l) => (
                          <li key={l.id}>
                            {l.title} ({l.contentType}) —{' '}
                            <span className="text-cyan-400">
                              {l.isPreview ? 'Free Preview' : 'Enrolled Only'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 2. ADMIN USERS & TEACHERS DIRECTORY VIEW (/admin/users)
// ============================================================================

export function AdminUsersDirectoryView() {
  const { data, isLoading, isError, error } = useUsersListQuery();
  const createUserMutation = useCreateUserByAdminMutation();

  const userForm = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'TEACHER',
      password: 'Password123!',
      defaultRevenueSharePercent: 30,
    },
  });

  return (
    <RolePanelShell
      role="ADMIN"
      operatorName="User & Faculty Admin"
      operatorSubtitle="RBAC Provisioning"
      headerTitle="Users, Teachers, Students & Support Directory"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" /> Provision User / Teacher Account (`POST /api/v1/users`)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Creates the account with its role-specific profile (`TeacherProfile`, `StudentProfile` + `Wallet`, or `SupportAgentProfile`).
          </p>

          <form
            onSubmit={userForm.handleSubmit((vals) =>
              createUserMutation.mutate(vals, { onSuccess: () => userForm.reset() })
            )}
            className="grid grid-cols-1 md:grid-cols-4 gap-3"
          >
            <input
              type="text"
              placeholder="Full Name"
              {...userForm.register('fullName')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <input
              type="email"
              placeholder="Email Address"
              {...userForm.register('email')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <select
              {...userForm.register('role')}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="TEACHER">TEACHER</option>
              <option value="STUDENT">STUDENT</option>
              <option value="SUPPORT">SUPPORT</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 text-white"
            >
              {createUserMutation.isPending ? 'Provisioning...' : '+ Provision Account'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-3">Platform Users (`GET /api/v1/users`)</h2>
          {isLoading && <p className="text-xs text-slate-500">Loading users from MySQL...</p>}
          {isError && (
            <p className="text-xs text-rose-500">
              {(error as { message?: string })?.message || 'Failed to load users.'}
            </p>
          )}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3">Full Name</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Profile Code / Rev Share</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-semibold">{u.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-bold">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {u.teacherCode
                          ? `${u.teacherCode} (${u.defaultRevenueSharePercent}%)`
                          : u.studentCode || u.agentCode || 'ADMIN'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 3. STUDENT COURSES CATALOG, ENROLLMENTS, SYLLABUS & MATERIALS VIEW
// ============================================================================

export function StudentCoursesCatalogView() {
  const { data: coursesData, isLoading: coursesLoading, isError, error } = useCoursesListQuery();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useEnrollmentsListQuery();
  const initiateEnrollmentMutation = useInitiateEnrollmentMutation();
  const verifyPaymentMutation = useVerifyInstallmentPaymentMutation();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const { data: courseDetail } = useCourseDetailQuery(selectedCourseId);
  const { data: materials = [], error: materialsError } = useCourseMaterialsQuery(selectedCourseId);

  return (
    <RolePanelShell
      role="STUDENT"
      operatorName="Student Catalog & Learning"
      operatorSubtitle="Own-Record Scope"
      headerTitle="Published Courses, Installments & Materials"
    >
      <div className="space-y-6">
        {/* Published Course Catalog from /api/v1/courses */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-500" /> Published Course Catalog (`GET /api/v1/courses`)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Select a Full Payment or Installment Plan to enroll, or inspect syllabus preview lessons.
          </p>

          {coursesLoading && <p className="text-xs text-slate-500">Loading published courses from API...</p>}
          {isError && (
            <p className="text-xs text-rose-500">
              {(error as { message?: string })?.message || 'Failed to load catalog.'}
            </p>
          )}

          {coursesData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coursesData.items.map((course) => (
                <div
                  key={course.id}
                  className="p-5 rounded-2xl border border-violet-500/30 bg-slate-50 dark:bg-[#181534] flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-cyan-400">
                        {course.code} • {course.level}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(course.id)}
                        className="text-xs font-bold text-violet-400 underline"
                      >
                        Inspect Syllabus & Materials →
                      </button>
                    </div>
                    <h3 className="text-base font-bold mt-1">{course.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                      {course.shortDescription}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold">Available Payment Plan Templates:</p>
                    {course.paymentPlanTemplates.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <div>
                          <span className="font-semibold">{plan.name}</span>
                          <span className="block text-[11px] text-slate-500">
                            {plan.installmentCount} installment(s) • Total ₹{plan.totalAmount}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            initiateEnrollmentMutation.mutate({
                              courseId: course.id,
                              paymentPlanTemplateId: plan.id,
                            })
                          }
                          disabled={initiateEnrollmentMutation.isPending}
                          className="px-3 py-1.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500"
                        >
                          Enroll ({plan.planType})
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Course Syllabus & Materials Viewer */}
        {courseDetail && (
          <div className="rounded-2xl border border-cyan-500/30 bg-white dark:bg-[#131127] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> {courseDetail.title} — Curriculum & Materials
            </h2>

            {courseDetail.sections && courseDetail.sections.length > 0 && (
              <div className="space-y-2">
                {courseDetail.sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <p className="font-bold">{sec.title}</p>
                    <ul className="mt-1 space-y-1 pl-4 list-disc text-slate-500">
                      {sec.lessons.map((l) => (
                        <li key={l.id}>
                          {l.title} ({l.contentType}) —{' '}
                          <span className="text-cyan-400">
                            {l.isPreview ? 'Preview Unlocked' : 'Enrolled Student Access'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold mb-2">Downloadable Materials (`GET /api/v1/materials/courses/:id`):</p>
              {materialsError ? (
                <p className="text-xs text-amber-500">
                  Materials are locked until your 1st installment or full payment is verified (C-027).
                </p>
              ) : materials.length === 0 ? (
                <p className="text-xs text-slate-500">No materials uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold">{mat.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {mat.fileName} ({Math.round(mat.sizeBytes / 1024)} KB)
                        </p>
                      </div>
                      <a
                        href={mat.signedDownloadUrl}
                        className="px-3 py-1.5 rounded-xl font-bold bg-cyan-500/15 text-cyan-400 flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Signed URL
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student's Own Enrollments & Installment Verification */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131127] p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-3">
            Your Enrollments & Installment Schedule (`GET /api/v1/enrollments`)
          </h2>
          {enrollmentsLoading && <p className="text-xs text-slate-500">Loading your enrollments...</p>}
          {enrollments.length === 0 && !enrollmentsLoading && (
            <p className="text-xs text-slate-500">No enrollments found for your account.</p>
          )}
          <div className="space-y-4">
            {enrollments.map((enr) => (
              <div
                key={enr.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold">{enr.courseTitle}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                      {enr.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseId(enr.courseId)}
                    className="px-3 py-1 rounded-xl text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                  >
                    Open Course Syllabus & Materials
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {enr.installments.map((inst) => (
                    <div
                      key={inst.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold">
                          Installment #{inst.sequenceNumber} — ₹{inst.amount}
                        </p>
                        <p className="text-[11px] text-slate-500">Status: {inst.status}</p>
                      </div>
                      {inst.status !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() =>
                            verifyPaymentMutation.mutate({
                              enrollmentId: enr.id,
                              installmentSequenceNumber: inst.sequenceNumber,
                              provider: 'RAZORPAY',
                              providerPaymentId: `pay_${inst.id.slice(0, 8)}`,
                              idempotencyKey: `idem_${inst.id}_${inst.sequenceNumber}`,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                        >
                          Pay & Verify
                        </button>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RolePanelShell>
  );
}

// ============================================================================
// 4. TEACHER ASSIGNED COURSES, CURRICULUM & MATERIALS WORKSPACE
// ============================================================================

export function TeacherCoursesWorkspaceView() {
  const { data: coursesData, isLoading } = useCoursesListQuery();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const { data: selectedCourseDetail } = useCourseDetailQuery(selectedCourseId);
  const { data: materials = [] } = useCourseMaterialsQuery(selectedCourseId);

  const uploadMutation = useCreateMaterialMutation();
  const createSectionMutation = useCreateSectionMutation();
  const createLessonMutation = useCreateLessonMutation();

  const materialForm = useForm<UploadMaterialValues>({
    resolver: zodResolver(uploadMaterialSchema),
    defaultValues: {
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
    },
  });

  const sectionForm = useForm<CreateSectionValues>({
    resolver: zodResolver(createSectionSchema),
    defaultValues: { sortOrder: 1 },
  });

  const lessonForm = useForm<CreateLessonValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      contentType: 'VIDEO',
      durationSeconds: 1800,
      sortOrder: 1,
      isPreview: false,
    },
  });

  return (
    <RolePanelShell
      role="TEACHER"
      operatorName="Assigned Course Workspace"
      operatorSubtitle="Scoped to course_teacher_assignments"
      headerTitle="My Assigned Courses, Curriculum & Materials"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="text-sm font-bold mb-3">
            Your Assigned Courses (`GET /api/v1/courses` — Scoped by Teacher ID)
          </h2>
          {isLoading && <p className="text-xs text-slate-500">Loading assigned courses...</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coursesData?.items.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border ${
                  selectedCourseId === c.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                } flex items-center justify-between`}
              >
                <div>
                  <p className="text-xs font-mono text-indigo-400">{c.code}</p>
                  <p className="text-sm font-bold">{c.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.enrollmentCount} Enrolled Students
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCourseId(c.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                >
                  Manage Curriculum & Materials
                </button>
              </div>
            ))}
          </div>
        </div>

        {selectedCourseDetail && (
          <>
            {/* Teacher Curriculum Section & Lesson Builder */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Manage Curriculum Sections & Lessons (`POST /api/v1/courses/:id/sections`)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form
                  onSubmit={sectionForm.handleSubmit((vals) =>
                    createSectionMutation.mutate(
                      { courseId: selectedCourseDetail.id, ...vals },
                      { onSuccess: () => sectionForm.reset() }
                    )
                  )}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <p className="text-xs font-bold">New Section</p>
                  <input
                    type="text"
                    placeholder="Section Title"
                    {...sectionForm.register('title')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={createSectionMutation.isPending}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                  >
                    + Add Section
                  </button>
                </form>

                <form
                  onSubmit={lessonForm.handleSubmit((vals) =>
                    createLessonMutation.mutate(
                      { courseId: selectedCourseDetail.id, ...vals },
                      { onSuccess: () => lessonForm.reset() }
                    )
                  )}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <p className="text-xs font-bold">New Lesson</p>
                  <select
                    {...lessonForm.register('sectionId')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                  >
                    <option value="">Select Section</option>
                    {selectedCourseDetail.sections?.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Lesson Title"
                    {...lessonForm.register('title')}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={createLessonMutation.isPending}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                  >
                    + Add Lesson
                  </button>
                </form>
              </div>
            </div>

            {/* Teacher Course Material Upload */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" /> Upload Course Material to Hostinger VPS (`POST /api/v1/materials/courses/:courseId`)
              </h2>

              <form
                onSubmit={materialForm.handleSubmit((vals) =>
                  uploadMutation.mutate(
                    { courseId: selectedCourseDetail.id, ...vals },
                    { onSuccess: () => materialForm.reset() }
                  )
                )}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <input
                  type="text"
                  placeholder="Material Title"
                  {...materialForm.register('title')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="text"
                  placeholder="File Name (e.g. lecture_notes.pdf)"
                  {...materialForm.register('fileName')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <select
                  {...materialForm.register('mimeType')}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="application/pdf">PDF Document</option>
                  <option value="application/vnd.openxmlformats-officedocument.presentationml.presentation">
                    PowerPoint (.pptx)
                  </option>
                  <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                    Word (.docx)
                  </option>
                  <option value="image/png">PNG Diagram</option>
                </select>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                >
                  {uploadMutation.isPending ? 'Registering...' : 'Authorize & Save Material'}
                </button>
              </form>

              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span>
                      <strong>{m.title}</strong> — {m.fileName}
                    </span>
                    <span className="text-slate-500">{m.storageProvider}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </RolePanelShell>
  );
}
