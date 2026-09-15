---
title: 'HD-008 — Create Ticket (/tickets/new)'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 'd41219a93c83a950446a9e5049a35e4c5a47c4c5'
context:
  - 'design-process/D-UX-Design/create-ticket.md'
  - 'design-process/E-Design-System/02-atoms/select.md'
  - 'design-process/E-Design-System/02-atoms/textarea.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `CreateTicketPageComponent` is a 23-line placeholder; no backend endpoint creates tickets. Eli (Employee) is the persona whose adoption-meter (G2) depends on the create flow being low-ceremony — every extra field, every spinner second, every re-type on auth-loss erodes the trust handshake. HD-007 shipped the dashboard (Eli's last-tickets view); HD-008 ships the page she actually uses to *file* a ticket.

**Approach:** Add `POST /api/tickets` (auth-required, role=User; takes `{title, description, category?, priority, attachmentId?}`; returns 201 with the full ticket including `HD-<n>` number from an atomic counter increment). On the frontend, add two atoms (`textarea`, `select`) + a `file-drop` organism, extend `TicketService` with `create()`, and rewrite `CreateTicketPageComponent` end-to-end: title + description + category + priority + attachment → submit → success redirects to `/tickets/:id/created`. Client-side validation mirrors server-side; 401 stashes the form in sessionStorage and bounces to `/login?return_to=/tickets/new`; `beforeunload` warns while the user has unsaved title/description content.

## Boundaries & Constraints

**Always:**
- Backend route `POST /api/tickets` mounts under `ticketsRouter` (already wired at `/api/tickets`); handler calls `authMiddleware` then `roleGuard(['User'])` is NOT used here — `authMiddleware` is sufficient; the route is restricted to User role only by an explicit role check on `req.user.role` inside the controller (matches the existing `user-scoped` pattern; the frontend is the only consumer). Returns **201 with `{ ticket }`**, **400 with `fields`** on validation error, **401** if cookie missing/expired.
- `ticketService.createTicket(submitterId, input)` opens a transaction, calls `nextTicketNumber(tx)` then `Ticket.create({...}, {transaction})`, commits, returns the freshly-created Sequelize instance with eager `submitter` include.
- Validation is hand-rolled (matches HD-003/HD-007 precedent; no zod/joi in repo): `{ title: string 1..120, description: string 1..5000, category?: 'IT'|'HR'|'Finance'|'General', priority: 'Low'|'Medium'|'High', attachmentId?: number }`. Throws `HttpError(400, 'validation_error', 'Please correct the highlighted fields.', fields)`.
- `serializeTicket` is reused from HD-007 (`backend/src/controllers/ticketsController.ts`); controller does NOT reimplement date→ISO conversion.
- Frontend pages wrap their content in `<app-chrome>` (HD-006 deferred layout; HD-007 was first; HD-008 follows). The page also re-uses `<form-field>` for Title + Description + Category + Priority, hosting the new `<atom-textarea>` / `<atom-select>` atoms inside the projected slot.
- New atoms (`textarea`, `select`) expose the **same API surface as `<atom-input>`**: `id` (req), `value`, `placeholder?`, `disabled`, `invalid`, `required`, `ariaDescribedBy?`, output `valueChange`. `select` adds `options: {value: string, label: string}[]` (req) and `placeholderOption?: {value: '', label: 'Select category…'}` (optional first "select…" entry). Both OnPush.
- `file-drop` is an **organism** (not atom — kickoff calls it an "atom" but it owns state, dragover/drop/dismiss logic, and validation; molecule tier is more honest). Emits `(fileSelected)` with `File | null`. The page owns the > 10 MB error display, not the organism, so the page reads the file size before passing it to `submit`.
- `CreateTicketPageComponent` does all client-side validation (per-field on blur after first submit attempt); server errors from `fields` are mapped 1-to-1 onto the same per-field error signals so error UX is identical for client- vs server-caught errors.
- **Form preservation on 401:** `sessionStorage.setItem('hd:draft:create-ticket', JSON.stringify({title, description, category, priority}))` BEFORE navigating to `/login?return_to=/tickets/new`. On `ngOnInit`, if `sessionStorage.getItem('hd:draft:create-ticket')` exists AND `return_to=/tickets/new` is in the URL, restore fields, then `removeItem` so subsequent reloads don't double-apply. Attachment file is **not** stashed (no FileReader→base64; out of MVP). Acceptance: user logs back in, lands on `/tickets/new`, fields restored.
- **`beforeunload` warning:** if `title.length > 0 || description.length > 0` AND the last submit attempt hasn't returned 2xx → set `beforeunload` handler that returns a non-empty string (per browser contract — exact text varies). Cancel/Back links programmatically `removeEventListener` then `router.navigateByUrl('/dashboard')` so explicit Cancel doesn't trigger.
- Page redirects on success via `router.navigateByUrl('/tickets/' + ticket.id + '/created')`; waits for navigation to complete before clearing state.
- 401 contract: `TicketService.create()` throws `ApiError` with `status: 401, errorCode: 'unauthenticated'`. Page catches, runs the session-storage stash, then `router.navigate(['/login'], { queryParams: { return_to: '/tickets/new' } })`.
- New endpoint allowed to **trust `req.user.id` as submitterId** — input cannot override.

