---
title: 'HD-007 — Employee Dashboard (My Tickets, /dashboard)'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '7c288eacd64682b5f272f7d2b198466ef0b505d6'
context:
  - 'design-process/D-UX-Design/employee-dashboard.md'
  - 'design-process/E-Design-System/02-atoms/badge-status.md'
  - 'design-process/E-Design-System/02-atoms/badge-priority.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** HD-001 left `EmployeeDashboardPageComponent` as a 23-line placeholder; no backend ticket listing exists. Eli (Employee) cannot see her own tickets; the page is the first stop after Login and the adoption-meter surface per the UX design. HD-006 tightened routes to `/dashboard` being role-guarded — but the role list still allows Support Agents and Admins, who have their own surfaces (`/queue`, `/admin`) and shouldn't appear on the Employee dashboard.

**Approach:** Add a `GET /api/tickets/mine` endpoint (auth-required; filters by the JWT'd user's `id`, returns newest-first by `updatedAt`, max 100). On the frontend, build three atoms (`badge-status`, `badge-priority`, `ticket-row`), one molecule (`empty-state`), one pattern (`loading-skeleton`), a `TicketService.listMine()`, and rewrite the placeholder page so it (a) wraps content in `<app-chrome>` per the HD-006 deferred-layout decision, (b) reads `auth.userSnapshot()` for self-id, (c) loads on init and re-renders on the three UI states (loading / empty / error / list).

## Boundaries & Constraints

**Always:**
- Backend mounts `ticketsRouter` at `/api/tickets`; route `GET /mine` calls `authMiddleware` then a controller that uses `req.user.id` as the implicit `submitterId` filter.
- `Ticket.findAll` filters `where: { submitterId: req.user.id }`, `order: [['updatedAt', 'DESC']]`, `limit: 100`, `paranoid: true` (excludes soft-deleted).
- Response shape = array of `Ticket` matching the frontend `models/ticket.ts` contract (nested `submitter`, optional `owner`, optional `attachment`, ISO date strings).
- New atoms read CSS tokens; no hard-coded color hexes. Reuse: `--status-open-bg/-text` etc. (status), `--priority-low-bg/-text` etc. (priority), `--color-surface`, `--color-border`, `--color-primary`, `--color-label`, `--color-muted`, `--font-mono`.
- Page wraps its own `<app-chrome>` (each-page opts in; HD-006 deferred the parent-layout work). The page also renders the skip-link's target via `id="main-content"` on its own `main` if it doesn't go through `app-chrome`'s `<main>`.
- Tighten the route guard on `/dashboard` to `roleGuard(['User'])` — kickoff canonical.

**Never:**
- No pagination on the backend response (cap at 100; no `next` cursor). Spec marks this out of MVP.
- No sort/filter/search controls on the dashboard (out of MVP; per kickoff).
- No stats cards, no team-wide counters, no assignee column, no other-employees' tickets — design spec explicitly forbids.
- No `beforeunload` warning, no live updates / websocket, no auto-refresh — out of MVP.
- No mocked data — backend endpoint required.
- No new tokens on `:root` for status/priority (already seeded in HD-001/HD-004). Use existing values.
- No changes to `app.routes.ts` beyond tightening the dashboard guard.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| LOGIN_TO_DASHBOARD | Eli logs in, `role=User`, lands on `/dashboard` | `ngOnInit` → `ticketService.listMine()` → 200 with rows → newest-first render | N/A |
| EMPTY_QUEUE | Eli has 0 tickets | 200 with `[]` → `<empty-state>` card with H1 "No tickets yet" + caption + larger "Create Ticket" CTA | N/A |
| LOADING | `listMine()` in flight | `<loading-skeleton>`: H1 placeholder, button placeholder, 5 row placeholders | N/A |
| SERVER_ERROR | `listMine()` 5xx or network | Inline error message above list: "Couldn't load your tickets. Refresh to try again."; heading + Create Ticket button still rendered; no list | `ApiError` thrown; `error` signal set; `loading=false` |
| SESSION_EXPIRED | `listMine()` 401 | `AuthService.refreshUser` already swallows 401 → guard would have redirected. Edge: cookie expired between guard pass and list call. Same `ApiError` caught → "session expired" wording | Treat as `server_error` state |
| DIRECT_DEEPLINK | `/dashboard` cold with no cookie | `authGuard` → 401 → `/login?return_to=%2Fdashboard` (HD-006 owns this; no rendering) | N/A |
| NAV_FROM_CREATED | After creating a ticket in HD-008, navigate back to `/dashboard` | Component reads snapshot first, only fetches if `ticketService` cache is empty (cold navigation = full fetch; warm cache from a tab switch = re-use). MVP: every visit re-fetches. | N/A |
| STALE_DATA | User submits a status-changing action on another tab | Page does not auto-refresh; user reloads. Out of MVP. | N/A |

