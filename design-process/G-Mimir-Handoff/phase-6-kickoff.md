---
title: HelpDesk Lite — Phase 6 Mimir Kickoff Brief
status: ready
created: 2026-09-15
project: Training_3
phase: Phase 6 — Mimir Implementation
method: Whiteport Design Studio (WDS)
stack: Angular 17+ standalone + Node/Express + MySQL (Sequelize) + JWT/bcrypt
---

# Phase 6 — Mimir Kickoff Brief

This document is the **implementation breakdown** that Mimir reads before writing a single line of code. It maps every Phase 4 page spec to:

1. **An Angular route + page component** (frontend)
2. **An Express endpoint set** (backend)
3. **A Sequelize model** (data layer)
4. **An Action ID** for tracking work as user stories

The Phase 4 specs at `design-process/D-UX-Design/` are the source of truth for *what* to build. The Phase 5 design system at `design-process/E-Design-System/` is the source of truth for *how it looks*. This document is the bridge — it gives Mimir a sequenced, dependency-ordered build plan.

---

## Stack (locked 2026-09-15)

| Layer | Choice |
|---|---|
| Frontend | Angular 17+ standalone components + plain CSS |
| Backend | Node.js + Express |
| Database | MySQL 8 via Sequelize ORM |
| Auth | JWT (short-lived) + bcrypt |
| Project layout | Monorepo — `frontend/` + `backend/` at project root |
| API style | REST, JSON, resource-oriented |

See `design-process/F-Tech-Stack/tech-stack.md` for full rationale and open questions.

---

## Story Index

| Story ID | Page / Capability | Priority | Depends on |
|---|---|---|---|
| HD-001 | Project scaffolding (monorepo, Angular, Express, MySQL) | P0 | — |
| HD-002 | Sequelize models + migrations | P0 | HD-001 |
| HD-003 | Auth: register / login / logout (JWT + bcrypt) | P0 | HD-002 |
| HD-004 | App-header chrome + dropdown + logout dialog | P0 | HD-003 |
| HD-005 | Login page (`/login`) | P0 | HD-003 |
| HD-006 | Routing guards (auth + role-based) | P0 | HD-003 |
| HD-007 | Employees dashboard (`/dashboard`) | P0 | HD-006, HD-002 |
| HD-008 | Create Ticket page (`/tickets/new`) | P0 | HD-006 |
| HD-009 | Submission Confirmation page (`/tickets/:id/created`) | P0 | HD-008 |
| HD-010 | Ticket Detail page (`/tickets/:id`) — role-aware | P0 | HD-006 |
| HD-011 | Ticket comments + activity log | P0 | HD-010 |
| HD-012 | Agent Kanban (`/queue`) + drag-and-drop status transitions | P1 | HD-010 |
| HD-013 | Admin Dashboard (`/admin`) — Dashboard tab | P1 | HD-010 |
| HD-014 | Admin Dashboard (`/admin`) — Users tab + role/active controls | P1 | HD-003 |
| HD-015 | Tickets API: filters, search, pagination (deferred filters) | P1 | HD-010 |
| HD-016 | Attachments (upload + storage + display) | P2 | HD-008, HD-010 |

Stories are grouped into milestones below.

---

## Milestone A — Foundation (P0, must ship before anything else)

### HD-001 — Project scaffolding

**What:** Initialize the monorepo with `frontend/` (Angular) and `backend/` (Express). Wire up TypeScript on both sides. MySQL container for dev. Sequelize CLI installed.

**Frontend (`/frontend/`):**
- `ng new helpdesk-lite-frontend --standalone --routing --style=css --strict`
- Angular 17+ (confirm with `ng version`)
- No UI library; no Tailwind
- `app.routes.ts` with placeholder routes for every Phase 4 page
- Folder structure mirrors WDS tiers:
  ```
  src/app/
    components/
      atoms/        # 13 atom components
      molecules/    # 11 molecule components
    pages/          # 6 organism components (1 per page)
    patterns/       # 7 cross-page patterns as services / directives
    services/       # HTTP, auth, role
    guards/         # authGuard, roleGuard
    models/         # TypeScript interfaces matching Sequelize models
  ```

