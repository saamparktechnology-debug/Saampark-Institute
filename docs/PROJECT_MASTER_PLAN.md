# Online Learning Platform --- Project Master Plan

**Document status:** Approved & Completed through Phase 10 (Chunk 1 & Chunk 2 Enterprise Release)  
**Version:** 1.0  
**Last updated:** 12 November 2026  
**Purpose:** Single source of truth for product scope, user journeys, business requirements, Indian regulatory & tax compliance, anti-piracy/anti-cheat security, constraints, and acceptance criteria.

## 1. Product vision

Build a production-grade, role-based online learning platform for a single institute (`C-024`) that supports course administration, teaching, student learning, live and recorded classes, proctored assessments, attendance & early-warning alerts, official Razorpay Standard Checkout payments, GST-compliant tax invoicing & credit notes, installment plans with automated grace-period lock/unlock and moratorium extensions, student referrals, append-only wallet balances, encrypted UPI redemption requests, Section 194J TDS revenue-share teacher payouts, support operations, omnichannel notifications (In-App + SMTP/Resend Email + Meta/Twilio/WATI WhatsApp + TRAI DLT SMS fallback), reporting, and Hostinger VPS readiness monitoring.

The platform has four distinct user experiences with rich Dark and Light mode dashboards (`C-002`, `C-023`):

1.  **Admin** (`/admin/login` -> `/admin/dashboard`)
2.  **Student** (`/student/login` -> `/student/dashboard`)
3.  **Teacher** (`/teacher/login` -> `/teacher/dashboard`)
4.  **Support Team** (`/support/login` -> `/support/dashboard`)

Authentication infrastructure is unified on the backend using short-lived access tokens, rotating `HttpOnly` refresh tokens (`C-025`), unauthenticated Forgot Password & passwordless 6-digit OTP Login (`C-032`), and a Max-2 concurrent device session limit for students (`C-033`), while each panel enforces strict role and resource ownership scopes on the server.

## 2. Product goals

-   Manage the complete learning lifecycle from course creation through enrollment, onboarding, teaching, proctored assessment, results, and verifiable certificates.
-   Allow multiple teachers (`PRIMARY`, `CO_INSTRUCTOR`, `TEACHING_ASSISTANT`) to be assigned to a course (`C-026`) and manage only the courses and students assigned to them.
-   Allow students to access only their own profile, enrollments, learning data, payments, GST tax invoices, wallet, and results.
-   Grant students full course access immediately upon verified payment of either full course fees or the 1st installment of an installment plan, with an automated `00:00 IST` cron & real-time guard that transitions overdue enrollments past `graceEndsAt` to `SUSPENDED_OVERDUE` and auto-unlocks them back to `ACTIVE` the instant payment is verified via [Razorpay Standard Checkout](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps) or webhook (`C-027`, `C-034`).
-   Ensure full Indian tax & financial compliance (`C-035`):
    -   **GST-Compliant Tax Invoices (`SAC 999293`)**: 18% GST split into `CGST 9% + SGST 9%` for intra-state supplies or `IGST 18%` for inter-state supplies based on student/institute state, plus optional B2B customer `GSTIN`.
    -   **Sequential Credit Notes on Refunds (`CN-2026-XXXX`)**: Issued automatically against the original tax invoice whenever an Admin refunds a captured transaction.
    -   **Section 194J TDS on Teacher Payouts**: Configurable TDS deduction (default `10%` under Section 194J) deducted from gross teacher revenue-share before net payout disbursement.
    -   **Idempotent Razorpay Webhook Reconciliation**: Server-side `/api/v1/webhooks/razorpay` listener verifying `x-razorpay-signature` via HMAC-SHA256 to settle orders even if a student's browser closes mid-UPI payment.
