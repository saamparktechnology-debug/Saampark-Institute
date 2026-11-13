import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ApiError } from '../utils/ApiError';

export const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'text/plain',
  'text/csv',
  'text/markdown',
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
  private readonly baseUploadDir: string;

  constructor(private readonly signingSecret: string, uploadDir?: string) {
    this.baseUploadDir = path.resolve(
      process.cwd(),
      uploadDir && !uploadDir.startsWith('/var/www') ? uploadDir : './uploads'
    );
  }

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

  /**
   * Persists the uploaded file bytes (`fileBase64`) to the local VPS disk under `uploads/<storageKey>`.
   */
  saveUploadedFileBuffer(storageKey: string, fileBase64?: string | null): boolean {
    if (!fileBase64) return false;
    try {
      const safeRelative = storageKey.replace(/\.\./g, '');
      const fullPath = path.join(this.baseUploadDir, safeRelative);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      const cleanBase64 = fileBase64.includes(',')
        ? fileBase64.split(',')[1]
        : fileBase64;
      const buf = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(fullPath, buf);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads a previously uploaded binary file from disk if present.
   */
  readUploadedFileBuffer(storageKey: string): Buffer | null {
    try {
      const safeRelative = storageKey.replace(/\.\./g, '');
      const fullPath = path.join(this.baseUploadDir, safeRelative);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    } catch {
      return null;
    }
  }

  generateSignedDownloadUrl(
    storageKey: string,
    userId: string,
    expiresInSeconds = 3600
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

  verifySignedDownloadUrl(
    storageKey: string,
    userId: string,
    exp: number,
    signature: string
  ): boolean {
    if (!storageKey || !userId || !signature || !Number.isFinite(exp)) return false;
    if (Math.floor(Date.now() / 1000) > exp) return false;
    const expected = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${storageKey}:${userId}:${exp}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
