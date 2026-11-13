import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(__dirname, '../../extracted_frontend');

test('Phase 12.1: JitsiVideoAdapter & Zero-Card Live Classroom Support (Localhost & VPS Ready)', () => {
  const providersContent = fs.readFileSync(
    path.join(backendRoot, 'src/integrations/providers.adapter.ts'),
    'utf8'
  );
  assert.ok(
    providersContent.includes('class JitsiVideoAdapter'),
    'providers.adapter.ts must implement JitsiVideoAdapter for zero-card live classrooms'
  );
  assert.ok(
    providersContent.includes('meet.ffmuc.net'),
    'JitsiVideoAdapter must default to meet.ffmuc.net for unrestricted localhost iframe testing'
  );

  const liveClassesBackend = fs.readFileSync(
    path.join(backendRoot, 'src/modules/live-classes/live-classes.module.ts'),
    'utf8'
  );
  assert.ok(
    liveClassesBackend.includes("provider: z\n      .enum(['JITSI_MEET', 'YOUTUBE_LIVE', 'HMS_100MS'])") &&
      liveClassesBackend.includes("default('JITSI_MEET')"),
    'createLiveClassValidation must default to JITSI_MEET and support YOUTUBE_LIVE'
  );

  const liveClassesFrontend = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/live-learning/components/LiveLearningAndAttendanceViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    liveClassesFrontend.includes('InteractiveJitsiAndYouTubeStudioStage') &&
      liveClassesFrontend.includes('external_api.js'),
    'LiveLearningAndAttendanceViews.tsx must embed Jitsi Meet via external_api.js and support direct iframe fallback'
  );
});

test('Phase 12.2: Public Unauthenticated Certificate Verification Link & Portal (/verify-certificate)', () => {
  const certBackend = fs.readFileSync(
    path.join(backendRoot, 'src/modules/certificates/certificates.module.ts'),
    'utf8'
  );
  assert.ok(
    certBackend.includes('publicVerificationPath: `/verify-certificate?code='),
    'certificates.module.ts must include publicVerificationPath on certificates and verification results'
  );

  const verifyPagePath = path.join(frontendRoot, 'src/app/verify-certificate/page.tsx');
  const verifyDynamicPagePath = path.join(
    frontendRoot,
    'src/app/verify-certificate/[certificateNumber]/page.tsx'
  );
  assert.ok(
    fs.existsSync(verifyPagePath),
    'Public route /verify-certificate (src/app/verify-certificate/page.tsx) must exist'
  );
  assert.ok(
    fs.existsSync(verifyDynamicPagePath),
    'Public dynamic route /verify-certificate/[certificateNumber] must exist'
  );

  const assessmentsFrontend = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/assessments/components/AssessmentsAndCertificatesViews.tsx'
    ),
    'utf8'
  );
  assert.ok(
    assessmentsFrontend.includes('PublicCertificateVerificationPortal') &&
      assessmentsFrontend.includes('/verify-certificate?code='),
    'AssessmentsAndCertificatesViews.tsx must export PublicCertificateVerificationPortal and render shareable /verify-certificate?code=... links'
  );
});
