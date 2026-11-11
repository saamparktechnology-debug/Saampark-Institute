export const COURSE_LEVEL_OPTIONS = [
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Intermediate', value: 'INTERMEDIATE' },
  { label: 'Advanced', value: 'ADVANCED' },
] as const;

export const TEACHER_ASSIGNMENT_ROLES = [
  { label: 'Primary Instructor', value: 'PRIMARY' },
  { label: 'Co-Instructor', value: 'CO_INSTRUCTOR' },
  { label: 'Teaching Assistant', value: 'TEACHING_ASSISTANT' },
] as const;

export const LESSON_CONTENT_TYPES = [
  { label: 'Video Lesson', value: 'VIDEO' },
  { label: 'Reading / Document', value: 'DOCUMENT' },
  { label: 'Interactive Quiz', value: 'QUIZ' },
  { label: 'Live Classroom Session', value: 'LIVE_SESSION' },
] as const;
