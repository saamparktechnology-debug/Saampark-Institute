import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { MaterialsService } from './materials.service';

export class MaterialsController {
  static listCourseMaterials = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await MaterialsService.listMaterialsForCourse(req.user, String(req.params.courseId));
    return apiResponse(res, 200, 'Course materials retrieved successfully', list);
  });

  static createCourseMaterial = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await MaterialsService.createCourseMaterial(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(res, 201, 'Course material authorized and registered', result);
  });
}
