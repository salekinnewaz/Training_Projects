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

---

## Log

- **This file** — Single source of truth for project progress
- **agent-experiences/** — Compressed insights from design discussions (dated files)
- **wds-project-outline.yaml** — Project configuration from Phase 0 setup

**Do not modify `wds-project-outline.yaml`** — it is the source of truth for project configuration.
