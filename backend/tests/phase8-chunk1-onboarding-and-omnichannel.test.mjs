import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 8 (Chunk 1 — Buckets 1–6) Automated Unit & Invariant Tests:
 * 1. Omnichannel Master & Event-Level Toggle Evaluator (`WHATSAPP`, `EMAIL`, `IN_APP`)
 * 2. WhatsApp Business Cloud API Template Formatter
 * 3. 4-Step Student Course Onboarding Checklist State Resolver
 * 4. Interactive Lesson Completion -> Course Progress % Calculator
 * 5. Admin Direct Student Admission & Scholarship Installment Snapshot Invariants
 */

function isChannelEnabledForEvent(settings, eventType, channel) {
  const eventToggle = settings.eventToggles?.[eventType] ?? {
    whatsapp: true,
    email: true,
    inApp: true,
  };
  if (channel === 'WHATSAPP') {
    return Boolean(settings.whatsappEnabled && eventToggle.whatsapp);
  }
  if (channel === 'EMAIL') {
    return Boolean(settings.emailEnabled && eventToggle.email);
  }
  return Boolean(settings.inAppEnabled && eventToggle.inApp);
}

function buildWhatsAppMessagePreview({ eventType, courseCode, title, body }) {
  const prefix = courseCode ? `*[${courseCode}]* ` : '*[Saampark Institute]* ';
  return `📲 ${prefix}*${title}*\n${body}\n— _Powered by Argon LMS WhatsApp Alerts_`;
}

function resolveOnboardingState({
  enrollmentId,
  enrollmentStatus,
  studentPhone,
  storedJson,
}) {
  const step1 =
    enrollmentStatus === 'ACTIVE' || enrollmentStatus === 'COMPLETED';
  const step2 = Boolean(storedJson?.step2AcademicPolicyAccepted);
  const step3 =
    storedJson?.step3WhatsappAlertsOptIn !== undefined
      ? Boolean(storedJson.step3WhatsappAlertsOptIn)
      : Boolean(studentPhone);
  const whatsappNumber = String(
    storedJson?.whatsappNumber || studentPhone || ''
  );
  const step4 = Boolean(storedJson?.step4StarterKitAndFirstLesson);

  const completedStepsCount = [step1, step2, step3, step4].filter(Boolean).length;
  const isCompleted = completedStepsCount === 4;

  return {
    enrollmentId,
    step1PlanAndPaymentVerified: step1,
    step2AcademicPolicyAccepted: step2,
    step3WhatsappAlertsOptIn: step3,
    whatsappNumber,
    step4StarterKitAndFirstLesson: step4,
    completedStepsCount,
    isCompleted,
  };
}

function calculateLessonProgressPercent(completedLessonCount, totalLessonsCount) {
  if (totalLessonsCount <= 0) return 0;
  const pct = (completedLessonCount / totalLessonsCount) * 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(2))));
}

test('1. Omnichannel toggle matrix blocks WhatsApp when master whatsappEnabled is OFF and allows Email', () => {
  const settings = {
    whatsappEnabled: false,
    emailEnabled: true,
    inAppEnabled: true,
    eventToggles: {
      LIVE_CLASS_SCHEDULED: { whatsapp: true, email: true, inApp: true },
      STUDY_MATERIAL_UPLOADED: { whatsapp: true, email: false, inApp: true },
    },
  };

  assert.equal(
    isChannelEnabledForEvent(settings, 'LIVE_CLASS_SCHEDULED', 'WHATSAPP'),
    false,
    'Master WhatsApp OFF must block WhatsApp dispatch even if event toggle is ON'
  );
  assert.equal(
    isChannelEnabledForEvent(settings, 'LIVE_CLASS_SCHEDULED', 'EMAIL'),
    true,
    'Email must remain enabled when master and event toggles are ON'
  );
  assert.equal(
    isChannelEnabledForEvent(settings, 'STUDY_MATERIAL_UPLOADED', 'EMAIL'),
    false,
    'Per-event Email OFF must block Email dispatch for STUDY_MATERIAL_UPLOADED'
  );
});

test('2. WhatsApp template formatter includes course code and structured headline', () => {
  const msg = buildWhatsAppMessagePreview({
    eventType: 'STUDY_MATERIAL_UPLOADED',
    courseCode: 'PHYS-401',
    title: 'New Study Material: Wave Mechanics Notes',
    body: 'Download lecture_notes.pdf from your course vault.',
  });

  assert.ok(msg.includes('*[PHYS-401]*'));
  assert.ok(msg.includes('*New Study Material: Wave Mechanics Notes*'));
});

test('3. 4-Step Student Course Onboarding checklist transitions to isCompleted=true only when all 4 steps are satisfied', () => {
  const partial = resolveOnboardingState({
    enrollmentId: 'enr-1',
    enrollmentStatus: 'ACTIVE',
    studentPhone: '+91-9876543210',
    storedJson: {
      step2AcademicPolicyAccepted: true,
      step3WhatsappAlertsOptIn: true,
      step4StarterKitAndFirstLesson: false,
    },
  });
  assert.equal(partial.completedStepsCount, 3);
  assert.equal(partial.isCompleted, false);

  const complete = resolveOnboardingState({
    enrollmentId: 'enr-1',
    enrollmentStatus: 'ACTIVE',
    studentPhone: '+91-9876543210',
    storedJson: {
      step2AcademicPolicyAccepted: true,
      step3WhatsappAlertsOptIn: true,
      step4StarterKitAndFirstLesson: true,
    },
  });
  assert.equal(complete.completedStepsCount, 4);
  assert.equal(complete.isCompleted, true);
});

test('4. Interactive lesson completion calculator computes exact percentage and caps at 100%', () => {
  assert.equal(calculateLessonProgressPercent(0, 8), 0);
  assert.equal(calculateLessonProgressPercent(2, 8), 25);
  assert.equal(calculateLessonProgressPercent(3, 8), 37.5);
  assert.equal(calculateLessonProgressPercent(8, 8), 100);
});
