import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 6 Support Ticket Queues, SLA Monitoring, Internal Notes, Notifications & RBAC Unit Tests (`node --test`)
 * Verifies:
 * 1. Priority-based SLA deadline calculation & 2-hour breach risk detection (C-002, C-011)
 * 2. Strict internal note (`isInternalNote: true`) stripping for Student/Teacher actors (C-013)
 * 3. Non-support actors blocked from forging `isInternalNote: true` messages (C-013)
 * 4. Notification recipient scope isolation (users only see or mark their own notifications) (C-010, C-013)
 * 5. Effective RBAC permission resolution merging RolePermissions with UserPermission overrides (C-025)
 */

const SLA_HOURS = {
  URGENT_RED: 2,
  HIGH: 4,
  MEDIUM: 12,
  LOW: 24,
};

function computeTicketSlaStatus(priority, createdAtMs, nowMs, status = 'INCOMING') {
  const hours = SLA_HOURS[priority] ?? 12;
  const slaDueAtMs = createdAtMs + hours * 3600_000;
  const remainingMinutes = Math.round((slaDueAtMs - nowMs) / 60_000);
  const isOpen = status === 'INCOMING' || status === 'IN_TRIAGE' || status === 'ESCALATED';
  return {
    slaDueAtMs,
    remainingMinutes,
    isSlaBreachRisk: isOpen && remainingMinutes <= 120,
  };
}

function filterTicketMessagesForActor(messages, actorRole) {
  if (actorRole === 'ADMIN' || actorRole === 'SUPPORT') {
    return messages;
  }
  return messages.filter((m) => !m.isInternalNote);
}

function sanitizeIncomingMessageFlag(actorRole, requestedInternalFlag) {
  if (actorRole !== 'ADMIN' && actorRole !== 'SUPPORT') {
    if (requestedInternalFlag) {
      throw new Error('INTERNAL_NOTE_FORBIDDEN_FOR_NON_STAFF');
    }
    return false;
  }
  return Boolean(requestedInternalFlag);
}

function resolveEffectivePermissions(rolePermCodes, userOverrides) {
  const set = new Set(rolePermCodes);
  for (const ov of userOverrides) {
    if (ov.isGranted) {
      set.add(ov.code);
    } else {
      set.delete(ov.code);
    }
  }
  return Array.from(set).sort();
}

test('1. Priority-based SLA calculation flags open tickets within 120 minutes as SLA breach risk', () => {
  const createdAt = Date.now();
  const after90Mins = createdAt + 90 * 60_000;

  // URGENT_RED has 2h (120m) SLA -> after 90m, 30m remain -> breach risk = true
  const urgentStatus = computeTicketSlaStatus('URGENT_RED', createdAt, after90Mins, 'INCOMING');
  assert.equal(urgentStatus.remainingMinutes, 30);
  assert.equal(urgentStatus.isSlaBreachRisk, true);

  // Once RESOLVED, breach risk alert is cleared
  const resolvedStatus = computeTicketSlaStatus('URGENT_RED', createdAt, after90Mins, 'RESOLVED');
  assert.equal(resolvedStatus.isSlaBreachRisk, false);
});

test('2. Internal support notes (isInternalNote=true) are strictly hidden from Student and Teacher views (C-013)', () => {
  const messages = [
    { id: 'm1', message: 'Student question about installment', isInternalNote: false },
    { id: 'm2', message: '[Internal] Checked Razorpay webhook log', isInternalNote: true },
    { id: 'm3', message: 'Public support reply', isInternalNote: false },
  ];

  const studentView = filterTicketMessagesForActor(messages, 'STUDENT');
  assert.equal(studentView.length, 2);
  assert.equal(studentView.some((m) => m.isInternalNote), false);

  const supportView = filterTicketMessagesForActor(messages, 'SUPPORT');
  assert.equal(supportView.length, 3);
});

test('3. Students and Teachers are blocked from posting internal support notes (C-013)', () => {
  assert.throws(
    () => sanitizeIncomingMessageFlag('STUDENT', true),
    /INTERNAL_NOTE_FORBIDDEN_FOR_NON_STAFF/
  );
  assert.equal(sanitizeIncomingMessageFlag('SUPPORT', true), true);
  assert.equal(sanitizeIncomingMessageFlag('TEACHER', false), false);
});

test('4. Notification read-state mutation enforces strict recipientUserId ownership (C-010, C-013)', () => {
  const notification = { id: 'notif-1', recipientUserId: 'student-1', readAt: null };
  const markRead = (actorId) => {
    if (notification.recipientUserId !== actorId) {
      throw new Error('RESOURCE_NOT_FOUND_OR_FORBIDDEN');
    }
    return { ...notification, readAt: new Date().toISOString() };
  };

  assert.throws(() => markRead('student-2'), /RESOURCE_NOT_FOUND_OR_FORBIDDEN/);
  const updated = markRead('student-1');
  assert.ok(updated.readAt);
});

test('5. Effective RBAC permission resolver merges role permissions and user-level grant/revoke overrides (C-025)', () => {
  const rolePerms = ['support.ticket.triage', 'support.ticket.view'];
  const overrides = [
    { code: 'finance.redemption.approve', isGranted: true },
    { code: 'support.ticket.triage', isGranted: false },
  ];

  const effective = resolveEffectivePermissions(rolePerms, overrides);
  assert.deepEqual(effective, ['finance.redemption.approve', 'support.ticket.view']);
});
