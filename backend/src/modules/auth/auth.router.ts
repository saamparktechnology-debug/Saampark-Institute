import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  changePasswordValidation,
  loginValidation,
  loginWithOtpValidation,
  requestOtpValidation,
  resetPasswordWithOtpValidation,
  sessionIdParamValidation,
  studentSignupValidation,
} from './auth.validation';
import { authenticate } from '../../middlewares/auth.middleware';

export const authRouter = Router();

// Shared authentication endpoints supporting the 4 distinct role login pages
authRouter.post('/login', validateRequest(loginValidation), AuthController.login);
authRouter.post(
  '/forgot-password/request-otp',
  validateRequest(requestOtpValidation),
  AuthController.requestOtp
);
authRouter.post(
  '/forgot-password/reset',
  validateRequest(resetPasswordWithOtpValidation),
  AuthController.resetPasswordWithOtp
);
authRouter.post(
  '/login-otp',
  validateRequest(loginWithOtpValidation),
  AuthController.loginWithOtp
);
authRouter.post(
  '/student/register',
  validateRequest(studentSignupValidation),
  AuthController.registerStudent
);
authRouter.post('/refresh', AuthController.refresh);
authRouter.get('/me', authenticate, AuthController.me);
authRouter.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordValidation),
  AuthController.changePassword
);
authRouter.get('/sessions', authenticate, AuthController.listSessions);
authRouter.post('/sessions/revoke-others', authenticate, AuthController.revokeOtherSessions);
authRouter.delete(
  '/sessions/:sessionId',
  authenticate,
  validateRequest(sessionIdParamValidation),
  AuthController.revokeSession
);
authRouter.post('/logout', authenticate, AuthController.logout);
