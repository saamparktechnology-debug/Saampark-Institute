# Online Learning Platform --- Project Master Plan

**Document status:** Approved for Phase 1–5 Implementation  
**Version:** 0.2  
**Last updated:** 10 November 2026  
**Purpose:** Single source of truth for product scope, user journeys, business requirements, constraints, and acceptance criteria.

## 1. Product vision

Build a role-based online learning platform for a single institute (`C-024`) that supports course administration, teaching, student learning, live and recorded classes, assessments, attendance, payments, installment plans, student referrals, wallet balances, UPI redemption requests, revenue-share teacher payouts, support operations, notifications, reporting, and performance monitoring.

The platform has four distinct user experiences with rich Dark and Light mode dashboards (`C-002`, `C-023`):

1.  **Admin** (`/admin/login` -> `/admin/dashboard`)
2.  **Student** (`/student/login` -> `/student/dashboard`)
3.  **Teacher** (`/teacher/login` -> `/teacher/dashboard`)
4.  **Support Team** (`/support/login` -> `/support/dashboard`)

Authentication infrastructure is unified on the backend using short-lived access tokens and rotating HttpOnly refresh tokens (`C-025`), while each panel enforces strict role and resource ownership scopes on the server.

## 2. Product goals

- Manage the complete learning lifecycle from course creation through enrollment, teaching, assessment, results, and certificates.
- Allow multiple teachers (`PRIMARY`, `CO_INSTRUCTOR`, `TEACHING_ASSISTANT`) to be assigned to a course (`C-026`) and manage only the courses and students assigned to them.
- Allow students to access only their own profile, enrollments, learning data, payments, wallet, and results.
- Grant students full course access immediately upon verified payment of either full course fees or the 1st installment of an installment plan, with automated suspension if subsequent installments fall overdue beyond the grace period (`C-027`).
- Give administrators platform-wide visibility, analytics, financial approval workflows, and live audit logs.
- Give support staff controlled access to triage ticket queues, monitor SLA breach risks, and inspect read-only payment/enrollment references without financial or academic mutation capabilities.
- Credit student referral rewards upon the referred student's first verified paid enrollment, and reserve wallet balances immediately when a student requests a UPI redemption (`C-028`).
- Calculate and track teacher payouts using a configurable revenue-share percentage per assigned course (`C-029`).
- Deploy cleanly on a Hostinger VPS (hosting Next.js, Express API, MySQL, and local/S3-compatible file storage) while utilizing YouTube video IDs for recorded lessons and provider adapters for Razorpay and 100ms (`C-030`).

## 3. Users, roles, and access principles

### 3.1 Admin

Platform-wide management, subject to granular permissions:

- Dashboard & Analytics (Total Users, Active Live Classes, Revenue Today, System Health, User & Financial Growth Trends, Critical Notifications & System Alerts, Live Audit Log & User Activity)
- User Management, Teacher Management, Student Management, Support Team Management, Role & Permissions
- Course Management, Enrollment Management, Live Class Management
- Payment Management, Referral Management, Wallet & Redemption Management, Teacher Revenue-Share Payouts, Certificate Management
- Reports & Exports, Platform Settings, Audit Logs

### 3.2 Student

Own-record access:

- Dashboard (Enrolled interactive course cards with progress rings, submission countdown rings, upcoming live sessions, attendance & dues summary)
- Academics: My Courses, Course Details, Live Classes, Recorded Classes, Learning Materials, Assignments, Examinations, Results, My Performance, Attendance
- Finance: Payment History, Installments & Dues, Wallet, Referral Program, Redeem Wallet (UPI)
- Others: Certificates, Notifications, Calendar, Profile & Settings, Help & Support
- _(Note: Gamification XP bars and Live AI Study Assistant are planned as post-MVP enhancements per `C-031`.)_

### 3.3 Teacher

Own and assigned-resource access ("Teacher's Cockpit"):

- Dashboard (Assigned Students count, Average Grade, Next Class countdown + Join Room, Today's Attendance %, Class Schedule & Live Sessions with Launch Classroom + Daily Attendance Code generator, Assigned Evaluation & Grading Queues, Student Performance tracker, Semester Average Score chart)
- Teacher Workspace: My Courses, My Students, Live Class Management, Class Schedule, Recorded Classes, Materials Management
- Evaluation: Assignments, Assignment Evaluation, Exam Management, Result Management
- Engagement: Attendance Management, Daily Attendance Code, Student Performance, My Performance
- Financial & Accounts: My Payment History (Revenue-Share Payouts), Notifications, Calendar, Profile, Support

### 3.4 Support Team

Ticket- and task-scoped access:

- Support Dashboard (SLA Breach Risk alert counter, Unassigned Tickets counter, Average Handle Time, Active Agents, Kanban Ticket Queue across Incoming / In Triage / Escalated, Live Escalation Monitor, Critical Comm Activity Feed & History Logs)
- Workspace: Ticket Management, Ticket Assignment
- Ticket Categories: Student Queries, Teacher Queries, Payment Issues, Enrollment Issues, Course Issues, Live Class Issues
- Collaboration & Insights: Internal Notes, Communication History, Escalation Management, Resolution Reports, Notifications

## 4. Approved functional policies

1.  **Ownership & Multi-Role Policy (`C-024`, `C-025`)**: Single institute. Each user account holds one primary role (`ADMIN`, `STUDENT`, `TEACHER`, `SUPPORT`) with optional granular RBAC permission grants. Students can self-register; Admin/Teacher/Support accounts are provisioned by Admins.
2.  **Installment & Enrollment Access (`C-027`)**: Enrollments link to an immutable purchase-time price and payment plan snapshot. Paying the 1st installment transitions the enrollment to `ACTIVE` and unlocks course materials, live classes, and recordings. Overdue installments past `gracePeriodDays` automatically transition the enrollment to `SUSPENDED_OVERDUE` until paid.
3.  **Referral & Wallet Ledger (`C-028`)**: Append-only `wallet_transactions` ledger (`DECIMAL(12,2)`). Referral rewards trigger once when the referred user completes their first verified payment. UPI redemption requests atomically create a debit reservation on the wallet; admin rejection creates a compensating credit reversal entry.
4.  **Teacher Payouts (`C-029`)**: Configured via `teacher_payout_rules` using `REVENUE_SHARE` percentage on verified net course collections for assigned courses, settled in periodic payout statements.
5.  **Infrastructure (`C-030`)**: Hostinger VPS hosts frontend, backend, MySQL, and uploaded materials/assignments; YouTube unlisted video IDs power recorded classes; Razorpay and 100ms are integrated behind clean service adapters.

## 5. Delivery phases

1.  **Phase 1**: Foundation, identity, RBAC, Prisma MySQL schema, centralized backend utilities, 4 role login pages, and 4 rich Dark/Light mode dashboard shells.
2.  **Phase 2**: Academic core (categories, courses, multi-teacher assignments, sections/lessons, materials, enrollment lifecycle).
3.  **Phase 3**: Financial engine (pricing snapshots, Razorpay adapter, installments, append-only wallet ledger, referrals, UPI redemptions, teacher revenue-share payouts).
4.  **Phase 4**: Live classes (100ms adapter), YouTube recorded classes, and session-based attendance codes.
5.  **Phase 5**: Assessments (question bank, assignments, exams, grading queues, results, verifiable certificates).
6.  **Phase 6**: Support ticket queues, SLA monitoring, notifications, schedules, and production hardening on Hostinger VPS.