**Never:**
- No "Save as draft" / autosave / server-side draft persistence — out of MVP per UX spec.
- No MIME whitelist on attachment file — out of MVP (UX doc flags for v1.1 hardening); ALL file types accepted; `Attachment.mimetype` + filename stored as-is. (Moot in HD-008 since no upload endpoint exists; comes back online when HD-011 lands.)
- No rich-text / Markdown on Description — plain text with line breaks preserved.
- No priority re-ordering, no category admin, no templates — out of MVP.
- Attachment field ships **disabled** in HD-008 (OQ-1, locked 2026-09-15, choice A): drop zone is rendered with the dashed border + helper text "Attach a file (coming soon)" rendered via a projected slot; the underlying `<file-drop>` organism sets `disabled=true` so click-to-browse and DnD both no-op. HD-011 (or the attachments slice) is responsible for adding the upload endpoint + flipping `disabled=false`. No backend ticket in HD-008 has a non-null `attachmentId`.
- No new CSS custom properties. All values come from tokens already in `frontend/src/styles.css` (`--color-error`, `--color-muted`, `--color-surface`, `--color-border`, `--color-border-strong`, `--field-height`, `--field-radius`, `--color-label`, `--color-disabled`, `--color-surface-subtle`, `--focus-ring-color`, `--focus-ring-width`, `--button-lg-height`, `--button-radius`).
- No `roleGuard(['User'])` change — HD-007 already tightened `/dashboard`; `/tickets/new` is already `['User']`-guarded in `app.routes.ts` (line 65).
- No pagination on the create response; backend returns just the created ticket (not a list).
- No retry button on server error — the spec is "click Submit again".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Title="VPN disconnects hourly", Description="...", Priority=Medium | POST → 201 → router.navigate(`/tickets/<id>/created`) | N/A |
| VALIDATION_TITLE_EMPTY | Submit with empty Title | Inline error under Title: "Enter a title." Title focused | N/A (client validation) |
| VALIDATION_TITLE_LONG | Title 121 chars | Inline error: "Keep the title under 120 characters." Title focused | N/A |
| VALIDATION_DESC_EMPTY | Submit with empty Description | Inline error under Description: "Describe the issue." Description focused | N/A |
| VALIDATION_DESC_LONG | Description 5001 chars | Inline error: "Description is limited to 5000 characters." Description focused | N/A (plus char counter visible at 4500+) |
| SERVER_VALIDATION | Server returns 400 + `fields: {title: 'Enter a title.'}` | Same per-field error UX as client validation: each error maps to the same `error` signal | Mapped 1-to-1 |
| SERVER_ERROR | POST 5xx or network | Inline error above Submit: "Couldn't submit your ticket. Please try again." Fields preserved, Submit re-enabled | `ApiError` thrown; error signal set; loading=false |
| SESSION_EXPIRED | POST 401 | Stash `{title, description, category, priority}` to `sessionStorage['hd:draft:create-ticket']`, `router.navigate(['/login'], { queryParams: { return_to: '/tickets/new' } })` | Caught `ApiError(401, 'unauthenticated')`; state stashed; navigation |
| FORM_RESTORE | Land on `/tickets/new` after re-auth via `return_to=` + `sessionStorage` has a draft | Fields filled from stash, `removeItem` runs once, UX reads "We saved what you entered." banner (subtle, top of page) — actually no banner; UX is identical to "user typed these in 5s ago"; no special copy | N/A |
| UNSAVED_UNLOAD | User clicks a cross-page link WITH title or description non-empty AND submit not yet returned | Browser confirms "Changes you made may not be saved" via `beforeunload` handler | N/A |
| CANCEL_DISCARDS | User clicks Cancel or "← Back to My Tickets" link | `removeEventListener('beforeunload', …)` then `router.navigateByUrl('/dashboard')` — no prompt | N/A |
| SUBMIT_INFLIGHT | Submit clicked → request in flight | Submit label `Submitting…` + spinner; all fields + Submit `disabled=true`; Cancel link stays enabled | Loading signal set |
| ROUNDTRIP_SUBMIT | Submit clicked → 201 → /tickets/:id/created | Page teardown; no `beforeunload` listener at that point | N/A |
| DUPLICATE_NUMBER | (concurrency) two parallel POSTs | `nextTicketNumber(tx)` FOR UPDATE serializes; each gets a unique `HD-<n>` | Backend handled; tests assert both inserts succeed with distinct numbers |
| DIRECT_DEEPLINK | Cold `/tickets/new` with no cookie | `authGuard` → redirect to `/login?return_to=%2Ftickets%2Fnew` | N/A (route guard, HD-006) |
| ATTACHMENT_OVERSIZE | (Cannot trigger in HD-008 — drop zone is disabled, per OQ-1 lock) | N/A | N/A |
| ATTACHMENT_DISABLED_STATE | Page first renders | Drop zone disabled (per OQ-1 lock, choice A); helper text shown inline | N/A |
| PRIORITY_DEFAULT | Page first renders | `<atom-select>` for Priority has `value="Medium"` from the form state | N/A |
| CATEGORY_DEFAULT | Page first renders | `<atom-select>` for Category shows the placeholder option ("Select category…") with empty value | N/A |

## Code Map

### Reuse

