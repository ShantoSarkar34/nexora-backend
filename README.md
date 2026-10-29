# Nexora Backend

REST API for **Nexora**, an AI-assisted freelance marketplace. Clients post jobs, freelancers apply, get hired and paid through Stripe, deliver work with file attachments, and review each other. It also includes job invitations, messaging, disputes, an admin console, earnings and dashboards, and personalized job recommendations.

**Live API:** `https://nexora-marketplace-backend.vercel.app`
**Base path for every route below:** `/api/v1`

---

## Tech stack

| Layer             | Technology                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime           | Node.js, Express 5, TypeScript (ESM)                                                                                                       |
| Build             | tsup (esbuild); deployed to Vercel as a serverless function (`api/index.ts` exports the Express app)                                       |
| Database          | PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter and a multi-file schema (`prisma/schema/*.prisma`)                    |
| Cache / temp data | Upstash Redis (REST), keys namespaced `nexora:`                                                                                            |
| Auth              | JWT in an httpOnly cookie, bcryptjs, Google sign-in (`google-auth-library`)                                                                |
| Validation        | Zod                                                                                                                                        |
| Payments          | Stripe Checkout and webhooks                                                                                                               |
| AI                | Google Gemini (`@google/genai`) for match analysis                                                                                         |
| Email             | Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) or Resend (`RESEND_API_KEY`, `EMAIL_FROM`), whichever `src/utils/sendEmail.ts` is wired to |
| Images            | ImgBB (avatars), via multer (memory storage)                                                                                               |
| File attachments  | Cloudinary signed direct uploads                                                                                                           |

---

## Architecture

```
src/
├── app.ts                 Express app (no listen); used by server.ts locally and api/index.ts on Vercel
├── server.ts              local entry (app.listen)
├── config/                env validation, Prisma/Redis/Stripe/Gemini/Google clients, CORS origins, cookie options
├── middleware/            auth, optionalAuth, authorize, validateRequest, rateLimiter(s), upload, errorHandler, notFound
├── utils/                 ApiError, catchAsync, sendResponse, pagination, checkOwnership, getParam, jwt, redisService, cloudinary, adminAudit, ...
└── modules/               one folder per resource, each with interface / validation / service / controller / routes
    auth · user · skill · freelancer-profile · client-profile · job · recommendation · application · invitation
    contract · review · payment · ai-match · notification · conversation · dashboard · dispute · admin · upload
prisma/schema/             schema.prisma (generator + datasource), enums, and one file per domain
scripts/                   one-off scripts (admin seed, backfills)
api/index.ts               Vercel serverless entry
```

Every module follows the same layering: **routes → controller → service → Prisma**. Business rules live in services; controllers only translate HTTP.

---

## Conventions

**Response envelope**

```json
{ "success": true, "message": "Human-readable text", "data": {}, "meta": {} }
```

- `data` is omitted on action-only responses (logout, delete).
- `meta` appears on list endpoints: `{ page, limit, total, totalPages }`. Message lists use `{ hasMore }`, and the recommended feed uses `{ limit, reason? }`.
- **Errors:** `{ "success": false, "message": "...", "errors": { "fieldName": ["message"] } }`. `errors` appears for validation failures only. Keys are field names (`newPassword`, `attachments.0.url`), and form-level problems use `_form`. A `stack` field appears only in development.

**Status codes:** 400 invalid input or invalid state transition · 401 not logged in or expired session · 403 wrong role, not the owner, or `Account suspended` · 404 not found · 409 duplicate or conflicting action · 429 rate limited · 502/503 upstream or configuration failure.

**Formats:** ids are UUIDs · timestamps are ISO-8601 UTC strings · **money is always a JSON number in USD** · pagination uses `?page=1&limit=10` (limit capped at 50, default 10).

---

## Authentication and access

- The session is a JWT in an **httpOnly cookie named `accessToken`** (7 days). It is never in a response body and cannot be read by JavaScript.
- **Every authenticated request must send credentials** (`credentials: "include"` for fetch, `withCredentials: true` for axios).
- **CORS** allows `FRONTEND_URL`, any origins in `ADDITIONAL_ALLOWED_ORIGINS` (comma-separated, for example `http://localhost:3000`), and Vercel preview URLs matching the configured pattern.
- **Login first, verify later.** Registering does not block login. `isVerified` is a flag set through an emailed 6-digit OTP, requested from the dashboard. No endpoint currently requires it.
- **Forgot password** is link based: the email links to `FRONTEND_URL/reset-password?token=...`.
- **Roles:** `CLIENT`, `FREELANCER`, `ADMIN`. Admin accounts cannot be registered, only seeded (`scripts/seed-admin.ts`).
- **Suspended accounts** get `403 "Account suspended"` on login, Google login and every authenticated request, including `GET /auth/me`.
- **Deleted accounts** (soft delete, anonymized as "Deleted user") get `401`. Their contracts, reviews and messages remain.
- **Password change or reset** invalidates all other sessions.
- **Ownership is always checked server-side** (owner of the job or contract, participant of the conversation or dispute), in addition to the role check.