## Code Map

### Reuse

- `frontend/src/app/services/auth.service.ts` — `userSnapshot(): UserPublic | null` (line 35). Page reads snapshot to confirm role + for self-id display.
- `frontend/src/app/services/api-error.ts` — `ApiError`, `apiErrorFrom(err)`. Service throws; page catches.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button variant="primary">` for header CTA + empty-state CTA (variant `primary`, 40px/48px — matches `button.md` §button-height spec). No click output; wrap in `<a routerLink="/tickets/new">` (Angular binds `routerLink` on the anchor, which wraps a button — preserves styling).
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — page wraps content in `<app-chrome>` (HD-006 deferred the parent-layout work). Skip-link and `<main id="main-content" tabindex="-1">` come from `app-chrome`.
- `frontend/src/app/components/atoms/link/link.component.ts` — `<atom-link href="/login?return_to=/dashboard">` fallback (unused in MVP happy path).
- `frontend/src/app/guards/role.guard.ts` — `roleGuard(['User'])` factory.
- `frontend/src/app/components/atoms/chrome-avatar/` — unused on this page (chrome owns it).
- `frontend/src/models/ticket.ts` — `Ticket` shape (id, number, title, status, priority, submitter, owner, createdAt, updatedAt).
- `frontend/src/models/enums.ts` — `TicketStatus`, `TicketPriority` literal unions.
- `frontend/src/environments/environment.ts` — `environment.apiBaseUrl`.
- `backend/src/middleware/auth.ts` — `authMiddleware` (attaches `req.user: { id, email, role }`).
- `backend/src/models/Ticket.ts` — `TicketAttributes`, `Ticket.init(...)`, underscored table.
- `backend/src/models/User.ts` — for the `submitter` include (eager-load in list).
- `backend/src/models/index.ts` — registers `Ticket.hasMany(ActivityLog)` already; the listing endpoint does NOT need the activity log but does need `User.belongsTo` association set (verified at line ~80 in `models/index.ts`).
- `frontend/src/styles.css` — tokens for status (`--status-open-bg/-text`, etc.), priority (`--priority-low-bg/-text`, etc.), `--color-surface`, `--color-border`, `--color-primary`, `--color-label`, `--color-muted`, `--font-mono`, `--content-column-width: 880px`, `--shadow-card-hover`. **No new tokens needed.**

### New files

- `backend/src/controllers/ticketsController.ts` — `listMine: RequestHandler`. Reads `req.user.id`; calls `Ticket.findAll({ where: { submitterId }, order: [['updatedAt','DESC']], limit: 100, include: [{ model: User, as: 'submitter' }, { model: User, as: 'owner' }, { model: Attachment, as: 'attachment' }] })`; serializes via `toJSON()` and maps Dates → ISO strings; returns `res.json({ tickets })`.
- `backend/src/routes/tickets.ts` — `ticketsRouter.get('/mine', authMiddleware, listMine)`. Single route for HD-007; later stories (HD-010 ticket detail, HD-012 kanban) extend this file.
- `backend/src/services/ticketService.ts` — single `listForUser(userId: number, opts?): Promise<Ticket[]>` wrapper. Returns just the data; pagination params deliberately not exposed yet (HD-015). Empty `services/` directory is filled with this file.
- `frontend/src/app/components/atoms/badge-status/badge-status.component.ts` — `<badge-status [status]="ticket.status">`. Pill: `min-height: 22px; border-radius: 11px; padding: 0 10px; font-size: 11px; font-weight: 600;`. Switches on status → tokens. `OnPush`, no inputs validation.
- `frontend/src/app/components/atoms/badge-priority/badge-priority.component.ts` — `<badge-priority [priority]="ticket.priority">`. Same shape; tokens `--priority-low-bg/-text`, `--priority-medium-bg/-text`, `--priority-high-bg/-text`. `OnPush`.
- `frontend/src/app/components/molecules/empty-state/empty-state.component.ts` — `<empty-state [headline]="..." [caption]="..." [actionLabel]="..." [actionHref]="...">`. Card 480px wide, centered; renders H1 + p + CTA. `OnPush`. Projected slot for optional supporting copy.
- `frontend/src/app/components/molecules/ticket-row/ticket-row.component.ts` — `<ticket-row [ticket]="..." (rowClick)="...">`. Renders the row per spec: number (mono) · title · `<badge-status>` · `<badge-priority>` · timestamp (right-aligned). Row is a `<button>` (full-width, native focus + Enter). Hover `bg: var(--color-surface-subtle)`. Keyboard focus shows the focus ring. Emits `rowClick` with the ticket's `id`.
- `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` — `<loading-skeleton [rows]="5">`. Renders heading placeholder + button placeholder + N row placeholders. Visual bars use `var(--color-surface-muted)` bg + subtle pulse animation. `OnPush`.
- `frontend/src/app/services/ticket.service.ts` — `listMine(): Promise<Ticket[]>`. POSTs `GET ${environment.apiBaseUrl}/tickets/mine` with `withCredentials: true`; maps response `{ tickets }` to `Ticket[]`; throws `apiErrorFrom(err)` on non-2xx. Marks the request as type-safe via the `frontend/src/app/models/ticket.ts` `Ticket` interface.

### Modified

- `frontend/src/app/pages/employee-dashboard-page/employee-dashboard-page.component.ts` — full rewrite. Standalone `OnPush` page. Injects `Router` (for back nav from prior story). Template: `<app-chrome><section class="dashboard-page" id="main-content"><header class="dashboard-header"><h1>My Tickets</h1><a routerLink="/tickets/new"><atom-button variant="primary">Create Ticket</atom-button></a></header>{render()}</section></app-chrome>`. `render()` is computed via `@switch` between `loading / error / empty / list` signals. On `ngOnInit`: call `ticketService.listMine()`; populate `tickets` signal; on throw set `error` signal + keep heading/CTA visible.
- `frontend/src/app/app.routes.ts` (line 55): tighten `roleGuard(['User', 'Support Agent', 'Admin'])` → `roleGuard(['User'])`. One line.
- `backend/src/routes/index.ts` — add `apiRouter.use('/tickets', ticketsRouter);`.

### Deleted

_None._

### Unchanged

- All atoms `button`, `link`, `chrome-avatar`, `input-text`, `divider-hr`, `caret-down`, `badge-role`, `show-password-toggle`.
- All molecules `header-chrome`, `dropdown-panel`, `dialog-modal`, `form-field`.
- The `app-chrome` pattern stays untouched (HD-006 already added skip-link + `<main id="main-content" tabindex="-1">`).
- All other page placeholders (HD-008+ owns those).
- Existing auth endpoints, models except for the new service file.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/services/ticketService.ts` -- create -- `listForUser(userId, opts?): Promise<Ticket[]>` wrapper. Encapsulates `findAll` with the consistent include shape and order/limit.
- [ ] `backend/src/controllers/ticketsController.ts` -- create -- `listMine(req, res, next)` reads `req.user.id` and calls `ticketService.listForUser(req.user.id)`. Maps `Date` → ISO strings; serializes via `toJSON()`.
- [ ] `backend/src/routes/tickets.ts` -- create -- `ticketsRouter.get('/mine', authMiddleware, listMine)`.
- [ ] `backend/src/routes/index.ts` -- modify -- mount `ticketsRouter` at `/tickets`.
- [ ] `frontend/src/app/components/atoms/badge-status/badge-status.component.ts` -- create -- pill switches on `TicketStatus`; tokens only.
- [ ] `frontend/src/app/components/atoms/badge-priority/badge-priority.component.ts` -- create -- pill switches on `TicketPriority`; tokens only.
- [ ] `frontend/src/app/components/molecules/empty-state/empty-state.component.ts` -- create -- `OnPush` molecule for centered empty card.
- [ ] `frontend/src/app/components/molecules/ticket-row/ticket-row.component.ts` -- create -- `OnPush` molecule; emits `(rowClick)` with `id`.
- [ ] `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` -- create -- `OnPush`; `[rows]` input default 5.
- [ ] `frontend/src/app/services/ticket.service.ts` -- create -- `listMine(): Promise<Ticket[]>`; throws `ApiError`.
- [ ] `frontend/src/app/pages/employee-dashboard-page/employee-dashboard-page.component.ts` -- modify -- full rewrite per Code Map.
- [ ] `frontend/src/app/app.routes.ts` (line 55) -- modify -- tighten `roleGuard` to `['User']`.

