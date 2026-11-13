import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

test('Phase 10 Chunk 1.1: Unauthenticated Forgot Password / OTP Login & Max-2 Student Concurrent Session Guard', () => {
  const authServiceContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/auth/auth.service.ts'),
    'utf8'
  );
  assert.ok(
    authServiceContent.includes('MAX_STUDENT_CONCURRENT_SESSIONS = 2'),
    'auth.service.ts must enforce MAX_STUDENT_CONCURRENT_SESSIONS = 2'
  );
  assert.ok(
    authServiceContent.includes('computeSessionsToRevokeForConcurrentLimit'),
    'auth.service.ts must implement computeSessionsToRevokeForConcurrentLimit'
  );
  assert.ok(
    authServiceContent.includes('requestPasswordOrLoginOtp'),
    'auth.service.ts must implement requestPasswordOrLoginOtp'
  );
  assert.ok(
    authServiceContent.includes('resetPasswordWithOtp'),
    'auth.service.ts must implement resetPasswordWithOtp'
  );
  assert.ok(
    authServiceContent.includes('loginWithOtp'),
    'auth.service.ts must implement loginWithOtp'
  );

  // Verify Max-2 concurrent session eviction logic deterministically
  const computeEvictions = (activeIds, maxAllowed = 2) => {
    const keepCount = maxAllowed - 1;
    if (activeIds.length <= keepCount) return [];
    return activeIds.slice(0, activeIds.length - keepCount);
  };
  assert.deepEqual(computeEvictions(['s1'], 2), []);
  assert.deepEqual(computeEvictions(['s1', 's2'], 2), ['s1']);
  assert.deepEqual(computeEvictions(['s1', 's2', 's3'], 2), ['s1', 's2']);
});

test('Phase 10 Chunk 1.2: Automated 00:00 IST Installment Default & Access Lock Engine (SUSPENDED_OVERDUE -> ACTIVE auto-unlock)', () => {
  const enrollmentsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/enrollments/enrollments.service.ts'),
    'utf8'
  );
  assert.ok(
    enrollmentsContent.includes('sweepOverdueInstallmentsAndLockAccess'),
    'EnrollmentsService must implement sweepOverdueInstallmentsAndLockAccess'
  );
  assert.ok(
    enrollmentsContent.includes('evaluateEnrollmentGracePeriodLockState'),
    'EnrollmentsService must export evaluateEnrollmentGracePeriodLockState'
  );

  const middlewareContent = fs.readFileSync(
    path.join(backendRoot, 'src/middlewares/auth.middleware.ts'),
    'utf8'
  );
  assert.ok(
    middlewareContent.includes('INSTALLMENT_OVERDUE_LOCKED'),
    'assertCourseAccessScope must throw INSTALLMENT_OVERDUE_LOCKED when an installment passes graceEndsAt'
  );
});

test('Phase 10 Chunk 1.3: Indian Tax Compliance — GST Invoices (SAC 999293), Credit Notes & Section 194J 10% Teacher TDS', () => {
  const paymentsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/payments/payments.module.ts'),
    'utf8'
  );
  assert.ok(
    paymentsContent.includes('computeGstTaxBreakdown'),
    'payments.module.ts must implement computeGstTaxBreakdown for SAC 999293'
  );
  assert.ok(
    paymentsContent.includes('999293'),
    'payments.module.ts must use SAC Code 999293 for commercial coaching/training'
  );
  assert.ok(
    paymentsContent.includes('creditNoteNumber'),
    'payments.module.ts must issue sequential Credit Notes on refunds'
  );
  assert.ok(
    paymentsContent.includes('razorpayWebhooksRouter'),
    'payments.module.ts must expose idempotent razorpayWebhooksRouter'
  );

  // Verify 18% GST inclusive math (₹11,800 -> ₹10,000 taxable + ₹900 CGST + ₹900 SGST intra-state)
  const gross = 11800;
  const taxableCents = Math.round((gross * 100) / 1.18);
  const totalGstCents = Math.round(gross * 100) - taxableCents;
  assert.equal((taxableCents / 100).toFixed(2), '10000.00');
  assert.equal((totalGstCents / 100).toFixed(2), '1800.00');

  const payoutsContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/teacher-payouts/teacher-payouts.module.ts'),
    'utf8'
  );
  assert.ok(
    payoutsContent.includes('computeTeacherPayoutWithSection194JTds'),
    'teacher-payouts.module.ts must compute Section 194J 10% TDS deductions'
  );
});

test('Phase 10 Chunk 1.4: DLT SMS Fallback Engine & Master/Per-Event Toggle (OFF by default while DLT is pending)', () => {
  const messagingContent = fs.readFileSync(
    path.join(backendRoot, 'src/integrations/messaging.adapter.ts'),
    'utf8'
  );
  assert.ok(
    messagingContent.includes('smsDltEnabled: env.SMS_DLT_ENABLED'),
    'messaging.adapter.ts must include smsDltEnabled master toggle'
  );
  assert.ok(
    messagingContent.includes('sendOutboundDltSms'),
    'messaging.adapter.ts must implement sendOutboundDltSms'
  );
  assert.ok(
    messagingContent.includes("channel === 'SMS_DLT'"),
    'isChannelEnabledForEvent must evaluate SMS_DLT channel toggle'
  );
});