---

## Core flow

```
Job (DRAFT → OPEN) → Application / Invitation → Hire (contract PENDING, job IN_PROGRESS)
→ Stripe checkout paid (webhook) → contract ACTIVE → freelancer submits work (SUBMITTED)
→ client approves (COMPLETED, job COMPLETED) → both sides review
             ↘ revision requested (back to ACTIVE)    ↘ dispute (DISPUTED) → admin resolves
```

---

## Enums and state machines

| Enum                                             | Values                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                                             | `CLIENT`, `FREELANCER`, `ADMIN`                                                                                                                                                                                                                                                                                 |
| AuthProvider                                     | `LOCAL`, `GOOGLE`                                                                                                                                                                                                                                                                                               |
| ExperienceLevel                                  | `ENTRY`, `INTERMEDIATE`, `EXPERT`                                                                                                                                                                                                                                                                               |
| Availability                                     | `AVAILABLE`, `BUSY`, `NOT_AVAILABLE`                                                                                                                                                                                                                                                                            |
| CompanySize                                      | `SOLO`, `SMALL`, `MEDIUM`, `LARGE`                                                                                                                                                                                                                                                                              |
| JobCategory                                      | `WEB_DEVELOPMENT`, `MOBILE_DEVELOPMENT`, `DESIGN`, `WRITING`, `MARKETING`, `DATA_SCIENCE`, `DEVOPS`, `OTHER`                                                                                                                                                                                                    |
| BudgetType                                       | `FIXED`, `HOURLY`                                                                                                                                                                                                                                                                                               |
| JobStatus                                        | `DRAFT`, `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `CLOSED`                                                                                                                                                                                                                                              |
| ApplicationStatus                                | `PENDING`, `SHORTLISTED`, `REJECTED`, `HIRED`, `WITHDRAWN`                                                                                                                                                                                                                                                      |
| InvitationStatus                                 | `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED` (computed, see below)                                                                                                                                                                                                                                 |
| ContractStatus                                   | `PENDING`, `ACTIVE`, `SUBMITTED`, `COMPLETED`, `CANCELLED`, `DISPUTED`                                                                                                                                                                                                                                          |
| PaymentStatus                                    | `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`                                                                                                                                                                                                                                           |
| DisputeStatus / DisputeResolution / RefundStatus | `OPEN`, `RESOLVED`, `WITHDRAWN` / `REFUND_CLIENT`, `RELEASE_TO_FREELANCER`, `NO_ACTION` / `SUCCEEDED`, `FAILED`, `NO_PAYMENT`                                                                                                                                                                                   |
| NotificationType                                 | `NEW_APPLICATION`, `APPLICATION_SHORTLISTED`, `APPLICATION_REJECTED`, `FREELANCER_HIRED`, `CONTRACT_ACTIVATED`, `WORK_SUBMITTED`, `CONTRACT_COMPLETED`, `PAYMENT_SUCCESSFUL`, `NEW_REVIEW`, `NEW_INVITATION`, `INVITATION_ACCEPTED`, `INVITATION_DECLINED`, `NEW_MESSAGE`, `DISPUTE_OPENED`, `DISPUTE_RESOLVED` |
| NotificationEntityType                           | `JOB`, `APPLICATION`, `CONTRACT`, `PAYMENT`, `REVIEW`, `INVITATION`, `CONVERSATION`, `DISPUTE`                                                                                                                                                                                                                  |

**Job status** (client-settable): `DRAFT → OPEN | CANCELLED`, `OPEN → CLOSED | CANCELLED`. `IN_PROGRESS` and `COMPLETED` are set only by hiring and approval. Only DRAFT jobs can be deleted, and only DRAFT or OPEN jobs can be edited. Admins can force-close DRAFT or OPEN jobs.

**Application status:** `PENDING → SHORTLISTED | REJECTED | WITHDRAWN | HIRED`, `SHORTLISTED → REJECTED | WITHDRAWN | HIRED`. Clients set only `SHORTLISTED` or `REJECTED`. `HIRED` is set only by the hire endpoint, which also rejects the other open applicants.

**Contract status:** `PENDING → ACTIVE | CANCELLED`, `ACTIVE → SUBMITTED | CANCELLED | DISPUTED`, `SUBMITTED → COMPLETED | ACTIVE (revision) | DISPUTED`. `DISPUTED` leaves only through a dispute (withdrawn or no action: back to the previous status; refund: `CANCELLED`; release: `COMPLETED`). `COMPLETED` and `CANCELLED` are terminal. Cancelling reopens the job.

**Invitations:** one PENDING invitation per job and freelancer. `EXPIRED` is never stored: a PENDING invitation reads as `EXPIRED` whenever its job is no longer OPEN, and the `status` filters follow that rule. Accepting an invitation does not create an application; the freelancer still applies, which then auto-accepts a pending invitation.

---

## API reference

Auth column: **public**, **login** (any role), a role name, **participant**, or **owner**.

### Health

| Method | Path      | Auth   | Notes                           |
| ------ | --------- | ------ | ------------------------------- |
| GET    | `/health` | public | Database and Redis connectivity |

### Auth (`/auth`)

| Method | Path                          | Auth   | Body                                                   | Notes                                                                          |
| ------ | ----------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| POST   | `/auth/register`              | public | `name, email, password, role` (`CLIENT`\|`FREELANCER`) | 201, no auto-login. Password: 8+ chars with upper, lower and a digit           |
| POST   | `/auth/login`                 | public | `email, password`                                      | Sets cookie, returns the current-user object. 400 for Google-only accounts     |
| POST   | `/auth/google`                | public | `idToken, role?`                                       | `role` required for first-time sign-up                                         |
| POST   | `/auth/logout`                | login  | none                                                   | Clears the cookie                                                              |
| POST   | `/auth/send-verification-otp` | login  | none                                                   | Emails a 6-digit code (10 min)                                                 |
| POST   | `/auth/verify-otp`            | login  | `otp`                                                  | 5 wrong attempts invalidate the code                                           |
| POST   | `/auth/forgot-password`       | public | `email`                                                | Always returns the same message                                                |
| POST   | `/auth/reset-password`        | public | `token, newPassword`                                   | Token comes from the emailed link                                              |
| POST   | `/auth/change-password`       | login  | `currentPassword, newPassword`                         | Re-issues the cookie; 400 for Google-only accounts or a wrong current password |
| GET    | `/auth/me`                    | login  | none                                                   | Current-user object                                                            |
| GET    | `/auth/admin-only`            | ADMIN  | none                                                   | Role-check ping used in testing                                                |

### Users (`/users`)

| Method | Path            | Auth  | Body                                                    | Notes                                                                                                                           |
| ------ | --------------- | ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/users/avatar` | login | multipart field `image`                                 | Image, max 4 MB; returns the current-user object with the new `imageUrl`                                                        |
| PATCH  | `/users/me`     | login | `name` (2 to 100)                                       | Returns the current-user object                                                                                                 |
| DELETE | `/users/me`     | login | `password` (or `confirmEmail` for Google-only accounts) | 409 while any contract is PENDING, ACTIVE, SUBMITTED or DISPUTED. Soft-deletes, anonymizes, removes profiles, clears the cookie |

