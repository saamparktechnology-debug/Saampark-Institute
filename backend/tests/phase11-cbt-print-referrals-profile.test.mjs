import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(__dirname, '../../extracted_frontend');

test('Phase 11.1: Standard High-Level CBT Examination Engine & Dynamic Question Bank Builder', () => {
  const examsBackend = fs.readFileSync(
    path.join(backendRoot, 'src/modules/exams/exams.module.ts'),
    'utf8'
  );
  assert.ok(
    examsBackend.includes('STANDARD_DEFAULT_EXAM_QUESTIONS'),
    'exams.module.ts must define a 5-question STANDARD_DEFAULT_EXAM_QUESTIONS bank'
  );

  const assessmentsFrontend = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/assessments/components/AssessmentsAndCertificatesViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    assessmentsFrontend.includes('cbtStage') && assessmentsFrontend.includes('ACTIVE_CBT'),
    'RoleExamsAndResultsView must implement LOBBY and ACTIVE_CBT examination stages'
  );
  assert.ok(
    assessmentsFrontend.includes('formatTimerClock') &&
      assessmentsFrontend.includes('remainingSeconds'),
    'RoleExamsAndResultsView must implement a live ticking HH:MM:SS countdown timer'
  );
  assert.ok(
    assessmentsFrontend.includes('markedForReview') &&
      assessmentsFrontend.includes('Question Palette'),
    'RoleExamsAndResultsView must implement Mark for Review and a numbered Question Palette sidebar'
  );
  assert.ok(
    assessmentsFrontend.includes('addBuilderQuestion'),
    'RoleExamsAndResultsView must allow teachers to dynamically add MCQ and True/False questions'
  );
});

test('Phase 11.2: Standalone A4 Certificate & GST Tax Invoice Print Engine (Zero Screen Printing)', () => {
  const assessmentsFrontend = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/assessments/components/AssessmentsAndCertificatesViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    assessmentsFrontend.includes('printVerifiableCertificateDocument'),
    'AssessmentsAndCertificatesViews.tsx must implement standalone printVerifiableCertificateDocument'
  );
  assert.ok(
    !assessmentsFrontend.includes('window.print()'),
    'AssessmentsAndCertificatesViews.tsx must not call window.print() on the main application screen'
  );

  const financeFrontend = fs.readFileSync(
    path.join(frontendRoot, 'src/features/finance/components/FinanceManagementViews.tsx'),
    'utf8'
  );
  assert.ok(
    financeFrontend.includes('printGstTaxInvoiceDocument'),
    'FinanceManagementViews.tsx must implement standalone printGstTaxInvoiceDocument'
  );
  assert.ok(
    !financeFrontend.includes('window.print()'),
    'FinanceManagementViews.tsx must not call window.print() on the main application screen'
  );
});

test('Phase 11.3: Unified Wallet & Referral Hub with Direct Shareable Registration Link', () => {
  const financeFrontend = fs.readFileSync(
    path.join(frontendRoot, 'src/features/finance/components/FinanceManagementViews.tsx'),
    'utf8'
  );
  assert.ok(
    financeFrontend.includes('StudentReferralShareCard'),
    'FinanceManagementViews.tsx must render StudentReferralShareCard in both Wallet and Referrals views'
  );
  assert.ok(
    financeFrontend.includes('/student/login?tab=REGISTER&ref='),
    'StudentReferralShareCard must generate a direct shareable signup URL (/student/login?tab=REGISTER&ref=...)'
  );

  const loginCardFrontend = fs.readFileSync(
    path.join(frontendRoot, 'src/features/auth/components/RoleLoginCard.tsx'),
    'utf8'
  );
  assert.ok(
    loginCardFrontend.includes("params.get('ref')") &&
      loginCardFrontend.includes("setAuthTab('REGISTER')"),
    'RoleLoginCard.tsx must detect ?ref= query parameters, switch to REGISTER tab, and pre-fill referralCode'
  );
});

test('Phase 11.4: Student Legal Name Lock (403 Forbidden for Student, Admin-Only Name Modification)', () => {
  const calendarBackend = fs.readFileSync(
    path.join(backendRoot, 'src/modules/calendar/calendar.module.ts'),
    'utf8'
  );
  assert.ok(
    calendarBackend.includes(
      'Students cannot modify their registered legal name'
    ),
    'calendar.module.ts must block students from changing their fullName with 403 Forbidden'
  );

  const usersServiceBackend = fs.readFileSync(
    path.join(backendRoot, 'src/modules/users/users.service.ts'),
    'utf8'
  );
  assert.ok(
    usersServiceBackend.includes('USER_NAME_OR_STATUS_UPDATED_BY_ADMIN'),
    'UsersService.updateUserStatus must allow Admin to update student fullName with audit logging'
  );

  const adminUsersFrontend = fs.readFileSync(
    path.join(frontendRoot, 'src/features/courses/components/CourseManagementViews.tsx'),
    'utf8'
  );
  assert.ok(
    adminUsersFrontend.includes('Edit Legal Name'),
    'AdminUsersDirectoryView must provide inline Edit Legal Name controls for Admin'
  );
});

test('Phase 11.5: Privacy-Safe Student Analytics Fields in /student/profile (Zero Aadhaar / PAN)', () => {
  const profileFrontend = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/operations/components/SupportAndOperationsViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    profileFrontend.includes('setPinCode') &&
      profileFrontend.includes('setHighestQualification') &&
      profileFrontend.includes('setCareerGoal') &&
      profileFrontend.includes("readOnly={role === 'STUDENT'}"),
    'RoleProfileAndSettingsView must collect pinCode, city, state, highestQualification, graduationYear, and careerGoal while locking fullName for students'
  );
  // Ensure no input asks for Aadhaar or PAN
  assert.ok(
    !profileFrontend.includes('aadhaarNumber') &&
      !profileFrontend.includes('panNumber'),
    'RoleProfileAndSettingsView must never collect Aadhaar or PAN numbers'
  );
});
