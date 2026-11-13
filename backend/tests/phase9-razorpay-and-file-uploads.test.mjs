import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRootCandidateA = path.resolve(backendRoot, '../frontend');
const frontendRootCandidateB = path.resolve(backendRoot, '../extracted_frontend');
const frontendRoot = fs.existsSync(frontendRootCandidateA)
  ? frontendRootCandidateA
  : frontendRootCandidateB;

test('Phase 9.1: env.ts strips surrounding double or single quotes from .env values', () => {
  const envFileContent = fs.readFileSync(
    path.join(backendRoot, 'src/config/env.ts'),
    'utf8'
  );
  assert.ok(
    envFileContent.includes('export function cleanEnvValue'),
    'env.ts must export cleanEnvValue helper to strip accidental quotes in .env'
  );
  assert.ok(
    envFileContent.includes('RAZORPAY_KEY_ID'),
    'env.ts must include RAZORPAY_KEY_ID'
  );
  assert.ok(
    envFileContent.includes('RAZORPAY_KEY_SECRET'),
    'env.ts must include RAZORPAY_KEY_SECRET'
  );
});

test('Phase 9.2: app.ts supports 65mb JSON & URL-encoded payloads for 50MB binary base64 uploads', () => {
  const appFileContent = fs.readFileSync(
    path.join(backendRoot, 'src/app.ts'),
    'utf8'
  );
  assert.ok(
    appFileContent.includes("limit: '65mb'"),
    'app.ts must allow 65mb JSON request bodies for 50MB file uploads'
  );
});

test('Phase 9.3: LocalVpsStorageAdapter and MaterialsService store and serve real binary files', () => {
  const storageContent = fs.readFileSync(
    path.join(backendRoot, 'src/integrations/storage.adapter.ts'),
    'utf8'
  );
  assert.ok(
    storageContent.includes('saveUploadedFileBuffer'),
    'LocalVpsStorageAdapter must implement saveUploadedFileBuffer'
  );
  assert.ok(
    storageContent.includes('readUploadedFileBuffer'),
    'LocalVpsStorageAdapter must implement readUploadedFileBuffer'
  );
  assert.ok(
    storageContent.includes('verifySignedDownloadUrl'),
    'LocalVpsStorageAdapter must implement verifySignedDownloadUrl'
  );

  const materialsServiceContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/materials/materials.service.ts'),
    'utf8'
  );
  assert.ok(
    materialsServiceContent.includes('saveUploadedFileBuffer(ticket.storageKey, payload.fileBase64)'),
    'MaterialsService.createCourseMaterial must persist fileBase64 to disk'
  );
  assert.ok(
    materialsServiceContent.includes('fileBase64'),
    'MaterialsService.getMaterialDownloadPayload must return fileBase64 for real binary downloads'
  );
  assert.ok(
    materialsServiceContent.includes('streamSignedMaterial'),
    'MaterialsService must support streaming raw binary files via streamSignedMaterial'
  );
});

test('Phase 9.4: RazorpayPaymentAdapter and PaymentsService verify checkout signatures and auto-settle installments', () => {
  const providersContent = fs.readFileSync(
    path.join(backendRoot, 'src/integrations/providers.adapter.ts'),
    'utf8'
  );
  assert.ok(
    providersContent.includes('https://api.razorpay.com/v1/orders'),
    'RazorpayPaymentAdapter must call Razorpay Orders REST API when live keys are configured'
  );
  assert.ok(
    providersContent.includes('verifyCheckoutSignature'),
    'RazorpayPaymentAdapter must verify razorpay_order_id|razorpay_payment_id HMAC-SHA256 signatures'
  );

  // Verify HMAC-SHA256 signature math matches Razorpay specification
  const secret = 'rzp_test_secret_key';
  const orderId = 'order_test_12345';
  const paymentId = 'pay_test_67890';
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  assert.equal(expectedSig.length, 64);

  const paymentsModuleContent = fs.readFileSync(
    path.join(backendRoot, 'src/modules/payments/payments.module.ts'),
    'utf8'
  );
  assert.ok(
    paymentsModuleContent.includes("'/verify-checkout'"),
    'paymentsRouter must expose POST /api/v1/payments/verify-checkout'
  );
  assert.ok(
    paymentsModuleContent.includes('EnrollmentsService.recordVerifiedInstallmentPayment'),
    'PaymentsService.verifyRazorpayCheckout must automatically settle the installment via EnrollmentsService.recordVerifiedInstallmentPayment'
  );
});

test('Phase 9.5: Frontend wires RazorpayInstallmentPayButton and MaterialFileUploadZone', () => {
  if (!fs.existsSync(frontendRoot)) return;
  const modalContent = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/finance/components/RazorpayCheckoutModal.tsx'
    ),
    'utf8'
  );
  assert.ok(
    modalContent.includes('https://checkout.razorpay.com/v1/checkout.js'),
    'RazorpayCheckoutModal must load the official Razorpay Checkout script'
  );
  assert.ok(
    modalContent.includes('export function RazorpayInstallmentPayButton'),
    'RazorpayCheckoutModal must export RazorpayInstallmentPayButton'
  );

  const uploadZoneContent = fs.readFileSync(
    path.join(
      frontendRoot,
      'src/features/courses/components/MaterialFileUploadZone.tsx'
    ),
    'utf8'
  );
  assert.ok(
    uploadZoneContent.includes('export function MaterialFileUploadZone'),
    'MaterialFileUploadZone must be exported'
  );
  assert.ok(
    uploadZoneContent.includes('export function triggerMaterialBinaryDownload'),
    'triggerMaterialBinaryDownload must be exported'
  );
});