**Backend (`/backend/`):**
- `npm init -y`, install: `express sequelize mysql2 bcrypt jsonwebtoken cors helmet dotenv morgan`
- Dev: `nodemon`, `sequelize-cli`
- TypeScript: `tsc --init`, `tsx` for runtime, `@types/*` for libs
- Folder structure:
  ```
  backend/
    src/
      config/         # DB connection, env loader
      models/         # Sequelize models (one file per entity)
      migrations/     # sequelize-cli migrations
      seeders/        # dev seeders (1 Admin, 2 Agents, 5 Employees, 20 tickets)
      controllers/    # Express handlers, one per resource
      routes/         # Express routers
      middleware/     # auth (JWT verify), role gate, error handler
      services/       # business logic (status transitions, activity log writes)
      utils/          # helpers (ticket number generator, etc.)
    server.ts         # entry
  ```

**Acceptance:**
- `npm run dev` from project root starts both Angular (port 4200) and Express (port 3000) concurrently (use `concurrently`).
- MySQL container running locally; Sequelize can connect; `sequelize db:migrate` succeeds on an empty DB.
- CORS: Angular dev origin (`http://localhost:4200`) allowlisted in Express.

---

### HD-002 — Sequelize models + migrations

**Models (5 total):**

| Model | Fields (high level) | Notes |
|---|---|---|
| `User` | `id`, `email` (unique), `passwordHash`, `displayName`, `role` (enum: `User` \| `Support Agent` \| `Admin`), `isActive` (boolean), `lastActiveAt`, `createdAt`, `updatedAt` | Role enum matches the dropdown vocabulary in `users-tab.md`. |
| `Ticket` | `id`, `number` (unique, e.g., `HD-47`), `title`, `description`, `category` (enum: `IT` \| `HR` \| `Finance` \| `General`, nullable), `priority` (enum: `Low` \| `Medium` \| `High`), `status` (enum: `Open` \| `In Progress` \| `Resolved` \| `Closed`), `submitterId` (FK → User), `ownerId` (FK → User, nullable), `attachmentId` (FK → Attachment, nullable), `createdAt`, `updatedAt` | `number` is the human-friendly ID shown in UI; `id` is the DB PK. |
| `Comment` | `id`, `ticketId` (FK), `authorId` (FK → User), `body`, `createdAt` | Soft delete out of MVP. |
| `ActivityLog` | `id`, `ticketId` (FK), `actorId` (FK → User, nullable for system events), `eventType` (enum: `Created` \| `Assigned` \| `Reassigned` \| `StatusChanged` \| `PriorityChanged` \| `Reopened` \| `ConfirmedClosed` \| `CommentAdded`), `payload` (JSON: `{ from?, to?, commentId? }`), `createdAt` | Append-only. No updates. |
| `Attachment` | `id`, `filename`, `sizeBytes`, `mimetype`, `storagePath` (relative), `uploadedById` (FK → User), `createdAt` | Storage strategy TBD (see `tech-stack.md` §Open Questions); recommend filesystem under `backend/uploads/` for MVP. |

**Migrations:**
- One migration per model (5 total).
- Indexes: `Ticket.status`, `Ticket.ownerId`, `Ticket.submitterId`, `Comment.ticketId`, `ActivityLog.ticketId`, `User.email` (unique already).

**Seeders (dev only):**
- 1 Admin (`admin@company.com`), 2 Support Agents (`sam@`, `morgan@`), 5 Employees (`eli@`, `jess@`, …)
- 20 tickets distributed: 8 Open, 5 In Progress, 3 Resolved, 4 Closed
- 2 tickets with attachments
- A handful of comments + activity log entries

**Acceptance:**
- `sequelize db:migrate:undo:all && sequelize db:migrate && sequelize db:seed:all` runs clean.
- All 5 models have TypeScript types generated via `sequelize-auto` or hand-written in `frontend/src/app/models/`.

---

### HD-003 — Auth: register / login / logout (JWT + bcrypt)

**Endpoints:**
- `POST /api/auth/login` — body: `{ email, password }`. Returns `{ token, user: { id, email, displayName, role } }`. Sets `HttpOnly` cookie containing JWT (recommended) **or** returns token for `localStorage` (open question — see tech-stack.md).
- `POST /api/auth/logout` — clears cookie / invalidates token (stateless JWT = just instruct client to drop it).
- `POST /api/auth/register` — out of MVP per `users-tab.md` (Admin manages users out-of-band); keep the route stubbed for future.
- `GET /api/auth/me` — returns current user from JWT.

