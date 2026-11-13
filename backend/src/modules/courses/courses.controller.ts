import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { CoursesService } from './courses.service';

export class CoursesController {
  static listCategories = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const categories = await CoursesService.listCategories(req.user);
    return apiResponse(res, 200, 'Course categories retrieved successfully', categories);
  });

  static createCategory = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await CoursesService.createCategory(req.user, req.body);
    return apiResponse(res, 201, 'Course category created successfully', created);
  });

  static listCourses = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await CoursesService.listCourses(req.user, req.query as Record<string, unknown>);
    return apiResponse(res, 200, 'Courses retrieved successfully', result.items, result.meta);
  });

  static listTeacherStudentsRoster = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const roster = await CoursesService.listTeacherStudentsRoster(req.user);
    return apiResponse(res, 200, 'Cohort student roster retrieved successfully', roster);
  });

  static getCourseDetail = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const detail = await CoursesService.getCourseDetail(req.user, String(req.params.courseId));
    return apiResponse(res, 200, 'Course details retrieved successfully', detail);
  });

  static createCourse = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await CoursesService.createCourse(req.user, req.body);
    return apiResponse(res, 201, 'Course created successfully', created);
  });

  static updateCourseStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await CoursesService.updateCourseStatus(
      req.user,
      String(req.params.courseId),
      req.body.status
    );
    return apiResponse(res, 200, 'Course status updated successfully', updated);
  });

  static assignTeacher = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const assigned = await CoursesService.assignTeacherToCourse(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(res, 200, 'Teacher assigned to course successfully', assigned);
  });

  static createPaymentPlanTemplate = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const plan = await CoursesService.createPaymentPlanTemplate(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(res, 201, 'Course payment plan template created', plan);
  });

  static createSection = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const sec = await CoursesService.createSection(req.user, String(req.params.courseId), req.body);
    return apiResponse(res, 201, 'Course section created', sec);
  });

  static createLesson = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const lesson = await CoursesService.createLesson(
      req.user,
      String(req.params.courseId),
      String(req.params.sectionId),
      req.body
    );
    return apiResponse(res, 201, 'Course lesson created', lesson);
  });

  static toggleLessonComplete = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const progress = await CoursesService.toggleLessonCompletion(
      req.user,
      String(req.params.courseId),
      String(req.params.lessonId),
      req.body?.completed
    );
    return apiResponse(
      res,
      200,
      'Lesson completion and course progress updated',
      progress
    );
  });

  static broadcastAnnouncement = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await CoursesService.broadcastCourseAnnouncement(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'Course announcement broadcasted to enrolled cohort',
      result
    );
  });

  static listDoubts = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await CoursesService.listCourseDoubts(
      req.user,
      String(req.params.courseId)
    );
    return apiResponse(res, 200, 'Course Q&A doubts retrieved', list);
  });

  static createDoubt = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await CoursesService.createCourseDoubt(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(res, 201, 'Course doubt posted successfully', created);
  });

  static replyDoubt = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const reply = await CoursesService.replyToCourseDoubt(
      req.user,
      String(req.params.courseId),
      String(req.params.doubtId),
      req.body
    );
    return apiResponse(res, 201, 'Doubt reply recorded and student notified', reply);
  });
}
