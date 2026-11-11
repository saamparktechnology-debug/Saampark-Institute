import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  initiateEnrollmentValidation,
  verifyInstallmentPaymentValidation,
} from './enrollments.validation';
import { EnrollmentsController } from './enrollments.controller';

export const enrollmentsRouter = Router();

enrollmentsRouter.use(authenticate);

enrollmentsRouter.get('/', EnrollmentsController.listEnrollments);
enrollmentsRouter.get('/:enrollmentId', EnrollmentsController.getEnrollmentById);

enrollmentsRouter.post(
  '/',
  authorizeRoles('STUDENT'),
  validateRequest(initiateEnrollmentValidation),
  EnrollmentsController.initiateEnrollment
);

enrollmentsRouter.post(
  '/:enrollmentId/verify-payment',
  authorizeRoles('ADMIN', 'STUDENT'),
  validateRequest(verifyInstallmentPaymentValidation),
  EnrollmentsController.verifyInstallmentPayment
);