**Backend middleware:**
- `authMiddleware`: verifies JWT, attaches `req.user`.
- `roleMiddleware(allowedRoles[])`: 403 if `req.user.role` not in list.
- `errorHandler`: maps Sequelize errors → 400, JWT errors → 401, role errors → 403, generic → 500.

**Frontend services:**
- `AuthService` with `login()`, `logout()`, `me()`, `isAuthenticated$` (BehaviorSubject).
- HTTP interceptor that attaches JWT (if `localStorage`) or relies on cookie.
- `roleGuard(allowedRoles)` for routes.

**Acceptance:**
- Login with seeded admin returns a valid token + role.
- Logout clears cookie / token.
- `GET /api/auth/me` returns 401 without token, user with token.

---

### HD-004 — App-header chrome + dropdown + logout dialog

**Page spec:** `design-process/D-UX-Design/header-profile-logout.md`

**Angular components (atoms/molecules):**
- `atoms/avatar` (24/32 px, initials on `#adb5bd`)
- `molecules/app-header-chrome` (renders brand mark + `MyProfileTrigger`)
- `molecules/dropdown-panel` (anchored, right-aligned)
- `molecules/dialog-modal` (scrim + headline + buttons)
- `atoms/divider`, `atoms/caret`, `atoms/badge-role`
- `patterns/app-chrome` (the persistent `<app-header-chrome>` rendering logic + brand-mark-click routing)

**Angular pages:** none — this is chrome, lives in a parent layout component.

**Endpoints:** `POST /api/auth/logout` (already in HD-003).

**Acceptance:**
- Chrome renders on every post-login page.
- Click `My Profile ▾` → dropdown opens with avatar + name + role + Logout.
- Click `Logout` → confirmation dialog opens.
- Confirm → calls `/api/auth/logout` → redirects to `/login`.
- Click brand mark → routes to role-correct Dashboard.
- Press `Esc` → dropdown/dialog closes.

---

### HD-005 — Login page (`/login`)

**Page spec:** `design-process/D-UX-Design/login.md`

**Angular components:**
- `pages/login-page` (organism)
  - Uses `atoms/button`, `atoms/input-text`, `atoms/link`, `molecules/form-field`
  - Renders brand mark + form column (400px centered on x=720)
  - Show/hide password toggle (eye icon)
  - Forgot password link (`/forgot-password` — out of MVP, route shows "coming soon" placeholder)

**Endpoints:** `POST /api/auth/login` (already in HD-003).

**Behavior:**
- Auto-focus email on load.
- Client validation: empty/invalid email → "Enter a valid email address."; empty password → "Enter your password."
- On 401 → "Email or password is incorrect. Try again."
- On 403 `account_inactive` → "Your account is inactive. Contact your administrator."
- On 429 → "Too many attempts. Try again in a few minutes."
- On success → redirect to role-correct dashboard.

**Acceptance:**
- Form submits, validation works, all error states render correctly.
- Already-logged-in users redirected to their dashboard.
- `?return_to=` query param honored after login (used by all pages on 401).

---

### HD-006 — Routing guards (auth + role-based)

**Angular guards:**
- `authGuard` — checks `AuthService.isAuthenticated$`; if false → redirect to `/login?return_to=<currentUrl>`.
- `roleGuard(allowedRoles[])` — checks `AuthService.user.role`; if not in list → render 403 Forbidden card (Employee → `/dashboard`, Support Agent → `/queue`, Admin → `/admin`).

**Route table:**

| Route | Allowed roles | Component |
|---|---|---|
| `/login` | (none — public) | LoginPage |
| `/dashboard` | `User`, `Support Agent`, `Admin` (Admin lands here only as fallback; default `/admin`) | EmployeeDashboardPage |
| `/tickets/new` | `User` | CreateTicketPage |
| `/tickets/:id/created` | `User` (and only reachable via submit flow; direct-arrival redirects to `/tickets/:id`) | SubmissionConfirmationPage |
| `/tickets/:id` | `User` (own tickets only), `Support Agent`, `Admin` | TicketDetailPage |
| `/queue` | `Support Agent` only (Admin → 403) | AgentKanbanPage |
| `/admin` | `Admin` only | AdminDashboardPage (with tab switcher) |
| `/users` | `Admin` only (but Admin navigates here from `/admin` Users tab; route still served standalone) | UsersTabPage |
| `/forgot-password` | public | Placeholder |