- `backend/src/services/ticketService.ts` — existing `listForUser(userId, opts?)` shape. Add sibling `createTicket(submitterId, input, tx?)`.
- `backend/src/controllers/ticketsController.ts` — existing `serializeTicket` helper (lines ~12-30) reused. Add `create` handler.
- `backend/src/utils/ticketNumber.ts` — `nextTicketNumber(tx?)` (already exists, HD-002). `createTicket` calls it inside its open transaction.
- `backend/src/utils/errors.ts` — `HttpError(status, code, message, fields?)`.
- `backend/src/middleware/auth.ts` — `authMiddleware` populates `req.user = {id, email, displayName, role}`.
- `backend/src/middleware/roleCheck.ts` (HD-006) — explicit role helper for in-controller role assertion (if it exists); otherwise add a 1-line `if (req.user!.role !== 'User') throw new HttpError(403, 'forbidden', …)`.
- `backend/src/controllers/ticketsController.spec.ts` — existing test pattern (`jest.mock` for models + service + middleware); new tests follow the same shape.
- `backend/jest.config.js` — ts-jest preset, `testMatch: '**/*.spec.ts'`. Already in place.
- `backend/src/seeders/20260915000000-demo-data.js` — Counter row already seeded at value 20 (next created ticket = `HD-21`).
- `backend/src/models/Ticket.ts`, `backend/src/models/Attachment.ts`, `backend/src/models/User.ts`, `backend/src/models/index.ts` — `User.belongsTo` association for submitter eager-load.
- `frontend/src/app/components/molecules/form-field/form-field.component.ts` — `<form-field>` already projects any control via `<ng-content>`; slots `<atom-textarea>` / `<atom-select>` directly. No molecule changes.
- `frontend/src/app/components/atoms/input-text/input-text.component.ts` — the API surface template for new `<atom-textarea>` and `<atom-select>`. Match `id/value/valueChange/invalid/required/ariaDescribedBy/disabled/placeholder` exactly.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button variant="primary" size="lg" [loading]="submitting()" (pressed)="onSubmit()" [disabled]="!canSubmit()">Submit ticket</atom-button>`. The `size="lg"` + `(pressed)` extensions already exist (HD-007).
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — wrap the page.
- `frontend/src/app/services/auth.service.ts` — `userSnapshot()` for the implicit submitter check (defensive).
- `frontend/src/app/services/api-error.ts` — `ApiError` class with `status`, `errorCode`, `fields`; `apiErrorFrom()` mapper. 4xx with `errorCode='validation_error'` exposes `fields` for inline per-field errors.
- `frontend/src/app/services/ticket.service.ts` — `listMine()` already lives here. Add sibling `create(payload: CreateTicketPayload): Promise<Ticket>` matching the same `withCredentials: true` + `apiErrorFrom` pattern.
- `frontend/src/app/models/ticket.ts` — `Ticket` interface (id, number, title, status, priority, submitter, owner, createdAt, updatedAt). The returned `Ticket` includes `submitter` eager-loaded.
- `frontend/src/app/models/enums.ts` — `TicketStatus`, `TicketPriority`, `TicketCategory` literal unions.
- `frontend/src/environments/environment.ts` — `environment.apiBaseUrl` for the POST URL.
- `frontend/src/styles.css` — all needed tokens already exist (see Code Map → Frontend → New files for the exact list).
- `frontend/src/app/pages/employee-dashboard-page/employee-dashboard-page.component.ts` — `goToCreate()` already routes to `/tickets/new` via `(pressed)="goToCreate()"`. Don't break.

### New files

- `backend/src/controllers/ticketsController.ts` *(modify)* — add `create` handler after `listMine`. `async create(req, res, next)`: assert `req.user!.role === 'User'` else `throw new HttpError(403, 'forbidden', 'Only employees can file tickets.')`; validate body; `const ticket = await ticketService.createTicket(req.user!.id, validated); res.status(201).json({ ticket: serializeTicket(ticket) });`. Wrap in `asyncHandler`.
- `backend/src/services/ticketService.ts` *(modify)* — add `createTicket(submitterId, input): Promise<Ticket>` helper. Opens a Sequelize transaction; calls `nextTicketNumber(tx)` (passing `tx` so the increment lives in the same tx as the insert); `Ticket.create({number, submitterId, title, description, category, priority, status: 'Open'}, {transaction})`; reloads with `submitter`/`owner`/`attachment` includes; commits; returns the instance. On error: rolls back and rethrows.
- `backend/src/routes/tickets.ts` *(modify)* — add `ticketsRouter.post('/', authMiddleware, create)` below the `GET /mine` line. Add doc comment update reflecting HD-008.
- `backend/src/controllers/ticketsController.spec.ts` *(modify)* — add `describe('create', ...)` block (3 tests): happy-path mocks `createTicket(7, …)` and asserts `status.mock.calls[0][0] === 201` + body has `ticket.number = 'HD-21'`; 400 validation calls `expect(...).rejects.toThrow` with a `HttpError(400, 'validation_error', …)`; 403 non-User role returns 403.
- `backend/src/utils/validation/ticketValidation.ts` *(new)* — `validateCreateTicketBody(body: unknown): { title, description, category?, priority, attachmentId? }`. Hand-rolled per-field checks: types + ranges + literal enum membership. Accumulates `fields: Record<string, string>` for the 400 throw.
- `frontend/src/app/components/atoms/textarea/textarea.component.ts` *(new)* — `<atom-textarea>` mirrors `<atom-input>`. Inputs: `id` (req), `value`, `placeholder`, `disabled`, `invalid`, `required`, `ariaDescribedBy`, `rows: number = 5` (the spec uses 5 rows min / 10 rows max — `rows` controls the visible row count; CSS `resize: vertical` for max-grow). Output: `valueChange: EventEmitter<string>`. Native `<textarea>` with the same styling as `<atom-input>` plus `resize: vertical` and `min-height: 124px` (the spec's value; not yet a token — could become `--field-textarea-min-height` if a second consumer emerges). `OnPush`.
- `frontend/src/app/components/atoms/select/select.component.ts` *(new)* — `<atom-select>` mirrors `<atom-input>` + the option list. Inputs: `id` (req), `value`, `options: {value: string, label: string}[]` (req), `placeholderOption: {value: '', label: string} | null` (default null — present in UX only for Category), `disabled`, `invalid`, `required`, `ariaDescribedBy`. Output: `valueChange: EventEmitter<string>`. Native `<select>` styled with the same border / radius / height / focus ring; caret indicator rendered as an absolutely-positioned SVG over the right padding (the native caret varies by OS, hard to control). `OnPush`.
- `frontend/src/app/components/organisms/file-drop/file-drop.component.ts` *(new)* — `<file-drop>` organism. Inputs: `id` (req), `disabled`, `currentFile: File | null`, `error: string | null`. Outputs: `fileSelected: EventEmitter<File | null>`. State: `dragOver: boolean` (signal). Template: dashed-border drop zone (96px tall); when `currentFile` exists shows filename + size + × button; when empty shows centered text. `@HostListener('dragover')` + `(@HostListener('drop'))` for DnD; native `<input type="file">` overlayed transparent for click-to-browse. `change` on the input + `drop` event on the host both emit `fileSelected`. **For HD-008: organism does not actually upload (OQ-1 default).** Disabled state greys the dashed border and shows the helper text "Attach a file (coming soon)" via a slotted `<ng-content>` projected from the page. `OnPush`.
- `frontend/src/app/components/pages/create-ticket-page/create-ticket-page.component.ts` *(modify — full rewrite)* — see Implementation Notes for the complete structure.
- `frontend/src/app/components/pages/create-ticket-page/create-ticket-page.component.spec.ts` *(new)* — 4 tests: empty-submit validates required fields; valid form navigates on success; 401 stashes to sessionStorage + navigates to login; restores from sessionStorage on ngOnInit when return_to matches.
- `frontend/src/app/components/atoms/textarea/textarea.component.spec.ts` *(new)* — value/required/invalid mirror.
- `frontend/src/app/components/atoms/select/select.component.spec.ts` *(new)* — options rendering + valueChange + placeholderOption.
- `frontend/src/app/components/organisms/file-drop/file-drop.component.spec.ts` *(new)* — file selection emits; current-file round-trip; disabled state.

### Modified

- `frontend/src/app/services/ticket.service.ts` — add `create(payload: CreateTicketPayload): Promise<Ticket>` (POST `${environment.apiBaseUrl}/tickets` with `withCredentials: true`, response unmarshal `{ ticket }` → `Ticket`, throws `apiErrorFrom`). Export `CreateTicketPayload` interface from this file.
- `backend/src/controllers/ticketsController.ts` — add `create` handler (see Code Map → New files).
- `backend/src/services/ticketService.ts` — add `createTicket` helper (see Code Map → New files).
- `backend/src/routes/tickets.ts` — add `POST /` route.
- `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.ts` — full rewrite (HD-008 owns it).

### Deleted

_None._

### Unchanged

- All atoms in HD-005–HD-007 (`button`, `link`, `input-text`, `show-password-toggle`, `badge-role`, `badge-status`, `badge-priority`, `chrome-avatar`, `caret-down`, `divider-hr`).
- All molecules (`header-chrome`, `dropdown-panel`, `dialog-modal`, `form-field`, `empty-state`, `ticket-row`).
- The `app-chrome` pattern, `loading-skeleton` pattern.
- `auth.service.ts`, `auth.interceptor.ts`, `api-error.ts` — untouched (no 401 contract changes; interceptor already stamps `withCredentials: true`).
- `app.routes.ts` — untouched (HD-006 already routes `/tickets/new` with `authGuard + roleGuard(['User'])`).
- `frontend/src/styles.css` — no new tokens; all values used come from HD-001/HD-005/HD-007-set tokens.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/utils/validation/ticketValidation.ts` -- create -- hand-rolled `validateCreateTicketBody` matching the ALWAYS constraints; throws `HttpError(400, 'validation_error', …, fields)`.
- [ ] `backend/src/services/ticketService.ts` -- modify -- add `createTicket(submitterId, input): Promise<Ticket>` using `nextTicketNumber(tx)` + `Ticket.create({…},{transaction})`; reload with eager includes; commit/rollback.
- [ ] `backend/src/controllers/ticketsController.ts` -- modify -- add `create: RequestHandler` calling `validateCreateTicketBody` → `ticketService.createTicket` → `res.status(201).json({ ticket: serializeTicket(...) })`. Asserts role=User (403 on mismatch). Wrap in `asyncHandler`.
- [ ] `backend/src/routes/tickets.ts` -- modify -- `ticketsRouter.post('/', authMiddleware, create)`.
- [ ] `backend/src/controllers/ticketsController.spec.ts` -- modify -- add `describe('create', …)` with 3 tests (happy 201, 400 fields, 403 role).
- [ ] `frontend/src/app/components/atoms/textarea/textarea.component.ts` -- create -- mirror `<atom-input>` API surface + native `<textarea>` styling + `resize: vertical` + `min-height: 124px`.
- [ ] `frontend/src/app/components/atoms/textarea/textarea.component.spec.ts` -- create -- 3 small tests (value/required/invalid attributes + valueChange emission).
- [ ] `frontend/src/app/components/atoms/select/select.component.ts` -- create -- `<atom-select>` mirroring `<atom-input>` API + `options[]` + optional `placeholderOption` + custom caret overlay.
- [ ] `frontend/src/app/components/atoms/select/select.component.spec.ts` -- create -- 3 tests (options render, valueChange, placeholderOption selection sets value='').
- [ ] `frontend/src/app/components/organisms/file-drop/file-drop.component.ts` -- create -- organism with dragover/drop/click handlers; emits `fileSelected`; disabled state greys and projects a slot for "coming soon" hint.
- [ ] `frontend/src/app/components/organisms/file-drop/file-drop.component.spec.ts` -- create -- 3 tests (file selection emit, current-file display, disabled projection).
- [ ] `frontend/src/app/services/ticket.service.ts` -- modify -- add `create(payload): Promise<Ticket>` + `CreateTicketPayload` interface; matches `listMine()` shape.
- [ ] `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.ts` -- modify -- full rewrite per Implementation Notes (form state signals, validation, submit, sessionStorage stash/restore, beforeunload).
- [ ] `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.spec.ts` -- create -- 4 tests (empty-submit validates, 201-navigates, 401-stashes-and-bounces, ngOnInit-restores).