### Freelancer profiles (`/profiles/freelancer`)

| Method | Path                                            | Auth       | Request                                                                                           | Notes                                                                                                                                                                                  |
| ------ | ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/profiles/freelancer`                          | public     | `search, skills, experienceLevel, availability, minRate, maxRate, minRating, sortBy, page, limit` | Directory. `skills` is a comma-separated list (match any); `sortBy` is `newest`\|`rate_asc`\|`rate_desc`\|`rating`. Lists only profiles with a title and bio. Blank params are ignored |
| POST   | `/profiles/freelancer`                          | FREELANCER | `title, bio, hourlyRate, experienceLevel, availability`                                           | One profile per user                                                                                                                                                                   |
| GET    | `/profiles/freelancer/me`                       | FREELANCER | none                                                                                              | Includes skills, experiences, portfolios, `completionPercentage`                                                                                                                       |
| PATCH  | `/profiles/freelancer/me`                       | FREELANCER | same fields, all optional                                                                         |                                                                                                                                                                                        |
| POST   | `/profiles/freelancer/skills`                   | FREELANCER | `name`                                                                                            | Skills are a shared, de-duplicated list                                                                                                                                                |
| DELETE | `/profiles/freelancer/skills/:skillId`          | FREELANCER | none                                                                                              |                                                                                                                                                                                        |
| POST   | `/profiles/freelancer/experience`               | FREELANCER | `title, company, startDate, endDate?, isCurrent, description?`                                    |                                                                                                                                                                                        |
| DELETE | `/profiles/freelancer/experience/:experienceId` | FREELANCER | none                                                                                              |                                                                                                                                                                                        |
| POST   | `/profiles/freelancer/portfolio`                | FREELANCER | `title, description?, projectUrl?, imageUrl?`                                                     |                                                                                                                                                                                        |
| DELETE | `/profiles/freelancer/portfolio/:portfolioId`   | FREELANCER | none                                                                                              |                                                                                                                                                                                        |
| GET    | `/profiles/freelancer/:userId`                  | public     | none                                                                                              | Profile plus flat `name` and `imageUrl` (the nested `user` object is kept)                                                                                                             |

### Client profiles (`/profiles/client`)

| Method | Path                       | Auth   | Body                                                                                                 | Notes                                         |
| ------ | -------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| POST   | `/profiles/client`         | CLIENT | `companyName, industry, companySize, website, about, location, foundedYear, linkedinUrl, twitterUrl` | All optional; URLs must be valid              |
| GET    | `/profiles/client/me`      | CLIENT | none                                                                                                 |                                               |
| PATCH  | `/profiles/client/me`      | CLIENT | same fields                                                                                          |                                               |
| GET    | `/profiles/client/:userId` | public | none                                                                                                 | Includes `user { name, createdAt, imageUrl }` |

### Jobs (`/jobs`)

| Method | Path                  | Auth       | Request                                                                                                                  | Notes                                                                                                                                   |
| ------ | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/jobs`               | public     | `search, category, budgetType, experienceLevel, minBudget, maxBudget, sortBy, page, limit`                               | OPEN jobs only. `sortBy`: `newest`\|`budget_asc`\|`budget_desc`. Cached 60 s. Logged-in freelancers get live `isSaved` and `hasApplied` |
| GET    | `/jobs/recommended`   | FREELANCER | `limit` (1 to 30, default 10)                                                                                            | Personalized feed, see below                                                                                                            |
| GET    | `/jobs/saved/me`      | FREELANCER | `page, limit`                                                                                                            | Flat jobs plus `savedAt`                                                                                                                |
| POST   | `/jobs/:jobId/save`   | FREELANCER | none                                                                                                                     | 409 if already saved                                                                                                                    |
| DELETE | `/jobs/:jobId/save`   | FREELANCER | none                                                                                                                     |                                                                                                                                         |
| POST   | `/jobs`               | CLIENT     | `title (5-150), description (20-5000), category, budgetType, budgetMin, budgetMax, experienceLevel, deadline?, skills[]` | Created as DRAFT                                                                                                                        |
| GET    | `/jobs/client/me`     | CLIENT     | `status, page, limit`                                                                                                    | The client's own jobs, any status                                                                                                       |
| GET    | `/jobs/:jobId`        | public     | none                                                                                                                     | Full detail; same flags as the list                                                                                                     |
| PATCH  | `/jobs/:jobId`        | owner      | partial of the create fields                                                                                             | DRAFT or OPEN only                                                                                                                      |
| PATCH  | `/jobs/:jobId/status` | owner      | `status`                                                                                                                 | `DRAFT→OPEN` publishes; `OPEN→CLOSED\|CANCELLED`                                                                                        |
| DELETE | `/jobs/:jobId`        | owner      | none                                                                                                                     | DRAFT only                                                                                                                              |