-   Provide omnichannel notifications (`In-App`, `Email`, `WhatsApp`, and `TRAI DLT SMS Fallback` with a master toggle defaulted to `OFF` while DLT registration is pending) configurable live from `/admin/settings` (`C-036`).
-   Protect academic integrity and intellectual property (`C-037`):
    -   **Exam Anti-Cheat Proctoring & Real-Time Auto-Save**: Monitors tab switches (`visibilitychange`), window blur, and copy/paste attempts during timed exams, auto-saves draft answers to the server (`POST /api/v1/exams/:examId/save-progress`), and auto-submits the attempt upon reaching the configured violation limit (`maxTabSwitches = 3`).
    -   **Recorded Classes Anti-Piracy Dynamic Watermarking & Resume Playback**: Overlays a moving watermark with the authenticated student's `fullName • email • phone` over recorded video lectures and persists per-student watch progress (`POST /api/v1/recordings/:recordingId/progress`).

## 3. Users, roles, and access principles

### 3.1 Admin
Platform-wide management, subject to granular permissions:
-   **Dashboard & Analytics**: Total Users, Active Live Classes, Revenue Today, System Health, User & Financial Growth Trends, Critical Notifications & System Alerts, Live Audit Log & User Activity.
-   **Identity & Access**: User Management, Teacher Management, Student Management, Support Team Management, Role & Permissions (`RBAC` matrix + user-level grant/revoke overrides), Session Security.
-   **Academic Operations**: Course Management (categories, sections, lessons, multi-teacher assignments, payment plan templates), Direct Student Enrollment & Scholarship Assignment, Course Broadcast Announcements, Course Q&A / Doubts Resolution, Binary Course Material Uploader (`PDF`, `PPTX`, `DOCX`, `XLSX`, `ZIP`, `MP4` up to 50 MB).
-   **Live Learning & Attendance**: Live Class Scheduling & 100ms Room Lifecycle, Session Attendance Monitoring, Audited Manual Overrides, and `<75%` Low-Attendance Early Warning Alerts.
-   **Finance, GST & TDS Compliance**: Official Razorpay Order & Signature Verification, GST Tax Invoices (`SAC 999293`), Sequential Refund Credit Notes (`CN-2026-XXXX`), Academic/Medical Installment Moratorium Extensions (`+1..90` days schedule shift & overdue auto-unlock), Referral Program Oversight, Wallet & Encrypted UPI Redemption Review, Teacher Revenue-Share Payouts with Section 194J `10%` TDS, Verifiable Certificate Issuance & Revocation.
-   **System & VPS Operations**: Executive CSV/JSON Reports (with spreadsheet formula-injection sanitization), Omnichannel Notification Toggles (`Email`, `WhatsApp`, `DLT SMS`), Append-Only Audit Log Explorer, Hostinger VPS Readiness Probe.

### 3.2 Student
Own-record access:
-   **Authentication & Security**: Self-Registration with optional Referral Code (`ARGON-...`), Email/Password Login, Forgot Password via 6-digit OTP, Passwordless 6-digit OTP Login, Max-2 Concurrent Device Session Guard, Active Device Session Manager.
-   **Dashboard**: Enrolled interactive course cards with progress rings, 4-Step Course Onboarding Wizard, submission countdowns, upcoming live sessions, attendance & installment dues summary.
-   **Academics**: My Courses, Interactive Lesson Completion Tracker, Course Q&A / Doubts Forum, 100ms Live Classes (with in-room 6-digit attendance code submission), Recorded Classes (with moving anti-piracy watermark & watch-progress resume), Binary Learning Materials Download, Assignments, Timed Proctored Examinations (with server auto-save & tab-switch guard), Results, My Performance, Session Attendance.
-   **Finance**: Official [Razorpay Standard Checkout](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps) (`checkout.razorpay.com/v1/checkout.js`) for full fees and installments, Printable GST Tax Invoices (`SAC 999293` with optional B2B `GSTIN` & state selector) and Credit Notes, Installments & Dues, Append-Only Wallet, Referral Program, Encrypted UPI Redemption Requests.
-   **Others**: Printable & QR/Code-Verifiable Certificates, Notifications, Unified Calendar, Profile & Security Settings, Help & Support Tickets.

