import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { EnrollmentsService } from './enrollments.service';

export class EnrollmentsController {
  static listEnrollments = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await EnrollmentsService.listEnrollments(
      req.user,
      req.query as Record<string, unknown>
    );
    return apiResponse(res, 200, 'Enrollments retrieved successfully', result.items, result.meta);
  });

  static getEnrollmentById = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const detail = await EnrollmentsService.getEnrollmentById(
      req.user,
      String(req.params.enrollmentId)
    );
    return apiResponse(res, 200, 'Enrollment details retrieved', detail);
  });

  static initiateEnrollment = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await EnrollmentsService.initiateEnrollment(req.user, req.body);
    return apiResponse(
      res,
      201,
      'Enrollment initiated with installment schedule snapshot',
      created
    );
  });

  static adminAssignEnrollment = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await EnrollmentsService.adminAssignEnrollment(req.user, req.body);
    return apiResponse(
      res,
      201,
      'Student directly enrolled and onboarding welcome dispatched',
      created
    );
  });

  static verifyInstallmentPayment = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await EnrollmentsService.recordVerifiedInstallmentPayment(
      req.user,
      String(req.params.enrollmentId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'Installment payment verified and course access updated',
      updated
    );
  });

  static updateOnboarding = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await EnrollmentsService.updateOnboardingState(
      req.user,
      String(req.params.enrollmentId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'Course onboarding checklist updated successfully',
      updated
    );
  });

  static extendInstallmentSchedule = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await EnrollmentsService.extendInstallmentScheduleMoratorium(
      req.user,
      String(req.params.enrollmentId),
      req.body
    );
    return apiResponse(
      res,
      200,
      'Installment schedule extended and overdue lock re-evaluated',
      updated
    );
  });
}