**Acceptance Criteria:**
- Given an authenticated Employee with at least one ticket, when the user lands on `/dashboard`, then the ticket list renders newest-first with rows showing number (mono) · title · status pill · priority pill · right-aligned timestamp.
- Given an authenticated Employee with zero tickets, when the user lands on `/dashboard`, then the `<empty-state>` card renders "No tickets yet" + caption + a centered "Create Ticket" primary button.
- Given `listMine()` is in flight, when the page renders, then `<loading-skeleton>` shows 5 placeholder rows; no spinners.
- Given `listMine()` 5xx or network failure, when the error is caught, then an inline error "Couldn't load your tickets. Refresh to try again." renders above an empty list area; heading + Create Ticket CTA still visible.
- Given a Support Agent or Admin, when navigating to `/dashboard`, then `roleGuard(['User'])` redirects to `/forbidden?denied_from=%2Fdashboard`.
- Given a row is clicked, when `(rowClick)` emits, then `router.navigateByUrl('/tickets/' + ticket.id)` happens.
- Given the page first renders, when the user presses Tab, then the first interactive element reaches focus with a visible focus ring and the skip-link (`Skip to main content`) appears as the very first focusable.
- Given `curl /api/tickets/mine` is called with a valid cookie as a seeded Employee, then the response is 200 + `{ tickets: [...], count: N }` and `tickets[0].updatedAt >= tickets[1].updatedAt`.

