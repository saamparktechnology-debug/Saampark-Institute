import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createMaterialValidation,
  listCourseMaterialsValidation,
} from './materials.validation';
import { MaterialsController } from './materials.controller';

export const materialsRouter = Router();

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