### 3.3 Teacher
Own and assigned-resource access ("Teacher's Cockpit"):
-   **Dashboard**: Assigned Students count, Average Grade, Next Class countdown + Launch 100ms Studio, Today's Attendance %, Class Schedule & Live Sessions, Assigned Evaluation & Grading Queues, Student Performance tracker.
-   **Teacher Workspace**: My Courses, Assigned Student Roster & 1-on-1 Nudges, Cohort Broadcast Announcements, Course Q&A / Doubts Resolution, Live Class Management, Class Schedule, YouTube Recorded Classes Publishing & Cohort Watch Telemetry, Drag-and-Drop Binary Materials Uploader.
-   **Evaluation**: Assignments, Assignment Grading Queue, Timed Exam & Question Bank Creation, Proctoring Integrity Inspection (`CLEAN` / `WARNING` / `FLAGGED_VIOLATION`), Result Publishing.
-   **Engagement**: Daily 6-Digit Attendance Code Generator (SHA-256 hashed at rest), Audited Manual Attendance Override, 1-Click `<75%` Low-Attendance Early Warning Dispatcher, Student Performance Matrix.
-   **Financial & Accounts**: My Payment History (Revenue-Share Payout Statements with Gross Share, Section 194J `10%` TDS Deduction, and Net Payout), Notifications, Calendar, Profile & Security, Support.

### 3.4 Support Team
Ticket- and task-scoped access:
-   **Support Dashboard**: SLA Breach Risk alert counter, Unassigned Tickets counter, Average Handle Time, Active Agents, Kanban Ticket Queue across `INCOMING` / `IN_TRIAGE` / `ESCALATED` / `RESOLVED` / `CLOSED`, Live Escalation Monitor.
-   **Workspace**: Ticket Management, Agent Assignment, SLA Triage, Read-Only Student Enrollment & Payment Context Lookup (`GET /api/v1/support/context-lookup`), Installment Moratorium Extension Assistance.
-   **Ticket Categories**: Student Queries, Teacher Queries, Payment Issues, Enrollment Issues, Course Issues, Live Class Issues.
-   **Collaboration & Insights**: Internal Collaboration Notes (`isInternalNote` strictly stripped from Student/Teacher payloads), Communication History, Escalation Management, Resolution SLA Reports, Notifications.

## 4. Approved functional policies

1.  **Ownership, Multi-Role & Concurrent Session Policy (`C-024`, `C-025`, `C-032`, `C-033`)**: Single institute. Each user account holds one primary role (`ADMIN`, `STUDENT`, `TEACHER`, `SUPPORT`) with optional granular RBAC permission grants. Unauthenticated users can reset passwords or sign in via 6-digit OTP (`10m` TTL, SHA-256 hashed, rate-limited to 5 attempts/10m). Student accounts enforce `MAX_STUDENT_CONCURRENT_SESSIONS = 2`, automatically revoking the oldest session when a 3rd device logs in.
2.  **Installment Access, Automated `00:00 IST` Overdue Lock & Moratorium Policy (`C-027`, `C-034`, `C-038`)**: Paying the 1st installment transitions the enrollment to `ACTIVE`. If any subsequent installment passes `graceEndsAt`, both the daily `00:00 IST` scheduler and real-time `assertCourseAccessScope` guard transition the enrollment to `SUSPENDED_OVERDUE`, blocking `/student/live-classes`, `/student/recorded-classes`, and `/student/materials` while keeping `/student/enrollments` and `/student/support` open. Verified payment or an Admin/Support Moratorium Schedule Extension (`POST /api/v1/enrollments/:id/extend-schedule`) immediately restores `ACTIVE` status.
3.  **Official Razorpay Standard Checkout, GST (`SAC 999293`), Credit Notes & Section 194J TDS (`C-028`, `C-029`, `C-035`)**:
    -   Orders are created server-side via `POST https://api.razorpay.com/v1/orders`, stored on a `CREATED` `PaymentTransaction` row, paid in the official `https://checkout.razorpay.com/v1/checkout.js` modal, and verified via HMAC-SHA256 against the server-stored `providerOrderId` (plus reconciled asynchronously via `/api/v1/webhooks/razorpay`).
    -   Captured payments generate GST Tax Invoices (`SAC 999293`, 18% GST split into `CGST 9% + SGST 9%` intra-state or `IGST 18%` inter-state); refunds generate sequential Credit Notes (`CN-2026-XXXX`).
    -   Teacher payouts deduct configurable Section 194J TDS (default `10%`) before net payout settlement.
