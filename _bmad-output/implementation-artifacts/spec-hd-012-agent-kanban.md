---
title: 'HD-012 — Agent Kanban (/queue) + drag-and-drop'
type: 'feature'
created: '2026-10-12'
status: 'in-progress'
route: 'build'
review_loop_iteration: 0
baseline_commit: 'b4736a66ae2e79e1901e473afa667c833188b4bd'
context:
  - 'design-process/D-UX-Design/agent-kanban.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current `AgentKanbanPageComponent` is a 25-line placeholder showing "Placeholder — full implementation lands in HD-012." Sam (Support Agent) lands on `/queue` after login and sees no board — no Open column, no In Progress column, no drag affordance, no filter strip. The Kanban is the **top-weighted feature** in `design-process/B-Trigger-Map/feature-impact.md` because it answers G1 ("queue runs itself — primary") with one screen: Sam scans four columns left-to-right and orphans surface instantly. Without this page, Sam can't act on tickets without re-discovering them, defeating the morning-triage ritual.

**Approach:** Build the GitHub-Issues-style Kanban board:
- New `GET /api/tickets/queue` endpoint (Support Agent only; Admin does not see this page per UX §"Admin role and this page") that returns all tickets with eager-loaded submitter/owner/attachment.
- New `KanbanCardComponent` molecule (title · meta row · drag handle).
- Full rewrite of `AgentKanbanPageComponent` with 4 columns (Open → In Progress → Resolved → Closed), HTML5 native drag-and-drop between columns, legal-transition validation per the ticket action matrix (Open↔InProgress, Open→Resolved, InProgress→Resolved — never into Closed from any non-Resolved state for Agent), ghost placeholder, invalid-drop shake, click-to-open, filter strip (search + priority + category + owner) with URL persistence, filter state in `?priority=&category=&owner=&q=` query string.
- Reuse the existing `PATCH /api/tickets/:id` from HD-010 for status changes (no new write endpoints).
- Basic in-memory client-side filter (search + priority + category + owner) on the fetched queue — full filter/search backend lands in **HD-015**. The kickoff explicitly says HD-012's filter strip "consumes" HD-015's combined-filter endpoint. For HD-012, fetch once on load + filter the local signal in-page.

**Boundaries noted now:** Filters are simplest-correct. No pagination (HD-015). No realtime updates (the page refetches on window-focus OR explicit user action via the URL). URL persistence uses the native `Router.navigate([], { queryParams })` (no store / no service).

**Admin:** not on this page. Route is already `roleGuard(['Support Agent'])` so an Admin typing `/queue` URL bounces to `/forbidden`.

## Boundaries & Constraints

**Always:**
- Backend new endpoint: `GET /api/tickets/queue` — Support Agent only. Returns all non-deleted tickets newest-first by `createdAt` DESC, with `submitter` / `owner` / `attachment` eager-loaded. Pagination out of MVP (limit 100; HD-015 will extend).
- Backend reuses existing `serializeTicket` from `ticketsController.ts`. No new helper for the response shape.
- Route mounts under the existing `ticketsRouter` with `authMiddleware`; role gate is inline in the controller — matches the HD-008 / HD-010 pattern (route guard is at the Angular side, the controller is the source of truth).
- Controller inline role assertion: if `req.user.role !== 'Support Agent'` → throw `HttpError(403, 'forbidden', 'Support Agent role required.')`. Mirror the HD-008 `create` controller's inline pattern.
- Service helper: `listForQueue()` in `ticketService.ts`. Returns `Ticket[]` newest-first by `createdAt` DESC, limit 100, eager include `[submitter, owner, attachment]`. Mirrors `listForUser` shape (HD-007).
- Frontend `TicketService.listForQueue(): Promise<Ticket[]>` mirrors the existing `listMine()` shape exactly: HttpClient → `firstValueFrom` → response unwrap → `apiErrorFrom`.
- Page renders 4 columns in a fixed order: **Open · In Progress · Resolved · Closed**. Closed is always last. Each column is a `<section>` with a sticky header showing `Status (count)` and a scrollable body of cards.
- Column allocation:
  - `Open` column shows tickets with `status === 'Open'`, sorted oldest-first by `createdAt` ASC (per UX "aging tickets float up"); orphans (`owner === null`) pinned to the top with the existing `--color-kanban-orphan-tint` token.
  - `In Progress` column shows `status === 'In Progress'`, sorted oldest-first by `createdAt` ASC.
  - `Resolved` column shows `status === 'Resolved'`, sorted oldest-first by `createdAt` ASC.
  - `Closed` column shows `status === 'Closed'`, sorted newest-first by `createdAt` DESC (per UX the closed column is read-only history; tail of scan). Read-only — no drag in, no drag out, cards have `cursor: not-allowed`.
