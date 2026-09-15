# Design Log

**Project:** HelpDesk Lite
**Started:** 2026-09-14
**Method:** Whiteport Design Studio (WDS)

---

## Backlog

> Business-value items. Add links to detail files if needed.

- [x] Complete product brief — Phase 1
  - [x] Vision
  - [x] Positioning
  - [x] Business model
  - [x] Business customers (skipped — internal tool, no external buyer)
  - [x] Target users (Employee, Support Agent, Admin-as-overlay)
- [x] Product concept (founding principle: ticket-as-atomic-unit; Resolved↔Open loop, Closed terminal)
- [x] Success criteria (Adoption ≥80%, Resolution <2 days, Reopen <15%, Satisfaction ≥85%)
- [x] Competitive landscape (Slack/DM = trust gap; enterprise ITSM = scale mismatch; greenfield origin)
- [x] Constraints (capacity, time-to-useful, stack fixed; deferred: data, deployment, SSO)
- [x] Define trigger map — Phase 2
- [x] Create user scenarios — Phase 3
- [x] Run UX Design — Phase 4 (complete; 9 page specs + 9 wireframes approved)
  - [x] Login
  - [x] Ticket Detail View (role-aware)
  - [x] Submission Confirmation
  - [x] Create Ticket
  - [x] Employee Dashboard (My Tickets)
  - [x] Agent Dashboard (Kanban)
  - [x] Users tab (Admin overlay)
  - [x] Header / My Profile / Logout
  - [x] Admin Dashboard (`/admin` — two tabs)
- [x] Extract Design System — Phase 5 (complete; 13 atoms + 11 molecules + 6 organisms + 7 patterns + tokens + index + README)
- [ ] Hand off to Mimir — Phase 6 (not started; design system is the handoff contract)

---

## Current