4.  **Omnichannel Messaging & TRAI DLT SMS Fallback (`C-036`)**: Supports `In-App`, `Email` (`Hostinger SMTP` / `AWS SES` / `Resend`), `WhatsApp` (`Meta Cloud API v20.0` / `Twilio` / `WATI`), and `TRAI DLT SMS` (`MSG91` / `Fast2SMS` / `Textlocal` / `Twilio SMS`). The DLT SMS master switch (`SMS_DLT_ENABLED=false`) and per-event `smsDlt` checkboxes are `OFF` by default while DLT registration is pending and can be enabled anytime from `/admin/settings`.
5.  **Zero-Dummy Infrastructure & Academic Anti-Piracy/Proctoring (`C-030`, `C-037`)**: No fake payment modals, no `.txt` placeholder material downloads, and no simulated webcam strings. Timed exams enforce anti-cheat tab-switch proctoring and server answer auto-save; recorded lectures enforce dynamic moving student watermarks and watch-progress persistence.

## 5. Delivery phases (All Completed)

1.  **Phase 1 (Completed)**: Foundation, identity, RBAC, Prisma MySQL schema, centralized backend utilities, 4 role login pages, and 4 rich Dark/Light mode dashboard shells.
2.  **Phase 2 (Completed)**: Academic core (categories, courses, multi-teacher assignments, sections/lessons, binary materials upload/download, enrollment lifecycle).
3.  **Phase 3 (Completed)**: Financial engine (pricing snapshots, official Razorpay adapter, installments, append-only wallet ledger, referrals, AES-256-GCM UPI redemptions, teacher revenue-share payouts).
4.  **Phase 4 (Completed)**: Live classes (100ms v2 REST API + HS256 JWT adapter), YouTube recorded classes, and session-based SHA-256 attendance codes.
5.  **Phase 5 (Completed)**: Assessments (question bank, assignments, timed exams, grading queues, results, verifiable certificates).
6.  **Phase 6 (Completed)**: Support ticket queues, SLA monitoring, notifications, unified calendar, profile & RBAC matrix.
7.  **Phase 7 (Completed)**: Executive reports, formula-safe CSV/JSON exports, append-only audit log explorer, platform settings, and Hostinger VPS deployment bundle (`PM2`, `Nginx`, `MySQL backup`).
8.  **Phase 8 (Completed)**: 4-step student onboarding wizard, omnichannel Email + WhatsApp engine, course Q&A doubts forum, batch due reminders, printable receipts & certificates.
9.  **Phase 9 (Completed)**: Real drag-and-drop 50 MB binary course material uploader (`FileReader` base64 -> disk storage) and official Razorpay Standard Checkout integration.
10. **Phase 10 Chunk 1 & Chunk 2 (Completed)**: Forgot Password & OTP Login, Max-2 Student Concurrent Sessions, Automated `00:00 IST` Overdue Lock & Auto-Unlock, Indian GST Tax Invoices (`SAC 999293`), Credit Notes (`CN-2026-XXXX`), Section 194J `10%` Teacher TDS, Idempotent Razorpay Webhook Reconciliation, DLT SMS Fallback Engine (default `OFF`), Exam Anti-Cheat Proctoring & Real-Time Answer Auto-Save, Recorded Class Dynamic Moving Watermark & Watch Progress, Enrollment Moratorium Schedule Shifting, `<75%` Low-Attendance Early Warning Alerts, and Zero-Dummy Hardening (53/53 automated tests passing).
