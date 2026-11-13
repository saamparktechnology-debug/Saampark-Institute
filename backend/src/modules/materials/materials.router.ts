import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createMaterialValidation,
  downloadMaterialValidation,
  listCourseMaterialsValidation,
} from './materials.validation';
import { MaterialsController } from './materials.controller';

export const materialsRouter = Router();

// Signed download URL stream (verified via HMAC signature in query string)
materialsRouter.get('/stream', MaterialsController.streamSignedMaterial);

materialsRouter.use(authenticate);

materialsRouter.get(
  '/courses/:courseId',
  validateRequest(listCourseMaterialsValidation),
  MaterialsController.listCourseMaterials
);

materialsRouter.post(
  '/courses/:courseId',
  authorizeRoles('ADMIN', 'TEACHER'),
  validateRequest(createMaterialValidation),
  MaterialsController.createCourseMaterial
);

materialsRouter.get(
  '/:materialId/download',
  validateRequest(downloadMaterialValidation),
  MaterialsController.downloadMaterial
);
