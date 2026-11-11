import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { assertCourseAccessScope } from '../../middlewares/auth.middleware';
import { LocalVpsStorageAdapter } from '../../integrations/storage.adapter';
import { CourseMaterialDto } from './materials.types';

const storageAdapter = new LocalVpsStorageAdapter(env.JWT_ACCESS_SECRET);

export class MaterialsService {
  /**
   * Lists course materials for a given course.
   * Enforces C-013, C-026, C-027 via `assertCourseAccessScope`:
   * - Student must have an ACTIVE or COMPLETED enrollment (1st installment or full payment verified).
   * - Teacher must have an ACTIVE assignment in `course_teacher_assignments`.
   * - Admin has full access.
   */
  static async listMaterialsForCourse(
    actor: AuthenticatedActor,
    courseId: string
  ): Promise<CourseMaterialDto[]> {
    await assertCourseAccessScope(actor, courseId);

    const records = await prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((m) => ({
      id: m.id,
      courseId: m.courseId,
      lessonId: m.lessonId,
      title: m.title,
      description: m.description,
      fileName: m.fileName,
      mimeType: m.mimeType,
      sizeBytes: Number(m.sizeBytes),
      storageProvider: m.storageProvider,
      uploadedById: m.uploadedById,
      signedDownloadUrl: storageAdapter.generateSignedDownloadUrl(m.storageKey, actor.id),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Authorizes and persists a course material record on the Hostinger VPS storage adapter.
   * Only ADMIN or an actively assigned TEACHER on that course can upload materials.
   */
  static async createCourseMaterial(
    actor: AuthenticatedActor,
    courseId: string,
    payload: {
      lessonId?: string | null;
      title: string;
      description?: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }
  ): Promise<{ material: CourseMaterialDto; uploadTicket: { uploadToken: string; expiresAt: string } }> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw ApiError.forbidden('Only Administrators or assigned Teachers can upload course materials.');
    }

    await assertCourseAccessScope(actor, courseId);

    const ticket = storageAdapter.authorizeUpload({
      courseId,
      lessonId: payload.lessonId,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    });

    const created = await prisma.$transaction(async (tx) => {
      const mat = await tx.courseMaterial.create({
        data: {
          courseId,
          lessonId: payload.lessonId || null,
          title: payload.title,
          description: payload.description || null,
          fileName: ticket.sanitizedFileName,
          mimeType: payload.mimeType,
          sizeBytes: BigInt(payload.sizeBytes),
          storageProvider: ticket.storageProvider,
          storageKey: ticket.storageKey,
          uploadedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'COURSE_MATERIAL_UPLOADED',
          entityType: 'CourseMaterial',
          entityId: mat.id,
          afterDataJson: JSON.stringify({
            courseId,
            title: mat.title,
            fileName: mat.fileName,
            sizeBytes: payload.sizeBytes,
          }),
        },
      });

      return mat;
    });

    return {
      material: {
        id: created.id,
        courseId: created.courseId,
        lessonId: created.lessonId,
        title: created.title,
        description: created.description,
        fileName: created.fileName,
        mimeType: created.mimeType,
        sizeBytes: Number(created.sizeBytes),
        storageProvider: created.storageProvider,
        uploadedById: created.uploadedById,
        signedDownloadUrl: storageAdapter.generateSignedDownloadUrl(created.storageKey, actor.id),
        createdAt: created.createdAt.toISOString(),
      },
      uploadTicket: {
        uploadToken: ticket.uploadToken,
        expiresAt: ticket.expiresAt,
      },
    };
  }
}
