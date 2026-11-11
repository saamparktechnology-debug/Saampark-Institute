# Online Learning Platform --- Architecture

**Status:** Approved Architecture (v0.2)  
**Version:** 0.2  
**Last updated:** 10 November 2026

## 1. Architectural direction

- **Single-Institute Modular Monolith (`C-024`)**:
  - `backend/`: Node.js + Express.js + TypeScript + Prisma ORM + MySQL.
  - `frontend/`: Single Next.js App Router application (TypeScript + Tailwind CSS + TanStack Query + Axios + React Hook Form + Zod + `next-themes` / custom Dark-Light theme provider) with four distinct role route groups (`/admin`, `/student`, `/teacher`, `/support`).
- **Target Deployment (`C-030`)**:
  - Hosted on a **Hostinger VPS** running Node.js processes (PM2/Docker), Nginx reverse proxy with Let's Encrypt TLS, MySQL 8.x, and local disk / S3-compatible object storage for documents and assignment files.
  - Recorded classes use **YouTube video IDs** rendered via safe server-validated embed parameters (`C-022`).
  - Live classes use a `LiveVideoProvider` adapter targeting **100ms** (`C-030`).
  - Payments use a `PaymentProvider` adapter targeting **Razorpay** (`C-030`).

## 2. Authentication & Authorization (`C-025`)

- **Primary Keys**: UUID v4 strings (`@default(uuid())`) across all tables to prevent ID enumeration across student/teacher/ticket URLs.
- **Credentials & Sessions**:
  - Passwords hashed using `bcryptjs` / Argon2-compatible salt rounds.
  - Short-lived signed JWT Access Token (`15m` expiry) + rotating `HttpOnly`, `Secure`, `SameSite=Lax` Refresh Token (`7d` expiry) stored as a SHA-256 token hash in the `sessions` table with IP, user-agent, and revocation timestamps.
- **Five-Layer Request Guard**:
  1.  `authenticate`: Verifies JWT signature and active `User` status (`ACTIVE`).
  2.  `authorizeRoles(...roles)`: Verifies the user's primary role matches the panel endpoint (`ADMIN`, `STUDENT`, `TEACHER`, `SUPPORT`).
  3.  `requirePermissions(...permCodes)`: Verifies granular RBAC permissions for sensitive mutations.
  4.  `enforceResourceScope`: Enforces student own-record scope, teacher assigned-course scope (`course_teacher_assignments`), and support ticket/triage scope.
  5.  Service-level business state validation & append-only audit logging.

## 3. Standardized Envelopes (`C-016`)

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
  "code": "RESOURCE_FORBIDDEN",
  "errors": null
}
```

## 4. Frontend Feature & Theme Architecture (`C-018`–`C-023`)

- **Theme System**: Seamless Dark Mode and Light Mode toggle persisted in `localStorage` and synced to the root `document.documentElement.classList` (`dark`), styled with high-contrast semantic tokens inspired by the four approved role mockups:
  - **Admin**: Deep slate/emerald-cyan telemetry aesthetic in dark mode; crisp executive slate/white in light mode.
  - **Student**: Vibrant neon-violet/cyan glassmorphic cards and progress rings in dark mode; airy pastel-violet/cyan glass aesthetic in light mode.
  - **Teacher ("Teacher's Cockpit")**: Clean academic indigo/violet cockpit in light mode and deep obsidian-indigo in dark mode.
  - **Support Team**: High-density operational command center with SLA breach alerts (crimson/amber), Kanban triage queues, and live escalation feeds in both dark and light modes.
- **Feature Modularization**:
  ```text
  src/features/<feature>/
  ├── index.tsx
  ├── types/<feature>.types.ts
  ├── services/<feature>.service.ts
  ├── hooks/<feature>.hook.ts
  ├── <feature>.constant.ts
  └── components/
  ```