- Drag affordances (HTML5 native):
  - Each card has `draggable="true"` and listens to `dragstart` / `dragend`. The dragstart handler attaches the ticket id to `event.dataTransfer` and a small custom MIME type `application/x-helpdesk-ticket`.
  - Each column body listens to `dragover` (preventDefault to allow drop), `dragenter` (highlight if valid drop), `dragleave`, `drop`.
  - On invalid drop (destination column not in legal transitions for the source status), the dragged card animates back to source (drop event still fires but the page treats it as a no-op + emits an inline toast).
  - On valid drop:
    1. Optimistic UI: move the card locally in the signal.
    2. `PATCH /api/tickets/:id { status: <new> }` via `TicketService.patch`.
    3. On 200: replace local card with the response payload.
    4. On error: revert the optimistic move + emit a toast "Couldn't move the ticket. Try again."
  - Cursor states: cards in draggable columns get `cursor: grab` on hover, `grabbing` on drag. Closed column body has `cursor: not-allowed`.
- Legal transitions (per the kickoff and `design-process/D-UX-Design/ticket-detail.md` Action Matrix — Agent cannot change to Closed from any non-Resolved state):
  - Open → {In Progress, Resolved}
  - In Progress → {Open, Resolved}
  - Resolved → (no drag target for Agent; Resolved awaits Eli's verdict)
  - Closed → (read-only; column body has `cursor: not-allowed`)
  - Any → Closed: rejected (Agent cannot drop into Closed; Closed is Eli-only per UX "any → Closed rejected for Agent")
- The page does NOT call `PATCH` with `ownerId` on drag — drag changes status only. The Ticket Detail page's inline edit + drag interplay is the only way to reassign during HD-012; HD-014 (Users tab) brings role/active controls and HD-015 brings deeper filters; drag-to-reassign is a v1.x follow-up per the spec's open question "Saved filter presets" note.
- Filter strip:
  - Search input `<input type="search">` (200ms debounce via RxJS `debounceTime`).
  - Priority dropdown `Priority: All ▾`.
  - Category dropdown `Category: All ▾`.
  - Owner dropdown `Owner: All ▾` (options: All · Mine · Unassigned · each active agent from `UserService.listAgents()` cache).
  - "× Clear" link, visible only when at least one filter is non-default.
  - Filters are AND across categories, OR within (deferred — single-select MVP).
- URL persistence: filter state syncs to `?priority=<high|medium|low>` `?category=<it|hr|finance|general>` `?owner=<me|unassigned|<agentId>>` `?q=<search>`. Page reads from `ActivatedRoute.snapshot.queryParamMap` on init; updates via `Router.navigate([], { queryParams, queryParamsHandling: 'merge' })` whenever a filter changes (sans search-debounce).
- Loading skeleton: heading row + filter strip (disabled look) + 4 columns each with 3 card-skeleton placeholders (rounded, 96px tall).
- Empty column states:
  - Filtered-no-match: `No tickets match your filters.`
  - Genuinely empty: `Nothing here.`
- Error state: inline error above the board "Couldn't load the queue. Refresh to try again." with a retry button.
- Page wraps in `<app-chrome>`. Route already wired in `app.routes.ts` with `authGuard + roleGuard(['Support Agent'])` — no change.
- New `<kanban-card>` molecule is reusable but HD-012 is the only consumer; it lives in `frontend/src/app/components/molecules/kanban-card/`. Reuses `<chrome-avatar>`, `<badge-priority>`, plus its own CSS for the title clamp + owner meta.

**Never:**
- No `PATCH` calls for `ownerId`, `priority`, `category` from the Kanban page — only `status`.
- No backend-driven filtering, search, or pagination in HD-012 — that's HD-015.
- No realtime updates (no WebSocket / SSE / long-poll). Page refetches on a window-focus event OR an explicit "Refresh" button (per UX "Sam refreshes the browser to see new tickets").
- No "Move with arrow keys" keyboard drag (UX open question v1.x). Keyboard users open Ticket Detail and use the Status dropdown.
- No mobile / touch drag (UX open question v1.x). Desktop-first.
- No drag-to-resequence within a column (UX "Sort is fixed"). Within-column order is `createdAt` ASC and is non-user-controlled.
- No new design tokens. Reuses `--color-surface`, `--color-border`, `--color-primary`, `--color-muted`, `--status-*-bg`, `--priority-*-bg`, `--role-employee-border`, `--role-support-agent-border`, `--color-kanban-orphan-tint`, `--color-kanban-invalid-drop`, existing `--button-radius`, `--shadow-card-hover`. New CSS lives in the page component (under existing 2kB soft budget — likely will need to move some rules to `styles.css` like HD-011).
- No new atoms / molecules beyond `<kanban-card>`.
- No new backend dependencies. No new middleware. Reuses `authMiddleware`, `asyncHandler`, `HttpError`, `serializeTicket`.
- No backend migration. No model change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_AGENT_LOADS_BOARD | Sam (Support Agent) loads `/queue`, 20 tickets across 4 statuses | `GET /api/tickets/queue` → 200 → page renders 4 columns with cards in the correct column by status; Open orphans pinned at top with tint + Unassigned badge | N/A |
| HAPPY_PATH_FILTER_NARROWS | Sam types "vpn" in search (debounced 200ms) | `q` query param updates to `vpn`; only matching cards visible (substring on number, title, submitter.displayName, case-insensitive); empty columns show "No tickets match your filters." | N/A |
| HAPPY_PATH_FILTER_FROM_URL | Sam opens `/queue?priority=High&owner=me` cold | Page parses queryParams on init; fetches once; applies filters from URL; only High-priority Mine tickets render | N/A |
| DRAG_OPEN_TO_IN_PROGRESS | Sam drags an Open card → drops on In Progress column | Optimistic: card moves to In Progress immediately. `PATCH /api/tickets/<id> { status: 'In Progress' }` fires. On 200, the local signal updates with the eager-loaded response. On error, the card reverts to Open + inline toast "Couldn't move the ticket. Try again." | `ApiError(...)` caught; revert + toast |
| DRAG_OPEN_TO_RESOLVED | Sam drags Open → Resolved | Same as above with new status `Resolved` | N/A |
| DRAG_IN_PROGRESS_TO_OPEN | Sam drags In Progress → Open | Same as above; valid transition per matrix | N/A |
| DRAG_IN_PROGRESS_TO_RESOLVED | Sam drags In Progress → Resolved | Same as above; valid transition per matrix | N/A |
| DRAG_INVALID_TO_CLOSED | Sam drags any → Closed | Drop is rejected; card returns to source with a brief shake animation; no API call; no state change | Drop event handler treats Closed as an invalid drop target for Agent |
| DRAG_INVALID_TO_RESOLVED_AS_RESOLVED | Sam drags a Resolved card → Open | Drop is rejected (Agent cannot drag from Resolved); card returns to source with shake; no API call | Resolved column is a no-drag column for Agent per the matrix |
| DRAG_CLOSED_IS_LOCKED | Sam mouses-down on a Closed card | Card has `cursor: not-allowed`; `draggable="false"`; drag never initiates; click still opens detail page | Closed column is read-only end-to-end |
| CLICK_CARD_OPENS_DETAIL | Sam clicks (no drag) an Open card | Routes to `/tickets/<id>` (Ticket Detail page) | N/A |
| SERVER_ERROR_LOAD | `GET /api/tickets/queue` returns 500 | Inline error above board "Couldn't load the queue. Refresh to try again." + Retry button. Filter strip stays visible. | `ApiError(500, ...)`; `renderState.set('error')` |
| SESSION_EXPIRED | `GET /api/tickets/queue` returns 401 | Auth interceptor redirects to `/login?return_to=/queue`; URL filter state preserved; after re-auth, page re-applies filters | `ApiError(401, ...)` handled by authInterceptor |
| FORBIDDEN_NON_AGENT | Admin hard-loads `/queue` | Angular `roleGuard(['Support Agent'])` already routes to `/forbidden`; the controller's role gate is defense-in-depth (returns 403 if a programmatic client bypassed Angular) | Frontend guard wins |
| EMPTY_BOARD_NO_FILTER | Sam has zero visible cards (all in past-due states that don't match) | Each column shows "Nothing here." | Calm, no panic per UX |
| EMPTY_BOARD_WITH_FILTER | Sam filtered to priority=High and there are none | Each empty column shows "No tickets match your filters." | "filtered-no-match" copy |
| LOADING_SKELETON | Initial fetch in flight | Heading + filter strip (disabled) + 4 columns with 3 card-skeleton rows each (rounded 96px) | Standard skeleton pattern |
| DIRECT_NAV_TO_QUEUE_DEEP_LINK | `/queue?q=vpn&priority=High` (browser refresh / share) | Page reads queryParamMap, applies filters post-fetch | N/A |
| ORPHAN_PIN_TOP_OPEN | An Open card has `owner: null` | Card sits at the top of the Open column with `--color-kanban-orphan-tint` 12% background and an "Unassigned" badge | N/A |

## Code Map

### Reuse

- `backend/src/controllers/ticketsController.ts` — existing `serializeTicket` helper. Add `listForQueue` handler (no PATCH / write logic).
- `backend/src/services/ticketService.ts` — existing `listForUser` (HD-007) shape. Add `listForQueue()` returning all tickets (no `submitterId` filter) with eager includes.
- `backend/src/middleware/auth.ts` — `authMiddleware` populates `req.user` (HD-003). Reuse.
- `backend/src/utils/errors.ts` — `HttpError(status, code, message, fields?)`.
- `backend/src/utils/asyncHandler.ts` — wraps rejected promises into `next(err)`.
- `backend/src/routes/tickets.ts` — extend the existing router; append `ticketsRouter.get('/queue', authMiddleware, listForQueue)`. Update the doc-comment header.
- `backend/src/controllers/ticketsController.spec.ts` — extend the test factory registry with `listForQueue`; add `describe('listForQueue', …)` block: 200 with sorted tickets; 403 when role is not Support Agent; 401 when `req.user` missing.
- `frontend/src/app/services/ticket.service.ts` — existing `listMine()` shape (HD-007). Add `listForQueue(): Promise<Ticket[]>`.
- `frontend/src/app/services/api-error.ts` — `ApiError` class with `status` / `errorCode` / `message`; used as the rejection type for HttpClient calls.
- `frontend/src/app/services/user.service.ts` — `listAgents(): Promise<AgentSummary[]>` for the Owner dropdown (HD-010 already uses this).
- `frontend/src/app/components/atoms/badge-priority/badge-priority.component.ts` — `<badge-priority [priority]>` for the card meta row.
- `frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.ts` — `<chrome-avatar [displayName] [size]="24">` for the card avatar.
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — `<app-chrome>` wrap.
- `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` — loading state.
- `frontend/src/app/models/ticket.ts` — `Ticket` interface (id, number, title, status, priority, submitter, owner, attachment, createdAt, updatedAt, deletedAt).
- `frontend/src/app/models/enums.ts` — `TicketStatus`, `TicketPriority`, `TicketCategory`, `UserRole`.
- `frontend/src/app/services/auth.service.ts` — `currentUser` signal (already used on Ticket Detail). The page reads `currentUser().id` for the Mine filter.
- `frontend/src/styles.css` — `--color-surface`, `--color-border`, `--color-primary`, `--color-muted`, `--status-*-bg`, `--priority-*-bg`, `--role-employee-border`, `--role-support-agent-border`, `--color-kanban-orphan-tint`, `--color-kanban-invalid-drop`, `--button-radius`, `--shadow-card-hover`. Plus the existing role-border classes from HD-011 (`.comment-role-user` / `.comment-role-agent`) — same visual vocabulary extends here.
- `frontend/src/app/app.routes.ts` — `/queue` route already wired with `authGuard + roleGuard(['Support Agent'])`. No change.
- `frontend/src/app/guards/role.guard.ts` — already handles the Support Agent gate; no change.

### New files

- `backend/src/services/ticketService.ts` *(modify)* — add `listForQueue(opts?: ListForUserOptions): Promise<Ticket[]>` helper. Calls `Ticket.findAll({ order: [['createdAt', 'DESC']], limit: 100, include: [submitter, owner, attachment] })`. No `submitterId` filter.
- `backend/src/controllers/ticketsController.ts` *(modify)* — add `export const listForQueue = asyncHandler(...)`. Asserts `req.user.role === 'Support Agent'` else throws `HttpError(403, 'forbidden', ...)`. Calls service; returns `{ tickets: payload, count: payload.length }` shape (mirrors `listMine`).
- `backend/src/routes/tickets.ts` *(modify)* — append `ticketsRouter.get('/queue', authMiddleware, listForQueue)`. Document in the header doc-comment.
- `backend/src/controllers/ticketsController.spec.ts` *(modify)* — extend the test factory registry; add the `describe('listForQueue')` block.
- `frontend/src/app/components/molecules/kanban-card/kanban-card.component.ts` *(new)* — `<kanban-card [ticket] [isDragDisabled]>`. Renders title (2-line clamp), meta row (mono number · priority pill · owner avatar+name+relative timestamp OR Unassigned badge), `draggable` attribute reflecting `isDragDisabled`. OnPush, standalone. Single test: given an Open ticket without an owner, the card renders "Unassigned" instead of an avatar+name.
- `frontend/src/app/components/molecules/kanban-card/kanban-card.component.spec.ts` *(new)* — 1 test (the Open orphan Unassigned rendering).
- `frontend/src/app/pages/agent-kanban-page/agent-kanban-page.component.ts` *(full rewrite — placeholder currently 26 lines)* — full implementation per Implementation Notes.
- `frontend/src/app/pages/agent-kanban-page/agent-kanban-page.component.spec.ts` *(new)* — tests per Acceptance Criteria.

### Modified

- `frontend/src/app/services/ticket.service.ts` — add `listForQueue(): Promise<Ticket[]>` method.
- `frontend/src/styles.css` — likely needs a `.kanban-*-*` rule or two (orphan-pin tint is already a token, but specific drag hover/shake keyframes may need landing in global if the page-specific budget is exceeded). Try to fit in the component first; fall back to global if over budget.

### Deleted

_None._

### Unchanged

- All HD-005–HD-011 atoms / molecules / patterns — untouched.
- `backend/src/models/Ticket.ts` — no schema change.
- `backend/src/utils/validation/ticketValidation.ts` — no new validator (search / filter live client-side for HD-012).

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/services/ticketService.ts` -- modify -- add `listForQueue()` helper returning all tickets newest-first by `createdAt` DESC, eager-load `submitter` / `owner` / `attachment`, limit 100.
- [ ] `backend/src/controllers/ticketsController.ts` -- modify -- add `listForQueue` handler with inline role gate (Support Agent only) returning `{ tickets, count }`.
- [ ] `backend/src/routes/tickets.ts` -- modify -- mount `GET /api/tickets/queue` behind `authMiddleware`. Update the doc-comment header.
- [ ] `backend/src/controllers/ticketsController.spec.ts` -- modify -- extend the test factory registry; add `describe('listForQueue')` describe with 3 tests: 200 happy sorted tickets; 403 when role isn't Support Agent; 401 from authMiddleware when `req.user` is missing.
- [ ] `frontend/src/app/services/ticket.service.ts` -- modify -- add `listForQueue(): Promise<Ticket[]>` method mirroring `listMine()` shape.
- [ ] `frontend/src/app/components/molecules/kanban-card/kanban-card.component.ts` -- create -- the card molecule: title + meta row + draggable attribute.
- [ ] `frontend/src/app/components/molecules/kanban-card/kanban-card.component.spec.ts` -- create -- 1 test: orphan Open renders "Unassigned" badge instead of avatar.
- [ ] `frontend/src/app/pages/agent-kanban-page/agent-kanban-page.component.ts` -- modify -- full rewrite: signal-based state, four columns, drag-and-drop with legal-transition validation, filter strip (search + priority + category + owner) with URL persistence, loading / error / empty render states, `<app-chrome>` wrap.
- [ ] `frontend/src/app/pages/agent-kanban-page/agent-kanban-page.component.spec.ts` -- create -- tests covering: 4-column render, cards by status, drag Open→InProgress patches + signal updates, invalid drop into Closed reverts + no API call, Closed column read-only, click navigates, search filter narrows, URL state syncs, error renders error card, loading renders skeleton, owner filter accepts Mine / Unassigned / agent id.

**Acceptance Criteria:**
- Given Sam loads `/queue`, when `GET /api/tickets/queue` returns 20 tickets across 4 statuses, then the page renders 4 columns with each ticket in the column matching its `status`; Open column sorts oldest-first; orphans pinned at top with the orphan tint + Unassigned badge.
- Given Sam drags an Open card and drops it on the In Progress column, when `PATCH /api/tickets/<id> { status: 'In Progress' }` returns 200, then the card moves to In Progress optimistically on drag-end and the response payload replaces the local instance.
- Given the PATCH fails, when the response rejects, then the card reverts to its source position with no API state change and an inline toast renders "Couldn't move the ticket. Try again.".
- Given Sam drags an Open card and tries to drop it on Closed, when the drop fires, then the card returns to source with a brief shake animation; no API call is made; Closed is rejected because Agent cannot transition to Closed.
- Given Sam tries to drag a Closed card, when mousedown fires, then no drag initiates (`draggable="false"`); the cursor is `not-allowed`; click still opens `/tickets/<id>`.
- Given Sam types "vpn" in the search box (debounced 200ms), when 200ms elapses with no further typing, then the visible cards narrow to those whose number/title/submitter.displayName contain "vpn" (case-insensitive); the `q` query param updates to `vpn`.
- Given the URL is `/queue?priority=High&owner=me`, when the page loads, then after the fetch, only High-priority tickets owned by Sam render; the dropdowns reflect the URL values.
- Given Sam toggles a filter, when the signal changes, then the URL updates via `Router.navigate([], { queryParams, queryParamsHandling: 'merge' })`.
- Given `GET /api/tickets/queue` returns 500, when the response arrives, then the page renders the error card with a Retry button; the filter strip stays visible.
- Given Sam clicks (no drag) an Open card, when the click event fires, then the router navigates to `/tickets/<id>` (Ticket Detail).
- Given the page is loading (initial fetch in flight), when the page first paints, then a skeleton renders: heading + filter strip (disabled) + 4 columns each with 3 card-shape skeletons.
- Given Sam filters to a no-result state, when the filtered list is empty in a column, then that column renders "No tickets match your filters.".
- Given the queue is genuinely empty (no tickets in any status), when the page loads, then each column renders "Nothing here.".
- Given Admin hard-loads `/queue`, when the route guard runs, then Angular redirects to `/forbidden` (defense-in-depth role check on the backend also returns 403).

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. Leave empty at planning time. -->

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass. Empty until first review pass. -->

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` -- expected: 30+ passing (existing 35 + 3 new for `listForQueue`).
- `cd backend && npx jest` (full suite) -- expected: 51/51 passing.
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` -- expected: 0 errors.
- `cd frontend && npx tsc --noEmit -p tsconfig.spec.json` -- expected: 0 errors.
- `cd frontend && npx ng build` -- expected: success. The agent-kanban-page-component lazy chunk should grow to ~30-40 kB raw (page state + filters + drag-and-drop + 4 columns + tests).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/agent-kanban-page.component.spec.ts'` -- expected: 10-13 SUCCESS.
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/kanban-card.component.spec.ts'` -- expected: 1 SUCCESS.
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` (full suite) -- expected: previous 63 SUCCESS + 14 HD-012 = 77 SUCCESS, same 6 pre-existing FAILED.

**Manual checks (if no CLI):**
- Start `npm run dev:backend` + `npm run dev:frontend`. Log in as `sam@company.com`. Land on `/queue`. Verify 4 columns render with tickets in the correct column. Open column has orphans (Unassigned) at the top with the cream tint.
- Drag an Open card to In Progress. Card moves optimistically; PATCH fires; activity log row written. Open Ticket Detail; Status dropdown shows "In Progress".
- Drag an In Progress card to Open. Card returns to In Progress (illegal per matrix?). Verify: actually In Progress → Open IS allowed per the matrix. Card moves; PATCH fires.
- Drag any card to Closed. Card returns to source with a brief shake; no API call. Verify in DevTools Network: no PATCH.
- Try to drag a Closed card. Cursor stays not-allowed; no drag begins.
- Click an Open card. Lands on `/tickets/<id>` (Ticket Detail).
- Type "vpn" in search. After ~200ms, board narrows. URL updates to `/queue?q=vpn`. Refresh — filters preserved.
- Filter to `priority=High`. URL `/queue?priority=High`. Refresh; preserved.
- Stop the backend. Refresh `/queue`. Error card renders with Retry.
- Hard-load `/queue` as Admin (e.g., log in as `admin@`). Lands on `/forbidden`.