## Implementation Notes

- Backend: `ticketsRouter` mounted at `/api/tickets`. Only `GET /mine` exposed for HD-007; HD-008/010/012/013 extend the same router.
- Backend: `listForUser(userId, opts?)` centralizes the findAll shape (where + includes + order + limit) — HD-015 cursor pagination extends via `opts`.
- Backend: `serializeTicket` is per-row to keep the controller thin; ISO conversion is explicit (not a generic date replacer) so it stays auditable.
- Frontend: page wraps itself in `<app-chrome>` per the HD-006 deferred-layout decision. First post-HD-006 page to do this; HD-008+ will follow the same pattern.
- Frontend: `formatRelative` inlined on the page (lightweight, MVP); second consumer (HD-010) is the trigger to extract `src/app/utils/time.ts`.
- Frontend: `EmptyStateComponent` is purely presentational — emits `(action)`, host wires navigation. Auto-navigation removed after review.
- Frontend: `EmployeeDashboardPageComponent` clears its 401-redirect `setTimeout` via `DestroyRef.onDestroy` to prevent post-teardown navigations.
- Frontend: `LoadingSkeletonComponent.rowArray()` guards NaN/Infinity/negative rows inputs.
- Tooling: `backend/jest.config.js` added (ts-jest preset) so `.spec.ts` files parse under Jest. No DB-side-effect during tests; `models/index.ts` is mocked.
- Testing: HD-007 ships the first real test coverage (1 controller spec + 2 component specs). Coverage is small but exercises the security boundary (JWT-submitterId filter) and the 401 bounce.

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