| Task | Started | Agent |
|------|---------|-------|
| UX Design — Login (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Ticket Detail View (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Submission Confirmation (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Create Ticket (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Employee Dashboard (My Tickets) (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Agent Kanban Dashboard (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Users tab (spec + wireframe approved, tokens synced) | 2026-09-14 | Freya |
| UX Design — Header / My Profile / Logout (spec + wireframe approved, tokens synced, retro-updates applied to 6 other wires) | 2026-09-14 | Freya |
| Design System extraction — Phase 5 (37 component docs + tokens + index + README + retro cross-refs) | 2026-09-14 | Freya |

**Rules:** Mark what you start. Complete it when done (move to Log). One task at a time per agent.

---

## Design Loop Status

> Per-page design progress. Updated by agents at every design transition.

**Status legend:** `○` not started · `S` speccing · `S✓` spec approved · `W` wireframed · `✓` approved · `✓S` spec synced · `B` building · `B✓` built · `R` reviewed · `T` tokens extracted

| Scenario | Page | Status | Updated |
|----------|------|--------|---------|
| Both | Login | ✓S | 2026-09-14 |
| Both | Ticket Detail View | ✓S | 2026-09-14 |
| Eli | Submission Confirmation | ✓S | 2026-09-14 |
| Eli | Create Ticket | ✓S | 2026-09-14 |
| Eli | Employee Dashboard (My Tickets) | ✓S | 2026-09-14 |
| Sam | Agent Kanban Dashboard | ✓S | 2026-09-14 |
| Admin | Users tab | ✓S | 2026-09-14 |
| Both | Header / My Profile / Logout | ✓S | 2026-09-14 |
| Admin | Admin Dashboard (/admin, two tabs) | ✓S | 2026-09-14 |

**Status values:** `discussed` → `wireframed` → `specified` → `explored` → `building` → `built` → `approved` | `removed`

**How to use:**
- **Append a row** when a page reaches a new status (do not overwrite — latest row per page is current status)
- **Read on startup** to see where the project stands and what to suggest next



### 2026-09-14 — Project initialized (Phase 0)
- Type: greenfield
- Complexity: Small (MVP, 5–20 users, 3 entities, 2 roles)
- Tech stack: TBD — internal web app; PRD/brief do not lock a stack

### 2026-09-14 — Product Brief completed (Phase 1)
- WDS-native brief written at `design-process/A-Product-Brief/product-brief.md`
- Discovery covered all 9 categories (business-customers skipped: internal tool, no external buyer)
- No extensions produced (no brand-voice / SEO / visual-direction signals during discovery; existing BMAD UX artifacts retained as visual source)
- Output folder: `design-process/A-Product-Brief/`

### 2026-09-14 — Trigger Map completed (Phase 2)
- Vision: company known for clear, reliable, accountable support without process overhead
- 3 business goals (G1 queue runs itself — primary; G2 one obvious front door; G3 every ticket has an owner) with 3 SMART objectives each; measurement window 90 days for adoption/satisfaction, 6 months for resolution/quality/queue hygiene
- 2 personas built (Admin = permission overlay on Agent, not separate archetype):
  - Sam the Support Agent (priority 02, primary) — 7 driving forces, top 15
  - Eli the End-User (priority 03, secondary) — 6 driving forces, top 14
- Alliterative naming rule applied (Sam/Support Agent, Eli/End-User)
- Poster: `design-process/B-Trigger-Map/00-trigger-map.md`
- Feature Impact: `design-process/B-Trigger-Map/feature-impact.md` (math verified)
- Top 5 features by weighted impact: Agent Kanban board (12.27), Ticket detail view (12.13), Owner field on every card (9.73), Status transition control (7.00), Comment thread per ticket (5.67)
- Strategic center of gravity: "no silent tickets, no Slack fallbacks" — adoption (G2) measured at 90 days

### 2026-09-14 — UX Scenarios completed (Phase 3)
- 2 scenarios written; 9 screens across 5 unique surfaces (Login, Employee Dashboard, Create Ticket, Submission Confirmation, Agent Kanban Dashboard, Ticket Detail View); status transition and reassign are interactions on existing screens
- Ticket Detail View is one role-aware shared page with state-dependent actions (Employee Open/InProgress: Add comment; Employee Resolved: + Reopen, + Confirm; Employee Closed: read-only; Agent any non-Closed: Add comment, Change status, Reassign, Change priority; Agent Closed: read-only; Admin = Agent + Users tab)
- Closed is terminal; only Eli (Employee) confirms Resolved → Closed; Sam cannot close
- Kanban defaults: oldest-first within columns, orphans pinned to top of Open with "Unassigned" badge, drag-and-drop for status, all-tickets view with "Mine" filter
- Attachment on Create Ticket added back to MVP during scenario walk (initially deprioritized in feature impact; feature-impact file updated)
- Login = email + password, no SSO (deferred to first-team deployment)
- Header elements (My Profile, Logout) on every post-login screen, shared across roles
- Index: `design-process/C-UX-Scenarios/00-ux-scenarios.md`
- Ready for UX Design (`/UX`)

### 2026-09-14 — UX Design: Login spec + wireframe approved (Phase 4, page 1 of 8)
- Spec: `design-process/D-UX-Design/login.md` (route `/login`, both scenarios)
- Wireframe: `design-process/D-UX-Design/wireframes/login.svg` + `.png` (1440×900)
- Visual vocabulary established: page bg `#f8f9fa`, surface `#fff`, primary `#212529`, label `#495057`, muted `#868e96`, border `#adb5bd` / `#dee2e6`. Form column 400px centered on x=720. Field 44px/4px radius, button 48px/6px radius, type stack `-apple-system…`. Tokens synced into spec under "Visual Tokens (extracted from approved wireframe)".
- Brand-mark group centered using measured wordmark width (144.54px at 22px HelveticaNeue-Bold) rather than assumed 168px — logomark x=621.73, wordmark x=673.73.
- PNG rendering note: `qlmanage -s 1440` squares the thumbnail to the longest dimension regardless of SVG viewBox; rendered via NSImage/CGContext at exact 1440×900 to honor the viewBox.
- Status: Login → ✓S (spec approved, wireframe approved, tokens synced). Next page: Ticket Detail View (role-aware, 6 states).
- Handoff correction: Mimir (Phase 6) consumes the full Phase-4 spec set + Phase-5 design system; per-page "Work Orders" are not a WDS convention. Continuing the design loop page-by-page.

### 2026-09-14 — UX Design: Ticket Detail View spec + wireframe approved (Phase 4, page 2 of 8)
- Spec: `design-process/D-UX-Design/ticket-detail.md` (route `/tickets/:id`)
- Wireframe: `design-process/D-UX-Design/wireframes/ticket-detail.svg` + `.png` (1440×900, Employee at Open canonical frame)
- Decisions locked: actions inline in header (right of badges); Closed state → "Closed · read-only" indicator (action zone collapses); Comments + Activity log single column (Description → Comments → Activity log); composer inline at bottom of Comments.
- Action matrix codified (9 cells × 2 roles = 18 cells resolved): Employee cannot change status at all; Agent cannot transition to Closed; Closed is terminal; Admin = Agent experience; only difference between Agent and Admin in this app is the Users tab on the Dashboard.
- New tokens introduced on this page (will propagate to Kanban + Employee Dashboard): 4 status badge colors, 3 priority badge colors, 2 role-border colors, content column 880px @ x=720, app-header chrome strip 64px, comment left-border 3px.
- Status: Ticket Detail View → ✓S. Next page: Submission Confirmation.

### 2026-09-14 — UX Design: Submission Confirmation spec + wireframe approved (Phase 4, page 3 of 8)
- Spec: `design-process/D-UX-Design/submission-confirmation.md` (route `/tickets/:id/created`)
- Wireframe: `design-process/D-UX-Design/wireframes/submission-confirmation.svg` + `.png` (1440×900, Default frame only)
- Decisions locked: dominant visual = green check + "Ticket created" + ticket number + Open chip, stacked; primary CTA "View ticket" routes to `/tickets/:id`; secondary "← Back to My Tickets" routes to `/dashboard`; no other content (no celebration, no timeline, no email confirmation copy, no share-with-team).
- Lifecycle: only reachable via Create Ticket submit. Direct-arrival (refresh / deep link) should redirect to Ticket Detail.
- No new tokens introduced; reuses Login + Ticket Detail palette.
- Status: Submission Confirmation → ✓S. Next page: Create Ticket.

### 2026-09-14 — UX Design: Create Ticket spec + wireframe approved (Phase 4, page 4 of 8)
- Spec: `design-process/D-UX-Design/create-ticket.md` (route `/tickets/new`)
- Wireframe: `design-process/D-UX-Design/wireframes/create-ticket.svg` + `.png` (1440×900, Default empty frame)
- Decisions locked: 720px form column (centered on x=720); "← Back to My Tickets" + "New ticket" heading; field order Title → Description → Category → Priority → Attachment → Submit; defaults Priority=Medium, Category=Select category… placeholder; (required) / (optional) micro-labels.
- Tokens: all inherited from Login + Ticket Detail — no new tokens introduced on this page. Field height 44px, field radius 4px, submit button 48px/6px, dashed attachment drop zone.
- Validation surface: 7 states (Default empty · Partially filled · Validating · Submitting · Server error · Attachment over-cap · Session expired). Submit lifecycle incl. cancel-still-enabled during in-flight.
- Drag-and-drop on attachment accepted (per dashboard discussion) — dashed zone UX implies it.
- Status: Create Ticket → ✓S. Next page: Employee Dashboard (My Tickets).

### 2026-09-14 — UX Design: Employee Dashboard spec + wireframe approved (Phase 4, page 5 of 8)
- Spec: `design-process/D-UX-Design/employee-dashboard.md` (route `/dashboard`)
- Wireframe: `design-process/D-UX-Design/wireframes/employee-dashboard.svg` + `.png` (1440×900, Default with-tickets frame, 5 rows)
- Decisions locked: centered CTA empty state ("No tickets yet" + Create Ticket); no search, no filter, no sort control (newest-first only); single Create Ticket button top-right; row = mono number + title + status pill + priority pill + right-aligned timestamp; entire row clickable to Ticket Detail.
- Row height 64px; row stride 64px; bottom border only.
- Tokens: all inherited — no new tokens introduced.
- Status: Employee Dashboard → ✓S. Next page: Agent Kanban Dashboard (Sam's command center).

### 2026-09-14 — UX Design: Agent Kanban Dashboard spec + wireframe approved (Phase 4, page 6 of 8)
- Spec: `design-process/D-UX-Design/agent-kanban.md` (route `/queue`)
- Wireframe: `design-process/D-UX-Design/wireframes/agent-kanban.svg` + `.png` (1440×900, Default loaded Agent view, 4 columns × ~3 cards each)
- Decisions locked: compact card (title + meta row); whole-card drag affordance; single horizontal filter strip (search + Priority + Category + Owner); 4 columns × 320px; orphans pinned to top of Open with warm tint + Unassigned badge; Closed is read-only.
- Drag validation rules codified (Open ↔ In Progress → Resolved; Closed read-only; Resolved no drag for Agent). Invalid-drop rejection color `#fff5f5`.
- Tokens introduced: card lift shadow `0 4px 8px rgba(33,37,41,0.08)`; orphan tint `#fff5d6` 12%; invalid-drop bg `#fff5f5`. All others inherited.
- Status: Agent Kanban → ✓S. Next page: Users tab (Admin overlay).

### 2026-09-14 — UX Design: Users tab spec + wireframe approved (Phase 4, page 7 of 8)
- Spec: `design-process/D-UX-Design/users-tab.md` (route `/users`)
- Wireframe: `design-process/D-UX-Design/wireframes/users-tab.svg` + `.png` (1440×900, 8 representative users with self-row highlighted)
- Decisions locked: alphabetical sort by last name; self-row controls disabled with micro-label (last-admin foot-gun prevention); inline role dropdown + active toggle (no separate Edit page); confirmation dialogs for Admin demotion and Admin deactivation only.
- Tab switcher (Queue inactive / Users active) introduced as the admin-chrome vocabulary — one-click return to Queue from Users tab without using the browser back button.
- Tokens introduced: active-green `#2b8a3e` for Active indicator; self-row bg `#f8f9fa` (page surface) + left border `#212529` 3px; disabled text `#adb5bd` reused.
- Status: Users tab → ✓S. Next page: Header / My Profile / Logout.

### 2026-09-14 — UX Design: Header / My Profile / Logout spec + wireframe approved (Phase 4, page 8 of 8 — complete)
- Spec: `design-process/D-UX-Design/header-profile-logout.md` (shared chrome + My Profile dropdown panel + Logout confirmation dialog)
- Wireframe: `design-process/D-UX-Design/wireframes/header-profile-logout.svg` + `.png` (1440×900, default chrome with dropdown overlay + logout dialog state)
- Decisions locked: single right-side `My Profile ▾` trigger (replaces static `My Profile + Logout` pair); dropdown panel 240px right-aligned containing avatar (32px) + display name + role badge + divider + Logout action; Logout inside dropdown protected by confirmation dialog "Log out of HelpDesk Lite?" with Cancel + Log out; brand mark click → role-correct dashboard.
- Tokens introduced: dropdown shadow `0 4px 12px rgba(33,37,41,0.12)`; dialog scrim `rgba(33,37,41,0.4)`; focus ring `#4263eb` 2px (focus-visible only, consistent with Support Agent role-border); role badge inside dropdown uses `#edf2ff` bg / `#4263eb` border+text.
- **Retro-update applied to 6 previously-rendered post-login wireframes** per spec migration notes: removed static `Logout` text link at x=1364; added `▾` caret polyline at x=1372..1388 right of `My Profile` text at x=1280. Affected: ticket-detail, submission-confirmation, create-ticket, employee-dashboard, agent-kanban, users-tab (the new header-profile-logout wireframe already uses the new pattern). All 6 SVGs edited + re-rendered to PNG.
- **Phase 4 (UX Design) complete:** all 8 pages ✓S, plus Admin variant of Agent Kanban (Users-tab overlay). Phase 5 (Design System) is the next step; the Phase 4 spec set + the consolidated visual token table feed Phase 5.

### 2026-09-14 — UX Design: Agent Kanban — Admin variant added (Phase 4 follow-up)
- Companion spec: `design-process/D-UX-Design/admin-kanban.md` (Admin = permission overlay on Agent; Users tab is the only added affordance)
- Wireframe: `design-process/D-UX-Design/wireframes/admin-kanban.svg` + `.png` — identical to `agent-kanban` except `Users` tab visible in heading row at x=1320, y=108.
- Status: Admin variant → ✓S. Phase 4 complete.

### 2026-09-14 — UX Design: Admin re-architected as a distinct surface (Phase 4 follow-up)
- Spec: `design-process/D-UX-Design/admin-dashboard.md` (route `/admin`, two tabs: Dashboard | Users)
- Wireframes: `design-process/D-UX-Design/wireframes/admin-dashboard.svg` + `.png` (Dashboard tab active, 4 status summary cards) and `admin-dashboard-users-tab.svg` + `.png` (Users tab active, sanity-check).
- **Re-architecture:** Admin is no longer a permission overlay on Agent. Admin now has a dedicated home at `/admin` with two tabs. The Admin Dashboard tab is a *cross-status summary view* — 4 cards (Open / In Progress / Resolved / Closed) with counts and recent tickets. The Users tab is the same role/active management surface as `/users`.
- The Kanban (`/queue`) is now **Support-Agent-only**. Admin direct-arrival to `/queue` returns 403. The Users tab on the Agent Kanban is gone. The Agent Kanban spec was updated: removed Users-tab section, added an "Admin role and this page" note explaining the new boundary.
- The `/users` page lost its own `Queue | Users` tab switcher (no longer relevant — Admin bounces between Dashboard and Users via the tab switcher on `/admin` itself). Updated `users-tab.svg` + `.png` to remove the switcher; updated `users-tab.md` accordingly.
- The prior `admin-kanban.md` + `wireframes/admin-kanban.{svg,png}` are deleted (no longer relevant — Admin doesn't use the Kanban).
- Status: Admin Dashboard → ✓S. Phase 4 complete.

### 2026-09-14 — Design System extraction (Phase 5 — complete)
- Output folder: `design-process/E-Design-System/`
- 39 documentation files total:
  - `00-design-system.md` — index, scope, how to read, handoff-ready checklist.
  - `01-design-tokens.md` — consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring).
  - `02-atoms/` (13 files): button, input-text, textarea, select, label, badge-status, badge-priority, badge-role, avatar, link, divider, check-circle, caret.
  - `03-molecules/` (11 files): form-field, form-field-dropdown, ticket-row, kanban-card, status-summary-card, self-row-table, app-header-chrome, tab-switcher, dropdown-panel, dialog-modal, empty-state.
  - `04-organisms/` (6 files): login-form, ticket-detail-page, kanban-board, admin-dashboard-page, users-table-page, create-ticket-form.
  - `05-patterns/` (7 files): app-chrome, confirmation-dialog, role-aware-action-matrix, empty-state, loading-skeleton, server-error-state, inline-error.
  - `README.md` — handoff quick-start: source-of-truth map, MVP vs deferred, handoff-ready checklist.
- **Cross-references:** added a one-line `## Design System Reference` section above `## Open Questions` in each of the 9 Phase 4 specs (login, ticket-detail, submission-confirmation, create-ticket, employee-dashboard, agent-kanban, admin-dashboard, users-tab, header-profile-logout), pointing to `01-design-tokens.md`. In-spec token tables preserved (still useful in context).
- **Phase 5 is documentation-only** — no new visual design or wireframes. The 9 Phase 4 specs + 9 wireframes remain the canonical visual reference; Phase 5 reorganizes the work into atomic design tiers for Mimir (Phase 6) handoff.
- **Out of scope (deferred to v1.x or beyond):** Figma library export, dark mode, interactive HTML component showcase, profile picture upload, email notifications, editable profile fields, live updates, search/sort/filter on Users tab, pagination, touch / mobile drag, keyboard shortcuts, MIME whitelist, Description Markdown, auto-save, status-filter drill-down on Admin cards, "Show all N →" expansion, date-range filter on Closed card, column-collapse on Kanban, saved filter presets.
- Status: Phase 5 (Design System) → complete. Phase 6 (Mimir handoff) ready.

### 2026-09-15 — Tech stack locked (Phase 6 preparation)
- Frontend: **Angular 17+ standalone components + plain CSS** (no UI library — wireframes define visual vocabulary)
- Backend: **Node.js + Express**
- Database: **MySQL** via **Sequelize ORM**
- Auth: **JWT (short-lived) + bcrypt** — email + password, no SSO (matches Phase 4 login.md)
- Component mapping: WDS Phase 5 atomic design tiers (atoms/molecules/organisms) → 1:1 Angular components
- Recorded in `_progress/wds-project-outline.yaml` under `stack:` block; `6_mimir_handoff: ready`
- Stack rationale doc: `design-process/F-Tech-Stack/tech-stack.md`
- **Open questions for Mimir (Phase 6):**
  1. Database schema (users, tickets, comments, activity_log) — Mimir to design from the 9 Phase 4 specs
  2. JWT storage: `localStorage` vs `httpOnly cookie` (security trade-off; needs decision before auth implementation)
  3. Attachment storage strategy: filesystem path, S3-compatible, or MySQL BLOB? (deferred per Phase 5; affects Create Ticket organism)
  4. Project root layout: monorepo (single repo, `frontend/` + `backend/`) vs two repos
  5. Routing: Angular Router routes confirmed (`/login`, `/dashboard`, `/tickets/new`, `/tickets/:id`, `/tickets/:id/created`, `/queue`, `/admin`, `/users`) — Mimir to wire these

### 2026-09-15 — Phase 6 kickoff brief written
- File: `design-process/G-Mimir-Handoff/phase-6-kickoff.md`
- 16 user stories (HD-001 … HD-016) mapped to Angular routes, Express endpoints, and Sequelize models
- **Milestone A (Foundation, P0):** HD-001 scaffolding → HD-002 models → HD-003 auth → HD-004 chrome → HD-005 login → HD-006 route guards
- **Milestone B (Employee flow, P0):** HD-007 dashboard → HD-008 create ticket → HD-009 submission confirmation → HD-010 ticket detail → HD-011 comments + activity log
- **Milestone C (Agent + Admin, P1):** HD-012 kanban + drag-drop → HD-013 admin Dashboard tab → HD-014 admin Users tab → HD-015 tickets API filters → HD-016 attachments
- 5 Sequelize models specified: `User`, `Ticket`, `Comment`, `ActivityLog`, `Attachment`
- Role-aware action matrix called out as a single source of truth (shared between backend service + frontend pattern)
- Out-of-MVP items re-listed from Phase 5 to prevent scope creep

### 2026-09-15 — HD-001 scaffolding complete (Phase 6 / Milestone A / Story 1 of 16)
- **Monorepo root** (`package.json` with npm workspaces; `concurrently` dev script; expanded `.gitignore`; `.env.example`; `docker-compose.yml`; `README.md`).
- **MySQL 8 container** via `mysql:8` (image is actually 8.4.11); healthcheck passes; credentials match `.env.example`.
  - Fixed on first run: the deprecated `--default-authentication-plugin=caching_sha2_password` argument was rejected by MySQL 8.4 (variable removed); removed.
- **Frontend** (`frontend/`) — Angular 17.3 LTS, standalone components, strict TypeScript, plain CSS, no UI library. `app.routes.ts` lazy-loads 9 page placeholders; `styles.css` seeds the design-system tokens as CSS custom properties mirroring `design-process/E-Design-System/01-design-tokens.md`.
- **Backend** (`backend/`) — Express + TypeScript + Sequelize; tsconfig strict mode; tsx for dev; jest configured (no tests yet); `.sequelizerc` points to `src/{models,migrations,seeders,config}`; one bootstrap migration (`src/migrations/20260915000000-bootstrap-connection.js`) confirms the DB connection.
  - Fixed on first run: migration parameter names used TS-style `_ Sequelize` (underscore + space) which is invalid JS; renamed to `_Sequelize`.
- **Smoke tests passed:**
  - `npm install` clean (288 packages at root)
  - `npm run docker:up` → MySQL 8.4.11 healthy in ~10s
  - `npm run db:migrate` → bootstrap migration applied in 0.011s
  - Backend `GET /api/health` → `200 OK` with `{status, service, timestamp}` JSON; CORS preflight `OPTIONS` → `204` with correct `Access-Control-Allow-Origin: http://localhost:4200` and `Access-Control-Allow-Credentials: true`
  - `npm run typecheck` (backend) → `tsc --noEmit` exits 0
  - `npm run dev:frontend` → Angular builds in ~1s, 9 lazy chunks emitted, index.html serves with `<title>HelpDesk Lite</title>` and the design tokens loaded from `styles.css`
  - SPA routes (`/tickets/HD-47`, `/admin`, `/unknown`) all return `200 OK` via Angular's dev-server fallback
  - Bootstrap migration rolled back at the end of smoke tests to leave a clean DB for HD-002
- **Scripts** (root `package.json`): `dev`, `dev:backend`, `dev:frontend`, `build`, `build:backend`, `build:frontend`, `db:migrate`, `db:migrate:undo`, `db:migrate:undo:all`, `db:seed`, `db:reset`, `typecheck`, `test`, `docker:up`, `docker:down`, `docker:logs`, `docker:ps`.
- **Status:** HD-001 done. Next story: HD-002 (User + Ticket + Comment + ActivityLog + Attachment models + migrations + seeders).

### 2026-09-15 — HD-002 data layer complete (Phase 6 / Milestone A / Story 2 of 16)
- **6 Sequelize migrations** under `backend/src/migrations/` (CommonJS, sequelize-cli-loadable):
  - `20260915000001-create-users.js` — ENUM role (`User` | `Support Agent` | `Admin`), bcrypt password_hash, is_active, last_active_at; unique email; indexes on role + is_active.
  - `20260915000002-create-counters.js` — internal `name`/`value` row store (PK = name); currently one row: `('ticket_number', 40)` after seeding.
  - `20260915000003-create-attachments.js` — filename / size_bytes / mimetype / storage_path / uploaded_by_id; FK to users (RESTRICT on delete).
  - `20260915000004-create-tickets.js` — soft-delete (deleted_at, paranoid mode), status / priority / category ENUMs, submitter_id (RESTRICT) + owner_id (SET NULL) + attachment_id (SET NULL); unique `number`; indexes on status / priority / submitter / owner / attachment / deleted_at.
  - `20260915000005-create-comments.js` — no updated_at (immutable past MVP); FKs to tickets (CASCADE) + users (RESTRICT).
  - `20260915000006-create-activity-logs.js` — append-only event stream; nullable actor_id (system events); JSON payload; FKs to tickets (CASCADE) + users (SET NULL); composite index `(ticket_id, created_at)`.
  - All migrations use `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` per locked tech-stack.
- **6 Sequelize TypeScript models** under `backend/src/models/`:
  - `User.ts` — `defaultScope` excludes `passwordHash`; companion `withPassword` scope available; underscored column mapping.
  - `Ticket.ts` — `paranoid: true` (deletedAt); typed ENUM unions; `underscored: true`.
  - `Comment.ts` — `timestamps: false` (immutable).
  - `ActivityLog.ts` — `timestamps: false`; payload typed as `unknown` (narrowed per eventType via the exported `ActivityEventPayload` discriminated union).
  - `Attachment.ts` — `timestamps: false` (only createdAt).
  - `Counter.ts` — `timestamps: false`; composite PK on `name`.
  - `models/index.ts` — registers every model on the shared sequelize instance and wires 13 associations in one `defineAssociations()` function. Exports the `ActivityEventPayload` discriminated union (8 variants: Created, Assigned, Reassigned, StatusChanged, PriorityChanged, Reopened, ConfirmedClosed, CommentAdded) so backend services can emit narrow, type-safe payloads.
- **Side-effect import** — `backend/src/config/database.ts` now imports `'../models'` so every consumer of the runtime sequelize instance has model + association metadata populated automatically.
- **Ticket number utility** — `backend/src/utils/ticketNumber.ts` exports `nextTicketNumber(tx?)` (reads Counter with `FOR UPDATE` lock inside the caller's transaction, increments, formats as `HD-<n>`) and `formatTicketNumber(n)`. The seeder uses the same helper pattern via raw SQL `FOR UPDATE`.
- **Dev seeder** — `backend/src/seeders/20260915000000-demo-data.js`:
  - Idempotent: wipes all 6 tables (reverse-dep order: activity_logs → comments → tickets → attachments → counters → users) before inserting, all inside one transaction.
  - bcrypt cost 10, single hash shared by all 8 seeded users. Dev password: `password123`.
  - **8 users:** Avery Patel (Admin), Sam Chen + Morgan Lee (Support Agent), Eli Tanaka / Jess Park / Noor Hassan / Priya Singh (User, active), Tomas Rivera (User, **is_active=false** for the Users-tab micro-label).
  - **Counter:** `('ticket_number', 40)` after insert (seeded at 20, incremented to 40 across the 20 tickets).
  - **2 attachments:** `vpn-error-screenshot.png` (image/png, 184320 bytes) + `expense-report-q3.pdf` (application/pdf, 524288 bytes) — `storage_path` points at placeholder files; the actual upload pipeline lands in HD-016.
  - **20 tickets:** distributed exactly per kickoff brief — 8 Open (3 with owner, 2 unassigned including ticket 1; mix of categories + priorities) / 5 In Progress / 4 Resolved / 3 Closed. Mix of submitter across Avery/Eli/Jess/Noah/Priya.
  - **6 comments:** distributed across 5 tickets (HD-9 Wi-Fi, HD-10 expense × 2, HD-16 2FA, HD-17 A/V, HD-19 badges); mix of Employee + Support Agent authors.
  - **54 activity log entries:** 20 `Created` (one per ticket) + 12 `Assigned` (every non-Open ticket that has an owner) + 12 `StatusChanged` (5 In Progress transitions + 4 Resolved transitions + 3 Closed transitions) + 4 `ConfirmedClosed` (one per Resolved ticket) + 6 `CommentAdded` (one per comment). All payloads are JSON-stringified `ActivityEventPayload` variants.
  - **Fixes during implementation:** (a) `wipe` helper originally passed the `tx` handle where it expected `queryInterface` — `bulkDelete` lives on the latter; (b) comment/activity-log specs initially hardcoded ticket numbers like `HD-9` but the counter starts at 20 so inserts land at `HD-21..HD-40` — switched to 1-based ticket-spec positions via a `ticketIdByPosition(pos)` helper.
- **Frontend TypeScript interfaces** — 7 files under `frontend/src/app/models/` (no runtime code):
  - `enums.ts` — `UserRole`, `TicketStatus`, `TicketPriority`, `TicketCategory`, `ActivityEventType` (mirrors MySQL ENUMs exactly; UI renders `User` as "Employee").
  - `user.ts` — `UserPublic` (no `passwordHash`).
  - `ticket.ts` — `Ticket` with nested `submitter` (required), `owner` (nullable), `attachment` (nullable).
  - `comment.ts` — `Comment` with nested `author`.
  - `activity-log.ts` — `ActivityLog` with nested `actor` (nullable) and a `ActivityEventPayload` discriminated union (8 variants, not `any`).
  - `attachment.ts` — `Attachment` with nested `uploadedBy`.
  - `ticket-number.ts` — `formatTicketNumber(n)` → `"HD-<n>"`; `parseTicketNumber(value)` → number | null.
  - `index.ts` — barrel export.
- **`db:reset` script corrected** — original script ran `db:migrate:undo:all && db:migrate && db:seed:all`, but `db:seed:all` skips already-tracked seeders, so the cycle left tables empty after the wipe. Updated to `db:seed:undo:all && db:migrate:undo:all && db:migrate && db:seed:all`. Seeder `down()` is idempotent — silently skips `ER_NO_SUCH_TABLE` so `db:seed:undo:all` works even after migrations are already undone.
- **Smoke tests passed (all green):**
  - `npm run db:migrate` → 6 migrations applied on top of the bootstrap (0.013–0.072s each).
  - `docker exec helpdesk-lite-mysql mysql ... -e "SHOW CREATE TABLE tickets\G"` confirms exact schema: ENUMs, FKs (`tickets_ibfk_1..3`), indexes, ENGINE/CHARSET/COLLATE all as designed.
  - `npm run db:seed` → `✔ users (8) · counters (1) · attachments (2) · tickets (20) · comments (6) · activity_logs (54)`.
  - `npm run db:reset` → idempotent re-run from a clean state; identical data shape.
  - `npm run typecheck` (backend) → `tsc --noEmit` exits 0 (no `any` leaks).
  - `npm run build:frontend` → Angular production build succeeds with no TS errors; 9 lazy chunks emitted; total initial bundle ~60KB.
  - `npm run dev:backend` then `curl http://localhost:3000/api/health` → `200 OK {status: "ok", service: "helpdesk-lite-backend", timestamp: ...}`. Backend boots without model-init errors (the new side-effect import in `config/database.ts` doesn't break anything at runtime).
  - `node -e` bcrypt spot check: `bcrypt.compare('password123', users.password_hash) === true` for `admin@company.com`.
  - `npm run db:migrate:undo:all` cleanly drops all 6 application tables (only `SequelizeMeta` + `SequelizeData` remain).
  - Spot-check SQL: status distribution `Open=8, In Progress=5, Resolved=4, Closed=3` exactly per kickoff brief; ticket numbers `HD-21..HD-40`; activity log breakdown `Created=20, Assigned=12, StatusChanged=12, CommentAdded=6, ConfirmedClosed=4`.
- **Status legend reminder:** `B` = building · `B✓` = built · `R` = reviewed. The Design Loop Status table above still applies to Phase 4/5; Phase 6 stories are tracked in the kickoff brief and in this log, not in the page table.
- **Out of scope (HD-002 does NOT do — saved for later stories):**
  - Auth endpoints (login / logout / JWT) — **HD-003**.
  - API endpoints beyond `/api/health` — **HD-007+** introduces `/api/tickets`, `/api/users`, `/api/comments`, etc.
  - Attachment file write pipeline (the actual file bytes) — **HD-016**.
  - Activity-log writers in service code (the seeder seeds them; service code that emits them lands in HD-007+).
  - Frontend HTTP services that consume these types — **HD-003** introduces the first one (`AuthService`).
  - Any business logic — HD-002 is purely data plumbing.
- **Status:** HD-002 done. Next story: HD-003 (JWT auth, login endpoint, login page wiring, route guards).

### 2026-09-15 — HD-003 auth backend + middleware complete (Phase 6 / Milestone A / Story 3 of 16)
- **Locked decisions (this session):**
  - **JWT storage:** `httpOnly` cookie named `auth`, `Path=/`, `SameSite=Lax`, `Secure` only when `NODE_ENV === 'production'`. Resolves the kickoff brief's open question (tech-stack.md §Open Questions §1).
  - **JWT expiry:** 1 hour (matches existing `JWT_EXPIRES_IN=1h` in `backend/.env`). No refresh token in MVP.
  - **Inactive account:** `POST /api/auth/login` checks `isActive` after password verification → returns 403 `{ error: 'account_inactive', message: 'Your account is inactive. Contact your administrator.' }`. Matches login spec §States.
  - **HD-003 scope (user-selected):** backend + middleware only. Frontend `AuthService` + `HttpInterceptor`, route guards, CSRF, and Jest tests are deferred to HD-004 / HD-005 / HD-006.
- **New deps:** `cookie-parser@^1.4.7` (runtime) + `@types/cookie-parser@^1.4.7` (dev). Hoisted to root `node_modules` via npm workspaces.
- **11 new backend files** (`backend/src/`):
  - `utils/errors.ts` — `HttpError` class with `status`, `errorCode`, `message`, optional `fields`; `toBody()` produces the `{ error, message, fields? }` shape every error response uses.
  - `utils/jwt.ts` — `signToken(payload)` + `verifyToken(token)`. Secret + expiry read from `process.env` per request (no boot-time memoization, so rotation doesn't require a restart). Custom payload validation: rejects `string`/null shapes and missing fields before casting.
  - `utils/password.ts` — `verifyPassword(plain, hash)` + `DUMMY_HASH` (pre-computed bcrypt of `'unused'` at module load). Used to equalize timing between "wrong password" and "no such user" paths — both run `bcrypt.compare` for ~58ms regardless of which path took the 401.
  - `utils/cookies.ts` — `AUTH_COOKIE_NAME = 'auth'`; `cookieOptions()` returns `{ httpOnly, secure: prod-only, sameSite: 'lax', path: '/', maxAge: 1h }`; `setAuthCookie(res, token)` + `clearAuthCookie(res)`. `clearAuthCookie` strips `maxAge` from the options before passing to `res.clearCookie` because Express forwards `maxAge` into the Set-Cookie header (overriding its own intent to invalidate with `Expires=epoch-zero`).
  - `utils/asyncHandler.ts` — 3-line wrapper that catches rejected promises and forwards via `next()` to the central errorHandler.
  - `types/express.d.ts` — module augmentation: `Express.Request.user? = { id, email, displayName, role }`. Inline string-literal union for `role` (declaration files don't play well with `import type` from relative paths through tsc).
  - `middleware/auth.ts` — `authMiddleware`: reads `req.cookies.auth`, calls `verifyToken`, attaches `req.user`, 401 on missing/bad/expired token. Generic message ("Authentication required.") — never differentiates malformed vs expired to clients.
  - `middleware/role.ts` — `roleMiddleware(allowedRoles)` factory; 403 with `{ error: 'forbidden', ... }` if `req.user.role` not in list; 401 if `req.user` missing (defense in depth).
  - `middleware/errorHandler.ts` — 4-arity central handler. Detection order: `HttpError` → typed; `SequelizeValidationError` / `SequelizeUniqueConstraintError` → 400 with `fields` extracted from `err.errors[].path`; `JsonWebTokenError` / `TokenExpiredError` / `NotBeforeError` → 401 (defense in depth — authMiddleware normally catches these first); fallback → 500 with sanitized message + full `console.error` log. Never exposes raw `err.message` to the client.
  - `controllers/authController.ts` — `login`, `logout`, `register` (501 stub), `me`. Login flow: validate body (`email` shape + `password` presence, 400 on miss) → `User.scope('withPassword').findOne({ where: { email } })` → always-run `bcrypt.compare` (against `DUMMY_HASH` if no user) → 401 on bad creds with single ambiguous message → 403 on inactive → `signToken` → `setAuthCookie` → fire-and-forget `User.update({ lastActiveAt })` (catch + log; never 500 the login on an audit-write failure) → 200 `{ user: { id, email, displayName, role } }` (no token in body). Logout: `clearAuthCookie` + 204. Me: `authMiddleware` already populated `req.user`; reload via `User.findByPk` to detect role/`isActive` changes since token issuance; 401 `{ error: 'account_inactive' }` if user missing or deactivated.
  - `routes/auth.ts` — wires the 4 handlers; `authMiddleware` only on `/me`. Login / logout / register are public.
- **Modified backend files:**
  - `server.ts` — mounts `cookieParser()` between `express.json()` and `/api` routes; replaces the inline 500-only error handler with the typed `errorHandler` (now last middleware). 404 JSON fallback kept as-is.
  - `routes/index.ts` — `apiRouter.use('/auth', authRouter)`.
  - `package.json` — adds `cookie-parser` + `@types/cookie-parser` at the locked versions.
- **API contract (all responses use `{ error, message, fields? }` shape so Angular can switch on `error`):**
  | Endpoint | Status | Body |
  |---|---|---|
  | `POST /api/auth/login` (correct) | 200 | `{ user: { id, email, displayName, role } }` + `Set-Cookie: auth=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600; Expires=…` |
  | `POST /api/auth/login` (wrong creds) | 401 | `{ error: 'invalid_credentials', message: 'Email or password is incorrect. Try again.' }` |
  | `POST /api/auth/login` (inactive) | 403 | `{ error: 'account_inactive', message: 'Your account is inactive. Contact your administrator.' }` |
  | `POST /api/auth/login` (bad body) | 400 | `{ error: 'validation_error', message: '…', fields: { email, password } }` |
  | `POST /api/auth/logout` | 204 | (empty body) + `Set-Cookie: auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax` |
  | `POST /api/auth/register` | 501 | `{ error: 'not_implemented', message: '…' }` |
  | `GET /api/auth/me` (no cookie) | 401 | `{ error: 'unauthenticated', message: 'Authentication required.' }` |
  | `GET /api/auth/me` (bad cookie) | 401 | `{ error: 'invalid_token', message: 'Authentication required.' }` |
  | `GET /api/auth/me` (valid) | 200 | `{ user: { id, email, displayName, role, isActive, lastActiveAt, createdAt, updatedAt } }` |
- **TypeScript gotchas hit during impl (recorded for the next person):**
  - `.d.ts` files don't reliably import types via relative paths through `tsc`; `Express.Request` augmentation uses an inline string-literal union rather than `import type { UserRole } from '../models/User'`.
  - `jsonwebtoken`'s `verify` returns `string | JwtPayload`; cast through `unknown` after a structural shape check (the `JwtPayload` from `@types/jsonwebtoken` doesn't sufficiently overlap with the custom one).
  - The backend defines its own `AuthUserPayload` interface locally rather than importing `UserPublic` from the frontend models — the frontend mirror is hand-maintained.
- **Smoke tests passed (all 13 cases from the plan):**
  - `GET /api/health` → 200 OK (regression check).
  - Wrong creds → 401 `invalid_credentials`; wrong email → 401 `invalid_credentials` (identical body; timing also identical — see below).
  - Login success → 200 + correct user body + `Set-Cookie` with `HttpOnly; SameSite=Lax; Path=/; Max-Age=3600` (no `Secure` because `NODE_ENV=development`).
  - Tomas (`is_active=false`) → 403 `account_inactive`.
  - Empty body → 400 `validation_error` with `fields: { email, password }`.
  - `me` without cookie → 401 `unauthenticated`; with garbage cookie → 401 `invalid_token`; with valid cookie → 200 with full public user.
  - Logout → 204 + `Set-Cookie: auth=; Expires=Thu, 01 Jan 1970 …` (epoch-zero, so browsers drop the cookie).
  - `register` stub → 501 `not_implemented`.
  - Unknown `/api/nope` → 404 `not_found` (JSON, not HTML).
  - **Timing probe** (5 iterations each, post-JIT warmup): wrong-password avg=72.2ms (60.1ms excl. warmup) vs no-such-user avg=58.6ms. Difference ≈1.5ms (the user lookup `findOne`), within bcrypt noise. Email-enumeration timing side channel mitigated.
  - DB sanity: `SELECT last_active_at FROM users WHERE email='admin@company.com'` shows `2026-09-15 08:30:35` — audit field updated on login (and on subsequent `/me` indirectly via the user-reload path; field only written by login flow itself).
  - `npm run typecheck` (backend) → 0 errors.
  - `npm run build:backend` → `tsc` exits 0; `dist/` populated.
- **Out of scope (HD-003 does NOT do — saved for later stories):**
  - Frontend `AuthService` + `HttpInterceptor` + login page wiring — **HD-004 / HD-005**.
  - Route guards (`authGuard`, `roleGuard`) + 403 Forbidden component — **HD-006**.
  - CSRF double-submit middleware — lands with the frontend story (Angular side needs to echo the header).
  - Jest tests for the auth flow — follow-up slice; kickoff brief's Definition of Done flagged but the user opted out for this story.
  - Rate limiting on `/api/auth/login` (login spec lists 429 as a state) — follow-up slice.
  - Password reset — out of MVP per tech-stack.md.
  - `POST /api/auth/register` implementation — Admin-managed users per HD-014.
  - Server-side JWT denylist — stateless logout only.
- **Edge cases documented:**
  - **Deactivated mid-session:** the JWT keeps working for up to 1 hour (until token expiry). The next explicit `/api/auth/me` call reloads from DB and returns 401 `account_inactive`. Acceptable for MVP.
  - **Password change:** out of scope (no password-change flow exists yet, HD-014). When added, tokens issued before the change remain valid until expiry unless a `tokenVersion` column is introduced.
  - **JWT secret rotation:** not handled. `JWT_SECRET` is read fresh per request from `process.env` so a restart picks up a new value immediately.
  - **Email enumeration:** mitigated by always running `bcrypt.compare` (~60ms) regardless of whether the user exists. Difference between paths is ~1.5ms (the `findOne`).
  - **Logout is stateless:** the JWT is not denylisted. The cookie clear is the only mechanism. If a stolen JWT is in flight when the user logs out, it stays valid until expiry.
- **Status:** HD-003 done (backend slice). Next stories: HD-004 (app-header chrome, dropdown, logout dialog — needs the frontend AuthService to know who's logged in), HD-005 (Login page wiring), HD-006 (route guards).

---

## HD-004 — App-header chrome + dropdown + logout dialog + frontend AuthService

**Date:** 2026-09-15
**Story:** Phase 6 / HD-004 (P0)
**Source spec:** `design-process/D-UX-Design/header-profile-logout.md`, kickoff brief lines 167-191.

### Locked decisions (this session)

- **AuthService lands in HD-004** (pulled forward from HD-005) so the chrome is end-to-end working against the backend built in HD-003.
- **Smoke test approach:** manual dev login via Node fetch against `npm run dev:backend`, then start `npm run dev:frontend` and verify chrome at `http://localhost:4200/chrome-preview`. Authenticated cookies set via fetch carry across to the browser session (same-origin cookie storage policy does not apply; in dev, cookies on `:4200` cannot be set directly from Node's fetch, so the browser-side login flow arrives in HD-005).
- **API base URL:** new `frontend/src/environments/environment.ts` with `apiBaseUrl: 'http://localhost:3000/api'`. No `environment.prod.ts` (out of MVP).
- **Patterns dir:** `frontend/src/app/components/patterns/app-chrome/`. The duplicate `app/patterns/.gitkeep` was deleted.
- **Selector convention:** drop the redundant `app-` prefix on chrome components → `chrome-avatar`, `badge-role`, `caret-down`, `header-chrome`, `dropdown-panel`, `dialog-modal`, `app-chrome`. Avoids `app-app-header-chrome`.
- **401 contract on `/me`:** AuthService catches 401, sets `user$ = null`, does NOT redirect. Route-guard redirect lands in HD-006.
- **Token-first CSS:** every color/size/z-index in chrome components reads from `styles.css` `:root`. New vars added: `--color-scrim`, `--role-admin-border`, `--size-avatar-32`, `--size-avatar-24`, `--size-dropdown-width`, `--size-modal-width`, `--space-modal-pad`, `--space-chrome-bottom-gap`.

### Architecture (frontend)

- **AuthService** (`src/app/services/auth.service.ts`) — single `BehaviorSubject<UserPublic | null>`, exposes `user$` (Observable) + `userSnapshot()` (sync). Bootstrap-performant: does NOT call `/me` on construction; `header-chrome` fires `refreshUser()` on init. `login(email, password)` POSTs to `/api/auth/login`, then internally calls `refreshUser()` to populate the full `UserPublic`. `logout()` POSTs to `/api/auth/logout`, treats 401 as success (cookie already gone), emits `null`. `roleHomePath()` returns `/dashboard` | `/queue` | `/admin` | `/login` based on snapshot role.
- **HttpInterceptor** (`src/app/services/auth.interceptor.ts`) — functional `HttpInterceptorFn` (Angular 17 idiom). Stamps `withCredentials: true` on any same-origin `/api/*` request. Converts raw `HttpErrorResponse` into typed `ApiError` so callers can switch on `errorCode`. Registered in `app.config.ts` via `provideHttpClient(withInterceptors([authInterceptor]))`.
- **ApiError** (`src/app/services/api-error.ts`) — extends `Error` with `status`, `errorCode: ApiErrorCode`, `message`, `fields?`. `apiErrorFrom(HttpErrorResponse)` parses the backend's `{ error, message, fields }` envelope and falls back to status→code mapping for unmapped errors. Status 0 → `network_error`. Type union covers `validation_error | invalid_credentials | account_inactive | unauthenticated | invalid_token | forbidden | not_found | not_implemented | internal_server_error | network_error | unknown_error` — extend as new codes land.

### Component tree

**Atoms** (`src/app/components/atoms/`):
- `chrome-avatar/chrome-avatar.component.ts` — circular avatar, inputs `displayName: string`, `size: 24 | 32 = 32`. Initials = first letter of first + first letter of last word, uppercased. Falls back to `?`. Background `--color-disabled` (neutral), color white.
- `caret-down/caret-down.component.ts` — inline SVG ▾ (8×8, `fill="currentColor"`).
- `divider-hr/divider-hr.component.ts` — `<hr>` styled with `--color-border`, no margin.
- `badge-role/badge-role.component.ts` — role pill. Variants: `User` → label "Employee", `--role-employee-border`. `Support Agent` → bg `--role-support-agent-bg`, border `--role-support-agent-border`. `Admin` → border `--role-admin-border` (new).

**Molecules** (`src/app/components/molecules/`):
- `header-chrome/header-chrome.component.ts` — the 64px sticky strip. Three regions: brand mark (left, focusable button → `roleHomePath()`), spacer, profile trigger (right, avatar + name + caret). Owns dropdown open state, dialog open state, logout error state. Hosts `@HostListener('document:keydown.escape')` (dialog first, then dropdown) and `@HostListener('document:click')` (outside-click closes dropdown). Calls `auth.refreshUser()` on init when `user$` is null.
- `dropdown-panel/dropdown-panel.component.ts` — absolute-positioned panel anchored to a trigger button. Content-projected via `<ng-content>`. Computes `top`/`right` from the anchor's bounding rect + `window.scrollY`/`window.innerWidth`. Re-anchors on `window:resize`. Role `menu`. Reads `--space-chrome-bottom-gap` from `:root`.
- `dialog-modal/dialog-modal.component.ts` — scrim + centered modal. Portals its scrim + modal to `document.body` via `Renderer2.appendChild` so `position: fixed` is independent of any ancestor `overflow`/`transform` (the chrome is `position: sticky`). Auto-focuses the confirm button per UX spec. Esc → cancel.emit. Inputs: `headline`, `cancelLabel = 'Cancel'`, `confirmLabel = 'Confirm'`, `error: string | null`, `confirming: boolean`.

**Pattern** (`src/app/components/patterns/app-chrome/`):
- `app-chrome.component.ts` — selector `app-chrome`. Renders `<header-chrome />` + `<main id="main-content" class="page-shell">` containing a `<div class="page-content">` with both `<ng-content />` (for direct wrap use) and `<router-outlet />` (for parent-route wrap use in HD-006). One component supports both modes.

### Smoke-test scaffolding (TO BE REMOVED IN HD-006)

- `src/app/pages/chrome-preview-page/chrome-preview-page.component.ts` — TEMPORARY standalone page that wraps `<app-chrome />` with a placeholder body. Renders at `/chrome-preview`.
- `src/app/app.routes.ts` — `''` redirect changed from `login` to `chrome-preview` for HD-004 verification. **Revert to `login` in HD-006** when authGuard lands. Both routes are wired so the change is one line.
- File header comment on `chrome-preview-page.component.ts`: `TODO(hd-006): remove`.

### Smoke test results

- **Backend round-trip (Node fetch):**
  - `POST /api/auth/login` as `admin@company.com`, `sam@company.com`, `eli@company.com` (Admin / Support Agent / Employee) → all 200, Set-Cookie has `HttpOnly; SameSite=Lax; Path=/; Max-Age=3600; Secure` flag **absent** (NODE_ENV=development → correct).
  - `GET /api/auth/me` with the cookie → 200 with full `UserPublic` including `id, email, displayName, role, isActive, lastActiveAt, createdAt, updatedAt`.
  - `POST /api/auth/logout` → 204 + `Set-Cookie: auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax` (cookie deletion).
  - `GET /api/auth/me` with no cookie → 401 `unauthenticated`.
  - **CORS probe:** request from `Origin: http://localhost:4200` → response `Access-Control-Allow-Origin: http://localhost:4200` and `Access-Control-Allow-Credentials: true`. Cookie rides cross-port (`localhost:4200` ↔ `localhost:3000`) — same-site for `SameSite=Lax`, different origins for CORS.
- **Frontend build:** `npm run build:frontend` → bundle generated, no errors, `chrome-preview-page-component` chunk = 35.72 kB (includes all atoms + molecules + AuthService).
- **Frontend dev server:** `ng serve` boots on `http://localhost:4200/` in 0.931s. Route probes: `/`, `/login`, `/chrome-preview`, `/dashboard`, `/nonexistent` all return 200 (SPA shell). Browser-side visual verification of the chrome (avatar/name/badge, dropdown open/close, logout dialog, brand-mark click → role-correct home) is blocked by the in-process harness; manual user verification recommended before HD-005.

### TypeScript gotchas hit

- **Angular template ICU parser:** inline template strings can't contain a literal `{` — it's interpreted as an ICU message start. The first preview-page template had a `<code>` block with a JSON body; trimmed to plain text to satisfy the parser. Same gotcha applies to the `<style>` strings used by every component (no `{` allowed in CSS variable references inside inline templates — work around by leaving CSS in the component's `styles` array, where the parser is more permissive).
- **Functional `HttpInterceptorFn`:** Angular 17 prefers functional interceptors over class-based. The `withInterceptors([fn])` helper wires them in `provideHttpClient`.

### Out of scope (HD-004 does NOT do — saved for later stories)

- Frontend login form wiring (`LoginPageComponent` replacement, form validation, error rendering) — **HD-005**.
- Route guards (`authGuard`, `roleGuard`) + 403 Forbidden component — **HD-006**. Until guards land, the `/` redirect routes to the chrome-preview scaffolding page rather than `/login`.
- CSRF double-submit middleware — lands with HD-005 (frontend echoes the header).
- Skip-to-main-content link — deferred to HD-006 with the route guards.
- Production `environment.prod.ts` — out of MVP.
- Jest tests for chrome + AuthService — follow-up slice.
- Replacing every placeholder page with its real content — each page's "real" body lands in its own story (HD-007 employee dashboard, HD-010 ticket detail, etc.).

### Edge cases documented

- **Stateless logout:** the backend doesn't denylist the JWT. If a stolen JWT is in flight when the user clicks "Log out", it stays valid server-side until expiry. The cookie clear is the only mechanism. Acceptable for MVP.
- **Cookie riding on cross-port requests:** `SameSite=Lax` allows the cookie to ride cross-port within `localhost` (same-site per spec). CORS `credentials: true` is required at the backend (already configured in HD-001).
- **Chrome renders nothing on the right when no user is loaded yet:** the brand mark + wordmark remain visible (it's the "logged-out" state). HD-006's authGuard will bounce unauthenticated users before they ever see this.
- **Dialog portal-to-body:** `position: fixed` works correctly even when the chrome's `position: sticky` would otherwise create a containing block. Tradeoff: dialog is outside Angular's component tree visually (DOM children of `<body>`); React-style portal. Standard pattern.
- **Logout redirect to `/login`:** owned by `header-chrome.confirmLogout()` calling `router.navigate(['/login'])`. HD-006 may consolidate this with the authGuard's redirect.

### Files created

**Frontend — new (13):**
- `frontend/src/environments/environment.ts`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/services/auth.interceptor.ts`
- `frontend/src/app/services/api-error.ts`
- `frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.ts`
- `frontend/src/app/components/atoms/caret-down/caret-down.component.ts`
- `frontend/src/app/components/atoms/divider-hr/divider-hr.component.ts`
- `frontend/src/app/components/atoms/badge-role/badge-role.component.ts`
- `frontend/src/app/components/molecules/header-chrome/header-chrome.component.ts`
- `frontend/src/app/components/molecules/dropdown-panel/dropdown-panel.component.ts`
- `frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts`
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts`
- `frontend/src/app/pages/chrome-preview-page/chrome-preview-page.component.ts` *(temporary; removed in HD-006)*

**Frontend — modified (3):**
- `frontend/src/styles.css` (token additions in `:root`)
- `frontend/src/app/app.config.ts` (provideHttpClient + authInterceptor)
- `frontend/src/app/app.routes.ts` (`/chrome-preview` route added; `''` redirect retargeted for verification; revert in HD-006)

**Frontend — deleted (1):**
- `frontend/src/app/patterns/.gitkeep` (orphan directory; patterns live under `components/patterns/`)

**Untouched:** all backend code; HD-002 models/migrations/seeds; all other Phase 4/5 design artifacts.

- **Status:** HD-004 done (frontend chrome + AuthService). Next stories: HD-005 (login form wiring), HD-006 (route guards + chrome-preview scaffolding removal + `''` redirect revert).

---

## Log

- **This file** — Single source of truth for project progress
- **agent-experiences/** — Compressed insights from design discussions (dated files)
- **wds-project-outline.yaml** — Project configuration from Phase 0 setup

**Do not modify `wds-project-outline.yaml`** — it is the source of truth for project configuration.