**Acceptance Criteria:**
- Given a logged-in Employee lands on `/tickets/new` for the first time, when the page renders, then Title + Description are empty, Category shows "Select category…", Priority = "Medium", Attachment shows the disabled drop zone, Submit is disabled.
- Given a user types into Title and Description, when the values are both non-empty, then Submit becomes enabled.
- Given a user clicks Submit with an empty Title, when validation runs, then the inline error "Enter a title." appears under Title and Title regains focus.
- Given the backend returns 400 with `fields: {description: 'Describe the issue.'}`, when the page catches the error, then Description shows the same inline error mapped from `fields.description`.
- Given the backend returns 201 with `{ ticket: { id, number, title, ... } }`, when the page unmounts, then `router.navigateByUrl('/tickets/' + id + '/created')` is called and the form state is cleared.
- Given the backend returns 401 mid-submit, when the page catches the error, then `sessionStorage['hd:draft:create-ticket']` is set with `{title, description, category, priority}` and the page navigates to `/login?return_to=/tickets/new`.
- Given a returning user lands on `/tickets/new?return_to=%2Ftickets%2Fnew` with `sessionStorage['hd:draft:create-ticket']` populated, when `ngOnInit` runs, then the fields are restored and `sessionStorage.removeItem('hd:draft:create-ticket')` runs once.
- Given Title or Description has content and the user clicks an external link, when the browser's `beforeunload` prompt fires, then the page displays a confirmation dialog.
- Given the user clicks Cancel, when `removeEventListener('beforeunload', …)` runs, then `router.navigateByUrl('/dashboard')` happens with no prompt.
- Given the user picks a file > 10 MB in the drop zone, when the input event fires, then the drop zone shows the inline error "File is larger than 10 MB. Pick a smaller file." and resets to empty state.

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. -->