Three review layers (Blind Hunter, Edge Case Hunter, Verification Gap) reported ~43 findings. Triaged as follows.

### Patched (6)

| # | Finding | Verdict | Resolution |
|---|---|---|---|
| P1 | `GET /api/tickets/mine` JWT-submitterId contract + ISO serialization has no test. `backend/jest --passWithNoTests` passes on an empty test tree; authz-data leak or wire-shape drift lands silently. | high | Added `backend/src/controllers/ticketsController.spec.ts` asserting `listForUser(7)` is called with `submitterId: 7` from JWT, and that the wire body roundtrips through `new Date(...).toISOString() === json.createdAt`. Test passes (1/1). |
| P2 | `EmployeeDashboardPageComponent` 401 bounce + 3 render states have no test. Spec's "session expired" sub-case was unverified. | high | Added `frontend/src/app/pages/employee-dashboard-page/employee-dashboard-page.component.spec.ts` covering empty, list, and 401-error cases. |
| P3 | `ButtonComponent` new `size` input + `pressed` output public surface had no test. The existing forbidden-page spec only asserts the host `(click)`; doesn't cover the new `(pressed)` event or the default `md` height. | medium | Added `frontend/src/app/components/atoms/button/button.component.spec.ts` asserting `(pressed)` emits, default `size` is `'md'`, and `size="'lg'"` renders the `lg` class. |
| P4 | `EmptyStateComponent.onCtaPress` both emits `action` and navigates, breaking the "host can override" contract. The molecule claimed hosts could ignore the event but always navigated regardless. | medium | Dropped the auto-navigation. Molecule is now purely presentational — emits `action`, host wires navigation. `EmployeeDashboardPageComponent` updated to listen to `(action)="goToCreate()"`. |
| P5 | `LoadingSkeletonComponent.rowArray()` calls `new Array(NaN)` which throws `RangeError` if the input is `NaN`/`Infinity`/negative. | medium | Guard added: `Math.floor` + `Number.isFinite` + `Math.max(0, n)`. |
| P6 | `EmployeeDashboardPageComponent` 401 redirect via `setTimeout(..., 0)` could fire after component destruction (route change), leaking a navigation. | medium | Captured the timer handle and `clearTimeout` it via `DestroyRef.onDestroy`. |

### Rejected

