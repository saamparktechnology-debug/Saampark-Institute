import crypto from 'crypto';
import path from 'path';
import { ApiError } from '../utils/ApiError';

export const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'text/plain',
]);

export const MAX_MATERIAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB max

export interface AuthorizeMaterialUploadInput {
  courseId: string;
  lessonId?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageObjectTicket {
  storageProvider: 'LOCAL_VPS' | 'S3';
  storageKey: string;
  sanitizedFileName: string;
  uploadToken: string;
  expiresAt: string;
}

export interface StorageProvider {
  readonly providerName: 'LOCAL_VPS' | 'S3';
  authorizeUpload(input: AuthorizeMaterialUploadInput): StorageObjectTicket;
  generateSignedDownloadUrl(storageKey: string, userId: string, expiresInSeconds?: number): string;
}

export function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 180) || 'material.bin';
}

export class LocalVpsStorageAdapter implements StorageProvider {
  public readonly providerName = 'LOCAL_VPS' as const;

  constructor(private readonly signingSecret: string) {}

  authorizeUpload(input: AuthorizeMaterialUploadInput): StorageObjectTicket {
    if (!ALLOWED_MATERIAL_MIME_TYPES.has(input.mimeType)) {
      throw ApiError.badRequest(
        `Unsupported material MIME type: ${input.mimeType}`,
        'VALIDATION_ERROR'
      );
    }

    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
      throw ApiError.badRequest('File size must be a positive byte count', 'VALIDATION_ERROR');
    }

    if (input.sizeBytes > MAX_MATERIAL_SIZE_BYTES) {
      throw ApiError.badRequest(
        `File size exceeds maximum limit of ${MAX_MATERIAL_SIZE_BYTES} bytes (50 MB)`,
        'VALIDATION_ERROR'
      );
    }

    const sanitizedFileName = sanitizeFileName(input.fileName);
    const uniquePrefix = crypto.randomUUID();
    const storageKey = `courses/${input.courseId}/materials/${uniquePrefix}-${sanitizedFileName}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const uploadToken = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${storageKey}:${input.mimeType}:${input.sizeBytes}:${expiresAt}`)
      .digest('hex');

    return {
      storageProvider: 'LOCAL_VPS',
      storageKey,
      sanitizedFileName,
      uploadToken,
      expiresAt,
    };
  }

  generateSignedDownloadUrl(
    storageKey: string,
    userId: string,
    expiresInSeconds = 900
  ): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${storageKey}:${userId}:${exp}`)
      .digest('hex');

    return `/api/v1/materials/stream?key=${encodeURIComponent(
      storageKey
    )}&uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${signature}`;
  }
}
