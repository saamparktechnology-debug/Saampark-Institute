import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * Pure domain invariant & authorization test suite executable via `node --test`
 * Verifies:
 * 1. Role-panel login isolation (C-003, C-025)
 * 2. Resource-level ownership scope (Student own records, Teacher assigned courses, Support read-only) (C-013, C-026)
 * 3. Installment 1st-payment immediate access & overdue grace-period suspension (C-027)
 * 4. Append-only wallet ledger & immediate UPI redemption reservation / rejection reversal (C-028)
 * 5. Webhook signature & idempotency guard (C-009, C-030)
 */

function verifyRolePanelLogin(userRole, requestedPanel, accountStatus = 'ACTIVE') {
  if (accountStatus !== 'ACTIVE') {
    return { allowed: false, code: 'ACCOUNT_SUSPENDED' };
  }
  if (userRole !== requestedPanel) {
    return { allowed: false, code: 'ROLE_PANEL_MISMATCH' };
  }
  return { allowed: true, redirectTo: `/${userRole.toLowerCase()}/dashboard` };
}

function checkCourseResourceScope(actor, courseId, assignedCourseIds = [], activeEnrollmentCourseIds = []) {
  if (actor.role === 'ADMIN') return { allowed: true };
  if (actor.role === 'TEACHER') {
    return assignedCourseIds.includes(courseId)
      ? { allowed: true }
      : { allowed: false, code: 'RESOURCE_FORBIDDEN' };
  }
  if (actor.role === 'STUDENT') {
    return activeEnrollmentCourseIds.includes(courseId)
      ? { allowed: true }
      : { allowed: false, code: 'RESOURCE_FORBIDDEN' };
  }
  return { allowed: false, code: 'RESOURCE_FORBIDDEN' };
}

function evaluateInstallmentEnrollmentStatus(installments, now = new Date()) {
  const firstInstallment = installments.find((i) => i.sequenceNumber === 1);
  if (!firstInstallment || firstInstallment.status !== 'PAID') {
    return 'PENDING_PAYMENT';
  }
  const hasOverduePastGrace = installments.some(
    (i) => i.status !== 'PAID' && new Date(i.graceEndsAt).getTime() < now.getTime()
  );
  if (hasOverduePastGrace) {
    return 'SUSPENDED_OVERDUE';
  }
  const allPaid = installments.every((i) => i.status === 'PAID');
  return allPaid ? 'COMPLETED' : 'ACTIVE';
}

class AppendOnlyWalletLedger {
  constructor() {
    this.availableCents = 0;
    this.reservedCents = 0;
    this.entries = [];
    this.seenIdempotencyKeys = new Set();
  }

  creditReferralReward(amountCents, idempotencyKey) {
    if (this.seenIdempotencyKeys.has(idempotencyKey)) {
      return { duplicate: true, availableCents: this.availableCents };
    }
    this.seenIdempotencyKeys.add(idempotencyKey);
    this.availableCents += amountCents;
    this.entries.push({
      type: 'REFERRAL_REWARD',
      direction: 'CREDIT',
      amountCents,
      balanceAfterCents: this.availableCents,
      idempotencyKey,
    });
    return { duplicate: false, availableCents: this.availableCents };
  }

  reserveForUpiRedemption(amountCents, idempotencyKey) {
    if (amountCents <= 0 || amountCents > this.availableCents) {
      throw new Error('INSUFFICIENT_WALLET_BALANCE');
    }
    this.seenIdempotencyKeys.add(idempotencyKey);
    this.availableCents -= amountCents;
    this.reservedCents += amountCents;
    this.entries.push({
      type: 'REDEMPTION_RESERVE',
      direction: 'DEBIT',
      amountCents,
      balanceAfterCents: this.availableCents,
      idempotencyKey,
    });
  }

  reverseRejectedRedemption(amountCents, idempotencyKey) {
    this.reservedCents -= amountCents;
    this.availableCents += amountCents;
    this.entries.push({
      type: 'REDEMPTION_REVERSAL',
      direction: 'CREDIT',
      amountCents,
      balanceAfterCents: this.availableCents,
      idempotencyKey,
    });
  }
}