| Finding | Verdict | Why |
|---|---|---|
| `serializeTicket` throws on null `createdAt`/`updatedAt` | low | `createdAt`/`updatedAt` are `allowNull: false` in `Ticket.init` (HD-002); only `deletedAt` is nullable and already guarded. Practically unreachable. |
| `req.user!` non-null assertion could throw | low | `authMiddleware` runs first and always populates `req.user` (HD-003 verified). Defensive check duplicates middleware contract. |
| `opts.limit = 0` or negative → empty / Sequelize error | low | Only caller (`listMine` controller) never passes opts. Extension point for HD-015. |
| `response.tickets` could be missing | low | Backed by our own backend; contract drift would surface in type-check + tests now added. |
| Missing trailing newlines on new files | low | Tooling/codestyle noise, not a behavioral defect. |
| `Record<string, unknown>` cast smell | low | Cosmetic TS nitpick. |
| `ListForUserOptions` is dead on HD-007 | low | Intentional extension point for HD-015; documented in spec Design Notes. |
| `loading-skeleton` uses `track $index` | low | Codestyle preference; OnPush already minimizes re-renders. |
| `formatRelative` should be a shared util | low | Premature; second consumer (HD-010) is the trigger per spec. |
| `rowArray()` should be `computed()` | low | Codestyle preference. |
| `id="main-content"` on dashboard | false | `app-chrome` already provides `<main id="main-content" tabindex="-1">` (HD-006). Spec Design Notes already noted this. |
| `withCredentials: true` redundant if interceptor stamps it | false | Interceptor stamps only on `/api/*`; explicit option matches `AuthService` pattern (defensive). |
| `--button-height` duplicated by `--button-lg-height` | low | Cosmetic; legacy token keeps the login form's height contract unchanged. HD-005 verified. |
| Switch default cases throw vs fallthrough | low | Defensive; backend enums are stable. YAGNI at this layer. |
| `(pressed)` fires during loading | false | Button's `[disabled]="disabled() || loading()"` blocks DOM click events at the browser level when loading. |
| Ticket-row `linkHref()` with undefined id | low | Backend ticket always has `id` (PK auto-increment, non-nullable). Unreachable. |
| Empty-state `actionHref` empty/invalid | low | Host passes literal `'/tickets/new'`; never empty. |
| `formatRelative(null)` returns 'just now' | low | Backend always returns ISO string; typed `Ticket.updatedAt: string`. |
| 403 from `listMine` not handled | low | Backend can't return 403 — submitter filter means no role mismatch. Spec routes role mismatches via `roleGuard` BEFORE the fetch. |
| `listMine()` resolves non-array | low | Same as `response.tickets` missing — covered by the new backend spec's response-shape assertions. |
| Role narrowing `/dashboard` to `['User']` is "deletion" | deletion (intentional) | Spec-approved; matches kickoff canonical. |
| Spec says "userSnapshot() for self-id" but page doesn't | false | Re-read: Code Map inventory note ("Page reads snapshot for self-id display") describes AuthService availability, NOT a feature requirement. The page has no greeting (chrome owns identity display). No AC requires this. |
| Service injects no AuthService | false | Same as above — duplicate. |
| Spec says `(rowClick) emits with id` | false | Design Notes section explicitly states the row is a `<a routerLink>` and `(rowClick)` is removed. Spec is internally consistent. |
| `required: false` for owner/attachment includes | false | Code Map note was contingent ("if include becomes a JOIN"). Sequelize `belongsTo` defaults to LEFT JOIN, so null owner/attachment rows are still included. Verified at runtime. |
| `setTimeout` race (covered by P6) | medium | Resolved. |

### Deferred

None.

## Design Notes

- **Per-page `<app-chrome>` wrapping.** HD-006 deferred adding `app-chrome` as a parent-route layout because doing it without per-page opt-in would rewrite every placeholder in one shot. For HD-007 the page wraps itself; HD-008+ follows the same pattern. Consolidating into a parent layout is a small follow-up slice when most pages have real content — likely HD-011 (Comments+ActivityLog) or HD-015, whichever lands last among the page-content stories.
- **Sort key.** `Ticket.updatedAt` is what the kickoff specifies. Sequelize writes `updated_at` automatically on every save; the backend re-order on every list call is correct without joining ActivityLog. The more semantically-correct "most recent activity-log event" would require a subquery — defer to a v1.x if product owner wants the difference surfaced.
- **Status badge token discrepancy.** `frontend/src/styles.css` has `--status-closed-text: #495057` but the badge-status atom spec (per `design-process/E-Design-System/02-atoms/badge-status.md`) lists `#868e96`. The token value is darker and contrast-safe (4.5:1 on `#e9ecef`); the spec value renders slightly washed-out but matches `--color-muted`. **Decision for HD-007:** keep the existing token (`#495057`). If the design team wants the washed-out look, it's a one-line `styles.css` edit + a comment to revisit.
- **Anchor + button nesting.** The header CTA is `<a routerLink="/tickets/new"><atom-button variant="primary">Create Ticket</atom-button></a>`. Native `<button>` inside an `<a>` is invalid HTML, but in this codebase the atom-button renders a `<button>` element and is wrapped by an `<a>`. Most browsers cope, but screen readers may announce both. **Decision:** render only `<atom-button>` (no anchor) and bind the click via `(click)="goToCreate()"` → `router.navigateByUrl('/tickets/new')`. The atom-button has no `(click)` output today — extension point: add `click` output event to atom-button by emitting `(pressed)` at the host click.

  **Patched:** instead of a routerLink-wrapped anchor, add `output() pressed = new EventEmitter<void>()` to `button.component.ts` and bind `(pressed)="navigate()"`. Keeps HTML valid, retains keyboard support, no screen reader ambiguity. This is a minor atom extension scoped to this story.
