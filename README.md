# HelpDesk Lite

An internal web-based ticket management system for small teams (5–20 people). Employees raise tickets; Support Agents work them through a clear lifecycle; the system keeps a complete record of every request, every comment, and every status change.

This repository contains the **design artifacts** (PRD, product brief, UX specs, design system, locked tech stack) and the **implementation** (Angular 17 frontend + Express/TypeScript backend + PostgreSQL via Sequelize), deployed to Vercel with Neon Postgres and Vercel Blob.

---

## Tech stack

| Layer | Choice |
|---|---|
| Language | **TypeScript 5.6** throughout (frontend and backend) |
| Frontend | **Angular 17.3** — standalone components, Angular Signals + RxJS, lazy-loaded routes, plain CSS (no third-party UI library) |
| Backend | **Node.js 20+ / Express 4.21** — CommonJS build, layered Route → Controller → Service → Model |
| Database | **PostgreSQL 16** (local Docker) / **Neon** (production) — 7 tables, 5 native ENUMs, 10 migrations |
| ORM | **Sequelize 6.37** (`postgres` dialect, `underscored: true` → snake_case, `paranoid: true` soft delete on tickets) |
| Auth | **JWT (HS256) in an httpOnly cookie** + **bcrypt** (cost 10) — no refresh tokens, no token in `localStorage` |
| File storage | **Vercel Blob** (private store) in production / local filesystem in dev, behind one storage interface |
| Hosting | **Vercel** — static Angular build + one serverless function for the API |
| Tests | **Jest** (backend unit + integration), **Karma/Jasmine** (frontend), **Playwright** (E2E), custom QA geometry gates |

---

## Repository layout

```
Training_Projects/
├── PRD.md                                # Product requirements (source of truth)
├── project_idea.md
├── README.md                             # This file
├── PUKU.md                               # Repo conventions + working notes for AI sessions
├── HANDSOFF.md                           # QA loop log — every iteration appended here
├── HANDOFF.md                            # Developer handoff (different document from HANDSOFF.md)
├── RESUME-TOMORROW.md                    # Next-session entry point
├── DEPLOY_VERCEL.md                      # Production deployment runbook
├── design-process/                       # WDS design artifacts (Phases 1–6)
│   ├── A-Product-Brief/                  # Phase 1
│   ├── B-Trigger-Map/                    # Phase 2
│   ├── C-UX-Scenarios/                   # Phase 3
│   ├── D-UX-Design/                      # Phase 4 — 9 page specs + wireframes
│   ├── E-Design-System/                  # Phase 5 — tokens + atoms + molecules + organisms + patterns
│   ├── F-Tech-Stack/                     # Locked tech stack (2026-09-15)
│   └── G-Mimir-Handoff/                  # Phase 6 kickoff brief (16 stories)
├── frontend/                             # Angular 17 standalone + plain CSS
│   └── src/app/
│       ├── components/{atoms,molecules,organisms,patterns}/  # Hand-built design system
│       ├── pages/                        # 15 route components
│       ├── services/                     # HTTP services + auth interceptor
│       ├── guards/                       # authGuard / loginGuard / roleGuard
│       └── environments/                 # environment.ts / environment.prod.ts
├── backend/                              # Express + TypeScript + Sequelize + Postgres
│   ├── src/{routes,controllers,services,models,migrations,seeders,utils,config,middleware,docs}/
│   └── test/integration/                 # DB-backed integration specs
├── api/index.ts                          # Vercel Function entry-point (re-exports the Express app)
├── qa/                                   # Playwright E2E specs + 7 geometry verification gates
├── docker/postgres-init/                 # Creates the `helpdesk_lite_test` sibling DB for integration tests
├── docker-compose.yml                    # PostgreSQL 16 for local dev
├── package.json                          # npm workspaces root
└── .env.example                          # Template — copy to .env
```

---

## Prerequisites

- **Node.js 20+** (tested on Node 26.8 / npm 11)
- **Docker Desktop** (for the PostgreSQL 16 container)
- **Angular CLI is NOT required** — the repo pins it via `npx @angular/cli@17`

---

## Quick start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start PostgreSQL (container: helpdesk-lite-postgres, port 5432)
npm run docker:up

# 3. Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env   # backend reads its own .env via dotenv

# 4. Run migrations (10 migrations) and seed demo data
npm run db:migrate
npm run db:seed

# 5. Start both apps concurrently (Angular on 4200, Express on 3000)
npm run dev
```

Open `http://localhost:4200` — the shell routes to `/login`. `curl http://localhost:3000/api/health` returns `{ "status": "ok", ... }`.

