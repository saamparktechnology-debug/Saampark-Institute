# Online Learning Platform --- Decision Log

**Status:** Approved & Implemented through Phase 10 (Chunk 1 & Chunk 2 Enterprise Release)  
**Version:** 1.0  
**Last updated:** 12 November 2026

This log records all confirmed product, architectural, financial, tax-compliance, anti-piracy, and security decisions across Phases 1–10.

## 1. Confirmed requirements & architectural decisions

| ID | Area | Confirmed requirement | Status | Approved Date |
| :--- | :--- | :--- | :--- | :--- |
| C-001 | Product | Build an online learning platform. | Implemented | 10 Nov 2026 |
| C-002 | Roles | Four primary roles/panels: Admin, Student, Teacher, Support Team. | Implemented | 10 Nov 2026 |
| C-003 | Login | Four separate login pages (`/admin/login`, `/student/login`, `/teacher/login`, `/support/login`) with clean empty form defaults. | Implemented | 12 Nov 2026 |
| C-004 | Live learning | Live class functionality via 100ms v2 REST API + short-lived HS256 JWT tokens. | Implemented | 12 Nov 2026 |
| C-005 | Referrals | Students can refer other students and earn wallet credit upon the referred student's 1st verified paid enrollment. | Implemented | 10 Nov 2026 |
| C-006 | Wallet | Append-only wallet ledger can be used to buy courses and request AES-256-GCM encrypted UPI redemptions. | Implemented | 10 Nov 2026 |
| C-007 | Academics | Courses, enrollments, classes, binary materials, assignments, proctored exams, results, and verifiable certificates. | Implemented | 12 Nov 2026 |
| C-008 | Attendance | Teacher generates a session-based 6-digit attendance code (SHA-256 hashed at rest); students submit it within expiry window. | Implemented | 10 Nov 2026 |
| C-009 | Payments | Official [Razorpay Standard Checkout](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps) (`POST /v1/orders` + `checkout.js` + server-stored `order_id` HMAC-SHA256 verification) for full and installment payments. | Implemented | 12 Nov 2026 |
| C-010 | Notifications | Omnichannel notifications (`In-App`, `Email`, `WhatsApp`, and `TRAI DLT SMS Fallback`). | Implemented | 12 Nov 2026 |
| C-011 | Analytics | Real-time stats and performance views across all four role dashboards. | Implemented | 10 Nov 2026 |
| C-012 | Scheduling | Unified role-scoped schedule/calendar functionality. | Implemented | 10 Nov 2026 |
| C-013 | Role scope | Student sees own data; teacher sees own data and assigned-course students; admin sees all; support sees ticket-scoped context. | Implemented | 10 Nov 2026 |
| C-014 | Payment scope | Student sees own payment history, GST invoices & credit notes; teacher sees own revenue-share/TDS payout history; admin monitors all. | Implemented | 12 Nov 2026 |
| C-015 | Backend | Separate `backend/` folder, Node.js, Express.js, TypeScript, Prisma, MySQL. | Implemented | 10 Nov 2026 |
| C-016 | Backend pattern | Centralized `ApiError`, `apiResponse`, and `catchAsync`. | Implemented | 10 Nov 2026 |
| C-017 | Backend modules | Module-based structure with router, controller, service, validation, and types. | Implemented | 10 Nov 2026 |
| C-018 | Frontend | Separate `frontend/` folder with Next.js App Router, TypeScript, Tailwind CSS, and modular feature-based design. | Implemented | 10 Nov 2026 |
| C-019 | Frontend data | TanStack Query for server state management with zero hardcoded fallback arrays. | Implemented | 10 Nov 2026 |
| C-020 | Frontend API | Centralized Axios API utility with auth/refresh interceptors. | Implemented | 10 Nov 2026 |
| C-021 | Feature structure | Feature folders contain `types/`, `services/`, `hooks/`, `components/`, `<feature>.constant.ts`, and `index.tsx`. | Implemented | 10 Nov 2026 |
| C-022 | Recordings | Recorded classes hosted on YouTube (`youtube-nocookie.com` safe embed URLs); binary materials hosted on Hostinger VPS disk storage. | Implemented | 12 Nov 2026 |
| C-023 | UI Theme & UX | Role-specific dashboards with full Dark and Light mode support. | Implemented | 10 Nov 2026 |
| C-024 | Architecture & Tenancy | Single-institute ownership model, one modular monolith backend, and one Next.js frontend housing all four role panels. | Implemented | 10 Nov 2026 |
| C-025 | Primary Key & Auth Strategy | UUID (`@default(uuid())`) string primary keys; bcrypt password hashing; short-lived JWT access token + HttpOnly rotating refresh token stored as SHA-256 hash in `sessions`. | Implemented | 10 Nov 2026 |
| C-026 | Teacher Assignment | Courses support multiple assigned teachers (`PRIMARY`, `CO_INSTRUCTOR`, `TEACHING_ASSISTANT`) via `course_teacher_assignments`. | Implemented | 10 Nov 2026 |
| C-027 | Installment Access Policy | Immediate course activation on 1st installment payment; automatic transition to `SUSPENDED_OVERDUE` past `graceEndsAt`. | Implemented | 12 Nov 2026 |
| C-028 | Referral & Wallet Reservation | Referral rewards credit upon 1st verified paid enrollment; UPI redemptions immediately reserve wallet funds and reverse on rejection. | Implemented | 10 Nov 2026 |
| C-029 | Teacher Compensation | Configurable revenue-share percentage per course assignment settled in Admin-approved payout batches. | Implemented | 10 Nov 2026 |
| C-030 | Zero-Dummy Provider Adapters | Strict Razorpay Orders/Checkout/Refunds API, strict 100ms v2 Rooms API, and strict binary disk storage (`404` on missing file; zero dummy UI modals or `.txt` fallbacks). | Implemented | 12 Nov 2026 |
| C-032 | Self-Service OTP Auth | Unauthenticated Forgot Password & Passwordless 6-digit OTP Login (`POST /api/v1/auth/forgot-password/request-otp`, `/reset`, `/login-otp`) with 10m TTL and 5-attempt rate limit. | Implemented | 12 Nov 2026 |
| C-033 | Anti-Account Sharing | Student accounts enforce `MAX_STUDENT_CONCURRENT_SESSIONS = 2`, automatically revoking the oldest session when a 3rd device signs in. | Implemented | 12 Nov 2026 |
| C-034 | Automated `00:00 IST` Overdue Lock & Auto-Unlock | Daily `00:00 IST` cron + real-time middleware lock (`INSTALLMENT_OVERDUE_LOCKED`) blocks classes/recordings/materials on overdue installments and auto-unlocks immediately upon Razorpay payment or webhook capture. | Implemented | 12 Nov 2026 |
| C-035 | Indian GST (`SAC 999293`), Credit Notes & Section 194J TDS | 18% GST Tax Invoices (`CGST 9% + SGST 9%` intra-state or `IGST 18%` inter-state + optional B2B `GSTIN`), sequential Credit Notes (`CN-2026-XXXX`) on refunds, Section 194J `10%` TDS deduction on teacher payouts, and idempotent `/api/v1/webhooks/razorpay` reconciliation. | Implemented | 12 Nov 2026 |
| C-036 | TRAI DLT SMS Fallback Toggle | DLT SMS adapter (`MSG91`, `Fast2SMS`, `Textlocal`, `Twilio SMS`) with master switch `SMS_DLT_ENABLED=false` and per-event `smsDlt` checkboxes defaulted to `OFF` while DLT registration is pending, toggleable live in `/admin/settings`. | Implemented | 12 Nov 2026 |
| C-037 | Exam Proctoring & Recording Anti-Piracy | Timed exams enforce `visibilitychange` tab-switch detection, copy/paste lock, 30s server answer auto-save (`POST /api/v1/exams/:id/save-progress`), and 3-strike auto-submission; recorded classes overlay a moving viewer watermark (`fullName • email • phone`) and persist watch progress (`POST /api/v1/recordings/:id/progress`). | Implemented | 12 Nov 2026 |
| C-038 | Moratorium Schedule Shift & `<75%` Attendance Alerts | Admin/Support Moratorium (`POST /api/v1/enrollments/:id/extend-schedule`) shifts unpaid installment `dueAt` and `graceEndsAt` by `1–90` days and unlocks overdue students; Teacher/Admin Low-Attendance Dispatcher (`POST /api/v1/attendance/low-attendance-alerts`) calculates consecutive classes needed to recover `>= 75%` and alerts at-risk students. | Implemented | 12 Nov 2026 |

## 2. Change history

| Version | Date | Change |
| :--- | :--- | :--- |
| 0.1 | 10 Nov 2026 | Initial capture of discussed requirements, recommendations, and open decisions. |
| 0.2 | 10 Nov 2026 | Product owner approved single-institute architecture, UUID/JWT+HttpOnly session strategy, multi-teacher assignments, immediate 1st-installment course access, first-paid-enrollment referral rewards, immediate UPI redemption reservation, revenue-share teacher payouts, and Hostinger VPS + YouTube recording infrastructure. |
| 1.0 | 12 Nov 2026 | Completed Phases 4–10 (Chunk 1 & Chunk 2): Official Razorpay Standard Checkout, 50 MB binary material uploads, Forgot Password & OTP Login, Max-2 Student Concurrent Sessions, `00:00 IST` Overdue Lock & Auto-Unlock, Indian GST Tax Invoices (`SAC 999293`), Refund Credit Notes (`CN-2026-XXXX`), Section 194J `10%` Teacher TDS, TRAI DLT SMS Fallback Toggle (default `OFF`), Exam Anti-Cheat Proctoring & Auto-Save, Dynamic Anti-Piracy Watermarking, Moratorium Schedule Shifting, and `<75%` Low-Attendance Warnings. |
