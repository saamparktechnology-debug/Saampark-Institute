import { Prisma, CourseStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationAndFilters, buildPaginationMeta } from '../../utils/pagination';
import { assertCourseAccessScope } from '../../middlewares/auth.middleware';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import {
  CourseCategoryDto,
  CourseSummaryDto,
  AssignedTeacherDto,
  PaymentPlanTemplateDto,
  CourseSectionDto,
  CourseLessonProgressDto,
  TeacherCohortStudentDto,
  CourseDoubtThreadDto,
  CourseDoubtReplyDto,
} from './courses.types';

/**
 * Pure helper to calculate course completion percentage from completed lesson IDs and total lessons.
 */
export function calculateLessonProgressPercent(
  completedLessonCount: number,
  totalLessonsCount: number
): number {
  if (totalLessonsCount <= 0) return 0;
  const pct = (completedLessonCount / totalLessonsCount) * 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(2))));
}

export class CoursesService {
  static async listCategories(actor: AuthenticatedActor): Promise<CourseCategoryDto[]> {
    const where: Prisma.CourseCategoryWhereInput =
      actor.role === 'ADMIN' ? {} : { isActive: true };

    const categories = await prisma.courseCategory.findMany({
      where,
      include: {
        _count: { select: { courses: true } },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      isActive: cat.isActive,
      courseCount: cat._count.courses,
    }));
  }