**Seeded logins** (password `password123` for all): `admin@company.com` and `riley@company.com` (Admins), `sam@` / `morgan@` / `eli@` / `priya@` (Support Agents), `jess@` / `noah@` (Users).

---

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:backend` | Start only the backend (port 3000) |
| `npm run dev:frontend` | Start only the Angular dev server (port 4200) |
| `npm run build` | Build both workspaces for production |
| `npm run typecheck` | Type-check the backend (`tsc --noEmit`, both app and test tsconfigs) |
| `npm test` | Run the backend unit + integration suites |
| `npm run db:migrate` | Apply pending Sequelize migrations |
| `npm run db:migrate:undo` | Roll back the most recent migration |
| `npm run db:migrate:undo:all` | Roll back every migration (use before `db:reset`) |
| `npm run db:seed` | Run the seeders (demo data + demo notifications) |
| `npm run db:reset` | Undo all → migrate → seed |
| `npm run docker:up` / `docker:down` | Start/stop the PostgreSQL container |
| `npm run docker:logs` | Tail the PostgreSQL container logs |
| `npm run docker:ps` | Show container status |

**Running two frontends at once** (e.g. two IDEs): the frontend port is *not* fixed at 4200. Start a second instance with `npm run start:alt --workspace frontend` (port **4300**) and point QA at it via `BASE_URL`. The backend is shared on `:3000`; its CORS allowlist covers both ports (`FRONTEND_PORTS` in `backend/src/server.ts`).

---

## Database

**PostgreSQL 16** locally (`postgres:16-alpine` in Docker), **Neon** in production. Sequelize's `postgres` dialect with `underscored: true`, so every column is `snake_case` in the database and `camelCase` in TypeScript.

**7 tables:** `users`, `tickets`, `comments`, `attachments`, `activity_logs`, `notifications`, `counters`.

**5 native Postgres ENUMs:** `user_role` (`User` / `Support Agent` / `Admin`), `ticket_status` (`Open` / `In Progress` / `Resolved` / `Closed`), `ticket_priority` (`Low` / `Medium` / `High`), `ticket_category` (`IT` / `HR` / `Finance` / `General`), `activity_action`.

**10 migrations**, tracked in Sequelize's `SequelizeMeta` table:

```
...000 bootstrap-connection      ...005 create-comments
...001 create-users              ...006 create-activity-logs
...002 create-counters           ...007 create-notifications
...003 create-attachments        ...008 ticket-priority-nullable
...004 create-tickets            ...009 add-attachment-backend-kind
```

Two behaviours worth knowing:

- **Tickets are soft-deleted** (`paranoid: true`) — a deleted ticket keeps its row with a `deleted_at` timestamp.
- **`counters` + `FOR UPDATE`** backs the `HD-<n>` ticket-number sequence. The counter row is locked inside the create transaction, so two concurrent creates cannot mint the same number.
- The **integration suite uses a sibling database** `helpdesk_lite_test` on the same container, created by `docker/postgres-init/01-helpdesk_lite_test.sql`. Schema is reset on every run.

---

## Authentication

**Email + password → JWT in an httpOnly cookie.**

1. `POST /api/auth/login` verifies the password with **bcrypt** (`cost 10`).
   If the user does not exist, the server still runs `bcrypt.compare` against a
   pre-computed `DUMMY_HASH` so the response time does not reveal whether the
   email is registered (timing-attack mitigation).
2. On success it signs a **HS256 JWT** (`jsonwebtoken` v9) with
   `JWT_SECRET`, default expiry **1 hour** (`JWT_EXPIRES_IN`), carrying
   `sub` (user id), `email`, `role`, `displayName`.
3. The token is set in an **httpOnly cookie named `auth`** —
   `httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/'`,
   `maxAge` matching the JWT expiry. The browser stores it opaquely; it is
   never readable from JavaScript and is **never written to
   `localStorage` / `sessionStorage`**.
4. `authMiddleware` verifies the cookie on every protected route and
   populates `req.user`.
5. `POST /api/auth/logout` clears the cookie (idempotent, always 204).

**Roles** are `User`, `Support Agent`, `Admin`. They are enforced **inline in
the controllers** (per-endpoint and per-field rules); the service layer
re-asserts the same rules as defense-in-depth. The frontend mirrors this with
`authGuard` / `loginGuard` / `roleGuard` route guards.

**Ownership violations return 404, not 403** — a non-owner asking for someone
else's ticket gets the same "not found" answer as a nonexistent id, so the API
cannot be used to enumerate ticket ids.

Other notes:

