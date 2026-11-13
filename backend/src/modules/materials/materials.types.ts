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

export interface MaterialDownloadPayloadDto {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileBase64: string | null;
  studyGuideText: string;
  downloadedAt: string;
}
