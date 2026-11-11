import { Prisma, CourseStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { parsePaginationAndFilters, buildPaginationMeta } from '../../utils/pagination';
import { assertCourseAccessScope } from '../../middlewares/auth.middleware';
import {
  CourseCategoryDto,
  CourseSummaryDto,
  AssignedTeacherDto,
  PaymentPlanTemplateDto,
  CourseSectionDto,
} from './courses.types';

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
   * Fetches course detail.
   * Non-preview lesson references are only returned if the student has an active enrollment,
   * the teacher is actively assigned to the course, or the actor is an Admin.
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
    if (actor.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          courseId: course.id,
          studentId: actor.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
        select: { id: true },
      });
      studentHasActiveAccess = Boolean(enrollment);
    }

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
    };
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
          publishedAt: status === 'PUBLISHED' && !existing.publishedAt ? new Date() : existing.publishedAt,
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

  /**
   * Assigns or updates a teacher on a course (Multi-teacher support: PRIMARY, CO_INSTRUCTOR, TEACHING_ASSISTANT)
   * with configurable revenueSharePercent (C-026, C-029).
   */
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
}