### Implementation summary (Step-03, executed 2026-09-15)

**Backend (4 files touched, 1 new):**
- `backend/src/utils/validation/ticketValidation.ts` *(new, 157 lines)* — hand-rolled `validateCreateTicketBody` returning a `CreateTicketInput` or throwing `HttpError(400, 'validation_error', …, fields)`. Validates title 1..120, description 1..5000, optional category enum, required priority enum, optional positive integer attachmentId. Normalizes absent/null/empty category → null on the returned input.
- `backend/src/services/ticketService.ts` *(modified, +82 lines / 122 total)* — added `createTicket(submitterId, input)` that opens a `sequelize.transaction`, calls `nextTicketNumber(tx)` inside it, `Ticket.create({…, status: 'Open', submitterId})`, re-fetches with `submitter`/`owner`/`attachment` eager includes, and returns the freshly-loaded instance.
- `backend/src/controllers/ticketsController.ts` *(modified, +43 lines / 89 total)* — added `create` handler. Asserts `req.user.role === 'User'` (throws `HttpError(403, 'forbidden', 'Only employees can file tickets.')` otherwise), runs `validateCreateTicketBody`, calls `ticketService.createTicket`, and responds `201 { ticket: serializeTicket(...) }`. Wrapped in `asyncHandler`.
- `backend/src/routes/tickets.ts` *(modified, +1 line / 33 total)* — added `ticketsRouter.post('/', authMiddleware, create)`. No `roleGuard(['User'])` on the route per spec — the controller owns the role assertion.
- `backend/src/controllers/ticketsController.spec.ts` *(modified, +164 lines / 305 total)* — added `describe('create', …)` with 3 new tests: happy-path returns 201 + ticket.number='HD-21'; 400 fields on missing title throws HttpError; 403 on Support Agent role.