**Recommended feed:** takes the latest ~200 OPEN jobs, excludes jobs the freelancer applied to and jobs of deleted or suspended clients, scores them with the same rule-based matcher as `/ai-match` (so scores match), and keeps only jobs sharing at least one skill. The ranking is cached 10 minutes per freelancer, keyed by a fingerprint of their skills, level and portfolio, so profile edits take effect immediately. Job data is read fresh on every call. Empty results carry `meta.reason`: `NO_PROFILE`, `NO_SKILLS` or `NO_MATCHES`.

### Applications (`/applications`)

| Method | Path                                    | Auth             | Request                                                               | Notes                                                                                        |
| ------ | --------------------------------------- | ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/applications`                         | FREELANCER       | `jobId, coverLetter (50-3000), proposedBudget, estimatedDeliveryDays` | OPEN jobs only; 409 if already applied (withdrawn counts). Auto-accepts a pending invitation |
| GET    | `/applications/me`                      | FREELANCER       | `status, page, limit`                                                 |                                                                                              |
| POST   | `/applications/:applicationId/withdraw` | owner            | none                                                                  | From PENDING or SHORTLISTED                                                                  |
| GET    | `/applications/job/:jobId`              | owner of the job | `status, page, limit`                                                 |                                                                                              |
| PATCH  | `/applications/:applicationId/status`   | owner of the job | `status` (`SHORTLISTED`\|`REJECTED`)                                  | Hiring is a separate endpoint                                                                |
| GET    | `/applications/:applicationId`          | participant      | none                                                                  |                                                                                              |

### Invitations (`/invitations`)

| Method | Path                       | Auth       | Request                                   | Notes                                                                                  |
| ------ | -------------------------- | ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| POST   | `/invitations`             | CLIENT     | `jobId, freelancerId, message?` (max 500) | Job must be OPEN and the freelancer must have a profile and no application. 20 per day |
| GET    | `/invitations/sent`        | CLIENT     | `jobId, status, page, limit`              |                                                                                        |
| PATCH  | `/invitations/:id/cancel`  | CLIENT     | none                                      | Pending only                                                                           |
| GET    | `/invitations/me`          | FREELANCER | `status, page, limit`                     |                                                                                        |
| PATCH  | `/invitations/:id/respond` | FREELANCER | `status` (`ACCEPTED`\|`DECLINED`)         | Pending only. Accepting does not create an application                                 |

### Contracts (`/contracts`)

| Method | Path                                      | Auth               | Request                                           | Notes                                                                                                                  |
| ------ | ----------------------------------------- | ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/contracts/hire/:applicationId`          | CLIENT (job owner) | none                                              | One transaction: application `HIRED`, other applicants `REJECTED`, job `IN_PROGRESS`, contract `PENDING`               |
| GET    | `/contracts/me`                           | login              | `status, page, limit`                             | The caller's contracts (by role)                                                                                       |
| GET    | `/contracts/:contractId`                  | participant        | none                                              |                                                                                                                        |
| PATCH  | `/contracts/:contractId/activate`         | CLIENT             | none                                              | Manual fallback; normally payment activates the contract                                                               |
| PATCH  | `/contracts/:contractId/submit`           | FREELANCER         | `submissionNote?, submissionUrl?, attachments?[]` | At least one is required. Up to 5 attachments (`{ url, name, size, mimeType }`), each uploaded through `/uploads/sign` |
| PATCH  | `/contracts/:contractId/request-revision` | CLIENT             | none                                              | `SUBMITTED → ACTIVE`; clears the submission and attachments                                                            |
| PATCH  | `/contracts/:contractId/approve`          | CLIENT             | none                                              | Completes the contract and the job                                                                                     |
| PATCH  | `/contracts/:contractId/cancel`           | participant        | `reason` (10+ chars)                              | PENDING or ACTIVE only; reopens the job                                                                                |
| POST   | `/contracts/:contractId/dispute`          | participant        | `reason` (20-2000)                                | ACTIVE or SUBMITTED only; sets the contract to `DISPUTED`                                                              |