- **Login is rate-limited** to 10 attempts / 15 minutes (`express-rate-limit`).
- **There are no refresh tokens.** When the 1-hour token expires the user logs in again. `POST /api/auth/me/password` re-hashes the password but does not rotate the JWT.
- `helmet` is enabled with its default headers (no custom CSP is set).
- Password change requires the current password, so a stolen cookie alone cannot lock the owner out.

---

## API surface

30 routes under `/api`, all documented with **Swagger** (`/api/docs/`, plus the raw spec at `/api/docs.json`; served by `swagger-ui-express` + `swagger-jsdoc`, with the spec inlined at build time).

| Group | Routes |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /login` · `POST /logout` · `POST /register` · `GET /me` · `PATCH /me/password` |
| Tickets | `GET /mine` · `GET /queue` · `GET /list` · `GET /stats` · `GET /stats/mine` · `POST /` · `GET /:id` · `PATCH /:id` · `POST /:id/comments` · `GET /:id/comments` · `GET /:id/activity` · `POST /:id/reopen` · `POST /:id/confirm-close` |
| Users (Admin) | `GET /api/users` · `GET /api/users/agents` · `PUT /api/users/:id/role` · `PUT /api/users/:id/status` |
| Admin | `GET /api/admin/dashboard` · `GET /api/admin/workspace` |
| Attachments | `POST /api/attachments` · `GET /api/attachments/:id` |
| Notifications | `GET /api/notifications` · `POST /api/notifications/:id/read` · `POST /api/notifications/read-all` |

**Notifications** follow a full recipient matrix (see `backend/src/services/notificationService.ts`): agents and admins are notified of new tickets; the ticket submitter is notified of every activity on their own ticket; and **the actor is never notified of their own action**. Inactive users are excluded throughout.

---

## Attachments and file storage

Uploaded bytes are written through a single `AttachmentStorage` interface
(`backend/src/utils/attachmentStorage.ts`) with **two implementations**, chosen
by the `ATTACHMENT_STORAGE_BACKEND` env var:

| Backend | Where | When |
|---|---|---|
| `fs` | local filesystem under `<cwd>/uploads` | local dev — the default, zero configuration |
| `blob` | a **private** Vercel Blob store | production — **required** on Vercel |

**Why the switch is mandatory:** Vercel's serverless filesystem is read-only
except `/tmp`, and `/tmp` is *ephemeral per function instance*, so bytes
written there do not survive. The app **refuses to boot** on Vercel with the
`fs` backend, so a missing env var fails loudly at deploy time instead of
silently breaking uploads at runtime.

The upload cap is env-derived: **4 MB in production** (Vercel rejects bodies
over 4.5 MB before the app sees them, so the honest cap has to sit below
that) and **10 MB locally**. The same number lives in the frontend's
`environment.ts` / `environment.prod.ts` as `maxAttachmentBytes`, so the client
copy and the server always agree.

Downloads are auth-gated and streamed through the API — the blob URL is never
exposed to the browser.

---

## Tests

Four layers, all runnable from the repo root:

| Layer | Runner | Scope |
|---|---|---|
| Backend unit | Jest (`unit` project) | `*.spec.ts` co-located with source. Mocked at module boundaries, no DB. Fast. |
| Backend integration | Jest (`integration` project) | `*.integration.spec.ts` under `backend/test/integration/`. Hits a **real Postgres** on `:5432` (sibling DB `helpdesk_lite_test`) and exercises real transactions. Runs `maxWorkers: 1` because the suite calls `sequelize.sync({ force: true })`. |
| Frontend unit | Karma + Jasmine | Component and service specs. **Must run with `--browsers=ChromeHeadlessDesktop`** — plain `ChromeHeadless` defaults to a ~741 px viewport that trips the stat-strip's responsive breakpoints and produces three phantom geometry failures. |
| End-to-end | Playwright | 11 specs in `qa/tests/` driving the real UI across all three roles. |

```bash
npm test                                              # backend unit + integration
cd backend && npm run test:integration                # DB-backed integration only
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessDesktop
cd qa && npx playwright test                          # E2E
```

Additionally, **7 QA geometry gates** (`qa/scripts/verify-*.js`) run against the live dev server and assert the pixel-level invariants from the reference wireframes (stat-strip layout, shared table, admin workspace, header at narrow widths). They default to `http://localhost:4200`; override with `BASE_URL`:

```bash
cd qa && for f in scripts/verify-*.js; do node "$f"; done
BASE_URL=http://localhost:4300 node qa/scripts/verify-strip.js
```

QA logins: `admin@company.com` / `password123`.

---

## Deployment

Production runs on **Vercel**, deployed automatically by the project's git integration — `git push origin main` is enough.

