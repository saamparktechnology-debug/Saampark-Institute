import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { DashboardsService } from './dashboards.service';

export class DashboardsController {
  static getAdminDashboard = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const summary = await DashboardsService.getAdminSummary(req.user);
    return apiResponse(res, 200, 'Admin dashboard summary fetched', summary);
  });

  static getStudentDashboard = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const summary = await DashboardsService.getStudentSummary(req.user);
    return apiResponse(res, 200, 'Student dashboard summary fetched', summary);
  });

  static getTeacherDashboard = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const summary = await DashboardsService.getTeacherSummary(req.user);
    return apiResponse(res, 200, 'Teacher cockpit summary fetched', summary);
  });

  static getSupportDashboard = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const summary = await DashboardsService.getSupportSummary(req.user);
    return apiResponse(res, 200, 'Support command center summary fetched', summary);
  });
}