While a contract is `DISPUTED`, submit, approve, request-revision, activate and cancel all return 400.

### Reviews (`/reviews`)

| Method | Path                            | Auth        | Request                               | Notes                                                                                    |
| ------ | ------------------------------- | ----------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST   | `/reviews/contract/:contractId` | participant | `rating` (1-5), `comment?` (max 1000) | COMPLETED contracts only; one per user per contract. The reviewee is derived server-side |
| GET    | `/reviews/contract/:contractId` | participant | none                                  |                                                                                          |
| GET    | `/reviews/user/:userId`         | public      | `page, limit`                         | Reviews received                                                                         |
| GET    | `/reviews/user/:userId/summary` | public      | none                                  | `{ averageRating, totalReviews }`                                                        |

### Payments (`/payments`)

| Method | Path                                      | Auth           | Request               | Notes                                                                                             |
| ------ | ----------------------------------------- | -------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| POST   | `/payments/contract/:contractId/checkout` | CLIENT (owner) | none                  | PENDING contracts only. Returns `{ checkoutUrl, payment }`; redirect the browser to `checkoutUrl` |
| GET    | `/payments/contract/:contractId`          | participant    | none                  |                                                                                                   |
| GET    | `/payments/me`                            | login          | `status, page, limit` | Payments the caller made                                                                          |
| GET    | `/payments/verify/:sessionId`             | payer          | none                  | Syncs a payment from Stripe and activates the contract if the webhook hasn't yet                  |
| GET    | `/payments/earnings/me`                   | FREELANCER     | none                  | `{ totalEarned, inEscrow, platformFeesPaid, completedContracts }` (net of the fee)                |
| GET    | `/payments/earnings/me/transactions`      | FREELANCER     | `page, limit`         | Rows with gross, fee, net                                                                         |
| GET    | `/payments/spending/me`                   | CLIENT         | none                  | `{ totalSpent, inEscrow, completedContracts }` (gross)                                            |
| POST   | `/payments/webhook/stripe`                | Stripe only    | raw body              | Signature-verified and idempotent. Not called by the frontend                                     |