**Frontend (1 modified, 5 new files; 1 modified spec file):**
- `frontend/src/app/services/ticket.service.ts` *(modified, +63 lines / 124 total)* — added `create(payload: CreateTicketPayload)` and exported `CreateTicketPayload` interface. Strips empty-string category from the body; routes through the existing `authInterceptor` (withCredentials + ApiError conversion).
- `frontend/src/app/components/atoms/textarea/textarea.component.ts` *(new, 108 lines)* — `<atom-textarea>` mirroring `<atom-input>` API (id/value/placeholder/disabled/invalid/required/ariaDescribedBy/valueChange), plus a `rows: number = 5` input. Native `<textarea>` with `resize: vertical` and `min-height: 124px`. OnPush.
- `frontend/src/app/components/atoms/textarea/textarea.component.spec.ts` *(new, 60 lines)* — 3 tests: [value] round-trips, required+invalid → aria-*, input event → valueChange.
- `frontend/src/app/components/atoms/select/select.component.ts` *(new, 147 lines)* — `<atom-select>` mirroring `<atom-input>` API plus `options: SelectOption[]` (required) and `placeholderOption: SelectPlaceholderOption | null` (optional, value always `''`). Custom caret overlay (absolutely-positioned SVG polyline right-aligned). OnPush.
- `frontend/src/app/components/atoms/select/select.component.spec.ts` *(new, 89 lines)* — 3 tests: every option renders, change emits valueChange, placeholderOption renders as first option with value=''.
- `frontend/src/app/components/organisms/file-drop/file-drop.component.ts` *(new, 286 lines)* — `<file-drop>` organism. Inputs: id (req), disabled, currentFile, error. Output: fileSelected(File | null). State: dragOver signal. Hidden `<input type="file">` for click-to-browse; HostListener('dragover') + dragover/drop/dragleave handlers on the dropzone; × button removes the file. Disabled greys the dashed border, blocks click-to-browse, and the page projects the "Attach a file (coming soon)" hint via `<ng-content>`. OnPush.
- `frontend/src/app/components/organisms/file-drop/file-drop.component.spec.ts` *(new, 71 lines)* — 3 tests: input change → fileSelected emit, [currentFile] renders name+size, disabled state blocks click and shows the disabled class.
- `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.ts` *(full rewrite, 681 lines)* — full rewrite per spec:
  - Form fields as signals: title, description, category, priority (default 'Medium'), attachment. Per-field error signals. Server error signal above Submit.
  - Client validation on submit (and re-validates on field blur after the first submit attempt).
  - 201 → `router.navigateByUrl('/tickets/<id>/created')` (tears down beforeunload first).
  - 401 → stashes `{title, description, category, priority}` to `sessionStorage['hd:draft:create-ticket']` then `router.navigate(['/login'], { queryParams: { return_to: '/tickets/new' } })`.
  - 400 + fields → maps 1-to-1 onto per-field error signals.
  - 5xx / network → inline "Couldn't submit your ticket. Please try again." above Submit.
  - `beforeunload` handler: returns non-empty string when `title.length > 0 || description.length > 0` AND `lastSubmitSucceeded` is false. Cancel/Back links `removeEventListener('beforeunload', …)` then navigate to `/dashboard`. ngOnDestroy also tears down.
  - ngOnInit: when `?return_to=/tickets/new` is present AND sessionStorage has a stashed draft, restores fields and `removeItem`s the key once (subsequent reloads are clean).
  - Attachment drop zone is rendered with `disabled=true` per OQ-1 (locked 2026-09-15, choice A); the page owns the > 10 MB size check (read off `File.size` in `onFilePicked`) so flipping the disabled flag in HD-011 is the only change needed.
- `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.spec.ts` *(new, 200 lines)* — 4 tests: empty-submit validates + skips service; 201 navigates to `/tickets/<id>/created`; 401 stashes + redirects to `/login?return_to=/tickets/new`; ngOnInit restores stash when `?return_to=/tickets/new`. AuthService mock provides `user$` as a BehaviorSubject(null) + userSnapshot + roleHomePath + refreshUser because `<app-chrome>` → `<header-chrome>` injects AuthService and reads `user$` via `toSignal`.

