export interface LiveClassItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  title: string;
  description: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  provider: string;
  providerRoomId: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  participantCount: number;
  createdAt: string;
}

export interface LiveRoomJoinTicket {
  liveClassId: string;
  courseTitle: string;
  title: string;
  provider: 'HMS_100MS';
  providerRoomId: string;
  roomRole: 'host' | 'co-host' | 'guest-student';
  token: string;
  expiresAt: string;
  participantId: string;
}

export interface LiveClassParticipantItem {
  id: string;
  liveClassId: string;
  userId: string;
  fullName: string;
  email: string;
  participantRole: 'ADMIN' | 'STUDENT' | 'TEACHER' | 'SUPPORT';
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number;
}

export interface ClassRecordingItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  liveClassId: string | null;
  liveClassTitle: string | null;
  title: string;
  provider: string;
  youtubeVideoId: string;
  safeEmbedUrl: string;
  durationSeconds: number;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string;
  createdAt: string;
}

export interface AttendanceRecordItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  markedAt: string;
  source: 'CODE' | 'MANUAL';
  correctedByName: string | null;
  correctionReason: string | null;
}

export interface AttendanceSessionItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  minAttendancePercent: string;
  liveClassId: string | null;
  liveClassTitle: string | null;
  teacherName: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  codeExpiresAt: string;
  isCodeExpired: boolean;
  status: 'OPEN' | 'CLOSED' | 'FINALIZED';
  myRecord: {
    id: string;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
    markedAt: string;
    source: 'CODE' | 'MANUAL';
    correctionReason: string | null;
  } | null;
  records: AttendanceRecordItem[];
  enrolledRoster: Array<{
    id: string;
    fullName: string;
    email: string;
  }>;
}

export interface GeneratedAttendanceCodeResult {
  sessionId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  generatedCode: string;
  codeExpiresAt: string;
  expiryMinutes: number;
  status: 'OPEN' | 'CLOSED' | 'FINALIZED';
}
