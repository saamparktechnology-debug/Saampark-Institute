import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { UsersService } from './users.service';

export class UsersController {
  static listUsers = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await UsersService.listUsers(req.user, req.query as Record<string, unknown>);
    return apiResponse(res, 200, 'Users retrieved successfully', result.items, result.meta);
  });

  static listActiveTeachers = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const teachers = await UsersService.listActiveTeachers(req.user);
    return apiResponse(res, 200, 'Active teachers retrieved successfully', teachers);
  });

  static createUserByAdmin = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const created = await UsersService.createUserByAdmin(req.user, req.body);
    return apiResponse(res, 201, 'User account provisioned successfully', created);
  });

  static updateUserStatus = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const updated = await UsersService.updateUserStatus(
      req.user,
      String(req.params.userId),
      req.body.status,
      req.body.fullName
    );
    return apiResponse(res, 200, 'User account updated successfully by Admin', updated);
  });
}