Stripe returns the browser to `FRONTEND_URL/payments/success?session_id=...` or `FRONTEND_URL/payments/cancel`. The platform fee (`PLATFORM_FEE_PERCENT`, default 10) is snapshotted on each payment and deducted on the freelancer's side. There are no real payouts; balances are recorded only.

### AI job matching (`/ai-match`), FREELANCER only

| Method | Path                               | Notes                                                                                                                              |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ai-match/jobs/:jobId/rule-based` | Instant, no external call. `matchScore` plus a `breakdown`                                                                         |
| POST   | `/ai-match/jobs/:jobId/analyze`    | Gemini analysis (`matchScore, strengths, missingSkills, recommendation`), saved per job. Daily limit per user. 502 if the AI fails |
| GET    | `/ai-match/jobs/:jobId/analysis`   | The saved analysis                                                                                                                 |

### Notifications (`/notifications`)

| Method | Path                                  | Auth  | Notes                          |
| ------ | ------------------------------------- | ----- | ------------------------------ |
| GET    | `/notifications/me`                   | login | `unreadOnly=true, page, limit` |
| GET    | `/notifications/unread-count`         | login | `{ unreadCount }`              |
| PATCH  | `/notifications/:notificationId/read` | owner |                                |
| PATCH  | `/notifications/read-all`             | login |                                |

### Messaging (`/conversations`, `/messages`), CLIENT and FREELANCER only (admins get 403)

| Method | Path                          | Request                                                | Notes                                                                                                                                        |
| ------ | ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/conversations`              | `jobId, otherUserId`                                   | Get-or-create (201 new, 200 existing). Requires an application, a pending or accepted invitation, or a contract between the pair on that job |
| GET    | `/conversations/me`           | `page, limit`                                          | Inbox, newest first. Threads with no messages are hidden                                                                                     |
| GET    | `/conversations/:id/messages` | `limit` (default 30), `before` or `after` (message id) | Oldest first, `meta.hasMore`. `after` is for cheap polling                                                                                   |
| POST   | `/conversations/:id/messages` | `body` (max 2000)                                      | 30 per minute. 400 if either account is deleted or suspended                                                                                 |
| PATCH  | `/conversations/:id/read`     | none                                                   | Marks the other person's messages as read                                                                                                    |
| GET    | `/messages/unread-count`      | none                                                   | `{ unreadCount }` across all threads                                                                                                         |

There is no real-time channel (serverless): clients poll.

### Dashboards (`/dashboard`)

| Method | Path                          | Auth       | Notes                                                                                                                                                    |
| ------ | ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/dashboard/freelancer/stats` | FREELANCER | `applications`, `contracts` (each `{ total, byStatus }`), `savedJobs`, `unreadNotifications`, `profile { hasProfile, completionPercentage }`, `earnings` |
| GET    | `/dashboard/client/stats`     | CLIENT     | `jobs`, `totalApplicants`, `contracts`, `spending`, `unreadNotifications`                                                                                |

Every status key is always present (zero-filled).

### Disputes (`/disputes`)

| Method | Path                            | Auth                 | Request                           | Notes                                   |
| ------ | ------------------------------- | -------------------- | --------------------------------- | --------------------------------------- |
| GET    | `/disputes/me`                  | CLIENT, FREELANCER   | `status, contractId, page, limit` |                                         |
| GET    | `/disputes/:disputeId`          | participant or ADMIN | none                              | Admins get extra fields                 |
| PATCH  | `/disputes/:disputeId/withdraw` | the opener           | none                              | Restores the contract's previous status |

### Admin (`/admin`), ADMIN only

| Method | Path                                 | Request                                   | Notes                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/stats`                       | none                                      | `users { total, byStatus (keyed by role), suspended }`, `jobs`, `contracts`, `disputes { open }`, `revenue { totalRevenue, platformFees, inEscrow, refunded }`                                                                                                                     |
| GET    | `/admin/users`                       | `role, search, isVerified, page, limit`   | Excludes deleted accounts                                                                                                                                                                                                                                                          |
| PATCH  | `/admin/users/:userId/suspension`    | `suspended, reason?`                      | Cannot suspend yourself or another admin                                                                                                                                                                                                                                           |
| GET    | `/admin/jobs`                        | `status, search, page, limit`             |                                                                                                                                                                                                                                                                                    |
| PATCH  | `/admin/jobs/:jobId/status`          | `status` (`CLOSED`\|`CANCELLED`), `note?` | DRAFT or OPEN jobs only                                                                                                                                                                                                                                                            |
| GET    | `/admin/disputes`                    | `status, contractId, page, limit`         |                                                                                                                                                                                                                                                                                    |
| PATCH  | `/admin/disputes/:disputeId/resolve` | `resolution, note` (10+ chars)            | `REFUND_CLIENT` (Stripe refund, contract `CANCELLED`, payment `REFUNDED`, job reopens), `RELEASE_TO_FREELANCER` (contract and job `COMPLETED`), `NO_ACTION` (previous status restored). If the Stripe refund fails the resolution is still recorded and `refundStatus` is `FAILED` |