```
api/index.ts  ──▶  serverless function  ──▶  Express app (backend/src/server.ts)
                                          └──▶ Sequelize ──▶ Neon Postgres
                                          └──▶ attachmentStorage ──▶ Vercel Blob (private)
```

- `api/index.ts` re-exports the Express app as the function's default export. The app guards `app.listen()` against `VERCEL === '1'` and sets `trust proxy` so `req.ip` is correct behind the edge.
- `vercel.json` rewrites `/api/(.*)` → `/api/index` and everything else → `/index.html` (SPA fallback), and serves hashed assets with a one-year immutable cache.
- The frontend builds to `frontend/dist/frontend/browser` with `environment.prod.ts` (relative `/api`).
- The database is **Neon**: `POSTGRES_URL` (pooled, for the app) and `POSTGRES_URL_DIRECT` (non-pooled, for migrations) are set as project environment variables and take precedence over the local `DB_*` values.

Full runbook, including the Neon setup and the Vercel Blob store creation, is in **`DEPLOY_VERCEL.md`**.

### Environment variables

| Variable | Where | Notes |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | local | Postgres 16 defaults; port **5432** |
| `POSTGRES_URL` / `POSTGRES_URL_DIRECT` | Vercel | Neon pooled + direct URLs; override the `DB_*` values |
| `PORT` | local | `3000` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | both | **Required**; expiry defaults to `1h` |
| `FRONTEND_ORIGIN` / `FRONTEND_PORTS` | local | CORS allowlist; ports default to `4200,4300` |
| `ATTACHMENT_STORAGE_BACKEND` | both | `fs` (default, local) or `blob` (**required on Vercel**) |
| `MAX_UPLOAD_BYTES` | both | Optional override; defaults to 4 MB on Vercel, 10 MB elsewhere |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Injected automatically once a Blob store is connected |

---

## Implementation status

All 16 HD stories are implemented and shipped, across four milestones:

- **Milestone A — Foundation (P0):** HD-001 scaffolding → HD-002 models → HD-003 auth → HD-004 chrome → HD-005 login page → HD-006 route guards
- **Milestone B — Employee flow (P0):** HD-007 dashboard → HD-008 create ticket → HD-009 submission confirmation → HD-010 ticket detail → HD-011 comments + activity log
- **Milestone C — Agent + Admin (P1):** HD-012 kanban → HD-013 admin Dashboard tab → HD-014 admin Users tab → HD-015 tickets API filters → HD-016 attachments
- **Plus:** the notification matrix, the WDS-2026 Admin Workspace rework, and the production attachment-storage fix (see `HANDSOFF.md` → Iterations 19–21).

The **WDS-2026 Admin Workspace** is the current Admin Dashboard: a three-row widget grid (Priority Distribution, Users Overview, Ticket Trends, Recent Tickets, Recent Users) with pixel-pinned grid tracks measured from the 1536 px reference mockup.

---

## Known gaps

Honest list of what is *not* done — worth knowing before extending the app:

1. **No refresh tokens.** A 1-hour JWT expiry means the user re-authenticates after an hour. (See `RESUME-TOMORROW.md` / `HANDSOFF.md` for the rationale.)
2. **Attachment bytes are never reclaimed.** `attachmentStorage.delete()` has no call sites and there is no `DELETE /api/attachments/:id` route, so Blob bytes accumulate. The Hobby tier is 1 GB/month and exceeding it is a hard block, not an overage bill. This is the thing that will eventually bite.
3. **The 4 MB production upload cap is a product regression** vs the documented 10 MB. The architecturally correct fix is client-direct upload via `@vercel/blob`'s `handleUpload()` (presigned PUT), which bypasses the 4.5 MB platform limit — a bigger change (new sign route, two-phase frontend rewrite).
4. **`storagePath` leaks into the ticket-detail wire shape** while the attachments controller deliberately omits it. A genuine inconsistency, deferred to keep the storage change surgical.
5. **No CSP.** `helmet` runs with default headers only.
6. **A `roleMiddleware` exists but is dead code** — role checks are asserted inline in the controllers.

---

## Source of truth

When in doubt, refer back to these documents (in this order):

1. `PRD.md` — what we're building
2. `design-process/D-UX-Design/*.md` — how every page is supposed to behave (the wireframes are the geometry authority — measure against them, don't eyeball)
3. `design-process/E-Design-System/01-design-tokens.md` — visual vocabulary
4. `design-process/F-Tech-Stack/tech-stack.md` — the locked stack and its rationale
5. `HANDSOFF.md` — the QA loop log; every iteration is appended as an `## Iteration N` section
6. `DEPLOY_VERCEL.md` — the production deployment runbook
