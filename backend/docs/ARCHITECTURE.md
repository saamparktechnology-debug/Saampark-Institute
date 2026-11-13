# Online Learning Platform --- Architecture

**Status:** Approved & Implemented Architecture (v1.0 — Phase 1–10 Complete)  
**Version:** 1.0  
**Last updated:** 12 November 2026

## 1. Architectural direction

-   **Single-Institute Modular Monolith (`C-024`)**:
    -   `backend/`: Node.js + Express.js (`65mb` JSON/URL-encoded body limit for 50 MB binary base64 uploads) + TypeScript + Prisma ORM + MySQL 8.x.
    -   `frontend/`: Single Next.js App Router application (TypeScript + Tailwind CSS + TanStack Query + Axios + React Hook Form + Zod + Dark/Light theme provider) housing four distinct role route groups (`/admin`, `/student`, `/teacher`, `/support`).
-   **Target Deployment (`C-030`)**:
    -   Hosted on a **Hostinger VPS** running Node.js processes (`deploy/ecosystem.config.cjs` via PM2), Nginx reverse proxy with Let's Encrypt TLS (`deploy/nginx-argon-lms.conf`), MySQL 8.x with automated daily backups (`deploy/backup-mysql.sh`), and local disk (`uploads/`) / S3-compatible binary file storage.
    -   **Payments (`RazorpayPaymentAdapter`)**: Follows the official [Razorpay Node.js Server Integration Steps](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps) (`POST https://api.razorpay.com/v1/orders` with Basic Auth, official `https://checkout.razorpay.com/v1/checkout.js` modal on the frontend, server-side HMAC-SHA256 signature verification against the server-stored `providerOrderId`, `POST https://api.razorpay.com/v1/payments/:id/refund`, and idempotent `/api/v1/webhooks/razorpay` reconciliation).
    -   **Live Classes (`Hms100msVideoAdapter`)**: Calls the [100ms v2 Rooms REST API](https://www.100ms.live/docs/server-side/v2/api-reference/Rooms/create-room) (`POST https://api.100ms.live/v2/rooms`) using RFC-7519 HS256 management JWTs and issues short-lived (`15m`) HS256 app tokens (`version: 2`) for WebRTC classroom sessions.
    -   **Recorded Classes (`RecordingsService`)**: Stores validated 11-character YouTube video IDs rendered via `youtube-nocookie.com` (`C-022`), overlaid with a dynamic moving anti-piracy watermark (`fullName • email • phone`) and backed by per-student watch-progress persistence (`POST /api/v1/recordings/:recordingId/progress`).
    -   **Omnichannel Messaging (`OmnichannelMessagingService`)**: Dispatches real outbound notifications across `In-App` (MySQL `notifications`), `Email` (`TLS SMTP` / `Resend REST API`), `WhatsApp` (`Meta WhatsApp Cloud API v20.0` / `Twilio` / `WATI`), and `TRAI DLT Transactional SMS` (`MSG91` / `Fast2SMS` / `Textlocal` / `Twilio SMS`, with master toggle `SMS_DLT_ENABLED=false` by default while DLT registration is pending).

## 2. Authentication, OTP, Concurrent Sessions & Five-Layer Authorization (`C-025`, `C-032`–`C-034`)

-   **Primary Keys**: UUID v4 strings (`@default(uuid())`) across all tables to prevent ID enumeration across student/teacher/ticket URLs.
-   **Credentials, OTP & Concurrent Device Guard**:
    -   Passwords hashed using `bcryptjs` salt rounds.
    -   Unauthenticated Forgot Password & Passwordless OTP Login (`POST /api/v1/auth/forgot-password/request-otp`, `/forgot-password/reset`, `/login-otp`) using 6-digit SHA-256 hashed OTPs (`10m` expiry, rate-limited to 5 attempts per 10 minutes).
    -   Short-lived signed JWT Access Token (`15m` expiry) + rotating `HttpOnly`, `Secure`, `SameSite=Lax` Refresh Token (`7d` expiry) stored as a SHA-256 token hash in the `sessions` table.
    -   **Student Concurrent Device Limit (`MAX_STUDENT_CONCURRENT_SESSIONS = 2`)**: On password or OTP login, `AuthService` inspects active unrevoked sessions for the student and automatically revokes the oldest session(s) when more than 2 devices are active.
-   **Five-Layer Request Guard**:
    1.  `authenticate`: Verifies JWT signature and active `User` status (`ACTIVE`).
    2.  `authorizeRoles(...roles)`: Verifies the user's primary role matches the panel endpoint (`ADMIN`, `STUDENT`, `TEACHER`, `SUPPORT`).
    3.  `requirePermissions(...permCodes)`: Verifies granular RBAC permissions for sensitive mutations.
    4.  `assertCourseAccessScope`:
        -   Enforces student own-enrollment scope and teacher assigned-course scope (`course_teacher_assignments`).
        -   **Real-Time & `00:00 IST` Overdue Installment Lock (`C-027`, `C-034`)**: Checks if any unpaid installment on the student's enrollment has passed `graceEndsAt`. If overdue, transitions the enrollment to `SUSPENDED_OVERDUE` and throws `403 INSTALLMENT_OVERDUE_LOCKED` on learning content (`/live-classes`, `/recordings`, `/materials`, `/exams`), while keeping `/enrollments`, `/payments`, and `/support` accessible so the student can pay via Razorpay and auto-unlock their account without Admin intervention.
    5.  Service-level business state validation & append-only `AuditLog` persistence.

## 3. Indian Tax Compliance, Anti-Cheat Proctoring & Anti-Piracy Architecture (`C-035`, `C-037`)

### 3.1 GST (`SAC 999293`), Credit Notes & Section 194J Teacher TDS
-   **GST Tax Invoices**: `computeGstTaxBreakdown()` in `payments.module.ts` computes the 18% GST inclusive breakdown (`taxableValue = gross / 1.18`) under `SAC 999293` (Commercial Coaching & Training). Intra-state transactions (`placeOfSupplyState === INSTITUTE_STATE`) split into `9% CGST + 9% SGST`; inter-state transactions apply `18% IGST`. Students can attach their optional B2B `customerGstin` via `PATCH /api/v1/payments/:transactionId/gst-details`.
-   **Sequential Refund Credit Notes**: `POST /api/v1/payments/:transactionId/refund` calls Razorpay's Refunds API (`POST https://api.razorpay.com/v1/payments/:id/refund`), transitions the transaction to `REFUNDED`, and issues a sequential Credit Note (`CN-2026-XXXX`) linked to the original tax invoice number (`INV-2026-XXXX`).
-   **Section 194J Teacher TDS**: `computeTeacherPayoutWithSection194JTds()` in `teacher-payouts.module.ts` calculates `grossShare = grossCollections * (sharePercent / 100)`, deducts `tdsAmount = grossShare * (tdsPercent / 100)` (default `10%` under Section 194J), and persists the breakdown in `AuditLog` (`TEACHER_PAYOUT_GENERATED_WITH_TDS`).

### 3.2 Exam Anti-Cheat Proctoring & Real-Time Answer Auto-Save
-   **Draft Auto-Save (`POST /api/v1/exams/:examId/save-progress`)**: Upserts an `IN_PROGRESS` `ExamAttempt` row and records selected answers, remaining timer seconds, and proctoring counters (`tabSwitchCount`, `fullscreenExits`, `copyPasteBlockedCount`, `violations`) in `AuditLog` (`EXAM_PROGRESS_AND_PROCTORING_SYNC`).
-   **3-Strike Auto-Submit**: Frontend `visibilitychange` listeners warn the student on tab switches `1` and `2`, block `onCopy`/`onPaste`/`onContextMenu`, and automatically submit the attempt (`autoSubmittedByProctor: true`) on violation `#3`, flagging the attempt as `FLAGGED_VIOLATION` in the Teacher/Admin grading queue.

## 4. Standardized Envelopes (`C-016`)

### Success Envelope (`apiResponse`)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Envelope (`ApiError` + Global Error Middleware)
```json
{
  "success": false,
  "message": "Descriptive safe message",
  "code": "INSTALLMENT_OVERDUE_LOCKED",
  "errors": null
}
```