Every admin mutation is written to the `AdminAction` audit table.

### Uploads (`/uploads`)

| Method | Path            | Auth                               | Body                                              | Notes                                                                                                 |
| ------ | --------------- | ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST   | `/uploads/sign` | FREELANCER with an ACTIVE contract | `purpose: "submission", fileName, mimeType, size` | PDF, ZIP, PNG, JPG, DOCX or TXT, max 10 MB. Returns the signed Cloudinary upload details. 30 per hour |

---

## Response shapes (key objects)

- **Current user:** `id, name, email, role, isVerified, provider, imageUrl, createdAt`
- **Job:** `id, clientId, title, description, category, budgetType, budgetMin, budgetMax, experienceLevel, deadline, status, createdAt, updatedAt, skills[{ id, jobId, skillId, skill{ id, name } }], client{ id, name, imageUrl, clientProfile{ companyName } }, clientName, clientImageUrl, companyName, applicantCount, isSaved, hasApplied` (saved list adds `savedAt`). `applicantCount` excludes withdrawn applications.
- **Application:** `id, jobId, freelancerId, coverLetter, proposedBudget, estimatedDeliveryDays, status, createdAt, updatedAt, job{ id, title, status, clientId, client{ id, name, imageUrl } }, freelancer{ id, name, imageUrl, freelancerProfile{ title, hourlyRate } }`
- **Contract:** `id, jobId, applicationId, clientId, freelancerId, agreedBudget, status, submissionNote, submissionUrl, attachments[{ url, name, size, mimeType }], submittedAt, completedAt, cancelledAt, cancelReason, createdAt, updatedAt, job{ id, title, status, budgetType }, client{ id, name, imageUrl }, freelancer{ id, name, imageUrl }, paymentStatus` (latest payment status or `null`)
- **Review:** `id, contractId, reviewerId, revieweeId, rating, comment, createdAt, authorId, authorName, authorImageUrl` (the nested `reviewer` and `contract` objects are also present)
- **Payment:** `id, contractId, payerId, amount, currency, provider, status, providerRef, feePercent, feeAmount, netAmount, paidAt, createdAt, updatedAt` (list endpoints add `contract{ id, jobId, job{ title } }`). Raw Stripe data is never returned.
- **Notification:** `id, userId, type, title, message, link, entityType, entityId, meta, isRead, createdAt`
- **Invitation** (freelancer view): `id, jobId, message, status, createdAt, respondedAt, job{ id, title, budgetMin, budgetMax, budgetType, status }, client{ id, name, imageUrl, companyName }`. The client view has `freelancer{ id, name, imageUrl, title }` instead of `client`.
- **Conversation item:** `id, job{ id, title }, otherUser{ id, name, imageUrl, role }, lastMessage{ body, senderId, createdAt } | null, unreadCount, lastMessageAt`. **Message:** `id, conversationId, senderId, body, readAt, createdAt`.
- **Dispute:** `id, contractId, status, reason, previousContractStatus, resolution, resolutionNote, refundStatus, resolvedAt, createdAt, updatedAt, openedBy{ id, name, imageUrl }, contract{ id, status, agreedBudget, job{ id, title }, client, freelancer }`. The admin view adds `resolvedBy{ id, name }` and `refund{ stripeRefundId, error }`.
- **Directory item:** `userId, name, imageUrl, title, bio, hourlyRate, experienceLevel, availability, skills[{ id, name }], averageRating, totalReviews, completionPercentage`
- **Recommended item:** `{ job (same shape as a job list item), matchScore (0-100), matchedSkills[] }`
- **Earnings transaction row:** `id, contractId, jobTitle, client{ id, name, imageUrl }, gross, feePercent, fee, net, contractStatus, paidAt, completedAt`

