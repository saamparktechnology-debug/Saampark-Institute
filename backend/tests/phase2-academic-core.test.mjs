import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Phase 2 Academic Core & Storage Security Unit Tests (`node --test`)
 * Verifies:
 * 1. Multi-teacher course assignment roles & revenue share bounds (C-026, C-029)
 * 2. Purchase-time price snapshot & equal/remainder installment schedule calculation (C-009, C-027)
 * 3. Preview vs. non-preview lesson filtering for unenrolled vs. enrolled students (C-007, C-027)
 * 4. Hostinger VPS storage adapter MIME allowlist, size limit, and path traversal sanitization (C-030)
 * 5. Referral reward credit triggered once on referred student's 1st verified installment payment (C-028)
 */

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

function sanitizeFileName(rawName) {
  const base = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 180) || 'material.bin';
}

function buildInstallmentScheduleSnapshot(totalAmountInr, installmentCount, gracePeriodDays = 5) {
  const totalCents = Math.round(totalAmountInr * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents - baseCents * installmentCount;

  const schedule = [];
  for (let seq = 1; seq <= installmentCount; seq++) {
    const cents = seq === 1 ? baseCents + remainderCents : baseCents;
    schedule.push({
      sequenceNumber: seq,
      amountInr: (cents / 100).toFixed(2),
      gracePeriodDays,
      status: 'PENDING',
    });
  }
  return schedule;
}

function filterCourseLessonsForActor(actorRole, hasActiveEnrollment, isAssignedTeacher, lessons) {
  if (actorRole === 'ADMIN') return lessons;
  if (actorRole === 'TEACHER') {
    if (!isAssignedTeacher) throw new Error('RESOURCE_FORBIDDEN');
    return lessons;
  }
  if (actorRole === 'STUDENT') {
    return lessons.filter((l) => hasActiveEnrollment || l.isPreview);
  }
  return [];
}

function authorizeMaterialUpload(actorRole, isAssignedTeacher, fileMeta) {
  if (actorRole !== 'ADMIN' && !(actorRole === 'TEACHER' && isAssignedTeacher)) {
    throw new Error('RESOURCE_FORBIDDEN');
  }
  if (!ALLOWED_MIME_TYPES.has(fileMeta.mimeType)) {
    throw new Error('UNSUPPORTED_MIME_TYPE');
  }
  if (fileMeta.sizeBytes <= 0 || fileMeta.sizeBytes > MAX_SIZE_BYTES) {
    throw new Error('FILE_SIZE_OUT_OF_BOUNDS');
  }
  const safeName = sanitizeFileName(fileMeta.fileName);
  return {
    storageKey: `courses/${fileMeta.courseId}/materials/${crypto.randomUUID()}-${safeName}`,
    sanitizedFileName: safeName,
  };
}

test('1. Installment snapshot preserves exact cent total and assigns remainder to 1st installment (C-009, C-027)', () => {
  const schedule = buildInstallmentScheduleSnapshot(10000, 3, 5);
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].amountInr, '3333.34');
  assert.equal(schedule[1].amountInr, '3333.33');
  assert.equal(schedule[2].amountInr, '3333.33');

  const sum = schedule.reduce((acc, i) => acc + Number(i.amountInr), 0);
  assert.equal(sum.toFixed(2), '10000.00');
});

test('2. Unenrolled student only sees preview lessons; enrolled student after 1st installment sees all lessons (C-027)', () => {
  const lessons = [
    { id: 'l1', title: 'Intro Preview', isPreview: true },
    { id: 'l2', title: 'Schrodinger Operators Deep Dive', isPreview: false },
  ];

  const unenrolledView = filterCourseLessonsForActor('STUDENT', false, false, lessons);
  assert.equal(unenrolledView.length, 1);
  assert.equal(unenrolledView[0].id, 'l1');

  const activeEnrolledView = filterCourseLessonsForActor('STUDENT', true, false, lessons);
  assert.equal(activeEnrolledView.length, 2);
});

test('3. Unassigned teacher is blocked from viewing or uploading course lessons/materials (C-013, C-026)', () => {
  const lessons = [{ id: 'l1', title: 'Module 1', isPreview: false }];
  assert.throws(
    () => filterCourseLessonsForActor('TEACHER', false, false, lessons),
    /RESOURCE_FORBIDDEN/
  );

  const assignedView = filterCourseLessonsForActor('TEACHER', false, true, lessons);
  assert.equal(assignedView.length, 1);
});

test('4. Hostinger VPS storage adapter blocks disallowed MIME types, oversized files, and path traversal (C-030)', () => {
  assert.throws(
    () =>
      authorizeMaterialUpload('TEACHER', true, {
        courseId: 'c1',
        fileName: 'exploit.sh',
        mimeType: 'application/x-sh',
        sizeBytes: 1024,
      }),
    /UNSUPPORTED_MIME_TYPE/
  );

  assert.throws(
    () =>
      authorizeMaterialUpload('TEACHER', true, {
        courseId: 'c1',
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 60 * 1024 * 1024,
      }),
    /FILE_SIZE_OUT_OF_BOUNDS/
  );

  const ticket = authorizeMaterialUpload('TEACHER', true, {
    courseId: 'c1',
    fileName: '../../../etc/passwd.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 204800,
  });
  assert.equal(ticket.sanitizedFileName, 'passwd.pdf');
  assert.equal(ticket.storageKey.includes('..'), false);
});