  static async createCategory(
    actor: AuthenticatedActor,
    payload: { name: string; slug: string; description?: string; isActive?: boolean }
  ): Promise<CourseCategoryDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can create course categories.');
    }

    const created = await prisma.$transaction(async (tx) => {
      const cat = await tx.courseCategory.create({
        data: {
          name: payload.name,
          slug: payload.slug.toLowerCase(),
          description: payload.description || null,
          isActive: payload.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_CATEGORY_CREATED',
          entityType: 'CourseCategory',
          entityId: cat.id,
          afterDataJson: JSON.stringify({ name: cat.name, slug: cat.slug }),
        },
      });

      return cat;
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description,
      isActive: created.isActive,
      courseCount: 0,
    };
  }

  /**
   * Lists courses strictly scoped by role:
   * - ADMIN: All courses (filterable by status, categoryId, level).
   * - TEACHER: Strictly courses actively assigned to `actor.id` in `course_teacher_assignments` (C-013, C-026).
   * - STUDENT: Published catalog courses + own enrolled courses.
   * - SUPPORT: Read-only published and active courses for ticket lookup.
   */
  static async listCourses(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder, filters } = parsePaginationAndFilters(
      rawQuery,
      ['status', 'categoryId', 'level', 'search'],
      ['createdAt', 'title', 'basePrice'],
      'createdAt'
    );

    const where: Prisma.CourseWhereInput = {};

    if (actor.role === 'TEACHER') {
      where.teacherAssignments = {
        some: {
          teacherId: actor.id,
          status: 'ACTIVE',
        },
      };
    } else if (actor.role === 'STUDENT') {
      where.status = 'PUBLISHED';
    } else if (actor.role === 'ADMIN' && filters.status) {
      where.status = filters.status as CourseStatus;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.level) {
      where.level = filters.level;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { code: { contains: filters.search } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          teacherAssignments: {
            where: { status: 'ACTIVE' },
            include: {
              teacher: { select: { id: true, fullName: true, email: true } },
            },
          },
          paymentPlanTemplates: {
            where: { isActive: true },
            orderBy: { installmentCount: 'asc' },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      }),
    ]);

    const items: CourseSummaryDto[] = records.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      slug: c.slug,
      shortDescription: c.shortDescription,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      level: c.level,
      language: c.language,
      basePrice: c.basePrice.toFixed(2),
      currency: c.currency,
      status: c.status,
      minAttendancePercent: c.minAttendancePercent.toFixed(2),
      minPassMarksPercent: c.minPassMarksPercent.toFixed(2),
      publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
      category: c.category,
      assignedTeachers: c.teacherAssignments.map((ta) => ({
        assignmentId: ta.id,
        teacherId: ta.teacher.id,
        fullName: ta.teacher.fullName,
        email: ta.teacher.email,
        assignmentRole: ta.assignmentRole,
        revenueSharePercent: ta.revenueSharePercent.toFixed(2),
        status: ta.status,
      })),
      paymentPlanTemplates: c.paymentPlanTemplates.map((pt) => ({
        id: pt.id,
        name: pt.name,
        planType: pt.planType,
        installmentCount: pt.installmentCount,
        totalAmount: pt.totalAmount.toFixed(2),
        currency: pt.currency,
        gracePeriodDays: pt.gracePeriodDays,
        isActive: pt.isActive,
      })),
      enrollmentCount: c._count.enrollments,
    }));

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Fetches course detail including completed lesson IDs for enrolled students.
   */
  static async getCourseDetail(
    actor: AuthenticatedActor,
    courseId: string
  ): Promise<CourseSummaryDto> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        teacherAssignments: {
          where: { status: 'ACTIVE' },
          include: { teacher: { select: { id: true, fullName: true, email: true } } },
        },
        paymentPlanTemplates: {
          where: { isActive: true },
          orderBy: { installmentCount: 'asc' },
        },
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: { orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    if (actor.role === 'TEACHER') {
      const isAssigned = course.teacherAssignments.some((ta) => ta.teacherId === actor.id);
      if (!isAssigned) {
        throw ApiError.forbidden(
          'Teachers may only inspect courses actively assigned to them.',
          'RESOURCE_FORBIDDEN'
        );
      }
    }

    let studentHasActiveAccess = false;
    let completedLessonIds: string[] = [];
    let studentProgressPercent: string | undefined;

    if (actor.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          courseId: course.id,
          studentId: actor.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
        select: { id: true, progressPercent: true },
      });
      studentHasActiveAccess = Boolean(enrollment);
      if (enrollment) {
        studentProgressPercent = enrollment.progressPercent.toFixed(2);
        const progressLog = await prisma.auditLog.findFirst({
          where: {
            action: 'LESSON_PROGRESS_UPDATED',
            entityType: 'Enrollment',
            entityId: enrollment.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (progressLog?.afterDataJson) {
          try {
            const parsed = JSON.parse(progressLog.afterDataJson) as {
              completedLessonIds?: string[];
            };
            if (Array.isArray(parsed.completedLessonIds)) {
              completedLessonIds = parsed.completedLessonIds;
            }
          } catch {
            completedLessonIds = [];
          }
        }
      }
    }

    const completedSet = new Set(completedLessonIds);

    const sections: CourseSectionDto[] = course.sections.map((sec) => ({
      id: sec.id,
      courseId: sec.courseId,
      title: sec.title,
      description: sec.description,
      sortOrder: sec.sortOrder,
      lessons: sec.lessons
        .filter((l) => actor.role !== 'STUDENT' || studentHasActiveAccess || l.isPreview)
        .map((l) => ({
          id: l.id,
          sectionId: l.sectionId,
          title: l.title,
          contentType: l.contentType,
          durationSeconds: l.durationSeconds,
          sortOrder: l.sortOrder,
          isPreview: l.isPreview,
          isCompleted: completedSet.has(l.id),
        })),
    }));

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      slug: course.slug,
      shortDescription: course.shortDescription,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level,
      language: course.language,
      basePrice: course.basePrice.toFixed(2),
      currency: course.currency,
      status: course.status,
      minAttendancePercent: course.minAttendancePercent.toFixed(2),
      minPassMarksPercent: course.minPassMarksPercent.toFixed(2),
      publishedAt: course.publishedAt ? course.publishedAt.toISOString() : null,
      category: course.category,
      assignedTeachers: course.teacherAssignments.map((ta) => ({
        assignmentId: ta.id,
        teacherId: ta.teacher.id,
        fullName: ta.teacher.fullName,
        email: ta.teacher.email,
        assignmentRole: ta.assignmentRole,
        revenueSharePercent: ta.revenueSharePercent.toFixed(2),
        status: ta.status,
      })),
      paymentPlanTemplates: course.paymentPlanTemplates.map((pt) => ({
        id: pt.id,
        name: pt.name,
        planType: pt.planType,
        installmentCount: pt.installmentCount,
        totalAmount: pt.totalAmount.toFixed(2),
        currency: pt.currency,
        gracePeriodDays: pt.gracePeriodDays,
        isActive: pt.isActive,
      })),
      sections,
      enrollmentCount: course._count.enrollments,
      completedLessonIds,
      studentProgressPercent,
    };
  }

  /**
   * Student marks or toggles a curriculum lesson as completed, dynamically recalculating `Enrollment.progressPercent`.
   */
  static async toggleLessonCompletion(
    actor: AuthenticatedActor,
    courseId: string,
    lessonId: string,
    completed?: boolean
  ): Promise<CourseLessonProgressDto> {
    if (actor.role !== 'STUDENT') {
      throw ApiError.forbidden('Only enrolled students can track personal lesson completion.');
    }

    const [enrollment, sections] = await Promise.all([
      prisma.enrollment.findFirst({
        where: {
          courseId,
          studentId: actor.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
      }),
      prisma.courseSection.findMany({
        where: { courseId },
        include: { lessons: { select: { id: true } } },
      }),
    ]);

    if (!enrollment) {
      throw ApiError.forbidden('An active enrollment is required to record lesson progress.');
    }

    const allLessonIds = sections.flatMap((s) => s.lessons.map((l) => l.id));
    if (!allLessonIds.includes(lessonId)) {
      throw ApiError.notFound('Lesson not found in this course.');
    }

    const latestLog = await prisma.auditLog.findFirst({
      where: {
        action: 'LESSON_PROGRESS_UPDATED',
        entityType: 'Enrollment',
        entityId: enrollment.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const completedSet = new Set<string>();
    if (latestLog?.afterDataJson) {
      try {
        const parsed = JSON.parse(latestLog.afterDataJson) as { completedLessonIds?: string[] };
        if (Array.isArray(parsed.completedLessonIds)) {
          for (const id of parsed.completedLessonIds) {
            if (allLessonIds.includes(id)) {
              completedSet.add(id);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const shouldComplete =
      completed !== undefined ? completed : !completedSet.has(lessonId);

    if (shouldComplete) {
      completedSet.add(lessonId);
    } else {
      completedSet.delete(lessonId);
    }

    const completedLessonIds = Array.from(completedSet);
    const totalLessons = allLessonIds.length;
    const progressNumber = calculateLessonProgressPercent(
      completedLessonIds.length,
      totalLessons
    );

    const updatedEnrollment = await prisma.$transaction(async (tx) => {
      const enr = await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          progressPercent: new Prisma.Decimal(progressNumber.toFixed(2)),
          status: progressNumber >= 100 ? 'COMPLETED' : 'ACTIVE',
          completedAt: progressNumber >= 100 ? enrollment.completedAt || new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'LESSON_PROGRESS_UPDATED',
          entityType: 'Enrollment',
          entityId: enrollment.id,
          afterDataJson: JSON.stringify({
            courseId,
            lessonId,
            completedLessonIds,
            completedCount: completedLessonIds.length,
            totalLessons,
            progressPercent: progressNumber.toFixed(2),
          }),
        },
      });

      return enr;
    });

    return {
      courseId,
      enrollmentId: enrollment.id,
      completedLessonIds,
      completedCount: completedLessonIds.length,
      totalLessons,
      progressPercent: updatedEnrollment.progressPercent.toFixed(2),
    };
  }

  /**
   * Lists the student cohort roster across the teacher's assigned courses (or all courses for Admin).
   */
  static async listTeacherStudentsRoster(
    actor: AuthenticatedActor
  ): Promise<TeacherCohortStudentDto[]> {
    if (actor.role !== 'TEACHER' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only Teachers and Administrators can view the cohort student roster.');
    }

    const where: Prisma.EnrollmentWhereInput =
      actor.role === 'TEACHER'
        ? {
            course: {
              teacherAssignments: {
                some: { teacherId: actor.id, status: 'ACTIVE' },
              },
            },
          }
        : {};

    const enrollments = await prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
        course: { select: { id: true, code: true, title: true } },
        installments: { select: { status: true } },
      },
    });

    const enrollmentIds = enrollments.map((e) => e.id);
    const onboardingLogs =
      enrollmentIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              action: 'COURSE_ONBOARDING_UPDATED',
              entityType: 'Enrollment',
              entityId: { in: enrollmentIds },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const onboardingCompletedSet = new Set<string>();
    for (const log of onboardingLogs) {
      if (log.afterDataJson) {
        try {
          const parsed = JSON.parse(log.afterDataJson) as { completedAt?: string | null };
          if (parsed.completedAt) {
            onboardingCompletedSet.add(log.entityId);
          }
        } catch {
          // ignore
        }
      }
    }

    return enrollments.map((e) => {
      const paidInstallmentsCount = e.installments.filter(
        (i) => i.status === 'PAID'
      ).length;
      return {
        enrollmentId: e.id,
        studentId: e.student.id,
        studentName: e.student.fullName,
        studentEmail: e.student.email,
        studentPhone: e.student.phone,
        studentCode: e.student.studentProfile?.studentCode || null,
        courseId: e.course.id,
        courseCode: e.course.code,
        courseTitle: e.course.title,
        enrollmentStatus: e.status,
        progressPercent: e.progressPercent.toFixed(2),
        paidInstallmentsCount,
        totalInstallmentsCount: e.installments.length,
        onboardingCompleted:
          onboardingCompletedSet.has(e.id) || Number(e.progressPercent) >= 5,
        enrolledAt: e.enrolledAt.toISOString(),
      };
    });
  }

  /**
   * Teacher or Admin broadcasts an announcement to all enrolled students in `courseId` via WhatsApp + Email + In-App.
   */
  static async broadcastCourseAnnouncement(
    actor: AuthenticatedActor,
    courseId: string,
    payload: { title: string; body: string }
  ) {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can broadcast course announcements.');
    }
    await assertCourseAccessScope(actor, courseId);

    return OmnichannelMessagingService.dispatchToCourseCohort({
      actorId: actor.id,
      courseId,
      eventType: 'COURSE_ANNOUNCEMENT',
      title: payload.title,
      body: payload.body,
    });
  }

  /**
   * Creates a new course along with its default FULL payment plan template and audit log.
   */
  static async createCourse(
    actor: AuthenticatedActor,
    payload: {
      categoryId: string;
      code: string;
      title: string;
      slug: string;
      shortDescription: string;
      description: string;
      thumbnailUrl?: string | null;
      level: string;
      language: string;
      basePrice: number;
      currency: string;
      minAttendancePercent: number;
      minPassMarksPercent: number;
    }
  ): Promise<CourseSummaryDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can create courses.');
    }

    const createdCourseId = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          categoryId: payload.categoryId,
          code: payload.code.toUpperCase(),
          title: payload.title,
          slug: payload.slug.toLowerCase(),
          shortDescription: payload.shortDescription,
          description: payload.description,
          thumbnailUrl: payload.thumbnailUrl || null,
          level: payload.level,
          language: payload.language,
          basePrice: new Prisma.Decimal(payload.basePrice.toFixed(2)),
          currency: payload.currency,
          status: 'DRAFT',
          minAttendancePercent: new Prisma.Decimal(payload.minAttendancePercent.toFixed(2)),
          minPassMarksPercent: new Prisma.Decimal(payload.minPassMarksPercent.toFixed(2)),
          createdById: actor.id,
          paymentPlanTemplates: {
            create: {
              name: 'Standard Full Payment',
              planType: 'FULL',
              installmentCount: 1,
              totalAmount: new Prisma.Decimal(payload.basePrice.toFixed(2)),
              currency: payload.currency,
              gracePeriodDays: 0,
              isActive: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_CREATED',
          entityType: 'Course',
          entityId: course.id,
          afterDataJson: JSON.stringify({
            code: course.code,
            title: course.title,
            basePrice: course.basePrice.toFixed(2),
          }),
        },
      });

      return course.id;
    });

    return this.getCourseDetail(actor, createdCourseId);
  }

  static async updateCourseStatus(
    actor: AuthenticatedActor,
    courseId: string,
    status: CourseStatus
  ): Promise<CourseSummaryDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can publish or archive courses.');
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.course.findUnique({ where: { id: courseId } });
      if (!existing) {
        throw ApiError.notFound('Course not found');
      }

      await tx.course.update({
        where: { id: courseId },
        data: {
          status,
          publishedAt:
            status === 'PUBLISHED' && !existing.publishedAt ? new Date() : existing.publishedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_STATUS_CHANGED',
          entityType: 'Course',
          entityId: courseId,
          beforeDataJson: JSON.stringify({ status: existing.status }),
          afterDataJson: JSON.stringify({ status }),
        },
      });
    });

    return this.getCourseDetail(actor, courseId);
  }

  static async assignTeacherToCourse(
    actor: AuthenticatedActor,
    courseId: string,
    payload: {
      teacherId: string;
      assignmentRole: 'PRIMARY' | 'CO_INSTRUCTOR' | 'TEACHING_ASSISTANT';
      revenueSharePercent: number;
    }
  ): Promise<AssignedTeacherDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can assign teachers to courses.');
    }

    const teacherUser = await prisma.user.findUnique({
      where: { id: payload.teacherId },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    });

    if (!teacherUser || teacherUser.role !== 'TEACHER' || teacherUser.status !== 'ACTIVE') {
      throw ApiError.unprocessable('Target user must be an ACTIVE account with the TEACHER role.');
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const upserted = await tx.courseTeacherAssignment.upsert({
        where: {
          courseId_teacherId: {
            courseId,
            teacherId: payload.teacherId,
          },
        },
        update: {
          assignmentRole: payload.assignmentRole,
          revenueSharePercent: new Prisma.Decimal(payload.revenueSharePercent.toFixed(2)),
          status: 'ACTIVE',
        },
        create: {
          courseId,
          teacherId: payload.teacherId,
          assignmentRole: payload.assignmentRole,
          revenueSharePercent: new Prisma.Decimal(payload.revenueSharePercent.toFixed(2)),
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_TEACHER_ASSIGNED',
          entityType: 'CourseTeacherAssignment',
          entityId: upserted.id,
          afterDataJson: JSON.stringify({
            courseId,
            teacherId: payload.teacherId,
            assignmentRole: payload.assignmentRole,
            revenueSharePercent: payload.revenueSharePercent,
          }),
        },
      });

      return upserted;
    });

    return {
      assignmentId: assignment.id,
      teacherId: teacherUser.id,
      fullName: teacherUser.fullName,
      email: teacherUser.email,
      assignmentRole: assignment.assignmentRole,
      revenueSharePercent: assignment.revenueSharePercent.toFixed(2),
      status: assignment.status,
    };
  }

  static async createPaymentPlanTemplate(
    actor: AuthenticatedActor,
    courseId: string,
    payload: {
      name: string;
      planType: 'FULL' | 'INSTALLMENT';
      installmentCount: number;
      totalAmount: number;
      currency: string;
      gracePeriodDays: number;
    }
  ): Promise<PaymentPlanTemplateDto> {
    if (actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can configure course payment plans.');
    }

    if (payload.planType === 'FULL' && payload.installmentCount !== 1) {
      throw ApiError.unprocessable('FULL payment plans must have installmentCount = 1.');
    }
    if (payload.planType === 'INSTALLMENT' && payload.installmentCount < 2) {
      throw ApiError.unprocessable('INSTALLMENT plans must have at least 2 installments.');
    }

    const created = await prisma.$transaction(async (tx) => {
      const tpl = await tx.paymentPlanTemplate.create({
        data: {
          courseId,
          name: payload.name,
          planType: payload.planType,
          installmentCount: payload.installmentCount,
          totalAmount: new Prisma.Decimal(payload.totalAmount.toFixed(2)),
          currency: payload.currency,
          gracePeriodDays: payload.gracePeriodDays,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'PAYMENT_PLAN_TEMPLATE_CREATED',
          entityType: 'PaymentPlanTemplate',
          entityId: tpl.id,
          afterDataJson: JSON.stringify(payload),
        },
      });

      return tpl;
    });

    return {
      id: created.id,
      name: created.name,
      planType: created.planType,
      installmentCount: created.installmentCount,
      totalAmount: created.totalAmount.toFixed(2),
      currency: created.currency,
      gracePeriodDays: created.gracePeriodDays,
      isActive: created.isActive,
    };
  }

  static async createSection(
    actor: AuthenticatedActor,
    courseId: string,
    payload: { title: string; description?: string; sortOrder: number }
  ) {
    await assertCourseAccessScope(actor, courseId);
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Admins or assigned Teachers can manage course curriculum.');
    }

    return prisma.courseSection.create({
      data: {
        courseId,
        title: payload.title,
        description: payload.description || null,
        sortOrder: payload.sortOrder,
      },
    });
  }

  static async createLesson(
    actor: AuthenticatedActor,
    courseId: string,
    sectionId: string,
    payload: {
      title: string;
      contentType: string;
      durationSeconds: number;
      sortOrder: number;
      isPreview: boolean;
    }
  ) {
    await assertCourseAccessScope(actor, courseId);
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Admins or assigned Teachers can create lessons.');
    }

    const section = await prisma.courseSection.findFirst({
      where: { id: sectionId, courseId },
      select: { id: true },
    });
    if (!section) {
      throw ApiError.notFound('Section not found in the specified course.');
    }

    return prisma.courseLesson.create({
      data: {
        sectionId,
        title: payload.title,
        contentType: payload.contentType,
        durationSeconds: payload.durationSeconds,
        sortOrder: payload.sortOrder,
        isPreview: payload.isPreview,
      },
    });
  }

  /**
   * Lists academic Q&A / Doubt threads for a course (`GET /api/v1/courses/:courseId/doubts`).
   */
  static async listCourseDoubts(
    actor: AuthenticatedActor,
    courseId: string
  ): Promise<CourseDoubtThreadDto[]> {
    await assertCourseAccessScope(actor, courseId);

    const [doubtLogs, replyLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: 'COURSE_DOUBT_CREATED',
          entityType: 'CourseDoubt',
          reason: courseId,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
      prisma.auditLog.findMany({
        where: {
          action: 'COURSE_DOUBT_REPLIED',
          entityType: 'CourseDoubtReply',
          reason: courseId,
        },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
    ]);

    const repliesByDoubtId = new Map<string, CourseDoubtReplyDto[]>();
    const resolvedDoubtIds = new Set<string>();

    for (const rLog of replyLogs) {
      let parsed: Record<string, unknown> = {};
      if (rLog.afterDataJson) {
        try {
          parsed = JSON.parse(rLog.afterDataJson) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
      }
      const doubtId = rLog.entityId;
      const senderRole = (rLog.actor?.role || 'STUDENT') as
        | 'ADMIN'
        | 'STUDENT'
        | 'TEACHER'
        | 'SUPPORT';
      if (senderRole === 'TEACHER' || senderRole === 'ADMIN') {
        resolvedDoubtIds.add(doubtId);
      }
      const list = repliesByDoubtId.get(doubtId) || [];
      list.push({
        id: rLog.id,
        doubtId,
        senderId: rLog.actorUserId || '',
        senderName: rLog.actor?.fullName || 'Faculty Member',
        senderRole,
        message: String(parsed.message || ''),
        createdAt: rLog.createdAt.toISOString(),
      });
      repliesByDoubtId.set(doubtId, list);
    }

    return doubtLogs.map((dLog) => {
      let parsed: Record<string, unknown> = {};
      if (dLog.afterDataJson) {
        try {
          parsed = JSON.parse(dLog.afterDataJson) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
      }
      const replies = repliesByDoubtId.get(dLog.id) || [];
      return {
        id: dLog.id,
        courseId,
        lessonTitle: parsed.lessonTitle ? String(parsed.lessonTitle) : null,
        subject: String(parsed.subject || 'Academic Doubt'),
        question: String(parsed.question || ''),
        studentId: dLog.actorUserId || '',
        studentName: dLog.actor?.fullName || 'Enrolled Student',
        status: resolvedDoubtIds.has(dLog.id) ? 'RESOLVED' : 'OPEN',
        createdAt: dLog.createdAt.toISOString(),
        replies,
      };
    });
  }

  /**
   * Enrolled student (or instructor) posts a new academic doubt / Q&A thread in a course.
   */
  static async createCourseDoubt(
    actor: AuthenticatedActor,
    courseId: string,
    payload: { lessonTitle?: string; subject: string; question: string }
  ): Promise<CourseDoubtThreadDto> {
    await assertCourseAccessScope(actor, courseId);

    const created = await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'COURSE_DOUBT_CREATED',
        entityType: 'CourseDoubt',
        entityId: courseId,
        reason: courseId,
        afterDataJson: JSON.stringify({
          courseId,
          lessonTitle: payload.lessonTitle || null,
          subject: payload.subject,
          question: payload.question,
        }),
      },
    });

    return {
      id: created.id,
      courseId,
      lessonTitle: payload.lessonTitle || null,
      subject: payload.subject,
      question: payload.question,
      studentId: actor.id,
      studentName: actor.fullName,
      status: 'OPEN',
      createdAt: created.createdAt.toISOString(),
      replies: [],
    };
  }

  /**
   * Teacher, Admin, or Student replies to a course doubt thread.
   * When a Teacher or Admin replies, the student who posted the doubt automatically receives
   * a WhatsApp + Email + In-App alert!
   */
  static async replyToCourseDoubt(
    actor: AuthenticatedActor,
    courseId: string,
    doubtId: string,
    payload: { message: string }
  ): Promise<CourseDoubtReplyDto> {
    await assertCourseAccessScope(actor, courseId);

    const [doubtLog, course] = await Promise.all([
      prisma.auditLog.findUnique({ where: { id: doubtId } }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { code: true, title: true },
      }),
    ]);

    if (!doubtLog || doubtLog.action !== 'COURSE_DOUBT_CREATED') {
      throw ApiError.notFound('Course doubt thread not found.');
    }

    const replyLog = await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'COURSE_DOUBT_REPLIED',
        entityType: 'CourseDoubtReply',
        entityId: doubtId,
        reason: courseId,
        afterDataJson: JSON.stringify({
          courseId,
          doubtId,
          message: payload.message,
        }),
      },
    });

    if (
      (actor.role === 'TEACHER' || actor.role === 'ADMIN') &&
      doubtLog.actorUserId &&
      doubtLog.actorUserId !== actor.id
    ) {
      let subject = 'your course doubt';
      if (doubtLog.afterDataJson) {
        try {
          const parsed = JSON.parse(doubtLog.afterDataJson) as { subject?: string };
          if (parsed.subject) subject = `"${parsed.subject}"`;
        } catch {
          // ignore
        }
      }
      await OmnichannelMessagingService.dispatchToUsers({
        actorId: actor.id,
        eventType: 'COURSE_ANNOUNCEMENT',
        courseCode: course?.code || null,
        title: `Faculty Answered Your Doubt (${course?.code || 'Course'})`,
        body: `${actor.fullName} replied to ${subject}: "${payload.message}"`,
        recipientUserIds: [doubtLog.actorUserId],
      });
    }

    return {
      id: replyLog.id,
      doubtId,
      senderId: actor.id,
      senderName: actor.fullName,
      senderRole: actor.role,
      message: payload.message,
      createdAt: replyLog.createdAt.toISOString(),
    };
  }
}
