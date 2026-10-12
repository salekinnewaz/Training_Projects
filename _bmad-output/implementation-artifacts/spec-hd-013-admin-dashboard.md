---
title: 'HD-013 — Admin Dashboard tab (/admin)'
type: 'feature'
created: '2026-10-12'
status: 'in-progress'
route: 'build'
review_loop_iteration: 0
baseline_commit: 'cf34802429a7c7bd6a50b6ef466d241622ecdba9'
context:
  - 'design-process/D-UX-Design/admin-dashboard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin lands on `/admin` after login and sees a 26-line placeholder. The page is Admin's command center for *oversight* (queue shape + user management), but today it answers none of Admin's questions. Admin doesn't move tickets (per the action matrix in `ticket-detail.md` — Admin = Support Agent for status changes, but Admin doesn't perform triage in MVP) and Admin doesn't take new tickets (End-Users do). Admin's two jobs are: (1) see the queue's shape at a glance, (2) manage who has access. HD-013 ships the first half. HD-014 ships the Users tab.

**Approach:**
- New `GET /api/admin/dashboard` endpoint (Admin only) that returns the tickets already partitioned by status, each list newest-first by `createdAt` DESC, capped at `DASHBOARD_CARD_LIMIT` (14) per the design doc's "12–14 rows per card" guidance.
- Wire it under a new `adminRouter` at `/api/admin` (HD-014 will own the rest of this file later; HD-013 only adds the dashboard subroute).
- Reuses the existing `Ticket` model with `submitter` / `owner` eager-load (no new model, no migration).
- Full rewrite of `AdminDashboardPageComponent` (placeholder today) with:
  - `<app-chrome>` wrap.
  - Page heading row: `Dashboard` (left) + tab switcher (right) with two tabs `Dashboard` / `Users`. The Users tab is a placeholder for HD-014 — it routes to `/users` for now so the tab affordance is real.
  - 4 status summary cards in a single horizontal row: `Open (n)` / `In Progress (n)` / `Resolved (n)` / `Closed (n)`.
  - Each card top zone: status badge mini-pill (left) + count (right). Closed count is muted (`#868e96`).
  - Each card body: vertical list of recent 14 tickets. Each row: mono ticket number (left) · title (center-left, 1-line clamp) · relative timestamp (right). Row hover tints `#f1f3f5` and cursor:pointer for Open / In Progress / Resolved; Closed rows are muted, no hover, no click.
  - Card footer: "Showing 14 of 47" muted, non-clickable in MVP. Only renders when `total > 14`.
  - Click on Open / In Progress / Resolved row → routes to `/tickets/<id>`.
  - Closed column: muted everywhere; rows do not navigate.
- URL hash: `#dashboard` and `#users` switch the active tab. Direct arrival at `/admin#users` lands on the Users tab. Unknown hash defaults to Dashboard. Users tab in HD-013 is a "tab affordance only" — clicking it routes to `/users` (the existing standalone page); it does not switch in-page content. This is acceptable for MVP: Admin bounces between two URLs via the tab affordance. HD-014 will absorb the Users content into `/admin` and the tab becomes a true in-page switch.

**Boundaries noted now:** Card footer "Show all N →" expansion is v1.x. Date-range filter on Closed is v1.x. Search is v1.x. No "Create Ticket" button on the page. No drag-and-drop. No filter strip.

**Why a new endpoint, not reuse `/api/tickets/queue`:** `/api/tickets/queue` is gated to Support Agent only (HD-012 spec, controller inline role gate). Admin cannot call it. Even if we relaxed the gate, the data shape differs: HD-012 returns the full list newest-first so the page partitions client-side. HD-013 returns the data already partitioned by status with per-bucket caps so the wire matches the design doc's "Showing N of M" footer.

## Boundaries & Constraints

**Always:**
- Backend: `GET /api/admin/dashboard` returns `{ open: Ticket[], inProgress: Ticket[], resolved: Ticket[], closed: Ticket[] }`. Each list newest-first by `createdAt` DESC, capped at 14. Eager-loads `submitter` and `owner` (no attachment — the summary card doesn't show attachment state).
- Backend: new `adminRouter` mounted under `/api/admin` with `authMiddleware`. Role gate is inline in the controller (Admin only) — same pattern as `listForQueue` (HD-012).
- Backend: response shape is *not* the same as `listForUser` / `listForQueue` (those return `{ tickets, count }`). The Dashboard endpoint returns a fixed-shape object with four buckets, each bucket pre-bounded to 14. Documented in the spec.
- Backend: `serializeTicket` is reused for each entry (no new helper).
- Frontend `TicketService.adminDashboard(): Promise<AdminDashboardSummary>` mirrors the existing service shape (HttpClient → `firstValueFrom` → response unwrap → `apiErrorFrom` on non-2xx).
- Frontend: page is wrapped in `<app-chrome>`.
- Frontend: 4 cards in a single horizontal row at 320px each, 16px gap, fits a 1440px canvas with the standard 56px outer padding. Responsive collapse to a 2x2 grid below ~1200px is a v1.x nice-to-have; MVP is desktop-first at 1440px.
- Frontend: each card uses the status badge mini-pill from the design doc. Reuses the existing CSS variables for status colors (already defined in HD-007/HD-012).
- Frontend: row hover tints only for Open / In Progress / Resolved. Closed row text is muted.
- Frontend: the tab switcher on `/admin` is two tabs: `Dashboard` (active in HD-013) and `Users` (routes to `/users` on click — placeholder for HD-014 in-page tab).
- Frontend: URL hash drives the active tab on initial render. `#dashboard` or unset → Dashboard. `#users` → Users tab rendered "active" but content is a redirect to `/users` (HD-014 will absorb). Direct-arrival to `/admin#users` sets the Users tab active. Unknown hash → Dashboard default.
- Frontend: render states (mutually exclusive `@switch`):
  - loading → heading + tab switcher (Dashboard active, disabled look) + 4 card skeletons (rounded, 720px tall, grey bars).
  - error → inline error above the cards: "Couldn't load the queue. Refresh to try again." + Retry button. Tab switcher stays visible.
  - success → 4 cards rendered.
- Frontend: each empty card (e.g., no Resolved tickets) renders the card skeleton-content "Nothing here." muted line in the body area, with the count `0` in the top zone. This is the empty-state per the design doc (no specific copy locked; "Nothing here." matches the Agent Kanban convention).
- Frontend: card footer "Showing N of M" renders only when `M > 14`. When `M <= 14`, no footer. Footer is muted (`#868e96`) and non-interactive in MVP.

**Never:**
- No write endpoints in HD-013 (no PATCH, no POST). Admin doesn't move tickets in MVP.
- No realtime updates (no WebSocket / SSE / long-poll). Page refetches on a window-focus event OR an explicit "Refresh" button.
- No new design tokens. Reuses `--color-surface`, `--color-border`, `--color-primary`, `--color-muted`, `--status-*-bg/text`, `--button-radius`, `--shadow-card-hover`. Card body internal padding (12px) and top zone padding (16px) are kept in the page component (the design doc lists these as page-specific geometry, not tokens).
- No new atoms / molecules beyond what's already shipped.
- No new backend dependencies. No new middleware. Reuses `authMiddleware`, `asyncHandler`, `HttpError`.
- No backend migration. No model change.
- The Agent Kanban (`/queue`) is **not** modified by HD-013 — it stays Support-Agent-only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_ADMIN_LOADS_DASHBOARD | Avery (Admin) loads `/admin`, 23 tickets across 4 statuses (11 Open, 5 In Progress, 4 Resolved, 3 Closed) | `GET /api/admin/dashboard` → 200 → 4 cards render with the most recent 14 per status (caps kick in only for status with >14; for the seeded 23 this means all 11 Open + all 5 In Progress + all 4 Resolved + 3 Closed). Open card shows 11, In Progress 5, Resolved 4, Closed 3. Closed count is muted. | N/A |
| HAPPY_PATH_LARGE_QUEUE | Avery loads `/admin` with 50 Closed tickets (capped at 14) | Closed card shows 14 rows; footer "Showing 14 of 50" muted, non-clickable. Other cards render their actual counts (no cap applies). | N/A |
| HAPPY_PATH_GREATER_THAN_14_OPEN | 20 Open tickets | Open card shows 14 rows; footer "Showing 14 of 20". | N/A |
| HAPPY_PATH_CLICK_OPEN_ROW | Avery clicks a row in the Open card | Routes to `/tickets/<id>` (the HD-010 detail page). | N/A |
| HAPPY_PATH_CLICK_IN_PROGRESS_ROW | Same as Open click | Same as above. | N/A |
| HAPPY_PATH_CLICK_RESOLVED_ROW | Same as Open click | Same as above. | N/A |
| NOOP_CLICK_CLOSED_ROW | Avery clicks a row in the Closed card | No-op. Cursor is `default` (not `pointer`). No row hover. | N/A |
| NOOP_CLICK_CARD_TOP | Avery clicks the status badge or count in any card top zone | No action in MVP. | N/A |
| USERS_TAB_CLICK | Avery clicks the `Users` tab on `/admin` | Routes to `/users` (the existing standalone page; HD-014 will absorb). The tab switcher on `/admin` keeps the active-tab URL hash in sync. | N/A |
| TAB_FROM_URL_HASH | Avery lands on `/admin#users` cold | Renders the Users tab as active (aria-current="page"); the page content area renders a single "Loading Users…" placeholder, then the Router redirects to `/users`. HD-013 keeps this in page; the "real" in-page tab is HD-014. | N/A |
| SERVER_ERROR_LOAD | `GET /api/admin/dashboard` returns 500 | Inline error above the cards: "Couldn't load the queue. Refresh to try again." + Retry button. Tab switcher stays visible. | `ApiError(500, ...)`; `renderState.set('error')` |
| SESSION_EXPIRED | `GET /api/admin/dashboard` returns 401 | Auth interceptor redirects to `/login?return_to=/admin`. URL hash preserved. | `ApiError(401, ...)` handled by authInterceptor |
| FORBIDDEN_NON_ADMIN | Eli (User) hard-loads `/admin` | Angular `roleGuard(['Admin'])` already routes to `/forbidden`. The controller's role gate is defense in depth (returns 403 if a programmatic client bypassed Angular). | Frontend guard wins |
| EMPTY_QUEUE_NO_TICKETS | Avery loads `/admin` with 0 tickets in any status | Each card renders the "Nothing here." muted body marker; counts all 0; no rows. | N/A |
| EMPTY_STATUS_OPEN | Avery loads `/admin` with 0 Open, others normal | Open card body: "Nothing here." Open count: 0. Other cards render normally. | N/A |
| LOADING_SKELETON | Initial fetch in flight on Dashboard tab | Heading + tab switcher (Dashboard active, disabled look); 4 card skeletons (rounded, 720px tall, grey bars where text would be). | Standard skeleton pattern |
| WINDOW_FOCUS_REFETCH | Avery switches tabs to Slack and back; window focus event fires | Page refetches the dashboard; render state cycles through loading → success. | N/A |
| REFRESH_BUTTON | Avery clicks the Refresh button in the page heading | Refetches the dashboard. Render state cycles through loading → success. | N/A |
| DIRECT_NAV_TO_ADMIN_DASHBOARD | Browser hard-load of `/admin` while Admin logged in | Heading + tab switcher (Dashboard active) + skeleton + 4 cards. | N/A |
| DIRECT_NAV_TO_ADMIN_USERS_HASH | Browser hard-load of `/admin#users` | Tab switcher reflects Users active. Page content renders a "Loading Users…" placeholder + auto-redirect to `/users`. | N/A |

## Code Map

### Reuse

- `backend/src/controllers/ticketsController.ts` — `serializeTicket` helper. Reused.
- `backend/src/services/ticketService.ts` — `Ticket.findAll` shape. Reuse the `order: [['createdAt', 'DESC']], include: [submitter, owner]` pattern.
- `backend/src/middleware/auth.ts` — `authMiddleware` (HD-003). Reuse.
- `backend/src/utils/errors.ts` — `HttpError(status, code, message, fields?)`. Reuse.
- `backend/src/utils/asyncHandler.ts` — wraps rejected promises. Reuse.
- `backend/src/routes/index.ts` — existing `routes/index.ts` already mounts each subrouter. Append the new `adminRouter` here.
- `frontend/src/app/services/ticket.service.ts` — existing `listForUser` / `listForQueue` shape. Add `adminDashboard()`.
- `frontend/src/app/services/api-error.ts` — `ApiError` + `apiErrorFrom`. Reuse.
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — `<app-chrome>` wrap. Reuse.
- `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` — loading skeleton. Reuse.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button>` for Refresh + Retry. Reuse.
- `frontend/src/app/models/ticket.ts` — `Ticket` interface. Reuse.
- `frontend/src/app/models/enums.ts` — `TicketStatus` (reused as the bucket key). Reuse.
- `frontend/src/app/guards/role.guard.ts` — already gates `/admin` to Admin. No change.
- `frontend/src/app/app.routes.ts` — `/admin` route already wired with `authGuard + roleGuard(['Admin'])`. No change in HD-013.
- `frontend/src/styles.css` — design tokens already seeded by HD-001/HD-004. No new tokens in HD-013. Likely needs a few global rules for the 4-card row + card top zone + status badge mini-pill (mirrors the HD-011 comment-role + HD-012 kanban pattern of pushing the heaviest rules to global so the per-page styles fit in the 2kB soft budget).

### New files

- `backend/src/services/ticketService.ts` *(modify)* — add `getDashboardSummary()` helper. Returns the four-bucket shape with per-bucket `limit: 14`.
- `backend/src/controllers/adminController.ts` *(new)* — the inline-role-gated controller for the new dashboard endpoint. Mirrors the HD-012 `listForQueue` handler's shape.
- `backend/src/routes/admin.ts` *(new)* — `adminRouter` mounted under `/api/admin`. Single GET for now; HD-014 will extend.
- `backend/src/routes/index.ts` *(modify)* — mount `adminRouter` alongside the existing `ticketsRouter` and `usersRouter`.
- `backend/src/controllers/adminController.spec.ts` *(new)* — 2 tests: 200 happy with shape verification (4 buckets, per-bucket count ≤ 14, newest-first ordering); 403 when role isn't Admin.
- `frontend/src/app/services/ticket.service.ts` *(modify)* — add `adminDashboard(): Promise<AdminDashboardSummary>` method.
- `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts` *(full rewrite — placeholder currently 26 lines)* — full implementation per Implementation Notes.
- `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.spec.ts` *(new)* — tests per Acceptance Criteria.
- `frontend/src/styles.css` *(modify)* — admin dashboard card layout + status badge mini-pill rules. Try to fit in the page component first; fall back to global if over budget.

### Modified

- `backend/src/routes/index.ts` — mount `adminRouter`.
- `frontend/src/app/services/ticket.service.ts` — `adminDashboard()` method.
- `frontend/src/styles.css` — card layout + status badge mini-pill (likely).

### Deleted

_None._

### Unchanged

- All HD-005–HD-012 atoms / molecules / patterns — untouched.
- `backend/src/models/Ticket.ts` — no schema change.
- `backend/src/utils/validation/ticketValidation.ts` — no new validator (the dashboard endpoint has no body).
- `backend/src/routes/tickets.ts` — no change. `/api/tickets/queue` stays Support-Agent-only.
- `frontend/src/app/pages/agent-kanban-page/agent-kanban-page.component.ts` — no change.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/services/ticketService.ts` -- modify -- add `getDashboardSummary()` helper returning the four-bucket shape, each newest-first by `createdAt` DESC, capped at 14.
- [ ] `backend/src/controllers/adminController.ts` -- create -- controller for `GET /api/admin/dashboard` with inline role gate (Admin only).
- [ ] `backend/src/routes/admin.ts` -- create -- `adminRouter` mounted under `/api/admin` behind `authMiddleware`. The HD-013 spec calls for one subroute (`GET /`); the file is structured so HD-014 can extend.
- [ ] `backend/src/routes/index.ts` -- modify -- mount `adminRouter` alongside `ticketsRouter` / `usersRouter`. Update the doc-comment header.
- [ ] `backend/src/controllers/adminController.spec.ts` -- create -- 2 tests: 200 happy (4 buckets, newest-first, per-bucket ≤ 14) + 403 when role isn't Admin.
- [ ] `frontend/src/app/services/ticket.service.ts` -- modify -- add `adminDashboard(): Promise<AdminDashboardSummary>` method mirroring the existing service shape.
- [ ] `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts` -- modify -- full rewrite: tab switcher (Dashboard / Users with #users routing to /users), 4 status summary cards, click-to-open, render states (loading / error / success), URL hash sync.
- [ ] `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.spec.ts` -- create -- tests covering: tab switcher renders, dashboard tab is default, 4 cards render with correct counts, click Open row navigates, click Closed row is no-op, error renders error card, loading renders skeleton, URL hash #users routes to /users.
- [ ] `frontend/src/styles.css` -- modify -- push card layout + status badge mini-pill rules to global if the page-specific budget is exceeded (mirrors HD-011/HD-012 pattern).

**Acceptance Criteria:**
- Given Avery loads `/admin`, when `GET /api/admin/dashboard` returns 23 tickets (11 Open / 5 In Progress / 4 Resolved / 3 Closed), then 4 cards render with the correct counts and the most recent rows visible in each.
- Given a status has more than 14 tickets (e.g., 50 Closed), when the page renders, then that card shows 14 rows + a "Showing 14 of 50" muted footer.
- Given Avery clicks a row in the Open card, when the click fires, then the router navigates to `/tickets/<id>`.
- Given Avery clicks a row in the Closed card, when the click fires, then nothing happens (no navigation; cursor is `default`).
- Given `GET /api/admin/dashboard` returns 500, when the response arrives, then the page renders the inline error card with a Retry button; the tab switcher stays visible.
- Given Avery is loading the page (initial fetch in flight), when the page first paints, then a skeleton renders: heading + tab switcher + 4 card skeletons.
- Given a status has 0 tickets, when the page renders, then that card's body shows "Nothing here." muted and the count is 0.
- Given Avery clicks the `Users` tab on `/admin`, when the click fires, then the router navigates to `/users` (HD-014 will absorb as in-page tab).
- Given the URL is `/admin#users`, when the page loads, then the Users tab is rendered active and the page content shows a redirect to `/users`.
- Given Eli (User) hard-loads `/admin`, when the route guard runs, then Angular redirects to `/forbidden` (defense-in-depth role check on the backend also returns 403).

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. Leave empty at planning time. -->

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass. Empty until first review pass. -->

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd backend && npx jest` (full suite) -- expected: 54 + 2 = 56/56 passing.
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` -- expected: 0 errors.
- `cd frontend && npx tsc --noEmit -p tsconfig.spec.json` -- expected: 0 errors.
- `cd frontend && npx ng build` -- expected: success. The admin-dashboard-page-component lazy chunk should grow to ~25-35 kB raw (page state + 4 cards + tab switcher + tests). The new `admin-dashboard-page` style budget is enforced; if over 2kB, push the card layout / status badge rules to `styles.css` (mirrors HD-011 / HD-012).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/admin-dashboard-page.component.spec.ts'` -- expected: 9-11 SUCCESS.
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` (full suite) -- expected: previous 78 SUCCESS + 10 HD-013 = 88 SUCCESS, same 6 pre-existing FAILED.

**Manual checks (if no CLI):**
- Start `npm run dev:backend` + `npm run dev:frontend`. Log in as `admin@company.com` (`password123`). Land on `/admin`. Verify 4 cards render with the seeded counts (11 / 5 / 4 / 3 in the demo dataset).
- Verify Closed card count is muted (`#868e96`); other card counts are dark (`#212529`).
- Click an Open row. Land on `/tickets/<id>` (the HD-010 detail page).
- Click a Closed row. Nothing happens.
- Click the `Users` tab. Land on `/users`.
- Hard-load `/admin#users`. Verify Users tab is active on initial render.
- Stop the backend. Refresh `/admin`. Verify error card renders with Retry.
- Hard-load `/admin` as Eli (Employee). Lands on `/forbidden`.
