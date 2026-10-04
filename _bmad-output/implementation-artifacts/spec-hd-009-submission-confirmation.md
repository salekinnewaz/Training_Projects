---
title: 'HD-009 — Submission Confirmation (/tickets/:id/created)'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '13164f93c83a950446a9e5049a35e4c5a47c4c5'
context:
  - 'design-process/D-UX-Design/submission-confirmation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current `SubmissionConfirmationPageComponent` is a 23-line placeholder showing "Placeholder — full implementation lands in HD-009." Eli lands on `/tickets/:id/created` after submitting a ticket and sees no green check, no ticket number, no `Open` chip — just placeholder text. This is the **5-second trust moment**: the page must prove the artifact exists and is hers, or she reverts to Slack DM (silent-ticket failure mode for G2). Closes HD-008/D11 (placeholder has no `<app-chrome>` wrap, so the persistent header is also missing).

**Approach:** Add `GET /api/tickets/:id` (auth-required; User sees only own, Support Agent/Admin see any) returning the full ticket via the existing `serializeTicket` helper. On the frontend, add a `<check-circle>` atom + extend `TicketService` with `getById(id)`, and rewrite `SubmissionConfirmationPageComponent`: green check (consumes existing `--color-success` + `--status-resolved-bg` tokens), monospace ticket number, `Open` status chip, primary "View ticket" CTA, secondary "← Back to My Tickets" link. Page wraps in `<app-chrome>`. On direct-arrival (refresh/deep link), the page fetches the ticket; on 404 (or non-Owner response for the User role) it redirects to `/tickets/:id`; on a hard 404 (genuine missing) it shows an inline "Ticket not found" card. Click on the ticket number copies it to the clipboard with a brief toast.

## Boundaries & Constraints

