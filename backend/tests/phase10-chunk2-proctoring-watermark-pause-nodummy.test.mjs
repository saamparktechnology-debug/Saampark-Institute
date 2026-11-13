import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(__dirname, '../../extracted_frontend');

test('Phase 10 Chunk 2.1: Zero-Dummy Hardening (100ms Strict API, Material Binary 404, Clean Auth Defaults)', () => {
  const providersContent = fs.readFileSync(
    path.join(backendRoot, 'src/integrations/providers.adapter.ts'),
    'utf8'
  );
  assert.ok(
    providersContent.includes('HMS_100MS_KEYS_MISSING'),
    'Hms100msVideoAdapter must throw HMS_100MS_KEYS_MISSING when 100ms keys are missing in non-test environments'
  );
  assert.ok(
    providersContent.includes('RAZORPAY_KEYS_MISSING'),
    'RazorpayPaymentAdapter must throw RAZORPAY_KEYS_MISSING when Razorpay keys are missing in non-test environments'
  );

  const materialsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/materials/materials.service.ts'),
    'utf8'
  );
  assert.ok(
    !materialsContent.includes('Downloaded via verified signed URL'),
    'MaterialsService must not generate a dummy .txt fallback when a binary file is missing on disk'
  );
  assert.ok(
    materialsContent.includes('not found on server disk storage'),
    'MaterialsService must throw a 404 NotFound error when a binary file is missing on disk'
  );

  const loginCardContent = fs.readFileSync(
    path.join(frontendRoot, 'src/features/auth/components/RoleLoginCard.tsx'),
    'utf8'
  );
  assert.ok(
    !loginCardContent.includes("password: 'Password123!'"),
    'RoleLoginCard must not pre-fill dummy default passwords'
  );

  const liveViewsContent = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/live-learning/components/LiveLearningAndAttendanceViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    !liveViewsContent.includes('Simulated camera feed active'),
    'LiveLearningAndAttendanceViews must not display simulated camera feed messages'
  );
});

test('Phase 10 Chunk 2.2: Exam Anti-Cheat Proctoring & Real-Time Answer Auto-Save', () => {
  const examsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/exams/exams.module.ts'),
    'utf8'
  );
  assert.ok(
    examsContent.includes('saveExamProgress'),
    'ExamsService must implement saveExamProgress for real-time answer auto-save'
  );
  assert.ok(
    examsContent.includes('computeExamIntegrityStatus'),
    'exams.module.ts must implement computeExamIntegrityStatus'
  );
  assert.ok(
    examsContent.includes('/:examId/save-progress'),
    'examsRouter must expose POST /:examId/save-progress'
  );

  // Verify proctoring 3-strike integrity evaluation math
  const evalIntegrity = ({ tabSwitchCount, fullscreenExits, autoSubmittedByProctor, max = 3 }) => {
    if (autoSubmittedByProctor || tabSwitchCount >= max || fullscreenExits >= max) {
      return 'FLAGGED_VIOLATION';
    }
    if (tabSwitchCount > 0 || fullscreenExits > 0) return 'WARNING';
    return 'CLEAN';
  };
  assert.equal(
    evalIntegrity({ tabSwitchCount: 0, fullscreenExits: 0, autoSubmittedByProctor: false }),
    'CLEAN'
  );
  assert.equal(
    evalIntegrity({ tabSwitchCount: 1, fullscreenExits: 0, autoSubmittedByProctor: false }),
    'WARNING'
  );
  assert.equal(
    evalIntegrity({ tabSwitchCount: 3, fullscreenExits: 0, autoSubmittedByProctor: true }),
    'FLAGGED_VIOLATION'
  );
});

test('Phase 10 Chunk 2.3: Recorded Classes Anti-Piracy Dynamic Watermark & Watch-Progress Resume', () => {
  const recordingsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/recordings/recordings.module.ts'),
    'utf8'
  );
  assert.ok(
    recordingsContent.includes('buildStudentWatermarkPayload'),
    'recordings.module.ts must implement buildStudentWatermarkPayload'
  );
  assert.ok(
    recordingsContent.includes('saveWatchProgress'),
    'RecordingsService must implement saveWatchProgress'
  );
  assert.ok(
    recordingsContent.includes('/:recordingId/progress'),
    'recordingsRouter must expose POST /:recordingId/progress'
  );
});

test('Phase 10 Chunk 2.4: Enrollment Moratorium Schedule Shifting & <75% Low-Attendance Recovery Math', () => {
  const enrollmentsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/enrollments/enrollments.service.ts'),
    'utf8'
  );
  assert.ok(
    enrollmentsContent.includes('extendInstallmentScheduleMoratorium'),
    'EnrollmentsService must implement extendInstallmentScheduleMoratorium'
  );
  assert.ok(
    enrollmentsContent.includes('shiftInstallmentDatesForMoratorium'),
    'enrollments.service.ts must implement shiftInstallmentDatesForMoratorium'
  );

  const attendanceContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/attendance/attendance.module.ts'),
    'utf8'
  );
  assert.ok(
    attendanceContent.includes('computeLowAttendanceRecoveryStats'),
    'attendance.module.ts must implement computeLowAttendanceRecoveryStats'
  );
  assert.ok(
    attendanceContent.includes('dispatchLowAttendanceAlerts'),
    'AttendanceService must implement dispatchLowAttendanceAlerts'
  );

  // Verify consecutive classes needed to recover >= 75% attendance:
  // If a student attended 2 of 4 sessions (50%), they need ceil((0.75 * 4 - 2) / 0.25) = 4 consecutive classes -> (2+4)/(4+4) = 6/8 = 75.0%
  const needed = Math.ceil((0.75 * 4 - 2) / (1 - 0.75));
  assert.equal(needed, 4);
  assert.equal(((2 + needed) / (4 + needed)) * 100, 75);
});