**Acceptance:**
- Unauthenticated user hitting `/dashboard` → redirect to `/login?return_to=/dashboard`.
- Support Agent hitting `/admin` → 403.
- Admin hitting `/queue` → 403.
- After login with `return_to`, lands on the original URL.

---

## Milestone B — Employee flow (P0)

### HD-007 — Employee Dashboard (`/dashboard`)

**Page spec:** `design-process/D-UX-Design/employee-dashboard.md`

**Angular components:**
- `pages/employee-dashboard-page` (organism)
  - `molecules/ticket-row` (mono number · title · status badge · priority badge · right-aligned timestamp)
  - `molecules/empty-state` (centered card)
  - `atoms/badge-status`, `atoms/badge-priority`
  - `patterns/loading-skeleton`, `patterns/server-error-state`

**Endpoints:**
- `GET /api/tickets?submitterId=<currentUserId>` — returns the Employee's own tickets.
- `GET /api/tickets/mine` (alias for clarity; backend filters by submitterId).

**Behavior:**
- Newest-first by `updatedAt`.
- Empty state: centered card with headline + caption + "Create Ticket" CTA.
- Loading: skeleton (heading + 5 row placeholders).
- Server error: inline error above list.
- Click row → `/tickets/:id`.

**Acceptance:**
- Seeded Employee lands here, sees their tickets newest-first.
- Empty state renders for users with zero tickets.
- Row click routes to Ticket Detail.

---

### HD-008 — Create Ticket (`/tickets/new`)

**Page spec:** `design-process/D-UX-Design/create-ticket.md`

**Angular components:**
- `pages/create-ticket-page` (organism)
  - `molecules/form-field`, `molecules/form-field-dropdown`
  - `atoms/button`, `atoms/input-text`, `atoms/textarea`, `atoms/select`
  - Custom: file-drop zone atom (dashed border, click + drag-drop, 10 MB cap)

**Endpoints:**
- `POST /api/tickets` — body: `{ title, description, category?, priority, attachmentId? }`. Returns created ticket with `number`.
- `POST /api/attachments` (multipart) — uploads file, returns `{ id, filename, sizeBytes }`. Used by HD-016.

**Behavior:**
- Defaults: Priority=Medium, Category=null (placeholder).
- Field validation per spec (Title empty → "Enter a title."; Description empty → "Describe the issue."; Description > 5000 chars → counter + error; Attachment > 10 MB → "File is larger than 10 MB…").
- Submit: 201 → navigate to `/tickets/:id/created`. Form state discarded.
- 5xx: inline error above Submit, form preserved.
- 401: redirect to `/login?return_to=/tickets/new`. Form state preserved via `sessionStorage`.
- `beforeunload` warning if Title or Description has content.

**Acceptance:**
- Happy path: Submit → land on Submission Confirmation with new ticket number.
- Validation errors render correctly.
- Session-expired round-trip preserves form.

---

### HD-009 — Submission Confirmation (`/tickets/:id/created`)

**Page spec:** `design-process/D-UX-Design/submission-confirmation.md`

**Angular components:**
- `pages/submission-confirmation-page` (organism)
  - `atoms/check-circle` (success glyph)
  - `atoms/badge-status` (Open chip)
  - `atoms/button`, `atoms/link`

**Endpoints:**
- `GET /api/tickets/:id` (reused) — fetch the ticket to confirm it exists.

**Behavior:**
- Direct-arrival (refresh, deep link) → redirect to `/tickets/:id`.
- "View ticket" → `/tickets/:id`.
- "← Back to My Tickets" → `/dashboard`.
- Click ticket number → copy to clipboard, toast.

**Acceptance:**
- Six elements render per spec.
- Direct-arrival redirects properly.

---

### HD-010 — Ticket Detail page (`/tickets/:id`) — role-aware

**Page spec:** `design-process/D-UX-Design/ticket-detail.md`

