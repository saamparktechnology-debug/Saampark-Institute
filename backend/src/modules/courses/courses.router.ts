import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  assignTeacherValidation,
  broadcastCourseAnnouncementValidation,
  createCourseDoubtValidation,
  replyCourseDoubtValidation,
  createCategoryValidation,
  createCourseValidation,
  createLessonValidation,
  createPaymentPlanTemplateValidation,
  createSectionValidation,
  toggleLessonCompleteValidation,
  updateCourseStatusValidation,
} from './courses.validation';
import { CoursesController } from './courses.controller';

export const coursesRouter = Router();

coursesRouter.use(authenticate);

// Categories
coursesRouter.get('/categories', CoursesController.listCategories);
coursesRouter.post(
  '/categories',
  authorizeRoles('ADMIN'),
  validateRequest(createCategoryValidation),
  CoursesController.createCategory
);

// Teacher Cohort Student Roster (/teacher/students)
coursesRouter.get(
  '/teacher/students',
  authorizeRoles('ADMIN', 'TEACHER'),
  CoursesController.listTeacherStudentsRoster
);

// Courses
coursesRouter.get('/', CoursesController.listCourses);
coursesRouter.post(
  '/',
  authorizeRoles('ADMIN'),
  validateRequest(createCourseValidation),
  CoursesController.createCourse
);
coursesRouter.get('/:courseId', CoursesController.getCourseDetail);
coursesRouter.patch(
  '/:courseId/status',
  authorizeRoles('ADMIN'),
  validateRequest(updateCourseStatusValidation),
  CoursesController.updateCourseStatus
);

// Multi-Teacher Assignments (C-026)
coursesRouter.post(
  '/:courseId/teachers',
  authorizeRoles('ADMIN'),
  validateRequest(assignTeacherValidation),
  CoursesController.assignTeacher
);

// Payment Plan Templates (C-009, C-027)
coursesRouter.post(
  '/:courseId/payment-plans',
  authorizeRoles('ADMIN'),
  validateRequest(createPaymentPlanTemplateValidation),
  CoursesController.createPaymentPlanTemplate
);

// Curriculum Sections & Lessons
coursesRouter.post(
  '/:courseId/sections',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createSectionValidation),
  CoursesController.createSection
);
coursesRouter.post(
  '/:courseId/sections/:sectionId/lessons',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createLessonValidation),
  CoursesController.createLesson
);

// Interactive Student Lesson Completion & Course Progress Engine
coursesRouter.post(
  '/:courseId/lessons/:lessonId/complete',
  authorizeRoles('STUDENT'),
  validateRequest(toggleLessonCompleteValidation),
  CoursesController.toggleLessonComplete
);

// Course Cohort Announcement Broadcast (Email + WhatsApp + In-App)
coursesRouter.post(
  '/:courseId/announcements',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(broadcastCourseAnnouncementValidation),
  CoursesController.broadcastAnnouncement
);

// Course Doubts & Q&A Discussion Forum
coursesRouter.get('/:courseId/doubts', CoursesController.listDoubts);
coursesRouter.post(
  '/:courseId/doubts',
  validateRequest(createCourseDoubtValidation),
  CoursesController.createDoubt
);
coursesRouter.post(
  '/:courseId/doubts/:doubtId/replies',
  validateRequest(replyCourseDoubtValidation),
  CoursesController.replyDoubt
);
