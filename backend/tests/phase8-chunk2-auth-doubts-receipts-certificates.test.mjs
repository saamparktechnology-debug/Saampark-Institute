import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 8 (Chunk 2 — Buckets 7–12) Automated Unit & Invariant Tests:
 * 1. Student Self-Registration Referral Code Attribution & Self-Referral Guard (Bucket 8)
 * 2. Course Doubts Q&A Resolution State Transition when Faculty Replies (Bucket 7)
 * 3. Active Device Session Revoke-Others Filter Invariant (Bucket 11)
 * 4. Pending/Overdue Installment Reminder Recipient Deduplication (Bucket 10)
 */

function evaluateReferralAttribution({
  newStudentUserId,
  referralCodeRecord,
}) {
  if (!referralCodeRecord || !referralCodeRecord.isActive) {
    return { attributed: false, reason: 'INACTIVE_OR_MISSING' };
  }
  if (referralCodeRecord.userId === newStudentUserId) {
    return { attributed: false, reason: 'SELF_REFERRAL_BLOCKED' };
  }
  return {
    attributed: true,
    referrerUserId: referralCodeRecord.userId,
    referredUserId: newStudentUserId,
    rewardAmountSnapshot: 500.0,
    status: 'ATTRIBUTED',
  };
}

function resolveDoubtStatusFromReplies(replies) {
  const hasFacultyReply = replies.some(
    (r) => r.senderRole === 'TEACHER' || r.senderRole === 'ADMIN'
  );
  return hasFacultyReply ? 'RESOLVED' : 'OPEN';
}

function filterSessionsToRevoke(allSessions, currentSessionId) {
  return allSessions.filter((s) => s.id !== currentSessionId && !s.revokedAt);
}

function extractUniqueInstallmentReminderRecipients(installments) {
  const active = installments.filter(
    (i) => i.status === 'PENDING' || i.status === 'OVERDUE'
  );
  const studentIds = Array.from(new Set(active.map((i) => i.studentId)));
  return {
    remindedInstallmentsCount: active.length,
    uniqueStudentsNotified: studentIds.length,
    studentIds,
  };
}

test('1. Student self-signup attributes valid referral code and blocks self-referral (Bucket 8)', () => {
  const valid = evaluateReferralAttribution({
    newStudentUserId: 'stu-new-1',
    referralCodeRecord: {
      id: 'ref-code-1',
      code: 'ARGON-SARAH42',
      userId: 'stu-sarah-1',
      isActive: true,
    },
  });
  assert.equal(valid.attributed, true);
  assert.equal(valid.rewardAmountSnapshot, 500.0);

  const selfRef = evaluateReferralAttribution({
    newStudentUserId: 'stu-sarah-1',
    referralCodeRecord: {
      id: 'ref-code-1',
      code: 'ARGON-SARAH42',
      userId: 'stu-sarah-1',
      isActive: true,
    },
  });
  assert.equal(selfRef.attributed, false);
  assert.equal(selfRef.reason, 'SELF_REFERRAL_BLOCKED');
});

test('2. Course doubt transitions from OPEN to RESOLVED when Teacher or Admin replies (Bucket 7)', () => {
  assert.equal(
    resolveDoubtStatusFromReplies([{ senderRole: 'STUDENT', message: 'Same doubt here!' }]),
    'OPEN'
  );
  assert.equal(
    resolveDoubtStatusFromReplies([
      { senderRole: 'STUDENT', message: 'Same doubt here!' },
      { senderRole: 'TEACHER', message: 'Apply boundary continuity at x = L.' },
    ]),
    'RESOLVED'
  );
});

test('3. Revoke-other-sessions preserves current active session while revoking all other devices (Bucket 11)', () => {
  const sessions = [
    { id: 'sess-current', revokedAt: null },
    { id: 'sess-mobile', revokedAt: null },
    { id: 'sess-tablet', revokedAt: null },
    { id: 'sess-old', revokedAt: '2026-11-01T00:00:00Z' },
  ];
  const toRevoke = filterSessionsToRevoke(sessions, 'sess-current');
  assert.equal(toRevoke.length, 2);
  assert.deepEqual(
    toRevoke.map((s) => s.id),
    ['sess-mobile', 'sess-tablet']
  );
});

test('4. Batch installment reminder runner deduplicates student recipients across multiple pending installments (Bucket 10)', () => {
  const installments = [
    { id: 'i1', studentId: 'stu-1', status: 'PENDING' },
    { id: 'i2', studentId: 'stu-1', status: 'OVERDUE' },
    { id: 'i3', studentId: 'stu-2', status: 'PENDING' },
    { id: 'i4', studentId: 'stu-3', status: 'PAID' },
  ];
  const summary = extractUniqueInstallmentReminderRecipients(installments);
  assert.equal(summary.remindedInstallmentsCount, 3);
  assert.equal(summary.uniqueStudentsNotified, 2);
  assert.deepEqual(summary.studentIds, ['stu-1', 'stu-2']);
});