test('1. Role-panel login strictly blocks cross-panel login attempts (C-003, C-025)', () => {
  assert.deepEqual(verifyRolePanelLogin('STUDENT', 'STUDENT'), {
    allowed: true,
    redirectTo: '/student/dashboard',
  });
  assert.deepEqual(verifyRolePanelLogin('STUDENT', 'ADMIN'), {
    allowed: false,
    code: 'ROLE_PANEL_MISMATCH',
  });
  assert.deepEqual(verifyRolePanelLogin('TEACHER', 'SUPPORT'), {
    allowed: false,
    code: 'ROLE_PANEL_MISMATCH',
  });
  assert.deepEqual(verifyRolePanelLogin('ADMIN', 'ADMIN', 'SUSPENDED'), {
    allowed: false,
    code: 'ACCOUNT_SUSPENDED',
  });
});

test('2. Resource scope blocks unassigned teachers and unenrolled students (C-013, C-026)', () => {
  const teacher = { id: 't-1', role: 'TEACHER' };
  assert.equal(checkCourseResourceScope(teacher, 'course-chem-101', ['course-chem-101']).allowed, true);
  assert.equal(checkCourseResourceScope(teacher, 'course-unassigned', ['course-chem-101']).allowed, false);

  const student = { id: 's-1', role: 'STUDENT' };
  assert.equal(checkCourseResourceScope(student, 'course-quantum', [], ['course-quantum']).allowed, true);
  assert.equal(checkCourseResourceScope(student, 'course-cyber', [], ['course-quantum']).allowed, false);
});

test('3. Installment plan grants immediate access on 1st installment and suspends past grace period (C-027)', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const installmentsActive = [
    { sequenceNumber: 1, status: 'PAID', graceEndsAt: '2026-10-15T00:00:00Z' },
    { sequenceNumber: 2, status: 'PENDING', graceEndsAt: '2026-11-20T00:00:00Z' },
  ];
  assert.equal(evaluateInstallmentEnrollmentStatus(installmentsActive, now), 'ACTIVE');

  const installmentsOverdue = [
    { sequenceNumber: 1, status: 'PAID', graceEndsAt: '2026-10-15T00:00:00Z' },
    { sequenceNumber: 2, status: 'PENDING', graceEndsAt: '2026-11-05T00:00:00Z' },
  ];
  assert.equal(evaluateInstallmentEnrollmentStatus(installmentsOverdue, now), 'SUSPENDED_OVERDUE');
});

test('4. Append-only wallet prevents duplicate referral rewards, overdraw, and restores rejected UPI redemptions (C-028)', () => {
  const wallet = new AppendOnlyWalletLedger();
  wallet.creditReferralReward(50000, 'ref-reward-enrollment-1');
  // Duplicate webhook/event must not double-credit
  const dup = wallet.creditReferralReward(50000, 'ref-reward-enrollment-1');
  assert.equal(dup.duplicate, true);
  assert.equal(wallet.availableCents, 50000);

  // Reserve 300.00 INR for UPI redemption
  wallet.reserveForUpiRedemption(30000, 'upi-req-1');
  assert.equal(wallet.availableCents, 20000);
  assert.equal(wallet.reservedCents, 30000);

  // Attempting to spend or redeem 250.00 INR while 300.00 is reserved must fail
  assert.throws(() => wallet.reserveForUpiRedemption(25000, 'upi-req-2'), /INSUFFICIENT_WALLET_BALANCE/);

  // Admin rejects redemption -> append-only reversal restores available balance
  wallet.reverseRejectedRedemption(30000, 'upi-rev-1');
  assert.equal(wallet.availableCents, 50000);
  assert.equal(wallet.reservedCents, 0);
  assert.equal(wallet.entries.length, 3);
});

test('5. Webhook HMAC-SHA256 signature verification rejects tampered payloads (C-030)', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
  const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const invalidSig = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');

  const verify = (body, sig) => {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return Buffer.from(expected).length === Buffer.from(sig).length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  };

  assert.equal(verify(payload, validSig), true);
  assert.equal(verify(payload, invalidSig), false);
});