**Notification routing** (route by `entityType`, not by parsing `link`): `JOB` → `/jobs/:entityId` · `APPLICATION` → the application (clients can use `meta.jobId` for the applicant list) · `CONTRACT` → `/contracts/:entityId` · `PAYMENT` and `REVIEW` → `/contracts/:meta.contractId` · `INVITATION` → `/jobs/:meta.jobId` · `CONVERSATION` → `/messages/:entityId` · `DISPUTE` → `/disputes/:entityId`.

---

## Rate limits

| Endpoint                                         | Limit                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| `POST /auth/register`                            | 5 per hour per IP                                      |
| `POST /auth/login`                               | 10 per 15 min per IP                                   |
| `POST /auth/forgot-password`                     | 5 per 15 min per IP                                    |
| `POST /auth/send-verification-otp`               | 5 per hour per user                                    |
| `POST /auth/change-password`, `DELETE /users/me` | 5 per 15 min per user                                  |
| `POST /invitations`                              | 20 per day per client                                  |
| `POST /conversations/:id/messages`               | 30 per minute per user                                 |
| `POST /uploads/sign`                             | 30 per hour per user                                   |
| `POST /ai-match/jobs/:jobId/analyze`             | `AI_DAILY_REQUEST_LIMIT` per day per user (default 20) |

Limited responses are `429` with `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers. Limiters fail open if Redis is down.

---

## Environment variables

| Variable                                                                | Purpose                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`, `PORT`                                                      | Runtime                                                      |
| `FRONTEND_URL`, `ADDITIONAL_ALLOWED_ORIGINS`                            | CORS and the Stripe and email links                          |
| `DATABASE_URL`                                                          | Postgres connection string                                   |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_NAMESPACE` | Redis (namespace defaults to `nexora`)                       |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                          | Sessions                                                     |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` (or `RESEND_API_KEY`, `EMAIL_FROM`)  | Transactional email                                          |
| `GOOGLE_CLIENT_ID`                                                      | Google sign-in                                               |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_FEE_PERCENT`    | Payments (fee default 10)                                    |
| `GEMINI_API_KEY`, `AI_DAILY_REQUEST_LIMIT`                              | AI matching                                                  |
| `IMGBB_API_KEY`                                                         | Avatar uploads                                               |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`  | Work attachments (optional; uploads return 503 without them) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`                           | Read only by `scripts/seed-admin.ts`                         |

---

## Scripts

| Command                                                              | Purpose                                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev` / `build` / `start` / `type-check`                     | Dev server (tsup watch), bundle, run the bundle, type-check |
| `npx prisma migrate dev --name <name>` / `npx prisma migrate deploy` | Create and apply migrations locally / apply on production   |
| `npx tsx scripts/seed-admin.ts`                                      | Create the admin (or reset its password)                    |
| `npx tsx scripts/backfill-notification-entities.ts`                  | One-time: fill `entityType`/`entityId` on old notifications |
| `npx tsx scripts/backfill-payment-fees.ts`                           | One-time: fill fee snapshots on old payments                |

---

## Behaviors worth knowing

- **Hiring is not activation.** After hire the contract is `PENDING` until the Stripe webhook (or `/payments/verify/:sessionId`) marks the payment paid. Show "awaiting payment" distinctly.
- **Public job list cache** lasts 60 seconds and is invalidated when jobs change; per-user flags are always live.
- **Redis** holds OTP and reset data, rate limits, the job-list and recommendation caches, and Stripe webhook de-duplication.
- **Soft-deleted users** appear as "Deleted user" with no avatar wherever their name is shown.
- **Attachments** are public, unguessable Cloudinary links, so don't treat them as private.

## Known limitations

- `PATCH /contracts/:id/activate` lets a client activate a contract without paying.
- Suspended freelancers still appear in the directory and can be invited; a suspended client's open jobs stay listed.
- Cancelling a paid contract has no refund flow (only dispute resolution refunds).
- An admin force-closing a job doesn't notify the client.
- Replaced Cloudinary files are never deleted, and the admin audit log has no read endpoint yet.