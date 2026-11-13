import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  adminAssignEnrollmentValidation,
  extendInstallmentScheduleValidation,
  initiateEnrollmentValidation,
  updateOnboardingStateValidation,
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
  '/admin-assign',
  authorizeRoles('ADMIN'),
  validateRequest(adminAssignEnrollmentValidation),
  EnrollmentsController.adminAssignEnrollment
);

enrollmentsRouter.post(
  '/:enrollmentId/verify-payment',
  authorizeRoles('ADMIN', 'STUDENT'),
  validateRequest(verifyInstallmentPaymentValidation),
  EnrollmentsController.verifyInstallmentPayment
);

enrollmentsRouter.patch(
  '/:enrollmentId/onboarding',
  authorizeRoles('ADMIN', 'STUDENT'),
  validateRequest(updateOnboardingStateValidation),
  EnrollmentsController.updateOnboarding
);

enrollmentsRouter.post(
  '/:enrollmentId/extend-schedule',
  authorizeRoles('ADMIN', 'SUPPORT'),
  validateRequest(extendInstallmentScheduleValidation),
  EnrollmentsController.extendInstallmentSchedule
);
