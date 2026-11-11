import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { DashboardsController } from './dashboards.controller';

export const dashboardsRouter = Router();

dashboardsRouter.use(authenticate);

dashboardsRouter.get(
  '/admin/summary',
  authorizeRoles('ADMIN'),
  DashboardsController.getAdminDashboard
);

dashboardsRouter.get(
  '/student/summary',
  authorizeRoles('STUDENT'),
  DashboardsController.getStudentDashboard
);

dashboardsRouter.get(
  '/teacher/summary',
  authorizeRoles('TEACHER'),
  DashboardsController.getTeacherDashboard
);

dashboardsRouter.get(
  '/support/summary',
  authorizeRoles('SUPPORT', 'ADMIN'),
  DashboardsController.getSupportDashboard
);
