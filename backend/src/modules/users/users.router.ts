import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createUserByAdminValidation,
  updateUserStatusValidation,
} from './users.validation';
import { UsersController } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(authorizeRoles('ADMIN'));

usersRouter.get('/', UsersController.listUsers);
usersRouter.get('/teachers', UsersController.listActiveTeachers);
usersRouter.post('/', validateRequest(createUserByAdminValidation), UsersController.createUserByAdmin);
usersRouter.patch(
  '/:userId/status',
  validateRequest(updateUserStatusValidation),
  UsersController.updateUserStatus
);