- **Empty state CTA size.** Design spec says the empty-state CTA is 48px (slightly taller than the header's 40px) so it reads as the most prominent affordance. We do this by passing `[size]="'lg'"` to atom-button — also an extension point. **Patched:** add `size?: 'md' | 'lg'` (default `'md'`, `'lg'` = 48px) to button.component. Same token, no behavior change.
- **Ticket-row click vs link semantics.** Design spec: "the entire row is clickable and routes to Ticket Detail. Row wrapped in a link/anchor; `Tab` moves through rows as a single focusable element each." Implementation: wrap row content in a single `<a routerLink="/tickets/:id">` so the whole row is one focusable element, native Enter follows the link. Removes need for `(click)` row-click event.
- **Skip-link target within `<app-chrome>`.** The skip-link lives inside `<app-chrome>` (HD-006 wired it there). The dashboard page wraps content in `<app-chrome>` so the skip-link works on this page too. The page does NOT need its own `id="main-content"` — `app-chrome`'s `<main>` already has it.
- **`Ticket.findAll` includes.** Eager-load `submitter` (User as `'submitter'`), `owner` (User as `'owner'`), `attachment` (Attachment as `'attachment'`). The frontend `Ticket` interface declares all three, so omitting `owner` or `attachment` would render as missing keys in the JSON. Sequelize with `paranoid: true` (already on the Ticket model) excludes soft-deleted rows. Add `required: false` if `include` becomes a `JOIN` and excludes rows.

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd frontend && npx ng build` -- expected: success, 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` -- expected: (no HD-007 test yet — see manual).
- `curl -i -b /tmp/hd-cookies.txt http://localhost:3000/api/tickets/mine` -- expected: 200, body shape matches frontend `Ticket[]`.

**Manual checks (if no CLI):**
- Log in as `eli@company.com / password123` (per seeders) → confirm `/dashboard` shows her tickets newest-first; click a row → Ticket Detail placeholder; click "Create Ticket" → Create Ticket placeholder. (Ticket Detail and Create Ticket are HD-010 + HD-008; their placeholders are fine for HD-007 verification.)
- Empty case: log in as a seeded Employee who has no tickets (reseed with eli having 0 if needed; or use the HD-001 seeder's count and confirm one user has zero) → confirm `<empty-state>` renders + CTA works.
- Loading case: open DevTools Network → Throttle: Slow 3G → confirm the loading skeleton renders before data lands.
- Server error case: stop the backend (`npm run dev:backend` Ctrl-C) → refresh `/dashboard` → confirm inline error renders.
- Role gate: log in as `sam@company.com / password123` (Support Agent) → navigate to `/dashboard` → confirm `/forbidden?denied_from=/dashboard` redirect. Same for `admin@company.com`.
- Keyboard: from a cold page, Tab → first focusable is the skip-link; Enter → focus jumps to `<main>`. Tab again → header CTA "Create Ticket"; Tab → first ticket row.