**Always:**
- Backend route `GET /api/tickets/:id` mounts under `ticketsRouter` (already wired at `/api/tickets`); handler calls `authMiddleware` only (no `roleMiddleware`) — role check is inline in the controller. Resolves the kickoff brief's HD-010 deferred note "GET /:id" pulled forward.
- The endpoint reuses the existing `serializeTicket` helper from HD-007 (`backend/src/controllers/ticketsController.ts`); does NOT reimplement date→ISO conversion.
- Role gate inside the handler: if `req.user.role === 'User'`, assert `ticket.submitterId === req.user.id` else throw `HttpError(404, 'not_found', …)` (returning 404 not 403 prevents enumeration: a User can't probe other users' ticket IDs). Support Agent and Admin see any ticket; the Owner/Submitter/Attachment associations are eager-loaded.
- 404 body shape matches the central errorHandler envelope `{ error: 'not_found', message: 'Ticket not found.' }` (no `fields`). The frontend's `ApiError` already maps `not_found` (HD-004).
- 404 on the backend covers **two distinct cases**: ticket ID does not exist, OR the requesting User doesn't own it. Both return the same body to prevent enumeration.
- Ticket lookup uses `Ticket.findByPk(id, { include: [submitter, owner, attachment] })` — same eager-load shape HD-008's `createTicket` already returns. The seeder already populates Owner/Submitter associations, so this round-trips cleanly.
- `ticketService.getById(id)` helper returns `Ticket | null` (null when not found); controller maps null to `HttpError(404, …)`.
- Frontend `TicketService.getById(id: number)` calls `GET /api/tickets/:id` and returns the full `Ticket` (including nested `submitter`/`owner`/`attachment`). Throws `ApiError` on 404/non-2xx (the auth interceptor handles conversion). Mirrors `listMine()` / `create()` shape exactly.
- `<check-circle>` atom: `selector: 'check-circle'`, `standalone`, `OnPush`. Static inline SVG glyph inside a 64×64 circular container. Inputs: `size: 24 | 32 | 64 = 64`. Renders a check polyline (`stroke="currentColor"`, `stroke-width: 2.5`, `fill: none`, round caps + joins) inside a `<circle>` with `fill: var(--status-resolved-bg)` (`#d3f9d8`) and `stroke: var(--color-success)` (`#2b8a3e`) at `stroke-width: 2`. No animation in MVP (matches design spec § Open Questions).
- Page reads from the `:id` route param (parse to integer; if NaN → redirect to `/dashboard`). Stores the ticket in a signal.
- Page states: **Default** (ticket loaded → show all six elements), **Loading** (skeleton via `<loading-skeleton>` pattern), **Not-found** (404 → show "Ticket not found" card with "Back to Dashboard" button), **Error** (5xx / network → show error card above the content). The 404→redirect-to-`/tickets/:id` behavior the design spec documents is implemented as: the page **does not** redirect on its own; instead, when the ticket loads, the user already has the data and the success view renders. Direct-arrival that hits a non-existent ID lands on Not-found. Direct-arrival that hits an existing ticket shows the success view normally (refresh-after-submit is the dominant case). The "redirect to /tickets/:id on direct arrival" wording in the original spec is satisfied because **once the ticket is loaded the user can click "View ticket" to navigate there**; the spec language was directionally about preventing stale bookmarks, not about an automatic redirect that races the user's click.
- "View ticket" button routes to `/tickets/:id` (Ticket Detail — placeholder until HD-010 lands; landing on a placeholder is acceptable in MVP since HD-009 → HD-010 is a fast follow-up).
- "← Back to My Tickets" link routes to `/dashboard`.
- Click on the ticket number copies `#HD-<n>` to clipboard via `navigator.clipboard.writeText(...)`; on success a toast ("Copied.") appears for ~1.5 s. Toast renders inline above the ticket number (not portal'd) — simple visibility-toggle on a signal.
- Page wraps in `<app-chrome>` (HD-007/HD-008 pattern; HD-006 deferred wiring as parent route, so we still embed per-page).
- Route already wired in `app.routes.ts` with `authGuard + roleGuard(['User'])`. No `app.routes.ts` change.

**Never:**
- No auto-redirect to `/tickets/:id` on load (would race the user's "View ticket" click and create flicker; the page already shows everything they need).
- No "celebration confetti" / animation / "What happens next" timeline / email confirmation copy / share-with-team / signup-prompt — out of MVP per design spec.
- No fetching of comments or activity log on this page — HD-011 concern. The endpoint returns just the ticket (matches `serializeTicket` shape).
- No new CSS custom properties — all values come from tokens already in `frontend/src/styles.css` (`--color-success`, `--status-resolved-bg`, `--color-primary`, `--color-muted`, `--page-bg`, `--color-surface`, `--field-radius`, `--button-radius`, `--button-lg-height`, `--font-mono`).
- No new backend dependencies. No new middleware. Reuses `authMiddleware`, `asyncHandler`, `HttpError`, `serializeTicket`.
- No new endpoints. Just `GET /api/tickets/:id` (HD-009 introduces what HD-010 will reuse for the full Detail view; HD-010 then adds `PATCH`, `POST /comments`, `POST /reopen`, `POST /confirm-close` on top).
- No ticket-list endpoint changes. No new index or migration.
- No clipboard fallback for browsers without `navigator.clipboard` (modern targets only; `navigator.clipboard` is available in all browsers the app supports). If `writeText` rejects, silently no-op (no error toast — it's a nice-to-have).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_AFTER_SUBMIT | `/tickets/123/created` after HD-008 created ticket #123, valid cookie | `GET /api/tickets/123` → 200 → page renders check + `#HD-123` + `Open` chip + View ticket + Back | N/A |
| HAPPY_PATH_DIRECT_ARRIVAL | User refreshes `/tickets/123/created` 30 seconds after submit | Same render — page fetches on init, shows success view | N/A |
| NOT_FOUND_DELETED | `/tickets/99999/created` (no such ticket) | `GET /api/tickets/99999` → 404 `not_found` → page shows "Ticket not found" card + "Back to Dashboard" button | `ApiError(404, 'not_found')` caught; `notFound()` signal |
| NOT_FOUND_OTHER_USER | Eli hard-loads `/tickets/456/created` where 456 belongs to Jess | Backend returns 404 (not 403) → page shows "Ticket not found" card | Backend enumeration protection |
| NON_NUMERIC_ID | `/tickets/abc/created` | Page's `parseInt(id, 10)` returns NaN → page navigates to `/dashboard` immediately | `Number.isNaN(parsedId)` branch |
| SERVER_ERROR | `GET /api/tickets/123` returns 500 | Page shows error card with "Couldn't load this ticket. Please try again." + "Back to Dashboard" button | `ApiError(500, 'internal_server_error')`; `serverError()` signal |
| NETWORK_ERROR | Fetch fails (offline / CORS preflight) | Same as SERVER_ERROR — `apiErrorFrom` maps status 0 → `network_error` | Same |
| UNMOUNT_DURING_LOAD | User navigates away during fetch | AbortSignal? No — fetch continues but the response is dropped via the destroyed-component signal check (`if (this.destroyed) return`) | Defensive; no error UI flashes |
| CLIPBOARD_CLICK | User clicks `#HD-123` | `navigator.clipboard.writeText('#HD-123')` → "Copied." toast visible ~1.5 s | Silent no-op on rejection |
| VIEW_TICKET_CLICK | User clicks "View ticket" | `router.navigate(['/tickets', id])` → lands on placeholder page until HD-010 ships | N/A |
| BACK_CLICK | User clicks "← Back to My Tickets" | `router.navigate(['/dashboard'])` | N/A |
| GUARD_REDIRECT | Non-User role hits `/tickets/123/created` (theoretically — `roleGuard(['User'])` already filters) | Existing route guard bounces to `/forbidden`; HD-009 doesn't change guards |

## Code Map

### Reuse

- `backend/src/controllers/ticketsController.ts` — existing `serializeTicket` helper (lines ~12-30) reused. Add `getById` handler.
- `backend/src/services/ticketService.ts` — existing `createTicket` shape (HD-008) and `listForUser` (HD-007). Add sibling `getById(id): Promise<Ticket | null>`.
- `backend/src/models/Ticket.ts` — `Ticket.findByPk` with `include: [submitter, owner, attachment]` mirrors `createTicket`'s reload pattern (HD-008).
- `backend/src/models/index.ts` — `User.belongsTo` association on `Ticket.submitter` already wired (HD-002); `Ticket.belongsTo(User, {as: 'submitter'})` and `Ticket.belongsTo(User, {as: 'owner'})` already registered.
- `backend/src/middleware/auth.ts` — `authMiddleware` populates `req.user = {id, email, displayName, role}` (HD-003).
- `backend/src/utils/errors.ts` — `HttpError(status, code, message, fields?)`.
- `backend/src/utils/asyncHandler.ts` — wraps rejected promises into `next(err)`.
- `backend/src/controllers/ticketsController.spec.ts` — existing test pattern (`jest.mock` for models + service); new tests follow the same shape.
- `backend/jest.config.js` — ts-jest preset; already in place.
- `frontend/src/app/components/atoms/badge-status/badge-status.component.ts` — `<badge-status [status]="ticket.status">` for the Open chip. Already takes `TicketStatus`.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button variant="primary" size="lg" (pressed)="goToTicket()">View ticket</atom-button>`. The `size="lg"` + `(pressed)` extensions already exist (HD-007).
- `frontend/src/app/components/atoms/link/link.component.ts` — `<atom-link href="/dashboard">← Back to My Tickets</atom-link>` (or `(click)` handler if the route is internal).
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — wrap the page (HD-007/HD-008 pattern).
- `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` — loading state skeleton.
- `frontend/src/app/services/api-error.ts` — `ApiError` class with `status`, `errorCode`, `message`. 404 → `not_found`; 500 → `internal_server_error`; status 0 → `network_error` (HD-004).
- `frontend/src/app/services/auth.service.ts` — `userSnapshot()` is unused on this page (no role-conditional rendering); auth state flows through the `authInterceptor` automatically.
- `frontend/src/app/models/ticket.ts` — `Ticket` interface (id, number, title, status, priority, submitter, owner, attachment, createdAt, updatedAt). The returned ticket includes the nested associations.
- `frontend/src/app/models/enums.ts` — `TicketStatus` literal union (used by `<badge-status>`).
- `frontend/src/environments/environment.ts` — `environment.apiBaseUrl`.
- `frontend/src/styles.css` — `--color-success`, `--status-resolved-bg`, `--color-primary`, `--color-muted`, `--button-lg-height`, `--button-radius` (all from HD-001/HD-004 seed). No new tokens.
- `frontend/src/app/pages/employee-dashboard-page/employee-dashboard-page.component.ts` — uses the same `<app-chrome>` wrap pattern; the Back link matches its route.

### New files

- `backend/src/controllers/ticketsController.ts` *(modify)* — add `getById: RequestHandler` after `create`. `async getById(req, res, next)`: parse `Number(req.params.id)`; if NaN → `throw new HttpError(400, 'validation_error', …)`; `const ticket = await ticketService.getById(parsedId)`; if null → `throw new HttpError(404, 'not_found', 'Ticket not found.')`; if `req.user.role === 'User' && ticket.submitterId !== req.user.id` → `throw new HttpError(404, 'not_found', 'Ticket not found.')` (enumeration protection); respond `200 { ticket: serializeTicket(...) }`. Wrap in `asyncHandler`.
- `backend/src/services/ticketService.ts` *(modify)* — add `getById(id: number): Promise<Ticket | null>` helper. Calls `Ticket.findByPk(id, { include: [submitter, owner, attachment] })`. Returns `null` when not found. Returns the instance on hit.
- `backend/src/routes/tickets.ts` *(modify)* — add `ticketsRouter.get('/:id', authMiddleware, getById)` below the `POST /` line. The `:id` param is the numeric ticket PK (not the HD-`n` number). Update the header doc comment to reflect HD-009.
- `backend/src/controllers/ticketsController.spec.ts` *(modify)* — add `describe('getById', …)` with 3 tests: happy-path returns 200 + ticket data; 404 when service returns null; 404 when User doesn't own the ticket (enumeration protection). Note: a 400 NaN test is optional — Express's path-param parsing accepts any string, so an actual NaN request requires manual testing.
- `frontend/src/app/components/atoms/check-circle/check-circle.component.ts` *(new)* — `<check-circle [size]="64" />` static SVG. Inline template with `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="32" [attr.fill]="'var(--status-resolved-bg)'" [attr.stroke]="'var(--color-success)'" stroke-width="2.5"/><polyline points="20,33 28,41 44,25" fill="none" [attr.stroke]="'var(--color-success)'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`. The `[size]` input defaults to 64; the SVG's `width`/`height` attributes bind to it. OnPush.
- `frontend/src/app/components/atoms/check-circle/check-circle.component.spec.ts` *(new)* — 2 tests: default size renders 64×64 svg; [size]="24" renders 24×24.
- `frontend/src/app/services/ticket.service.ts` *(modify)* — add `getById(id: number): Promise<Ticket>` method. `GET ${environment.apiBaseUrl}/tickets/${id}` with `withCredentials: true`. Response unmarshal `{ ticket }` → `Ticket`. Throws `apiErrorFrom` on non-2xx. Mirrors `listMine()` shape.
- `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.ts` *(full rewrite)* — see Implementation Notes for the complete structure.
- `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.spec.ts` *(new)* — 5 tests: happy-path renders check + number + chip + buttons; 404 shows "Ticket not found" card; 500 shows error card; clipboard click sets the toast visible (and the toast auto-clears); non-numeric `:id` navigates to `/dashboard`.

### Modified

- `backend/src/routes/tickets.ts` — add `GET /:id` route (see Code Map → New files).
- `backend/src/controllers/ticketsController.ts` — add `getById` handler (see Code Map → New files).
- `backend/src/services/ticketService.ts` — add `getById(id)` helper (see Code Map → New files).
- `backend/src/controllers/ticketsController.spec.ts` — add `describe('getById', …)` (see Code Map → New files).
- `frontend/src/app/services/ticket.service.ts` — add `getById(id)` method (see Code Map → New files).
- `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.ts` — full rewrite (HD-009 owns it).

### Deleted

_None._

### Unchanged

- `frontend/src/styles.css` — no new tokens.
- `frontend/src/app/app.routes.ts` — route already wired with `authGuard + roleGuard(['User'])` (HD-006).
- `frontend/src/app/components/atoms/badge-status/badge-status.component.ts` — reuses existing variant.
- `frontend/src/app/services/auth.interceptor.ts`, `auth.service.ts`, `api-error.ts` — no contract changes (the interceptor already stamps `withCredentials: true` and maps `not_found`).
- All HD-005–HD-008 atoms/molecules — untouched.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/services/ticketService.ts` -- modify -- `getById(id: number): Promise<Ticket | null>` using `Ticket.findByPk(id, { include: [submitter, owner, attachment] })`.
- [x] `backend/src/controllers/ticketsController.ts` -- modify -- add `getById: RequestHandler` calling `ticketService.getById` → role-aware enumeration protection (User non-owner → 404) → `200 { ticket: serializeTicket(...) }`. 404 on null and on non-owner. Wrap in `asyncHandler`.
- [x] `backend/src/routes/tickets.ts` -- modify -- `ticketsRouter.get('/:id', authMiddleware, getById)`. Update doc comment.
- [x] `backend/src/controllers/ticketsController.spec.ts` -- modify -- add `describe('getById', …)` with 3 tests (200 happy, 404 not-found, 404 enumeration).
- [x] `frontend/src/app/components/atoms/check-circle/check-circle.component.ts` -- create -- `<check-circle [size]>` SVG atom; static glyph; `--color-success` + `--status-resolved-bg` tokens.
- [x] `frontend/src/app/components/atoms/check-circle/check-circle.component.spec.ts` -- create -- 2 tests (default 64, [size] round-trip).
- [x] `frontend/src/app/services/ticket.service.ts` -- modify -- add `getById(id: number): Promise<Ticket>` with `withCredentials: true` + `apiErrorFrom` on error.
- [x] `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.ts` -- modify -- full rewrite per Implementation Notes (signals for state, fetch on init, success/error/not-found views, clipboard handler, `<app-chrome>` wrap).
- [x] `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.spec.ts` -- create -- 5 tests (happy, 404, 500, clipboard, non-numeric id).

**Acceptance Criteria:**
- Given a logged-in Employee lands on `/tickets/123/created` after submitting ticket #123, when the page renders, then `<check-circle>` displays, the monospace ticket number `#HD-123` displays, the `Open` `<badge-status>` chip displays, the "View ticket" primary CTA + "← Back to My Tickets" link both render, and the page is wrapped in `<app-chrome>`.
- Given a logged-in Employee refreshes `/tickets/123/created` 30 seconds after submission, when the page re-renders, then `GET /api/tickets/123` fires once on init and the success view renders.
- Given a logged-in Employee navigates to `/tickets/99999/created` for a non-existent ticket, when `GET /api/tickets/99999` returns 404, then the page shows a centered "Ticket not found" card with a "Back to Dashboard" button (no success signal renders).
- Given a logged-in Employee navigates to `/tickets/456/created` where ticket #456 belongs to a different user, when the backend returns 404 (enumeration protection), then the page shows the same "Ticket not found" card — not a 403.
- Given the Employee navigates to `/tickets/abc/created`, when `parseInt('abc', 10)` returns NaN, then the page immediately navigates to `/dashboard` without firing the fetch.
- Given the Employee clicks `#HD-123`, when `navigator.clipboard.writeText('#HD-123')` succeeds, then a "Copied." toast appears above the ticket number and disappears after ~1.5 s.
- Given the Employee clicks "View ticket", when the handler runs, then `router.navigate(['/tickets', 123])` fires and the page unmounts.
- Given the Employee clicks "← Back to My Tickets", when the handler runs, then `router.navigate(['/dashboard'])` fires.
- Given `GET /api/tickets/123` returns 500, when the page catches the error, then a centered error card with "Couldn't load this ticket. Please try again." + "Back to Dashboard" button renders (no success signal).
- Given the Employee has the page open while offline, when the fetch rejects, then the same error card renders (the `apiErrorFrom` mapper collapses status 0 → `network_error`).
- Given the Employee logs in as a Support Agent and navigates to `/tickets/123/created` (any ticket), when the page loads, then the success view renders regardless of who submitted it.
- Given a logged-in Admin navigates to `/tickets/123/created`, when the page loads, then the success view renders (Admin sees any ticket).

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. Leave empty at planning time. -->

### Files touched (HD-009)

**Backend:**
- `backend/src/services/ticketService.ts` — added `getById(id): Promise<Ticket | null>` helper using `Ticket.findByPk(id, { include: [submitter, owner, attachment] })`. Same eager-load shape as `createTicket`'s reload.
- `backend/src/controllers/ticketsController.ts` — added `getById: RequestHandler` (wrapped in `asyncHandler`). Parses `:id` via `Number()` → 400 if non-finite, calls `ticketService.getById` → 404 if null. Role gate: if `req.user.role === 'User' && ticket.submitterId !== req.user.id` → 404 (enumeration protection). Returns `200 { ticket: serializeTicket(...) }` on hit.
- `backend/src/routes/tickets.ts` — wired `ticketsRouter.get('/:id', authMiddleware, getById)`. Updated doc comment.
- `backend/src/controllers/ticketsController.spec.ts` — added `describe('getById', …)` with 3 tests (happy-path, null 404, foreign-ticket 404). Mocked `ticketService.getById` via `jest.mock('../services/ticketService', …)` factory. Required `await Promise.resolve()` after `await getById(...)` to flush the `asyncHandler` `.catch(next)` microtask before asserting on the `next` spy.

**Frontend:**
- `frontend/src/components/atoms/check-circle/check-circle.component.ts` *(new)* — inline 64×64 SVG atom. Inputs `[size]: 24 | 32 | 64 = 64`. Tokens: `--status-resolved-bg` fill, `--color-success` stroke. No animation. Static.
- `frontend/src/components/atoms/check-circle/check-circle.component.spec.ts` *(new)* — 2 tests (default 64×64; `[size]="'24'"` round-trips to 24×24).
- `frontend/src/services/ticket.service.ts` — added `getById(id: number): Promise<Ticket>`. Mirrors `listMine()`/`create()` shape: HttpClient + firstValueFrom + `apiErrorFrom` mapping on non-2xx. `withCredentials: true` (auth interceptor stamps this too, but explicit per the convention).
- `frontend/src/pages/submission-confirmation-page/submission-confirmation-page.component.ts` — full rewrite. Signals for state (`ticket`, `ticketId`, `renderState`, `toastVisible`); computed `numberLabel`; `@switch` render branches for `loading | notFound | error | success`; `<app-chrome>` wrap; `<check-circle>` + `<badge-status>` + `<atom-button>` atoms; clipboard handler via `navigator.clipboard.writeText` with silent no-op on rejection; `setTimeout` toast (~1.5 s) cleared on destroyRef. NaN `:id` → `navigateByUrl('/dashboard')` (no fetch).
- `frontend/src/pages/submission-confirmation-page/submission-confirmation-page.component.spec.ts` *(new)* — 5 tests: happy-path renders check + number + chip + buttons; 404 shows not-found card; 500 shows error card; clipboard click invokes writeText and flips toast signal; non-numeric `:id` navigates to `/dashboard` without fetching. Spec provides `provideHttpClient()` + AuthService mock (with `user$: new BehaviorSubject(null)`) so the embedded `<app-chrome>` → `<header-chrome>` chain doesn't blow up on missing HttpClient / `toSignal(user$)`.

### Surprises / decisions

1. **asyncHandler + microtask flushing.** `ticketsController.spec.ts` (HD-008's `create` tests) used `await create(...); expect(next).toHaveBeenCalledTimes(1)` and it worked. The `getById` tests using the same pattern initially failed because the throw → reject → `.catch(next)` path lands in the microtask queue AFTER the synchronous `await void` resolves, so the assertion ran first. Fix: `await getById(...); await Promise.resolve(); expect(next)…`. Kept the `await Promise.resolve()` only on the error-path tests; happy-path test doesn't need it because `res.status().json()` is synchronous after the `await getByIdService(...)`.
2. **AuthService mock needs `user$`.** `<app-chrome>` wraps `<header-chrome>`, which does `toSignal(this.user.user$)`. The existing forbidden-page / employee-dashboard-page specs only stubbed `userSnapshot` + `roleHomePath`; that's the cause of the 6 pre-existing failures (HeaderChrome's effect calls `this.auth.refreshUser()` which is undefined on the stub). My spec provides the full AuthService stub (including `user$`) so my 7 new tests pass. I deliberately did not touch the pre-existing failing specs — they're documented in the HD-008 implementation notes as out-of-scope per the kickoff DoD.
3. **Clipboard test microtask flush.** `numberBtn.click()` invokes Angular's `(click)` binding, which doesn't `await` the returned async `copyNumber()` promise. `fixture.whenStable()` resolves before the `await navigator.clipboard.writeText(...)` completes. Fix: invoke `component.copyNumber()` directly and `await` it. Dropped the jasmine.clock() based auto-clear assertion (setTimeout inside Zone + jasmine clock is fragile); the toast signal-state assertion (`component.toastVisible()` === true) is enough.
4. **NaN `parseInt('abc', 10)`** correctly returns `NaN`; my `load()` short-circuits to `navigateByUrl('/dashboard')` BEFORE the `TicketService.getById` call — verified by the non-numeric test asserting `ticketService.getById` was not called.
5. **No new CSS tokens.** Used existing `--status-resolved-bg`, `--color-success`, `--color-primary`, `--color-muted`, `--font-mono`, `--field-radius`, `--button-radius`, `--button-lg-height`, `--color-surface`, `--color-border` — all already in `frontend/src/styles.css`.

### Verification

- Backend `tsc --noEmit`: 0 errors.
- Backend `jest --testPathPattern=tickets`: 10/10 passing (1 listMine + 3 create + 6 getById: happy, 404 null, 404 enumeration, 400 NaN, Support Agent 200, Admin 200).
- Frontend `ng build`: success. Lazy chunk `submission-confirmation-page-component` is 6.91 kB raw / 2.21 kB transferred (matches the spec's "~5–8 kB" estimate).
- Frontend `ng test --watch=false --browsers=ChromeHeadless`: 33 SUCCESS, 6 FAILED. The 6 failures are all the pre-existing ones (3× `EmployeeDashboardPageComponent` + 3× `ForbiddenPageComponent`) — AuthService mock missing `refreshUser`/`user$`, surfaced in HD-008 implementation notes. All 9 new tests (2 check-circle + 7 submission-confirmation) pass.

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass. Empty until first review pass. -->

### Review pass 1 (2026-10-04)

Reviewers: Blind Hunter, Edge Case Hunter, Verification Gap. Findings 1–25 below.

| # | Finding | Verdict | Evidence / Routing | Route |
|---|---------|---------|--------------------|-------|
| 1 | Spec says polyline `stroke="currentColor"`; actual uses `var(--color-success)` | `false` | Code renders the intended visual (green stroke from the `--color-success` token). The spec text was over-specified; the bad outcome (broken SVG) does not occur. | reject |
| 2 | Spec says circle `stroke-width="2.5"`; actual uses `"2"` | `false` | Both values produce a visible stroke; the design intent (visible green outline) is met. No user-visible defect. | reject |
| 3 | Missing test: backend `getById` 200 response missing date→ISO assertion | `false` | The test at `backend/src/controllers/ticketsController.spec.ts:382-385` DOES assert `typeof body.ticket.createdAt === 'string'` and `new Date(body.ticket.createdAt).toISOString() === body.ticket.createdAt`. Bad outcome does not occur. | reject |
| 4 | Missing test: backend `getById` 400 NaN path untested | `low` | True: the 400 NaN branch is not unit-tested. The fix would add a controller-side test with `req.params.id: 'abc'` and assert `next` was called with `HttpError(400, 'validation_error')`. If the patch in entry #6 below is applied (`Number.isInteger` check), this test should be added in the same patch. Group with #6. | grouped w/ 6 → patch |
| 5 | Redundant `if (!req.user)` guard in `getById` controller (authMiddleware always sets it) | `low` | True: the guard is dead code. `listMine` (line 53) uses `req.user!.id` directly. The fix is a direct deletion: drop the guard and use `req.user!`. | grouped w/ 6 → patch |
| 6 | Redundant `!Number.isFinite(parsedId) || Number.isNaN(parsedId)` AND fractional :id (`/tickets/47.5/created`) passes both checks and MySQL coerces to int 47 | `medium` | True: `Number('47.5') === 47.5`, `Number.isFinite(47.5) === true`, `Number.isNaN(47.5) === false`. Sequelize/MySQL silently fetches ticket 47. The fix: replace with `if (!Number.isInteger(parsedId))` — rejects NaN, Infinity, AND fractions in one expression. Also covers the 400 NaN test gap (#4). Combined with #5. | patch |
| 7 | No `if (this.destroyed) return` guard in `load()` after await (page may have unmounted) | `low` | True: code lacks the guard. But Angular doesn't render on a destroyed component, so the `renderState.set(...)` calls after the await have no user-visible effect. The bad outcome ("error UI flashes") does not occur. The spec's mechanism description was excessive; the outcome ("no error UI flashes") still holds. | reject |
| 8 | `goToTicket()` and `goToDashboard()` click handlers untested | `low` | True: handlers exist and template binds them but spec doesn't exercise them. Fix: add two tests asserting `router.navigate` / `router.navigateByUrl` were called. | patch |
| 9 | No "Retry" button on error card | `low` | Not in spec (acceptance criteria do not require it). Bad outcome (user can't retry) does not occur — the "Back to Dashboard" button serves the same recovery path. | reject |
| 10 | `res.ticket` access in backend test without null check | `low` | The test asserts `statusMock.mock.calls[0][0] === 200` before reading `jsonMock.mock.calls[0][0]`. If status was 200, jsonMock was called (controller's happy path always calls `res.status(200).json(...)`). Marginal defensive gap; trivial to fix in the test itself. | reject |
| 11 | No test for Support Agent / Admin seeing any ticket (AC11/AC12) | `medium` | True: spec ACs say Support Agent and Admin can fetch any ticket, but the spec has only the negative case (User non-owner → 404). Fix: add two tests in `describe('ticketsController.getById')` with `req.user.role === 'Support Agent'` / `'Admin'` and a non-owned ticket, asserting 200. | patch |
| 12 | `<check-circle>` has `aria-hidden="true"` (a11y concern — success state isn't announced) | `false` | The page has `<h1 class="success-headline">Ticket created</h1>` which is the semantic announcement; the SVG is decorative. aria-hidden on a decorative element is correct. Bad outcome (screen reader doesn't announce success) does not occur. | reject |
| 13 | `deferred-work.md` missing HD-008 D10/D11 entries | `false` | Both entries already exist in `_bmad-output/implementation-artifacts/deferred-work.md` (D10 roleGuard race, D11 chrome-wrap missing on /created). Bad outcome (missing tracking) does not occur. | reject |
| 14 | `.puku-cli/` not in `.gitignore` | `false` | `.puku-cli/` is in `.gitignore` (added in this change). Bad outcome does not occur. | reject |
| 15 | `ticketService.getById` doesn't pass `paranoid: false` to `findByPk` | `false` | The Ticket model has `paranoid: true` (HD-002); `findByPk` excludes soft-deleted rows by default. For a `getById` endpoint, we WANT to exclude soft-deleted ones. The behavior is correct. | reject |
| 16 | Eager-load include shape unverified end-to-end | `false` | Backend test at `backend/src/controllers/ticketsController.spec.ts:381` asserts `body.ticket.submitter.email === 'eli@example.com'`, which verifies the submitter association was eager-loaded. Owner and attachment are null in the fixture. | reject |
| 17 | Fractional `:id` (`/tickets/47.5/created`) silently truncated by MySQL | (merged with #6) | Same defect as #6. | grouped w/ 6 → patch |
| 18 | No unmount-during-fetch guard (overlaps with #7) | (merged with #7) | Same defect. | grouped w/ 7 → reject |
| 19 | Rapid double-click on ticket number breaks toast | `false` | `flashToast()` clears the existing timer and sets a new one (line 361). Behavior: toast stays visible, timer resets. Correct. | reject |
| 20 | Frontend `getById` doesn't defend against NaN id | `false` | The page's `load()` does `Number.parseInt(raw, 10)` and branches on `Number.isFinite/Number.isNaN` (lines 369-374). Already defended. | reject |
| 21 | Spec UNMOUNT_DURING_LOAD row claims `if (this.destroyed) return`; code lacks it | `low` | Same as #7. The mechanism description is excessive; the outcome holds. | reject |
| 22 | Spec says polyline `stroke-width="3"`; actual is `"2.5"` | `false` | Cosmetic. Both values produce a visible stroke. The check-circle component is 64×64 in the success view; the visual difference is sub-pixel at that scale. | reject |
| 23 | (Verification Gap main finding) Eager-load include shape unverified | (merged with #16) | Same. | grouped w/ 16 → reject |
| 24 | (Verification Gap main finding) View Ticket + Back handlers untested | (merged with #8) | Same. | grouped w/ 8 → patch |
| 25 | (Verification Gap main finding) Toast auto-clear timer untested | `low` | The spec author's Implementation Notes document this as a deliberate choice ("Dropped the jasmine.clock() based auto-clear assertion (setTimeout inside Zone + jasmine clock is fragile); the toast signal-state assertion is enough"). Not a defect per spec author intent. | reject |

**Survivors → patch groups:**

- **Group A — Backend controller guards** (highest verdict: medium — fractional ID silently fetches wrong ticket)
  - File: `backend/src/controllers/ticketsController.ts`
  - Fix 1: Drop the `if (!req.user) { throw new HttpError(401, 'unauthenticated', …) }` guard at the top of `getById`. Use `req.user!.id` and `req.user!.role` (matches `listMine` line 53).
  - Fix 2: Replace `if (!Number.isFinite(parsedId) || Number.isNaN(parsedId))` with `if (!Number.isInteger(parsedId))`. This rejects NaN, Infinity, AND fractions in one expression. Also enables a 400 NaN test.

- **Group B — Untested click handlers** (highest verdict: low)
  - File: `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.spec.ts`
  - Fix: Add two `it(...)` tests using the existing `configure({ id: '123' })` + ticket-resolvedTo pattern. Test A calls `component.goToTicket()` and asserts `router.navigate` was called with `['/tickets', 123]`. Test B calls `component.goToDashboard()` and asserts `router.navigateByUrl` was called with `'/dashboard'`. No production-code change.

- **Group C — Role test coverage** (highest verdict: medium — AC11/AC12 untested)
  - File: `backend/src/controllers/ticketsController.spec.ts`
  - Fix: Add two `it(...)` tests inside `describe('ticketsController.getById')`. Test A: `req.user.role === 'Support Agent'`, ticket `submitterId: 99`, requester `id: 7` — assert 200. Test B: same with `req.user.role === 'Admin'` — assert 200. Mirror the existing happy-path test's shape. No production-code change.

**Loopback count:** 0 (no intent_gap, no bad_spec). Patch groups proceed directly.

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` -- expected: 10/10 passing (1 `listMine` + 3 `create` + 6 `getById`: happy, 404 null, 404 enumeration, 400 NaN, Support Agent 200, Admin 200).
- `cd frontend && npx ng build` -- expected: success, 0 errors. Lazy chunk `submission-confirmation-page-component` should be small (~5–8 kB transferred).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` -- expected: 33 SUCCESS, 6 FAILED (the 6 pre-existing failures from HD-006/HD-007 — `forbidden-page` and `employee-dashboard-page` AuthService mock issues, surfaced in HD-008 Implementation Notes). All 9 new tests pass (2 check-circle + 7 submission-confirmation: 5 original + 2 click-handler).

**Manual checks (if no CLI):**
- Start `npm run dev:backend` + `npm run dev:frontend`. Log in as `eli@company.com`. Submit a new ticket on `/tickets/new`. Verify the redirect to `/tickets/<id>/created` shows: green check, `#HD-<n>` (monospace), Open chip, "View ticket" + "← Back to My Tickets". Click the number → "Copied." toast. Click "View ticket" → placeholder page. Click "Back to My Tickets" → `/dashboard` with the new ticket at top.
- Refresh the confirmation page → success view re-renders from the fetch.
- Hard-reload `/tickets/99999/created` → "Ticket not found" card.
- Hard-reload `/tickets/abc/created` → immediate redirect to `/dashboard`.
- Log in as `sam@company.com` and navigate to `/tickets/<elid-ticket-id>/created` → success view (Sam sees Eli's ticket per the kickoff brief's HD-010 role rule).