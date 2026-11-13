import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/ApiError';
import { MaterialsService } from './materials.service';

export class MaterialsController {
  static listCourseMaterials = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await MaterialsService.listMaterialsForCourse(
      req.user,
      String(req.params.courseId)
    );
    return apiResponse(res, 200, 'Course materials retrieved successfully', list);
  });

  static createCourseMaterial = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await MaterialsService.createCourseMaterial(
      req.user,
      String(req.params.courseId),
      req.body
    );
    return apiResponse(res, 201, 'Course material uploaded and cohort notified', result);
  });

  static downloadMaterial = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const payload = await MaterialsService.getMaterialDownloadPayload(
      req.user,
      String(req.params.materialId)
    );
    return apiResponse(
      res,
      200,
      'Study material preview and download payload retrieved',
      payload
    );
  });

  static streamSignedMaterial = catchAsync(async (req: Request, res: Response) => {
    const result = MaterialsService.streamSignedMaterial(
      req.query as Record<string, unknown>
    );
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName.replace(/"/g, '')}"`
    );
    return res.status(200).send(result.buffer);
  });
}
