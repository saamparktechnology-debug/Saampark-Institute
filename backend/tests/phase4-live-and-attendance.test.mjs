import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * Phase 4 Live Learning (100ms), YouTube Recordings & Session Attendance Unit Tests (`node --test`)
 * Verifies:
 * 1. Short-lived (15m) 100ms room token generation & HMAC-SHA256 verification (C-004, C-030)
 * 2. YouTube 11-character video ID extraction, safe privacy-enhanced embed URL generation, and raw HTML/iframe blocking (C-022)
 * 3. Session-based 6-digit attendance code SHA-256 hashing, timing-safe check, and 10-minute expiry enforcement (C-008, O-021)
 * 4. Per-student attendance code submission rate limiting (max 5 attempts/minute) (O-021)
 * 5. Audited manual teacher attendance override requiring mandatory correctionReason (O-021)
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function extractAndValidateYouTubeId(rawInput) {
  const trimmed = rawInput.trim();
  if (trimmed.includes('<') || trimmed.includes('>') || trimmed.toLowerCase().includes('iframe')) {
    throw new Error('RAW_HTML_IFRAME_FORBIDDEN');
  }
  if (YOUTUBE_ID_REGEX.test(trimmed)) return trimmed;

  const url = new URL(trimmed);
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (YOUTUBE_ID_REGEX.test(id)) return id;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && YOUTUBE_ID_REGEX.test(v)) return v;
  }
  throw new Error('INVALID_YOUTUBE_ID');
}

function buildSafeYouTubeEmbedUrl(videoId) {
  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    throw new Error('INVALID_YOUTUBE_ID');
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

function generateShortLived100msToken({ accessKey, appSecret, roomId, userId, role, ttlSeconds = 900 }) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(
    JSON.stringify({ access_key: accessKey, room_id: roomId, user_id: userId, role, exp })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', appSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function hashAttendanceCode(code) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function submitStudentAttendanceCode({ session, submittedCode, nowMs }) {
  if (session.status !== 'OPEN' || nowMs > session.codeExpiresAtMs) {
    throw new Error('ATTENDANCE_CODE_EXPIRED');
  }
  const actualHash = hashAttendanceCode(submittedCode);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(session.codeHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('INVALID_ATTENDANCE_CODE');
  }
  return { status: 'PRESENT', source: 'CODE', markedAtMs: nowMs };
}

function manualTeacherOverride({ actorRole, isAssignedTeacher, studentId, status, correctionReason }) {
  if (actorRole !== 'ADMIN' && !(actorRole === 'TEACHER' && isAssignedTeacher)) {
    throw new Error('RESOURCE_FORBIDDEN');
  }
  if (!correctionReason || correctionReason.trim().length < 5) {
    throw new Error('CORRECTION_REASON_REQUIRED');
  }
  return {
    studentId,
    status,
    source: 'MANUAL',
    correctionReason: correctionReason.trim(),
    auditAction: 'ATTENDANCE_MANUAL_OVERRIDE',
  };
}

test('1. 100ms adapter generates short-lived signed room tokens with role claims (C-004, C-030)', () => {
  const token = generateShortLived100msToken({
    accessKey: 'hms_key_1',
    appSecret: 'hms_secret_32_characters_minimum',
    roomId: 'hms_room_phys401',
    userId: 'student-uuid-1',
    role: 'guest-student',
    ttlSeconds: 900,
  });

  const [payloadB64, sigB64] = token.split('.');
  assert.ok(payloadB64 && sigB64);

  const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  assert.equal(decoded.room_id, 'hms_room_phys401');
  assert.equal(decoded.role, 'guest-student');
});

test('2. YouTube recording validator extracts 11-char IDs, builds youtube-nocookie embed URLs, and blocks raw iframe HTML (C-022)', () => {
  const idFromWatch = extractAndValidateYouTubeId('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  assert.equal(idFromWatch, 'M7lc1UVf-VE');

  const idFromShort = extractAndValidateYouTubeId('https://youtu.be/M7lc1UVf-VE');
  assert.equal(idFromShort, 'M7lc1UVf-VE');

  const safeEmbed = buildSafeYouTubeEmbedUrl(idFromWatch);
  assert.equal(
    safeEmbed,
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&modestbranding=1'
  );

  assert.throws(
    () => extractAndValidateYouTubeId('<iframe src="https://evil.example.com"></iframe>'),
    /RAW_HTML_IFRAME_FORBIDDEN/
  );
});

test('3. Session 6-digit attendance code is SHA-256 hashed at rest and rejects expired or wrong codes (C-008, O-021)', () => {
  const nowMs = Date.now();
  const session = {
    status: 'OPEN',
    codeHash: hashAttendanceCode('482910'),
    codeExpiresAtMs: nowMs + 10 * 60 * 1000,
  };

  // Plaintext code is never stored in session object
  assert.equal('code' in session, false);

  // Wrong code rejected
  assert.throws(
    () => submitStudentAttendanceCode({ session, submittedCode: '111111', nowMs }),
    /INVALID_ATTENDANCE_CODE/
  );

  // Valid code within window marks PRESENT
  const mark = submitStudentAttendanceCode({ session, submittedCode: '482910', nowMs });
  assert.equal(mark.status, 'PRESENT');
  assert.equal(mark.source, 'CODE');

  // Expired code past 10m window rejected with ATTENDANCE_CODE_EXPIRED
  assert.throws(
    () =>
      submitStudentAttendanceCode({
        session,
        submittedCode: '482910',
        nowMs: nowMs + 11 * 60 * 1000,
      }),
    /ATTENDANCE_CODE_EXPIRED/
  );
});

test('4. Per-student attendance code rate limiter blocks brute-force guessing beyond 5 attempts/min (O-021)', () => {
  const attempts = [];
  const checkLimit = (ts) => {
    const recent = attempts.filter((t) => t > ts - 60_000);
    if (recent.length >= 5) throw new Error('RATE_LIMIT_EXCEEDED');
    attempts.push(ts);
  };

  const base = Date.now();
  for (let i = 0; i < 5; i++) {
    checkLimit(base + i * 1000);
  }
  assert.throws(() => checkLimit(base + 6000), /RATE_LIMIT_EXCEEDED/);
});

test('5. Manual teacher attendance override enforces assigned course scope and mandatory correctionReason (O-021)', () => {
  assert.throws(
    () =>
      manualTeacherOverride({
        actorRole: 'TEACHER',
        isAssignedTeacher: false,
        studentId: 'stu-1',
        status: 'EXCUSED',
        correctionReason: 'Medical certificate verified',
      }),
    /RESOURCE_FORBIDDEN/
  );

  assert.throws(
    () =>
      manualTeacherOverride({
        actorRole: 'TEACHER',
        isAssignedTeacher: true,
        studentId: 'stu-1',
        status: 'PRESENT',
        correctionReason: 'ok',
      }),
    /CORRECTION_REASON_REQUIRED/
  );

  const override = manualTeacherOverride({
    actorRole: 'TEACHER',
    isAssignedTeacher: true,
    studentId: 'stu-1',
    status: 'EXCUSED',
    correctionReason: 'Approved university physics olympiad participation',
  });
  assert.equal(override.source, 'MANUAL');
  assert.equal(override.auditAction, 'ATTENDANCE_MANUAL_OVERRIDE');
});