**Angular components:**
- `pages/ticket-detail-page` (organism)
  - `patterns/role-aware-action-matrix` — encodes the action matrix table; takes `(role, status)` and returns visible actions.
  - `molecules/dialog-modal` — confirmation dialogs for Reopen / Confirm close.
  - `atoms/badge-status`, `atoms/badge-priority`, `atoms/badge-role`, `atoms/avatar`
  - `molecules/form-field` (comment composer variant)

**Endpoints:**
- `GET /api/tickets/:id` — full ticket + submitter + owner + comments + activity log.
- `PATCH /api/tickets/:id` — body: `{ status?, priority?, ownerId? }`. Validates transitions per matrix server-side.
- `POST /api/tickets/:id/comments` — append comment.
- `POST /api/tickets/:id/reopen` — Employee at Resolved → Open. Adds activity log entry.
- `POST /api/tickets/:id/confirm-close` — Employee at Resolved → Closed. Adds activity log entry.

**Backend service:** `services/ticketTransitions.ts` — single source of truth for legal transitions. Called from controllers. Writes `ActivityLog` entries on every change.

**Behavior:**
- Action matrix enforced server-side **and** UI-side. Server is the source of truth; UI hides illegal buttons, but server rejects illegal requests with 403.
- Reopen / Confirm trigger confirmation dialogs.
- Composer: send on click or Enter (Shift+Enter for newline). Inline error on failure.
- Status badge colors per spec; role-border colors on comments per spec.

**Acceptance:**
- Eli sees only `[+ Comment]` at Open/In Progress.
- Eli sees `[+ Comment] [Reopen] [Confirm (close)]` at Resolved.
- Sam sees `[+ Comment] [Change status ▾] [Reassign] [Change priority ▾]` at Open/In Progress.
- Sam cannot change status at Resolved (button hidden + server 403 if attempted).
- Sam cannot transition to Closed (button never shown + server 403).
- Closed state: action zone collapses to "Closed · read-only"; composer hidden.

---

### HD-011 — Ticket comments + activity log

**Page spec:** embedded in `design-process/D-UX-Design/ticket-detail.md` § Comments / § Activity log

**Angular:**
- Comments list rendered as part of `TicketDetailPage`.
- Comment: `atoms/badge-role` + author name + relative timestamp + body + left-border in role color (3px).
- Activity log: flat list, chronological (oldest first), monospace-ish event format per spec.

**Endpoints:** `POST /api/tickets/:id/comments` (already in HD-010).

**Backend:**
- Comment write must also create an `ActivityLog` entry with `eventType=CommentAdded`.
- Comment body stored as plain text; line breaks preserved. No Markdown rendering.

**Acceptance:**
- Posting a comment appends to thread + activity log.
- Relative timestamps within 24h, absolute beyond.
- Role-border color matches author role.

---

## Milestone C — Agent + Admin flows (P1)

### HD-012 — Agent Kanban (`/queue`) + drag-and-drop

**Page spec:** `design-process/D-UX-Design/agent-kanban.md`

**Angular components:**
- `pages/agent-kanban-page` (organism)
  - `molecules/kanban-card` (title + meta row)
  - Custom: drag-and-drop directive (uses HTML5 drag events; lift shadow on hover; ghost placeholder on source; invalid-drop `#fff5f5` highlight on Closed column)

**Endpoints:**
- `GET /api/tickets?status=<status1>,<status2>...` — returns all tickets across statuses.
- `PATCH /api/tickets/:id` — same endpoint as HD-010; status changes from drag drop.

**Backend:** reuse `PATCH /api/tickets/:id` + transition validator.

**Behavior:**
- 4 columns: Open, In Progress, Resolved, Closed.
- Sort within column: oldest-first by `createdAt`; orphans pinned to top of Open with `#fff5d6` 12% tint + Unassigned badge.
- Drag validation: Open → {In Progress, Resolved}; In Progress → {Open, Resolved}; Resolved → no drag for Agent; Closed → read-only; any → Closed rejected for Agent.
- Filter strip: search box (debounced 200ms), Priority / Category / Owner dropdowns.
- Filter state in URL (`?priority=high&owner=me&q=vpn`).
- Closed column: read-only, no drag, cursor: not-allowed on hover.

**Acceptance:**
- Drag Open card → In Progress; lands; activity log entry created.
- Drag Open card onto Closed column; rejected with shake animation + invalid-drop color.
- Filters combine with AND; URL updates; refresh preserves filters.
- Orphans visible at top of Open.

