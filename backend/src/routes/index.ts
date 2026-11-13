import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.router';
import { usersRouter } from '../modules/users/users.router';
import { dashboardsRouter } from '../modules/dashboards/dashboards.router';
import { coursesRouter } from '../modules/courses/courses.router';
import { enrollmentsRouter } from '../modules/enrollments/enrollments.router';
import { materialsRouter } from '../modules/materials/materials.router';
import {
  paymentsRouter,
  razorpayWebhooksRouter,
} from '../modules/payments/payments.module';
import { walletsRouter, referralsRouter } from '../modules/wallets/wallets.module';
import { teacherPayoutsRouter } from '../modules/teacher-payouts/teacher-payouts.module';
import { liveClassesRouter } from '../modules/live-classes/live-classes.module';
import { recordingsRouter } from '../modules/recordings/recordings.module';
import { attendanceRouter } from '../modules/attendance/attendance.module';
import { assignmentsRouter } from '../modules/assignments/assignments.module';
import { examsRouter } from '../modules/exams/exams.module';
import { certificatesRouter } from '../modules/certificates/certificates.module';
import { supportRouter } from '../modules/support/support.module';
import { notificationsRouter } from '../modules/notifications/notifications.module';
import { calendarRouter } from '../modules/calendar/calendar.module';
import { systemRouter } from '../modules/system/system.module';
import { apiResponse } from '../utils/apiResponse';

export const v1Router = Router();

v1Router.get('/health', (_req, res) => {
  return apiResponse(res, 200, 'Online Learning Platform API is healthy', {
    status: 'OK',
    phase: 'PHASE_10_ENTERPRISE_READY',
    timestamp: new Date().toISOString(),
  });
});

v1Router.use('/auth', authRouter);
v1Router.use('/webhooks', razorpayWebhooksRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/dashboards', dashboardsRouter);
v1Router.use('/courses', coursesRouter);
v1Router.use('/enrollments', enrollmentsRouter);
v1Router.use('/materials', materialsRouter);
v1Router.use('/payments', paymentsRouter);
v1Router.use('/wallets', walletsRouter);
v1Router.use('/referrals', referralsRouter);
v1Router.use('/teacher-payouts', teacherPayoutsRouter);
v1Router.use('/live-classes', liveClassesRouter);
v1Router.use('/recordings', recordingsRouter);
v1Router.use('/attendance', attendanceRouter);
v1Router.use('/assignments', assignmentsRouter);
v1Router.use('/exams', examsRouter);
v1Router.use('/certificates', certificatesRouter);
v1Router.use('/support', supportRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/calendar', calendarRouter);
v1Router.use('/system', systemRouter);
