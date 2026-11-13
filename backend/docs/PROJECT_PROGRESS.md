# Online Learning Platform --- Project Progress

**Status:** Phase 1–10 (Chunk 1 & Chunk 2 Enterprise Release) Completed — 53/53 Automated Tests Passing; 0 TypeScript Errors; 100% API/DB-Driven (Zero Dummy Fallbacks)  
**Version:** 1.0  
**Last updated:** 12 November 2026

## 1. Current project status

-   **Overall Phase**: **Phase 10 (Chunk 1 & Chunk 2) Completed — Full Enterprise EdTech Platform**
-   **Hard Rule Enforced**: **Zero dummy UI screens, zero `.txt` file fallbacks, zero simulated camera strings, and zero hardcoded mock arrays**.
    -   Payments exclusively use the official [Razorpay Standard Checkout](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps) (`POST https://api.razorpay.com/v1/orders` + `https://checkout.razorpay.com/v1/checkout.js` + server-side HMAC-SHA256 signature verification against the database-stored `providerOrderId` + idempotent `/api/v1/webhooks/razorpay`).
    -   Live classes use the [100ms v2 Rooms REST API](https://www.100ms.live/docs/server-side/v2/api-reference/Rooms/create-room) (`POST https://api.100ms.live/v2/rooms`) and short-lived RFC-7519 HS256 JWT tokens.
    -   Course materials use real binary file uploads (`<input type="file" />` + drag-and-drop up to 50 MB) persisted on disk and served with strict `404 Not Found` enforcement if a physical file is missing.
-   **Automated Tests & Type Verification**: **53/53 unit & invariant tests passing** (`node --test tests/*.test.mjs`) and **0 TypeScript errors** (`npm run typecheck`) across both `backend/` and `frontend/`.

## 2. Implementation checklist

### Phase 1 --- Foundation and identity (Completed)

-   [x] Synchronize all 5 project documentation files (`PROJECT_MASTER_PLAN.md`, `PROJECT_PROGRESS.md`, `ARCHITECTURE.md`, `DATABASE_PLAN.md`, `DECISIONS.md`)
-   [x] Initialize backend TypeScript/Express project (`backend/`) with quote-resilient `.env` loader (`cleanEnvValue`)
-   [x] Initialize frontend Next.js App Router project (`frontend/`)
-   [x] Configure environment validation (`backend/src/config/env.ts` & `backend/.env.example`)
-   [x] Configure Prisma and complete MySQL schema (`backend/prisma/schema.prisma`)
-   [x] Implement centralized `ApiError`, `apiResponse`, `catchAsync`, and global error middleware
-   [x] Implement user, role, permission, and session model
-   [x] Implement four login pages (`/admin/login`, `/student/login`, `/teacher/login`, `/support/login`) with clean empty form defaults
-   [x] Implement authentication and authorization middleware (`backend/src/middlewares/auth.middleware.ts`)
-   [x] Add permission/resource-scope tests (`backend/tests/security-and-invariants.test.mjs`)
-   [x] Create role-specific Dark/Light mode dashboard shells (`/admin/dashboard`, `/student/dashboard`, `/teacher/dashboard`, `/support/dashboard`)

### Phase 2 --- Academic foundation (Completed)

-   [x] Categories and courses CRUD (`backend/src/modules/courses/*`)
-   [x] Sections and lessons curriculum (`POST /api/v1/courses/:courseId/sections` & `lessons`) + interactive student lesson completion toggle (`POST /api/v1/courses/:courseId/lessons/:lessonId/toggle-complete`)
-   [x] Multi-teacher course assignments (`PRIMARY`, `CO_INSTRUCTOR`, `TEACHING_ASSISTANT`) with `revenueSharePercent` (`C-026`, `C-029`)
-   [x] Student and teacher profiles + database seed (`backend/prisma/seed.ts`)
-   [x] Enrollment lifecycle & immutable purchase-time installment schedule snapshots (`backend/src/modules/enrollments/*`)
-   [x] Course materials & Hostinger VPS binary storage adapter (`backend/src/integrations/storage.adapter.ts`, `backend/src/modules/materials/*`, `frontend/src/features/courses/components/MaterialFileUploadZone.tsx`)
-   [x] Course access policy enforcing preview-only access before payment and full access after verified 1st installment (`C-027`)
-   [x] 100% API-driven Admin, Student, and Teacher course screens (`frontend/src/features/courses/*`)

### Phase 3 --- Financial system (Completed)

-   [x] Course pricing and price snapshots (`PaymentPlanTemplate` & `Enrollment` snapshots)
-   [x] Official Razorpay Orders, Checkout Verification & Refunds adapter (`RazorpayPaymentAdapter` in `backend/src/integrations/providers.adapter.ts`)
-   [x] Verified payment flow (`POST /api/v1/payments/orders`, `POST /api/v1/payments/verify-checkout`) and HMAC-SHA256 idempotent webhooks (`POST /api/v1/webhooks/razorpay`)
-   [x] Full payments and atomic wallet-balance course purchases (`COURSE_PURCHASE_DEBIT`)
-   [x] Installment schedules and 1st-installment immediate course activation (`C-027`)
-   [x] GST Tax Invoices (`SAC 999293`) and audited Admin refunds with sequential Credit Notes (`CN-2026-XXXX`) (`POST /api/v1/payments/:transactionId/refund`)
-   [x] Append-only wallet ledger and real-time balance reconciliation (`backend/src/modules/wallets/wallets.module.ts`)
-   [x] Referral attribution and automatic 1st-paid-enrollment reward credit (`C-005`, `C-028`)
-   [x] AES-256-GCM UPI redemption request with atomic fund reservation (`REDEMPTION_RESERVE`) and Admin approval/rejection with automatic `REDEMPTION_REVERSAL` credit (`backend/src/utils/crypto.util.ts`)
-   [x] Teacher revenue-share payout calculation & batch statements with Section 194J `10%` TDS deduction (`backend/src/modules/teacher-payouts/teacher-payouts.module.ts`)
-   [x] Financial concurrency/idempotency tests (`backend/tests/phase3-financial-engine.test.mjs`, `backend/tests/phase9-razorpay-and-file-uploads.test.mjs`)
-   [x] 100% API-driven Finance UI screens across Admin (`/admin/payments`, `/admin/referrals`, `/admin/wallets`), Student (`/student/payment-history`, `/student/wallet`, `/student/referrals`, `/student/redeem-wallet`), and Teacher (`/teacher/payouts`)

### Phase 4 --- Live learning and attendance (Completed)

-   [x] Live-class scheduling and strict 100ms v2 REST room creation (`backend/src/modules/live-classes/live-classes.module.ts`)
-   [x] Short-lived server-generated 100ms HS256 JWT room tokens (`POST /api/v1/live-classes/:liveClassId/join-token`)
-   [x] Participant join/leave interval tracking (`live_class_participants` via `/join-token` & `/leave`)
-   [x] Recorded classes metadata & server-validated YouTube privacy-enhanced embed URLs (`backend/src/modules/recordings/recordings.module.ts`)
-   [x] Expiring 6-digit session attendance code generation (SHA-256 hashed at rest), rate-limited student submission, and audited manual teacher override (`backend/src/modules/attendance/attendance.module.ts`)
-   [x] Phase 4 invariant & security unit tests (`backend/tests/phase4-live-and-attendance.test.mjs`)
-   [x] 100% API-driven Live Classes, YouTube Recordings, Class Schedule, and Session Attendance UI screens (`frontend/src/features/live-learning/*`)

### Phase 5 --- Assessments, grading queues, results and certificates (Completed)

-   [x] Course assignments, student text/file submissions, and teacher evaluation/grading queues (`backend/src/modules/assignments/assignments.module.ts`)
-   [x] Timed examinations with structured question banks, objective auto-grading, teacher result evaluation, and strict answer-reveal protection before `resultPublishAt` (`backend/src/modules/exams/exams.module.ts`)
-   [x] Student & Teacher performance analytics (`GET /api/v1/exams/performance`)
-   [x] Automated & Admin-audited verifiable course completion certificates enforcing attendance (`>= 75%`) and exam pass (`>= 50%`) thresholds (`backend/src/modules/certificates/certificates.module.ts`)
-   [x] Phase 5 invariant & security unit tests (`backend/tests/phase5-assessments-and-certificates.test.mjs`)
-   [x] 100% API-driven Assessments, Results, Performance, and Certificates UI screens (`frontend/src/features/assessments/*`)

### Phase 6 --- Support ticket queues, SLA monitoring, notifications, calendar, profile & RBAC (Completed)

-   [x] Support ticket creation, agent assignment, and Kanban triage (`INCOMING`, `IN_TRIAGE`, `ESCALATED`, `RESOLVED`, `CLOSED`) (`backend/src/modules/support/support.module.ts`)
-   [x] SLA breach monitoring, escalation workflows, and internal collaboration notes (`isInternalNote` strictly hidden from Student/Teacher payloads)
-   [x] Read-only payment and enrollment reference lookup for Support agents (`GET /api/v1/support/context-lookup`)
-   [x] Support resolution & SLA analytics (`GET /api/v1/support/reports`)
-   [x] In-app/Email/WhatsApp/DLT-SMS notifications & read-state tracking (`backend/src/modules/notifications/notifications.module.ts`)
-   [x] Unified role-scoped schedule & calendar aggregation, Profile & Security editor, and Admin RBAC Permission matrix (`backend/src/modules/calendar/calendar.module.ts`)
-   [x] Phase 6 invariant & security unit tests (`backend/tests/phase6-support-and-operations.test.mjs`)
-   [x] 100% API-driven UI screens across Support, Student, Teacher, and Admin panels (`frontend/src/features/operations/*`)

### Phase 7 --- Platform reports, exports, audit log explorer, settings and VPS hardening (Completed)

-   [x] Executive financial, enrollment, teacher payout, and attendance summary reports (`GET /api/v1/system/reports`)
-   [x] Safe CSV (with formula-injection sanitization) and JSON dataset exports (`GET /api/v1/system/reports/export`)
-   [x] Filterable, paginated append-only Audit Log Explorer (`GET /api/v1/system/audit-logs`)
-   [x] Configurable institute operational settings & thresholds (`GET/PATCH /api/v1/system/settings`) and live Hostinger VPS readiness probe (`GET /api/v1/system/vps-readiness`)
-   [x] Hostinger VPS production deployment bundle (`deploy/ecosystem.config.cjs`, `deploy/nginx-argon-lms.conf`, `deploy/backup-mysql.sh`)
-   [x] Phase 7 unit tests (`backend/tests/phase7-reports-audit-and-hardening.test.mjs`)
-   [x] 100% API-driven Admin screens for `/admin/reports`, `/admin/settings`, and `/admin/audit-logs` (`frontend/src/features/system/*`)

### Phase 8 & 9 --- Omnichannel notifications, onboarding wizard, doubts forum, real file uploads & official Razorpay Checkout (Completed)

-   [x] 4-Step Student Course Onboarding Checklist (`PATCH /api/v1/enrollments/:enrollmentId/onboarding`)
-   [x] Live Email (`TLS SMTP` / `Resend`) + WhatsApp (`Meta Cloud API v20.0` / `Twilio` / `WATI`) notification engine with per-event admin toggles (`backend/src/integrations/messaging.adapter.ts`)
-   [x] Course Q&A / Doubts Forum (`GET/POST /api/v1/courses/:courseId/doubts`, `POST /api/v1/courses/:courseId/doubts/:doubtId/reply`), Teacher 1-on-1 Student Nudges, and Cohort Broadcast Announcements
-   [x] Drag-and-drop 50 MB binary Course Material uploader (`FileReader` base64 -> local disk storage)
-   [x] Official Razorpay Standard Checkout integration (`https://checkout.razorpay.com/v1/checkout.js` + `POST https://api.razorpay.com/v1/orders` + server-stored `order_id` HMAC-SHA256 verification)
-   [x] Phase 8 & 9 unit tests (`backend/tests/phase8-chunk1-onboarding-and-omnichannel.test.mjs`, `backend/tests/phase8-chunk2-auth-doubts-receipts-certificates.test.mjs`, `backend/tests/phase9-razorpay-and-file-uploads.test.mjs`)

### Phase 10 (Chunk 1 & Chunk 2) --- Indian Tax Compliance, Overdue Lock/Moratorium, DLT SMS Toggle, Exam Proctoring & Anti-Piracy Watermarking (Completed)

-   [x] **Unauthenticated Forgot Password & Passwordless OTP Login**: `POST /api/v1/auth/forgot-password/request-otp`, `POST /api/v1/auth/forgot-password/reset`, and `POST /api/v1/auth/login-otp` (6-digit SHA-256 hashed OTP, 10m TTL, 5 attempts/10m rate limit)
-   [x] **Max-2 Concurrent Student Device Sessions**: Automatically evicts oldest active session when a student logs in on a 3rd device (`MAX_STUDENT_CONCURRENT_SESSIONS = 2`)
-   [x] **Automated `00:00 IST` Installment Default & Access Lock Engine**: Daily `00:00 IST` scheduler (`sweepOverdueInstallmentsAndLockAccess`) + real-time middleware lock (`INSTALLMENT_OVERDUE_LOCKED`) blocking classes/recordings/materials when an installment passes `graceEndsAt`, with instant auto-unlock upon payment verification
-   [x] **Academic / Medical Moratorium & Schedule Extension**: `POST /api/v1/enrollments/:enrollmentId/extend-schedule` shifts unpaid installment `dueAt` and `graceEndsAt` forward by `1–90` days and auto-unlocks `SUSPENDED_OVERDUE` students
-   [x] **Indian GST (`SAC 999293`), Credit Notes (`CN-2026-XXXX`) & Section 194J `10%` Teacher TDS**: Intra-state (`CGST 9% + SGST 9%`) vs. inter-state (`IGST 18%`) breakdown, optional student B2B `GSTIN`, sequential Credit Notes on refunds, and Section 194J TDS deductions on teacher payouts
-   [x] **TRAI DLT SMS Fallback Engine (Master & Per-Event Toggle `OFF` by Default)**: Supports `MSG91`, `Fast2SMS`, `Textlocal`, and `Twilio SMS` with live switches in `/admin/settings`
-   [x] **Exam Anti-Cheat Proctoring & Real-Time Answer Auto-Save**: `POST /api/v1/exams/:examId/save-progress`, `visibilitychange` tab-switch detection, copy/paste blocking, 3-strike auto-submission (`autoSubmittedByProctor`), and Teacher/Admin `CLEAN` / `WARNING` / `FLAGGED_VIOLATION` badges
-   [x] **Recorded Classes Anti-Piracy Dynamic Moving Watermark & Watch Progress**: Floating viewer identity watermark (`fullName • email • phone`), `POST /api/v1/recordings/:recordingId/progress`, resume-playback `&start=` parameter, and cohort watch analytics
-   [x] **Automated `<75%` Low-Attendance Early Warning Alerts**: `POST /api/v1/attendance/low-attendance-alerts` calculates exact consecutive classes needed to recover `>= 75%` eligibility and dispatches Email + WhatsApp alerts
-   [x] **Phase 10 Chunk 1 & Chunk 2 Automated Tests**: `backend/tests/phase10-chunk1-otp-overdue-gst-tds-dlt.test.mjs` and `backend/tests/phase10-chunk2-proctoring-watermark-pause-nodummy.test.mjs` (**53/53 total tests passing**)
