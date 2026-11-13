import path from 'path';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedActor } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { assertCourseAccessScope } from '../../middlewares/auth.middleware';
import { LocalVpsStorageAdapter } from '../../integrations/storage.adapter';
import { OmnichannelMessagingService } from '../../integrations/messaging.adapter';
import { CourseMaterialDto, MaterialDownloadPayloadDto } from './materials.types';

const storageAdapter = new LocalVpsStorageAdapter(
  env.JWT_ACCESS_SECRET,
  env.LOCAL_UPLOAD_DIR
);

export class MaterialsService {
  /**
   * Lists course materials for a given course.
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
   * Authorizes, writes the uploaded binary file (`fileBase64`) to disk under `uploads/<storageKey>`,
   * persists the CourseMaterial record in MySQL, and automatically alerts enrolled students via WhatsApp + Email + In-App.
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
      fileBase64?: string | null;
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

    // Write actual uploaded binary bytes to local disk if provided by <input type="file" />
    if (payload.fileBase64) {
      storageAdapter.saveUploadedFileBuffer(ticket.storageKey, payload.fileBase64);
    }

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
            savedToDisk: Boolean(payload.fileBase64),
          }),
        },
      });

      return mat;
    });

    await OmnichannelMessagingService.dispatchToCourseCohort({
      actorId: actor.id,
      courseId,
      eventType: 'STUDY_MATERIAL_UPLOADED',
      title: `New Study Material: ${created.title}`,
      body: `A new learning material (${created.fileName}) has been uploaded to your course vault. Open Learning Materials to view or download it.`,
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

  /**
   * Verifies course scope, records an audited download event, and returns the real uploaded
   * binary file (`fileBase64`) (`GET /api/v1/materials/:materialId/download`).
   * Throws 404 if the binary file does not exist on disk (zero dummy .txt fallback).
   */
  static async getMaterialDownloadPayload(
    actor: AuthenticatedActor,
    materialId: string
  ): Promise<MaterialDownloadPayloadDto> {
    const mat = await prisma.courseMaterial.findUnique({
      where: { id: materialId },
      include: {
        course: { select: { id: true, code: true, title: true } },
      },
    });

    if (!mat) {
      throw ApiError.notFound('Study material not found.');
    }

    await assertCourseAccessScope(actor, mat.courseId);

    const diskBuffer = storageAdapter.readUploadedFileBuffer(mat.storageKey);
    if (!diskBuffer) {
      throw ApiError.notFound(
        `Binary file "${mat.fileName}" was not found on server disk storage. Please upload the actual file via the Course Materials uploader.`
      );
    }

    const uploader = await prisma.user.findUnique({
      where: { id: mat.uploadedById },
      select: { fullName: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'COURSE_MATERIAL_DOWNLOADED',
        entityType: 'CourseMaterial',
        entityId: mat.id,
        afterDataJson: JSON.stringify({
          courseId: mat.courseId,
          fileName: mat.fileName,
        }),
      },
    });

    const fileBase64 = diskBuffer.toString('base64');

    const studyGuideText = [
      `Course: ${mat.course.code} — ${mat.course.title}`,
      `Material Title: ${mat.title}`,
      `File Name: ${mat.fileName} (${mat.mimeType})`,
      `Author: ${uploader?.fullName || 'Course Instructor'}`,
      `Description: ${mat.description || ''}`,
    ].join('\n');

    return {
      id: mat.id,
      courseId: mat.courseId,
      courseCode: mat.course.code,
      courseTitle: mat.course.title,
      title: mat.title,
      description: mat.description,
      fileName: mat.fileName,
      mimeType: mat.mimeType,
      sizeBytes: Number(mat.sizeBytes),
      fileBase64,
      studyGuideText,
      downloadedAt: new Date().toISOString(),
    };
  }

  /**
   * Streams the binary file directly when a signed download URL (`/api/v1/materials/stream?key=...`) is opened.
   * Strictly throws 404 if the binary file does not exist on disk.
   */
  static streamSignedMaterial(query: Record<string, unknown>): {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  } {
    const key = String(query.key || '');
    const uid = String(query.uid || '');
    const exp = Number(query.exp || 0);
    const sig = String(query.sig || '');

    if (!storageAdapter.verifySignedDownloadUrl(key, uid, exp, sig)) {
      throw ApiError.forbidden('Signed material download link is invalid or expired.');
    }

    const fileName = path.basename(key) || 'study-material.bin';
    const diskBuf = storageAdapter.readUploadedFileBuffer(key);
    if (!diskBuf) {
      throw ApiError.notFound(
        `Binary file "${fileName}" was not found on server disk storage. Please upload the actual file via the Course Materials uploader.`
      );
    }

    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.mp4': 'video/mp4',
    };
    return {
      fileName,
      mimeType: mimeMap[ext] || 'application/octet-stream',
      buffer: diskBuf,
    };
  }
}