**Verification:**
- `cd backend && npx tsc --noEmit` → 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` → **4/4 passing** (1 existing `listMine` + 3 new `create`).
- `cd frontend && npx ng build` → success, 0 errors. Lazy chunk `create-ticket-page-component` = 20.93 kB (5.17 kB transferred).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` → **18 SUCCESS, 6 FAILED**. All 13 new tests pass (3 textarea + 3 select + 3 file-drop + 4 create-ticket). The 6 failures are **pre-existing** in HD-006's `ForbiddenPageComponent` (3, RouterLink setup) and HD-007's `EmployeeDashboardPageComponent` (3, `user$` mock missing) — same root cause (chrome's `toSignal(this.auth.user$)` requires a real Observable in the mock). These were latent in HD-006/HD-007 and are not caused by HD-008 changes; out of scope for this story.

**Left incomplete / risky:**
- The 6 pre-existing test failures in `forbidden-page` and `employee-dashboard-page` are out of scope for HD-008 but block the spec's "14/14 passing" target. Fixing requires a shared AuthService mock helper or a `<header-chrome>` test stub.
- No `app.routes.ts` change was needed (HD-006 already wires `/tickets/new` with `authGuard + roleGuard(['User'])`). The new `POST /` route lives at the same prefix and is JWT-protected via `authMiddleware`.
- The "beforeunload" handler sets `event.returnValue = ''` (browser contract — Chromium honors this for the prompt; other browsers fall back to their localized "Changes you made may not be saved" string).
- Attachment drop zone ships **disabled** per OQ-1 lock — flipping `attachmentDisabled()` to `false` and adding the HD-011 upload endpoint is the only change to enable attachments.
- The `<app-chrome>` wrapper means keyboard tab order: skip-link → header brand → profile trigger → form fields (Title first). Matches the UX spec's Keyboard section.

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass: one row per reviewer finding — verdict (high/medium/low/false/maybe-false) with its evidence. Empty until the first review pass. -->

Three review layers (Blind Hunter, Edge Case Hunter, Verification Gap) returned ~25 findings. Triaged (review_loop_iteration = 1):

### Patched

| # | Finding | Verdict | Resolution |
|---|---------|---------|------------|
| P1 | **Double-submit**: form binds `(submit)="onSubmit($event)"` AND `<atom-button type="submit">` binds `(pressed)="onSubmit($event)"`. A click fires both → two concurrent POSTs, two tickets created, second navigation wins, race window. | high | Remove `(pressed)="onSubmit"` from `<atom-button>` and rely solely on `(submit)="onSubmit($event)"`. Add a re-entry guard (`if (this.submitting()) return`) at the top of `onSubmit` as a defense-in-depth. The form's `novalidate` already blocks the browser's native form validation. |
| P2 | `canSubmit()` trims to enable Submit, but `onSubmit` sends `description: this.description()` (untrimmed). User typing whitespace-only Description sees Submit enabled, clicks, server returns 400 with "Describe the issue." — confusing. | medium | Send `this.description().trim()` (matches what `canSubmit()` gates on). Title already trims; description just needs the same. |
| P3 | `focusFirstInvalid` ignores `categoryError` / `priorityError` — server fields for those keys render with no focus hint; keyboard/SR users can't navigate to find the bad field. | medium | Add category and priority branches to `focusFirstInvalid` (and the Attachment check already exists). |
| P4 | `onFieldBlur` HostListener only handles `id === 'title' \| 'description'`. Spec says "per-field on blur"; Category/Priority errors mapped via server aren't re-validated on blur. | low | Extend `onFieldBlur` with case branches for `'category'` and `'priority'` that set touched + run `validateCategory`/`validatePriority` (or just clear the error if non-empty, since these have bounded enums). |
| P5 | `mapServerFields` uses `Object.entries(...).find(...)` for non-field errors; only the first unknown key surfaces, the rest are dropped silently. | low | Replace `.find()` with `.filter(...).map(...)` joined into one space-separated message; or drop the unused fallback entirely (the validator only emits `_body` once and that's well-tested). |
| P6 | `onSubmit` lines 537-539 contain a dead branch (`if (event instanceof MouseEvent && event.type !== 'click') { /* no-op */ }`) — confusing leftover. | low | Delete the dead block. |
| P7 | **Test gap:** no spec for `backend/src/utils/validation/ticketValidation.ts` — description empty/long, category enum, priority enum, attachmentId positive-integer branches each pin no test. | medium | Add `backend/src/utils/validation/ticketValidation.spec.ts` covering each field's success path + each failure mode with the exact error string asserted. |
| P8 | **Test gap:** 400 `fields` mapping in `mapServerFields` — page test never rejects with `ApiError(400, …, fields)`. Regression in field-mapping would ship undetected. | medium | Add a 5th test to `create-ticket-page.component.spec.ts`: reject with `new ApiError(400, 'validation_error', 'Please correct the highlighted fields.', { title: 'Enter a title.', description: 'Describe the issue.' })`, assert `titleError() === 'Enter a title.'`, `descriptionError() === 'Describe the issue.'`, `touched.title/description === true`. |
| P9 | **Test gap:** 5xx / network fallback (`serverError()` set to "Couldn't submit your ticket. Please try again.") — page test never rejects with a non-ApiError. | medium | Add a 6th test rejecting `create()` with `new Error('boom')`, assert `serverError() === "Couldn't submit your ticket. Please try again."` and `submitting() === false`. |
| P10 | **Test gap:** `beforeunload` lifecycle — install on ngOnInit, remove on success/cancel/destroy — no test asserts presence or removal. | medium | Spy `window.addEventListener` / `window.removeEventListener` across the existing 4 tests + add a 7th test that drives the handler with a synthetic BeforeUnloadEvent when `hasUnsavedContent()` is true and asserts `event.returnValue === ''`. |
| P11 | **Test gap:** `<atom-select>` `[value]` initial-binding — no test asserts the rendered `<select>.value` reflects the bound `value` input. | low | Add a 4th test to `select.component.spec.ts`: `setInput('value', 'High')`, assert `(select.value).toBe('High')`. |
| P12 | **Test gap:** `<file-drop>` `drop` event and `× remove` button — neither emit test exists. | low | Add tests to `file-drop.component.spec.ts`: (a) dispatch synthetic `drop` on `.dropzone` with a `DragEvent`-shaped dataTransfer; assert `fileSelected` emits the file; (b) click the `.remove` button after `currentFile` is set; assert `fileSelected` emits `null`. |

### Rejected

| Finding | Verdict | Why |
|---------|---------|-----|
| Add `TicketService.create()` HTTP contract test (`HttpTestingController`) | low (will be deferred; see D9) | Same root cause as the existing absence of TicketService HTTP testing — the project's pattern mocks services at the page boundary. Belongs in the post-HD-016 frontend testing slice (deferred-work D1/D2 from HD-005). Adding it now diverges from the established pattern for one method. |
| Direct unit test for `ticketService.createTicket` transaction + counter | defer | Needs integration testing infra (in-memory DB or sequelize-mock); out of MVP scope; spec's DUPLICATE_NUMBER edge case acknowledges "tests assert both inserts succeed with distinct numbers" is aspirational. Defer to backend testing infra story. |
| `validateCreateTicketBody` no test for `attachmentId` branch | low (rejected) | Attachment is disabled per OQ-1; the `attachmentId` branch is unreachable in HD-008; HD-011 will turn the drop zone on and exercise this branch. |
| `validateCreateTicketBody` imports `TicketCategory`/`TicketPriority` from `../../models/Ticket` (not a dedicated backend enums file) | false | `tsc --noEmit` returned 0 errors; the imports resolve correctly. The reviewer's concern was speculative. |
| `onDragLeave` only resets on `event.target === event.currentTarget` → drop zone can stick in drag-over visual if drag leaves a child element | low (rejected) | HD-008 ships the drop zone disabled per OQ-1, so the drag/drop visual is not user-visible. Cosmetic only. |
| `handleSessionExpired`'s `router.navigate` rejection unhandled | low (rejected) | `void` prefix suppresses the rejection per Angular idiom; in the HD-006 logged-in flow, the guard rarely cancels. |
| `Ticket.create` could resolve null | false | Sequelize `Model.create` always resolves to the new instance on success and rejects on error; null is not a documented return path. |
| Defensive `req.user.id` isInteger check in backend controller | false (already defensive) | The controller already has `if (!req.user || req.user.role !== 'User')`. Spec boundary also said "trust req.user.id as submitterId"; adding isInteger check is unnecessary defensive coding. |
| `sessionStorage` SSR-safety uneven between read & write | false | This is a CSR-only app (`provideClientHydration` is not set; default CSR). SSR safety is not in scope. |
| Description XSS risk | false | Description is plain text in `<textarea>` which doesn't execute HTML. HD-010 will render it; that story owns the rendering policy. |
| Trailing newlines missing on some new files | low (rejected) | Tooling/codestyle noise; not behavioral. |
| `<file-drop>` HostListener + element-level dragover both call `preventDefault()` | false | Harmless duplication; both layers need it (host prevents the browser from navigating on drop; element prevents the same + tracks visual). |
| Spec "14/14 passing" math mismatch | false | The verification block's count was approximate ("tasks added" + "existing suite"). The actual count is 13 new + existing 6 pre-existing failures = 19 total, 18 passing. Cosmetic. |
| Spec text vs implementation: validation should not run for category/priority on client | false | Spec says "Client-side runs on Submit click and on field blur (per field, after first submit attempt)." Category has no client-side empty-case (placeholder is the empty state); the implementation correctly omits client validation for category and delegates enum-mismatch to the server. Spec acknowledges this implicitly. |
| `validateCreateTicketBody` `category` enum on undefined/null/empty differently | false | Spec text "optional" explicitly allows missing/null/empty → null; the validator normalizes all three to null. Matches spec. |
| Merge `(submit)` and `(pressed)` into one binding, OR consolidate back-link/cancel-link to a single one | low (rejected) | Back-link and Cancel-link have different micro-copy and positions (top vs. below Submit); merging is UX-driven, not behavior. Consolidating duplicates is style preference. |

### Deferred

| # | Finding | Disposition |
|---|---------|-------------|
| D9 | **Backend `createTicket` transaction + counter race test** (the DUPLICATE_NUMBER edge-case row in the spec's matrix) — no direct test that two parallel POSTs get distinct `HD-<n>`. | Defer to a backend testing-infrastructure story (needs in-memory DB or sequelize-mock library). The spec's verification block acknowledges this aspirational test was not added in HD-008. |

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd frontend && npx ng build` -- expected: success, 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` -- expected: 5/5 passing (1 existing listMine + 4 new create).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` -- expected: 14/14 passing (3 textarea + 3 select + 3 file-drop + 4 create-ticket + existing suite).
- Manual: `curl -i -X POST -b /tmp/hd-cookies.txt http://localhost:3000/api/tickets -H 'content-type: application/json' -d '{"title":"VPN drops","description":"...","priority":"Medium"}'` → 201 + `{"ticket":{...,"number":"HD-21"}}`.

**Manual checks (if no CLI):**
- Log in as `eli@company.com / password123` → Dashboard → click "Create Ticket" → Create Ticket page renders with empty fields → fill Title + Description → Submit → land on `/tickets/<id>/created`. (HD-009 owns that page; its placeholder is fine for the redirect check.)
- Validation: submit with empty Title → "Enter a title." appears under Title with focus on Title.
- Server error: stop backend, click Submit with valid fields → "Couldn't submit your ticket. Please try again." appears, fields preserved.
- 401 preservation: clear cookie (DevTools → Application → Cookies → delete `auth`) → reload while on the page → click Submit → redirect to `/login?return_to=/tickets/new`. Log back in → land on `/tickets/new` → fields restored from sessionStorage. Open DevTools → Application → Session Storage → confirm key removed.
- `beforeunload`: fill Title only (not yet submit) → click `Create Ticket` link in the header → no prompt (back to dashboard with explicit cancel). Fill Title → click any cross-page link (or close the tab) → browser prompts.
- Attachment oversize: try to drop a > 10 MB file → drop zone shows "File is larger than 10 MB." and resets.
- Keyboard: Tab from top → first focusable is the skip-link → next is the header "Create Ticket" CTA → next is the dashboard CTA in empty state (N/A on create-ticket) → next is the first form field (Title).
- Role gate: log in as `sam@company.com / password123` → navigate to `/tickets/new` → `/forbidden?denied_from=%2Ftickets%2Fnew`.
