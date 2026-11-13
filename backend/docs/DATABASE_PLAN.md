# Online Learning Platform --- Database Plan

**Status:** Approved & Implemented Schema Blueprint (v1.0 — Phase 1–10 Complete)  
**Version:** 1.0  
**Last updated:** 12 November 2026

## 1. Locked Database Principles

-   **Database Engine**: MySQL 8.x with Prisma ORM (`C-015`).
-   **Tenancy**: Single-institute model (`C-024`) — no multi-tenant `instituteId` overhead required.
-   **Primary Keys**: `String @id @default(uuid()) @db.Char(36)` across all models (`C-025`).
-   **Monetary Precision**: `Decimal @db.Decimal(12, 2)` for all prices, installments, payments, GST tax breakdowns, wallet balances, referral rewards, redemptions, and teacher payouts (`O-009`). Default currency is `INR`.
-   **Timestamps**: Stored in UTC (`DateTime @default(now())`, `@updatedAt`), evaluated in `Asia/Kolkata` (`IST`) for `00:00 IST` installment grace-period sweeps.
-   **Append-Only Ledgers & Extended Telemetry**: `WalletTransaction`, `PaymentWebhookEvent`, and `AuditLog` are strictly append-only; reversals and adjustments create new compensating entries. Extended compliance and telemetry payloads (OTP hashes, 4-step onboarding state, GST tax invoice & Credit Note metadata, Section 194J TDS breakdowns, exam proctoring & draft auto-save state, and recording watch-progress bookmarks) are stored as structured JSON snapshots in `AuditLog` (`afterDataJson`) keyed by `(action, entityType, entityId)` so zero destructive schema migrations are required on existing MySQL deployments.

## 2. Entity & Relationship Summary (ERD)

