export interface CourseMaterialDto {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  uploadedById: string;
  signedDownloadUrl: string;
  createdAt: string;
}