---

### HD-013 — Admin Dashboard (`/admin`) — Dashboard tab

**Page spec:** `design-process/D-UX-Design/admin-dashboard.md` § Dashboard tab

**Angular components:**
- `pages/admin-dashboard-page` (organism with two tabs)
  - `molecules/tab-switcher` (Dashboard | Users)
  - `molecules/status-summary-card` (badge + count + recent tickets list)
  - URL hash for tab state: `#dashboard` (default) | `#users`

**Endpoints:**
- `GET /api/tickets/summary` — returns `{ open: {count, recent[]}, inProgress: {...}, resolved: {...}, closed: {...} }`. Closed count text uses muted color (`#868e96`).

**Behavior:**
- Click row in Open / In Progress / Resolved → `/tickets/:id`.
- Closed rows: muted, no hover, no click.
- Tab switch via hash; browser back/forward preserves tab.

**Acceptance:**
- 4 cards render with correct counts and recent tickets.
- Tab switcher works; URL hash updates.
- Direct-arrival to `/admin#users` lands on Users tab.

---

### HD-014 — Admin Dashboard (`/admin`) — Users tab + role/active controls

**Page spec:** `design-process/D-UX-Design/admin-dashboard.md` § Users tab + `design-process/D-UX-Design/users-tab.md`

**Angular components:**
- Same `admin-dashboard-page`, tab switcher swap.
  - `molecules/self-row-table` (disabled controls + micro-label)
  - `molecules/dialog-modal` (confirmation dialogs)

**Endpoints:**
- `GET /api/users` — returns all users sorted alphabetically by last name, then first name.
- `PATCH /api/users/:id/role` — body: `{ role }`. Returns updated user.
- `PATCH /api/users/:id/status` — body: `{ isActive }`. Returns updated user.

**Behavior:**
- Self-row: role dropdown + active toggle disabled; micro-label below row.
- Role change Admin → Support Agent / User: confirmation dialog.
- Active toggle targeting Admin: confirmation dialog.
- Other role / active changes: immediate.

**Acceptance:**
- Alphabetical sort renders correctly.
- Self-row controls disabled.
- Confirmation dialogs trigger correctly.
- On 5xx, control reverts + inline error.

---

### HD-015 — Tickets API: filters, search (deeper filter persistence)

**Backend:**
- `GET /api/tickets?priority=&category=&owner=&submitterId=&status=&q=` — combined filters; AND across filter types.
- Search (`q`) does case-insensitive substring match on `number`, `title`, submitter's `displayName`.

**Frontend:**
- `services/ticket.service.ts` with a single `list(filters)` method that builds query string.
- Agent Kanban filter strip (already covered in HD-012) consumes this.

**Acceptance:**
- Combined filters return correct subset.
- Search debounced 200ms on frontend.
- Empty result set renders column-scoped "No tickets match your filters."

---

### HD-016 — Attachments

**Page spec:** `design-process/D-UX-Design/create-ticket.md` § Attachment field; `design-process/D-UX-Design/ticket-detail.md` § Attachment display

**Backend:**
- `POST /api/attachments` — multipart, accepts single file ≤ 10 MB. Stores to `backend/uploads/<id>-<filename>`. Returns `{ id, filename, sizeBytes, mimetype }`.
- `GET /api/attachments/:id` — streams file back with correct `Content-Type`. Auth required.

**Frontend:**
- Drop zone atom (dashed border, drag + click).
- On submit: upload attachment first → get `attachmentId` → POST `/api/tickets` with `attachmentId`.
- Ticket Detail header: shows attachment file name + size + download link when present.

**Storage decision:** filesystem for MVP (see tech-stack.md §Open Questions). Mimir to wrap in an `AttachmentStorageService` so S3 can be swapped in v1.x.

**Acceptance:**
- Upload ≤ 10 MB succeeds; file retrievable via `/api/attachments/:id` after auth.
- Upload > 10 MB rejected with "File is larger than 10 MB…"
- Attachment shows on Ticket Detail with download link.

---

## Dependency Order