### 2.1 Identity, Roles, Profiles, Sessions & OTPs
-   `User`: `id`, `email` (unique), `phone` (unique), `passwordHash`, `fullName`, `avatarUrl`, `role` (`ADMIN` | `STUDENT` | `TEACHER` | `SUPPORT`), `status` (`ACTIVE` | `PENDING` | `SUSPENDED` | `DISABLED`), `emailVerifiedAt`, `lastLoginAt`, timestamps.
-   `StudentProfile`: `id`, `userId` (unique FK), `studentCode` (unique), `dateOfBirth`, `guardianName`, `guardianPhone`, `address`.
-   `TeacherProfile`: `id`, `userId` (unique FK), `teacherCode` (unique), `qualification`, `specialization`, `bio`, `defaultRevenueSharePercent` (`Decimal(5,2)`).
-   `SupportAgentProfile`: `id`, `userId` (unique FK), `agentCode` (unique), `department`, `isTriageLead` (`Boolean`), `maxConcurrentTickets`.
-   `Permission` & `RolePermission` & `UserPermission`: Granular permission codes (e.g., `finance.redemption.approve`, `academics.attendance.override`, `support.ticket.triage`) mapped to roles and optional user-level overrides.
-   `Session`: `id`, `userId` (FK), `refreshTokenHash` (unique), `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `createdAt`. Enforces `MAX_STUDENT_CONCURRENT_SESSIONS = 2` for `STUDENT` accounts.
-   **OTP Verification Records (`AuditLog` `entityType = 'UserOtp'`)**: Stores `{ email, rolePanel, purpose: 'PASSWORD_RESET' | 'OTP_LOGIN', otpHash, expiresAt }` under `action = 'AUTH_OTP_ISSUED'` and marks consumption via `action = 'AUTH_OTP_CONSUMED'`.

### 2.2 Courses, Multi-Teacher Assignments, Curriculum & Doubts
-   `CourseCategory`: `id`, `name`, `slug` (unique), `description`, `parentId`, `status`.
-   `Course`: `id`, `categoryId` (FK), `code` (unique), `title`, `slug` (unique), `shortDescription`, `description`, `thumbnailUrl`, `level`, `language`, `basePrice` (`Decimal(12,2)`), `currency`, `status` (`DRAFT` | `REVIEW` | `PUBLISHED` | `ARCHIVED`), `minAttendancePercent` (`Decimal(5,2)`), `minPassMarksPercent` (`Decimal(5,2)`), `publishedAt`, `createdById`.
-   `CourseTeacherAssignment` (`C-026`): `id`, `courseId` (FK), `teacherId` (FK to `User`), `assignmentRole` (`PRIMARY` | `CO_INSTRUCTOR` | `TEACHING_ASSISTANT`), `revenueSharePercent` (`Decimal(5,2)`), `status` (`ACTIVE` | `INACTIVE`), `assignedAt`. Unique `(courseId, teacherId)`.
-   `CourseSection`: `id`, `courseId` (FK), `title`, `description`, `sortOrder`.
-   `CourseLesson`: `id`, `sectionId` (FK), `title`, `contentType`, `durationSeconds`, `sortOrder`, `isPreview`.
-   `CourseMaterial`: `id`, `courseId` (FK), `lessonId` (nullable FK), `title`, `description`, `fileName`, `mimeType`, `sizeBytes` (`BigInt`), `storageProvider` (`LOCAL_VPS` | `S3`), `storageKey`, `uploadedById`. Physical binary files reside under `uploads/<storageKey>`.

### 2.3 Enrollments, Installment Plans, Official Razorpay Orders & GST/Credit Note Compliance
-   `PaymentPlanTemplate`: `id`, `courseId` (FK), `name`, `planType` (`FULL` | `INSTALLMENT`), `installmentCount`, `totalAmount` (`Decimal(12,2)`), `gracePeriodDays` (`Int`), `isActive`.
-   `Enrollment` (`C-027`, `C-034`, `C-038`): `id`, `studentId` (FK), `courseId` (FK), `paymentPlanTemplateId` (nullable FK), `status` (`PENDING_PAYMENT` | `ACTIVE` | `SUSPENDED_OVERDUE` | `COMPLETED` | `CANCELLED` | `REFUNDED`), `purchasedPriceSnapshot` (`Decimal(12,2)`), `currencySnapshot`, `progressPercent` (`Decimal(5,2)`), `enrolledAt`, `activatedAt`, `suspendedAt`, `completedAt`.
-   `Installment`: `id`, `enrollmentId` (FK), `sequenceNumber` (`Int`), `amount` (`Decimal(12,2)`), `dueAt`, `graceEndsAt`, `status` (`PENDING` | `PAID` | `OVERDUE` | `CANCELLED`), `paidAt`. Unique `(enrollmentId, sequenceNumber)`. Supports moratorium date shifting (`ENROLLMENT_MORATORIUM_SCHEDULE_SHIFTED`).
-   `PaymentTransaction`: `id`, `enrollmentId` (FK), `installmentId` (nullable FK), `studentId` (FK), `provider` (`RAZORPAY` | `WALLET` | `MANUAL`), `providerOrderId` (persisted during Step 2 `POST /api/v1/payments/orders`), `providerPaymentId` (verified against `providerOrderId` during Step 5 `POST /api/v1/payments/verify-checkout`), `amount` (`Decimal(12,2)`), `walletAmountUsed` (`Decimal(12,2)`), `currency`, `status` (`CREATED` | `AUTHORIZED` | `CAPTURED` | `FAILED` | `REFUNDED`), `idempotencyKey` (unique), `verifiedAt`, `refundedAt`, `refundReason`.
-   `PaymentWebhookEvent`: `id`, `provider`, `providerEventId`, `eventType`, `signatureVerified`, `payloadJson`, `processedAt`, `processingStatus`. Unique `(provider, providerEventId)` for idempotent Razorpay webhook reconciliation (`/api/v1/webhooks/razorpay`).
-   **GST Tax Invoice & Credit Note Metadata (`AuditLog` `entityType = 'PaymentTransaction'`)**:
    -   `PAYMENT_GST_DETAILS_UPDATED`: `{ customerGstin, placeOfSupplyState }` (computes `SAC 999293` 18% GST split: `CGST 9% + SGST 9%` intra-state or `IGST 18%` inter-state).
    -   `PAYMENT_REFUNDED`: `{ creditNoteNumber: 'CN-2026-XXXX', originalInvoiceNumber: 'INV-2026-XXXX', providerRefundId, reason }`.

### 2.4 Wallet, Referrals, UPI Redemptions & Teacher Section 194J TDS Payouts (`C-028`, `C-029`, `C-035`)
-   `Wallet`: `id`, `userId` (unique FK), `currency`, `availableBalance` (`Decimal(12,2)`), `reservedBalance` (`Decimal(12,2)`), `version` (`Int`).
-   `WalletTransaction`: `id`, `walletId` (FK), `transactionType` (`REFERRAL_REWARD` | `COURSE_PURCHASE_DEBIT` | `REDEMPTION_RESERVE` | `REDEMPTION_SETTLED` | `REDEMPTION_REVERSAL` | `ADMIN_ADJUSTMENT` | `REFUND_CREDIT`), `direction` (`CREDIT` | `DEBIT`), `amount` (`Decimal(12,2)`), `balanceAfter` (`Decimal(12,2)`), `status` (`PENDING` | `POSTED` | `REVERSED`), `referenceType`, `referenceId`, `idempotencyKey` (unique), `description`, `createdById`, `createdAt`.
-   `ReferralCode` & `Referral`: Tracks student referral codes (`ARGON-...`) and credits the referrer's wallet once upon the referred student's first verified paid enrollment.
-   `RedemptionRequest`: `id`, `userId` (FK), `walletId` (FK), `amount` (`Decimal(12,2)`), `currency`, `upiIdMasked`, `upiIdEncrypted` (`AES-256-GCM`), `status` (`REQUESTED` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `PAID` | `FAILED`), `reserveTransactionId` (unique FK), `reversalTransactionId` (nullable FK), `reviewedById`, `reviewedAt`, `payoutReference`, `rejectionReason`.
-   `TeacherPayout`: `id`, `teacherId` (FK), `periodStart`, `periodEnd`, `grossCourseCollections` (`Decimal(12,2)`), `revenueSharePercentSnapshot` (`Decimal(5,2)`), `grossPayoutAmount` (`Decimal(12,2)`), `adjustments` (`Decimal(12,2)`), `netPayoutAmount` (`Decimal(12,2)`), `status` (`DRAFT` | `APPROVED` | `PAID` | `CANCELLED`), `approvedById`, `paidAt`, `paymentReference`. Section 194J TDS (`tdsPercent`, `tdsAmount`, `tdsSection: '194J'`) is stored in `AuditLog` (`TEACHER_PAYOUT_GENERATED_WITH_TDS`).

### 2.5 Live Classes, YouTube Recordings (with Watermark & Watch Progress) & Attendance (`C-022`, `C-030`, `C-037`)
-   `LiveClass`: `id`, `courseId` (FK), `teacherId` (FK), `title`, `description`, `scheduledStartAt`, `scheduledEndAt`, `provider` (`HMS_100MS`), `providerRoomId`, `status` (`SCHEDULED` | `LIVE` | `ENDED` | `CANCELLED`).
-   `LiveClassParticipant`: `id`, `liveClassId` (FK), `userId` (FK), `participantRole`, `joinedAt`, `leftAt`, `durationSeconds`.
-   `ClassRecording`: `id`, `courseId` (FK), `liveClassId` (nullable FK), `title`, `provider` (`YOUTUBE`), `youtubeVideoId`, `durationSeconds`, `status` (`DRAFT` | `PUBLISHED` | `ARCHIVED`), `publishedAt`.
    -   **Watch-Progress Telemetry (`AuditLog` `action = 'RECORDING_WATCH_PROGRESS_SYNC'`)**: `{ lastPositionSeconds, watchedSeconds, completionPercent, completed, updatedAt }` per `(recordingId, actorUserId)`.
-   `AttendanceSession`: `id`, `courseId` (FK), `liveClassId` (nullable FK), `teacherId` (FK), `sessionDate` (`Date`), `startsAt`, `endsAt`, `codeHash` (`SHA-256`), `codeExpiresAt`, `status` (`OPEN` | `CLOSED` | `FINALIZED`).
-   `AttendanceRecord`: `id`, `attendanceSessionId` (FK), `studentId` (FK), `status` (`PRESENT` | `LATE` | `ABSENT` | `EXCUSED`), `markedAt`, `source` (`CODE` | `MANUAL`), `correctedById`, `correctionReason`. Unique `(attendanceSessionId, studentId)`.

### 2.6 Assessments, Proctored Exam Attempts, Results & Certificates (`O-022`, `O-023`, `C-037`)
-   `Assignment` & `AssignmentSubmission`: Course assignments, file/text submissions, grading queues, marks, and teacher feedback.
-   `Exam`: `id`, `courseId` (FK), `title`, `instructions` (JSON-encoded `{ summary, questions, maxTabSwitches }`), `durationSeconds`, `totalMarks`, `passMarks`, `attemptLimit`, `startsAt`, `endsAt`, `resultPublishAt`, `status`.
-   `ExamAttempt`: `id`, `examId` (FK), `studentId` (FK), `attemptNumber`, `status` (`IN_PROGRESS` | `SUBMITTED` | `EVALUATED`), `score`, `grade`, `startedAt`, `submittedAt`, `evaluatedAt`. Unique `(examId, studentId, attemptNumber)`.
    -   **Proctoring & Draft Auto-Save Telemetry (`AuditLog` `entityType = 'ExamAttempt'`)**: `{ answers, remainingSeconds, tabSwitchCount, fullscreenExits, copyPasteBlockedCount, autoSubmittedByProctor, integrityStatus: 'CLEAN' | 'WARNING' | 'FLAGGED_VIOLATION', violations }`.
-   `Certificate`: `id`, `studentId` (FK), `courseId` (FK), `enrollmentId` (unique FK), `certificateNumber` (unique), `issuedAt`, `status` (`ISSUED` | `REVOKED`), `revocationReason`, `fileReference`.

### 2.7 Support Tickets, Omnichannel Notifications & Append-Only Audit Logs
-   `SupportTicket` & `SupportTicketMessage`: SLA triage (`slaDueAt`), escalation tracking, and internal notes (`isInternalNote`).
-   `Notification`: `id`, `recipientUserId` (FK), `type`, `title`, `body`, `channel` (`IN_APP` | `EMAIL` | `SMS`), `status`, `readAt`, `sentAt`.
-   `AuditLog`: `id`, `actorUserId` (nullable FK), `action`, `entityType`, `entityId`, `beforeDataJson`, `afterDataJson`, `reason`, `ipAddress`, `requestId`, `createdAt`.
