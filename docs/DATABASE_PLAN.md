# Online Learning Platform --- Database Plan

**Status:** Approved Schema Blueprint (v0.2)  
**Version:** 0.2  
**Last updated:** 10 November 2026

## 1. Locked Database Principles

- **Database Engine**: MySQL 8.x with Prisma ORM (`C-015`).
- **Tenancy**: Single-institute model (`C-024`) — no multi-tenant `instituteId` overhead required.
- **Primary Keys**: `String @id @default(uuid()) @db.Char(36)` across all models (`C-025`).
- **Monetary Precision**: `Decimal @db.Decimal(12, 2)` for all prices, installments, payments, wallet balances, referral rewards, redemptions, and teacher payouts (`O-009`).Default currency is `INR`.
- **Timestamps**: Stored in UTC (`DateTime @default(now())`, `@updatedAt`), displayed in `Asia/Kolkata` by default.
- **Append-Only Ledgers**: `WalletTransaction`, `PaymentWebhookEvent`, and `AuditLog` are strictly append-only; reversals and adjustments create new compensating entries.

## 2. Entity & Relationship Summary (ERD)

### 2.1 Identity, Roles, Profiles & Sessions

- `User`: `id`, `email` (unique), `phone` (unique), `passwordHash`, `fullName`, `avatarUrl`, `role` (`ADMIN` | `STUDENT` | `TEACHER` | `SUPPORT`), `status` (`ACTIVE` | `PENDING` | `SUSPENDED` | `DISABLED`), `emailVerifiedAt`, `lastLoginAt`, timestamps.
- `StudentProfile`: `id`, `userId` (unique FK), `studentCode` (unique), `dateOfBirth`, `guardianName`, `guardianPhone`, `address`.
- `TeacherProfile`: `id`, `userId` (unique FK), `teacherCode` (unique), `qualification`, `specialization`, `bio`, `defaultRevenueSharePercent` (`Decimal(5,2)`).
- `SupportAgentProfile`: `id`, `userId` (unique FK), `agentCode` (unique), `department`, `isTriageLead` (`Boolean`), `maxConcurrentTickets`.
- `Permission` & `RolePermission` & `UserPermission`: Granular permission codes (e.g., `finance.redemption.approve`, `academics.attendance.override`, `support.ticket.triage`) mapped to roles and optional user-level overrides.
- `Session`: `id`, `userId` (FK), `refreshTokenHash` (unique), `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `createdAt`.

### 2.2 Courses, Multi-Teacher Assignments & Curriculum

- `CourseCategory`: `id`, `name`, `slug` (unique), `description`, `parentId`, `status`.
- `Course`: `id`, `categoryId` (FK), `code` (unique), `title`, `slug` (unique), `shortDescription`, `description`, `thumbnailUrl`, `level`, `language`, `basePrice` (`Decimal(12,2)`), `currency`, `status` (`DRAFT` | `REVIEW` | `PUBLISHED` | `ARCHIVED`), `minAttendancePercent` (`Decimal(5,2)`), `minPassMarksPercent` (`Decimal(5,2)`), `publishedAt`, `createdById`.
- `CourseTeacherAssignment` (`C-026`): `id`, `courseId` (FK), `teacherId` (FK to `User`), `assignmentRole` (`PRIMARY` | `CO_INSTRUCTOR` | `TEACHING_ASSISTANT`), `revenueSharePercent` (`Decimal(5,2)`), `status` (`ACTIVE` | `INACTIVE`), `assignedAt`. Unique `(courseId, teacherId)`.
- `CourseSection`: `id`, `courseId` (FK), `title`, `description`, `sortOrder`.
- `CourseLesson`: `id`, `sectionId` (FK), `title`, `contentType`, `durationSeconds`, `sortOrder`, `isPreview`.
- `CourseMaterial`: `id`, `courseId` (FK), `lessonId` (nullable FK), `title`, `fileName`, `mimeType`, `sizeBytes`, `storageProvider` (`LOCAL_VPS` | `S3`), `storageKey`, `uploadedById`, `status`.

### 2.3 Enrollments, Installment Plans & Payments

- `PaymentPlanTemplate`: `id`, `courseId` (FK), `name`, `planType` (`FULL` | `INSTALLMENT`), `installmentCount`, `totalAmount` (`Decimal(12,2)`), `gracePeriodDays` (`Int`), `isActive`.
- `Enrollment` (`C-027`): `id`, `studentId` (FK), `courseId` (FK), `paymentPlanTemplateId` (nullable FK), `status` (`PENDING_PAYMENT` | `ACTIVE` | `SUSPENDED_OVERDUE` | `COMPLETED` | `CANCELLED` | `REFUNDED`), `purchasedPriceSnapshot` (`Decimal(12,2)`), `currencySnapshot`, `progressPercent` (`Decimal(5,2)`), `enrolledAt`, `activatedAt`, `completedAt`, `expiresAt`. Unique active constraint handled via service + composite index `(studentId, courseId, status)`.
- `Installment`: `id`, `enrollmentId` (FK), `sequenceNumber` (`Int`), `amount` (`Decimal(12,2)`), `dueAt`, `graceEndsAt`, `status` (`PENDING` | `PAID` | `OVERDUE` | `CANCELLED`), `paidAt`. Unique `(enrollmentId, sequenceNumber)`.
- `PaymentTransaction`: `id`, `enrollmentId` (FK), `installmentId` (nullable FK), `studentId` (FK), `provider` (`RAZORPAY` | `WALLET` | `MANUAL`), `providerOrderId`, `providerPaymentId`, `amount` (`Decimal(12,2)`), `walletAmountUsed` (`Decimal(12,2)`), `currency`, `status` (`CREATED` | `AUTHORIZED` | `CAPTURED` | `FAILED` | `REFUNDED`), `idempotencyKey` (unique), `verifiedAt`.
- `PaymentWebhookEvent`: `id`, `provider`, `providerEventId`, `eventType`, `signatureVerified`, `payloadJson`, `processedAt`, `processingStatus`. Unique `(provider, providerEventId)`.

### 2.4 Wallet, Referrals, UPI Redemptions & Teacher Payouts (`C-028`, `C-029`)

- `Wallet`: `id`, `userId` (unique FK), `currency`, `availableBalance` (`Decimal(12,2)`), `reservedBalance` (`Decimal(12,2)`), `version` (`Int` for optimistic concurrency + row lock).
- `WalletTransaction`: `id`, `walletId` (FK), `transactionType` (`REFERRAL_REWARD` | `COURSE_PURCHASE_DEBIT` | `REDEMPTION_RESERVE` | `REDEMPTION_SETTLED` | `REDEMPTION_REVERSAL` | `ADMIN_ADJUSTMENT` | `REFUND_CREDIT`), `direction` (`CREDIT` | `DEBIT`), `amount` (`Decimal(12,2)`), `balanceAfter` (`Decimal(12,2)`), `status` (`PENDING` | `POSTED` | `REVERSED`), `referenceType`, `referenceId`, `idempotencyKey` (unique), `description`, `createdById`, `createdAt`.
- `ReferralCode`: `id`, `userId` (unique FK), `code` (unique), `isActive`, `createdAt`.
- `Referral`: `id`, `referrerUserId` (FK), `referredUserId` (unique FK — a user can only be referred once), `referralCodeId` (FK), `status` (`ATTRIBUTED` | `QUALIFIED` | `REWARDED` | `REVERSED`), `rewardAmountSnapshot` (`Decimal(12,2)`), `qualifyingEnrollmentId` (nullable FK), `attributedAt`, `qualifiedAt`, `rewardedAt`.
- `RedemptionRequest`: `id`, `userId` (FK), `walletId` (FK), `amount` (`Decimal(12,2)`), `currency`, `upiIdMasked`, `upiIdEncrypted`, `status` (`REQUESTED` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `PAID` | `FAILED`), `reserveTransactionId` (unique FK), `reversalTransactionId` (nullable FK), `reviewedById`, `reviewedAt`, `payoutReference`, `rejectionReason`, `requestedAt`, `paidAt`.
- `TeacherPayout`: `id`, `teacherId` (FK), `periodStart`, `periodEnd`, `grossCourseCollections` (`Decimal(12,2)`), `revenueSharePercentSnapshot` (`Decimal(5,2)`), `grossPayoutAmount` (`Decimal(12,2)`), `adjustments` (`Decimal(12,2)`), `netPayoutAmount` (`Decimal(12,2)`), `status` (`DRAFT` | `APPROVED` | `PAID` | `CANCELLED`), `approvedById`, `paidAt`, `paymentReference`.

### 2.5 Live Classes, YouTube Recordings & Session Attendance (`C-022`, `C-030`)

- `LiveClass`: `id`, `courseId` (FK), `teacherId` (FK), `title`, `description`, `scheduledStartAt`, `scheduledEndAt`, `provider` (`HMS_100MS`), `providerRoomId`, `status` (`SCHEDULED` | `LIVE` | `ENDED` | `CANCELLED`).
- `LiveClassParticipant`: `id`, `liveClassId` (FK), `userId` (FK), `participantRole`, `joinedAt`, `leftAt`, `durationSeconds`.
- `ClassRecording`: `id`, `courseId` (FK), `liveClassId` (nullable FK), `title`, `provider` (`YOUTUBE`), `youtubeVideoId`, `durationSeconds`, `visibility`, `status` (`DRAFT` | `PUBLISHED` | `ARCHIVED`), `publishedAt`.
- `AttendanceSession`: `id`, `courseId` (FK), `liveClassId` (nullable FK), `teacherId` (FK), `sessionDate` (`Date`), `startsAt`, `endsAt`, `codeHash`, `codeExpiresAt`, `status` (`OPEN` | `CLOSED` | `FINALIZED`).
- `AttendanceRecord`: `id`, `attendanceSessionId` (FK), `studentId` (FK), `status` (`PRESENT` | `LATE` | `ABSENT` | `EXCUSED`), `markedAt`, `source` (`CODE` | `MANUAL`), `correctedById`, `correctionReason`. Unique `(attendanceSessionId, studentId)`.

### 2.6 Assessments, Results & Certificates

- `Assignment` & `AssignmentSubmission`: Course assignments, file/text submissions, grading queues, marks, teacher feedback, and audit log of grade changes.
- `QuestionBank`, `Question`, `QuestionOption`, `Exam`, `ExamQuestion`, `ExamAttempt`, `ExamAnswer`, `Result`: Full examination lifecycle ensuring `QuestionOption.isCorrect` is never serialized to student payloads before `Exam.resultPublishAt`.
- `Certificate`: `id`, `studentId` (FK), `courseId` (FK), `enrollmentId` (unique FK), `certificateNumber` (unique), `issuedAt`, `status` (`ISSUED` | `REVOKED`), `revocationReason`, `fileReference`.

### 2.7 Support Tickets, Notifications & Audit Logs

- `SupportTicket`: `id`, `ticketNumber` (unique), `createdById` (FK), `assignedToId` (nullable FK), `category` (`STUDENT_QUERY` | `TEACHER_QUERY` | `PAYMENT_ISSUE` | `ENROLLMENT_ISSUE` | `COURSE_ISSUE` | `LIVE_CLASS_ISSUE`), `priority` (`LOW` | `MEDIUM` | `HIGH` | `URGENT_RED`), `status` (`INCOMING` | `IN_TRIAGE` | `ESCALATED` | `RESOLVED` | `CLOSED`), `subject`, `description`, `slaDueAt`, `escalatedTo`, `resolvedAt`, `closedAt`.
- `SupportTicketMessage`: `id`, `ticketId` (FK), `senderId` (FK), `message`, `isInternalNote` (`Boolean`), `createdAt`.
- `Notification`: `id`, `recipientUserId` (FK), `type`, `title`, `body`, `channel` (`IN_APP` | `EMAIL` | `SMS`), `status`, `readAt`, `sentAt`.
- `AuditLog`: `id`, `actorUserId` (nullable FK), `action`, `entityType`, `entityId`, `beforeDataJson`, `afterDataJson`, `reason`, `ipAddress`, `requestId`, `createdAt`.