```
HD-001 (scaffolding)
  └─> HD-002 (models + migrations)
        ├─> HD-003 (auth) ──> HD-004 (chrome) ──┐
        │                                    ├─> HD-005 (login page)
        │                                    └─> HD-006 (route guards)
        │                                          └─> HD-007 (employee dashboard)
        │                                                └─> HD-008 (create ticket) ──> HD-009 (submission confirmation)
        │                                                       └─> HD-016 (attachments)
        │                                          └─> HD-010 (ticket detail) ──> HD-011 (comments + activity log)
        │                                                                         ├─> HD-012 (agent kanban)
        │                                                                         └─> HD-013 (admin dashboard — Dashboard tab)
        │                                                                                └─> HD-014 (admin dashboard — Users tab)
        └─> HD-015 (tickets API: filters / search) — supports HD-012 + HD-013
```

**Build order:** HD-001 → HD-002 → HD-003 → HD-004 → HD-005 → HD-006 → HD-007 → HD-008 → HD-009 → HD-010 → HD-011 → HD-012 → HD-013 → HD-014 → HD-015 → HD-016.

P0 stories (HD-001 through HD-011) form a working app. P1 stories (HD-012 through HD-014) round it out to the full MVP. HD-015 + HD-016 are hardening / supporting work that can land at any time after HD-010.

---

## Cross-Cutting Concerns

### Role-aware action matrix

The single most important shared concept. Encoded:
- **Backend:** `services/ticketTransitions.ts` — `canTransition(role, fromStatus, toStatus)` and `getLegalActions(role, status)`.
- **Frontend:** `patterns/role-aware-action-matrix` — pure function `(role, status) → Action[]`.

Both must agree; the backend is the source of truth. **Mimir should write the matrix as a single data structure** (e.g., a const object) that both ends import from, or at minimum keep them in lockstep with a test.

### Activity log

Every state change writes an `ActivityLog` row. Activity log entries are append-only. The `eventType` enum is shared between backend and frontend for filterability and rendering.

### Visual tokens

`design-process/E-Design-System/01-design-tokens.md` is the source. **Frontend must consume tokens as CSS custom properties** (`:root { --color-primary: #212529; ... }`) defined once in `frontend/src/styles.css`. **Backend doesn't render UI** but should not embed any UI constants.

### Out of MVP (do NOT build)

Per `design-process/E-Design-System/00-design-system.md`:
- Figma library export
- Interactive HTML showcase
- Dark mode
- Email notifications
- Profile picture upload
- Editable profile fields in-app
- Active sessions list
- Notification preferences
- Live updates / websockets
- Users tab search/sort/filter (alphabetical only)
- Pagination / infinite scroll
- Touch / mobile drag
- Keyboard shortcuts (J/K, c, r, e)
- Attachment MIME whitelist
- Description Markdown / rich text
- Auto-save on blur
- Admin Dashboard card status-filter drill-down
- Admin Dashboard card "Show all N →" expansion
- Admin Dashboard Closed card date-range filter
- Kanban column-collapse
- Kanban saved filter presets
- SSO (deferred to first-team deployment)

---

## Definition of Done (per story)

- All acceptance criteria above pass.
- TypeScript compiles with `--strict` (no `any` except where documented).
- Backend: at least one Jest test for the controller endpoint + any service-layer logic (especially `ticketTransitions`).
- Frontend: at least one component test for the page or molecule; smoke test that the route loads.
- No console errors in dev mode.
- Story ID cited in the commit message (e.g., `HD-008: validate 120-char title cap`).

---

## Open Questions for Mimir (resolve before or during HD-001)

From `design-process/F-Tech-Stack/tech-stack.md`:
1. **JWT storage** — `httpOnly cookie` recommended (internal tool, security > convenience). Decide before HD-003.
2. **Attachment storage** — filesystem for MVP; wrap in `AttachmentStorageService` interface.
3. **Sequelize CLI** — confirmed.
4. **CORS** — `cors` middleware, allowlist `http://localhost:4200` for dev.
5. **Testing** — Jest for both. Angular default Karma may suffice for component tests; Mimir to choose.

---

_Locked by: Salekinnewaz, 2026-09-15_
_Source: design-process/D-UX-Design/ (9 page specs), design-process/E-Design-System/ (atoms/molecules/organisms/patterns/tokens), design-process/F-Tech-Stack/tech-stack.md (stack lock), design-process/A-Product-Brief/product-brief.md (MVP scope)._
