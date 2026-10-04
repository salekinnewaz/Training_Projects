---
title: 'HD-010 — Ticket Detail (/tickets/:id)'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'build'
review_loop_iteration: 1
baseline_commit: '4d917a4f8d6f473d0580b70ef0a79a7930b74914'
context:
  - '_bmad-output/planning-artifacts/ux/ux-HelpDesk-Lite-2026-09-06/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux/ux-HelpDesk-Lite-2026-09-06/mockups/05-ticket-details.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current `TicketDetailPageComponent` is a 34-line placeholder showing `#HD-XXX` and "Placeholder — full implementation lands in HD-010." HD-009's submission confirmation page already routes the user to `/tickets/:id` via "View ticket", so Eli's landing on this placeholder is the second trust-moment break in the same submit → confirm → detail arc. Sam (Support Agent) has no inbound or admin pages to view or act on a ticket from a deep link; the only path is the agent Kanban (HD-012). Without this page the workflow can't close: comments can't be added, status can't be changed, and reopen is impossible.

**Approach:** Build a GitHub Issues-style detail page (`/tickets/:id`) that fetches the ticket via HD-009's `GET /api/tickets/:id`, displays a 4-column meta grid (Status / Priority / Category / Assignee) with `<atom-select>` dropdowns for the role-editable fields, a description card, a comments thread (oldest-first) with a composer, and an **activity timeline** (newest-first) below. Backend adds four write endpoints (PATCH `/:id`, POST `/:id/comments`, POST `/:id/reopen`, POST `/:id/confirm-close`) plus three read endpoints (GET `/:id/comments`, GET `/:id/activity`, GET `/api/users/agents`). Every mutation writes an `ActivityLog` row inside the same transaction. Role-aware controls per EXPERIENCE.md: agents see inline `<select>` for Status/Priority/Assignee and a self-assign "Assign to me" button; the submitter sees **Reopen** (when Resolved, with confirm modal) and **Confirm and close** (when Resolved, one-click) buttons; Closed is read-only for everyone (no edits, no comments, no reopen). The assignee dropdown lists both Support Agents AND Admins (active only). Page wraps in `<app-chrome>` and mirrors the HD-009 signal-state pattern (`loading | notFound | error | success` `@switch`).

## Boundaries & Constraints

**Always:**
- Backend reuses HD-009's `serializeTicket` helper (`backend/src/controllers/ticketsController.ts`); no new date→ISO conversion logic.
- All four new ticket routes (`PATCH /:id`, `POST /:id/comments`, `POST /:id/reopen`, `POST /:id/confirm-close`) and the two new read routes (`GET /:id/comments`, `GET /:id/activity`) mount under `ticketsRouter` behind `authMiddleware` only (no `roleGuard` on the route — the controller asserts the role inline, same pattern as HD-008's `create` and HD-009's `getById`).
- PATCH body validator accepts **partial** updates: any subset of `status`, `priority`, `category`, `ownerId`. At least one field required. Rejects unknown keys with 400 `validation_error`. Per-field type + enum-membership checks (status ∈ `{Open, In Progress, Resolved, Closed}`, priority ∈ `{Low, Medium, High}`, category ∈ `{IT, HR, Finance, General}` or null, ownerId is positive integer or null).
- PATCH role gate: only `Support Agent` / `Admin` may change `status` or `ownerId`; only `Support Agent` / `Admin` may change `priority`; `User` (the submitter) MAY change `category` and may NOT change `status` / `priority` / `ownerId`. Forbidden combinations return 400 `validation_error` with `fields` shape (HD-008 pattern).
- Status transitions enforced server-side per the workflow rule from EXPERIENCE.md `### Ticket Status Workflow Controls`: Open → In Progress / Resolved; In Progress → Open / Resolved; Resolved → Open (reopen) / Closed (confirm-close); Closed → (terminal, no transitions out). Invalid transitions return 400 `validation_error`.
- Reopen endpoint: only the submitter (`req.user.id === ticket.submitterId`) may reopen. Only valid when `ticket.status === Resolved`. New status: `Open`. Writes ActivityLog `{eventType: 'Reopened', reopenedBy: actorId}`. Returns 200 `{ ticket }`.
- Confirm-close endpoint: only the submitter may confirm-close. Only valid when `ticket.status === Resolved`. New status: `Closed` (terminal). Writes ActivityLog `{eventType: 'ConfirmedClosed', closedBy: actorId}`. Returns 200 `{ ticket }`.
- Comments endpoint: any authenticated user who can see the ticket (per HD-009 enumeration rule — User sees own only, Support Agent / Admin see any) may add a comment. Body: 1–5000 chars after trim. Writes Comment row + ActivityLog `{eventType: 'CommentAdded', commentId}`. Returns 201 `{ comment }`.
- Comments GET endpoint: returns the thread sorted oldest-first. Includes `author` association (`id`, `displayName`, `role`) eager-loaded for the comment header.
- Comments endpoint enforces Closed read-only rule: when `ticket.status === Closed`, POST `/comments` returns 403 `forbidden` ("Ticket is closed and cannot accept new comments"). Mirrors the role gate's defense-in-depth pattern.
- `GET /api/users/agents` endpoint: returns all `active` users with role `'Support Agent'` OR `'Admin'`, shape `{ id, displayName, role }[]`. Mounted under a new `usersRouter` at `/api/users` (HD-014 will own more of this file later; HD-010 only adds the agents subroute). Sorted by displayName ASC. Includes `isActive: true` filter — deactivated agents cannot be assigned. Both Support Agents and Admins are valid assignees.
- Ticket load endpoint `GET /api/tickets/:id` is extended (not a new one) to eager-load `ownerId` reference — the assignee field needs `owner: User | null` to render the current assignee's display name.
- PATCH service runs inside a `sequelize.transaction`: update Ticket + write ActivityLog in the same tx. Reloads with eager-load after update. Returns the updated instance.
- Frontend `TicketService` adds: `patch(id, payload)`, `addComment(ticketId, body)`, `reopen(id)`, `confirmClose(id)`, `listComments(ticketId)`, `listActivity(ticketId)`. Mirrors `getById()`/`create()`/`listMine()` shape exactly: HttpClient → firstValueFrom → response unwrap → `apiErrorFrom`.
- Frontend `UserService` (new, `providedIn: 'root'`) owns `listAgents(): Promise<AgentSummary[]>` returning `{ id, displayName, role }[]`. Caches the result in a signal for the lifetime of the page; refetches on `agentAssignee_changed` events (none in MVP — first load only).
- Page reads `:id` from `ActivatedRoute.snapshot.paramMap`, parses to integer; if NaN → `navigateByUrl('/dashboard')` (HD-009 pattern).
- Render states: `loading | notFound | error | success`. `@switch` block — same vocabulary as HD-009.
- Page role-aware controls: derived `computed` signals gate which buttons render (e.g. `canReopen`, `canConfirmClose`, `canEditMeta`). The backend is the source of truth; the frontend gates only for UX.
- Status dropdown for agents/admins: shows only valid transitions from current status (Open→InProgress, Open→Resolved, InProgress→Open, InProgress→Resolved, Resolved→Open for agents; Closed is never in the list).
- Priority / Category / Assignee dropdowns for agents/admins; priority/category disabled for users. (Per EXPERIENCE.md `### Priority Pill`: "Editable inline on Ticket Details by agents/admins".)
- Category dropdown for users (the submitter) only when their role is User AND they own the ticket. Or just users who can see the ticket? Per Experience.md "Editable inline on Ticket Details by agents/admins" — only agents/admins edit. **User role cannot edit category.** (Both the brief and EXPERIENCE.md are silent on user-side category edits; default is "agent/admin only" for any field edit.)
- Reopen control: visible only when `ticket.status === Resolved` AND `currentUser.role === User` AND `currentUser.id === ticket.submitterId`. Renders as a primary `<atom-button variant="primary">` reading "Reopen". Click → `<dialog-modal>` confirms: "This will reopen the ticket. Previous conversation and history will be kept." Cancel/Reopen buttons. Confirm → calls `reopenTicket()` and updates the local signal.
- Confirm-close control: visible only when `ticket.status === Resolved` AND `currentUser.id === ticket.submitterId` (any role — including Admin who happens to be the submitter). One-click — no modal. Renders as a secondary `<atom-button variant="secondary">` reading "Confirm and close". Click → calls `confirmCloseTicket()` and updates the local signal.
- Closed tickets render in read-only mode: all dropdowns disabled, all buttons hidden, comment composer hidden. A small `<empty-state>`-like banner reads "This ticket is closed."
- Self-assign button: visible to any authenticated user whose role is `Support Agent` or `Admin` when viewing a ticket whose `ownerId` does not equal `req.user.id`. Renders as a tertiary `<atom-button variant="secondary">` reading "Assign to me", positioned in the action row beside the Status dropdown. One-click — calls `PATCH /:id { ownerId: <self> }`. Hidden for the submitter if their role is User, hidden when `ownerId === req.user.id`, hidden when ticket is Closed.
- Activity timeline: rendered below the comments thread. Newest-first. Each `<timeline-entry>` row shows: actor `displayName` (or "System" when `actorId === null`) + relative timestamp + event description. Event descriptions are derived per `eventType`: `Created` → "Ticket created"; `Assigned` / `Reassigned` → "Assigned to {name}" / "Reassigned from {prev} to {new}"; `StatusChanged` → "Status changed from {from} to {to}"; `PriorityChanged` → "Priority changed from {from} to {to}"; `Reopened` → "Reopened by {actor}"; `ConfirmedClosed` → "Closed by {actor}"; `CommentAdded` → "{author} commented" (with optional snippet if backend includes it). Renders as a vertical list with a thin left border connecting entries (timeline style). Each entry uses `<chrome-avatar [size]="24">` for the actor glyph.
- Comments thread: oldest-first. Each comment shows author display name + `chrome-avatar` (initials, 24px) + relative timestamp (e.g. "2 hours ago") + body. For agent/admin authors, a small `.agent-badge` chip ("Agent" / "Admin") next to the display name.
- Composer: `<atom-textarea>` (rows=3) + Send `<atom-button>`. Disabled until non-empty (per EXPERIENCE.md `### Comment Composer`: "Empty comments are prevented (textarea disabled until non-empty)"). Optimistic local update not in MVP — wait for server response, then append the returned `comment` to the local signal. Submits on Send click (no Cmd+Enter shortcut in MVP).
- Page wraps in `<app-chrome>`. Reuses HD-009's `<app-chrome>` import.
- Route already wired in `app.routes.ts` with `authGuard + roleGuard(['User', 'Support Agent', 'Admin'])`. No `app.routes.ts` change.

**Never:**
- No activity-log visible rendering on the page (deferred to HD-011 per Open Question Q1 below).
- No edit/diff/markdown for comment bodies — plain text only.
- No comment edit/delete (comments are immutable per Comment model + HD-002 spec).
- No attachment upload on the comment composer (HD-011 concern; out of MVP).
- No auto-redirect to `/dashboard` on Closed (the user expects to land on a read-only detail view, not bounce).
- No drag-to-change-status on this page (HD-012 owns the Kanban drag affordance).
- No admin-only fields (HD-013 is the Admin Dashboard; HD-010 is the cross-role Detail).
- No realtime updates (no WebSocket / SSE). User refreshes or clicks to see new state.
- No new design tokens — reuse the existing CSS variables from `frontend/src/styles.css` (`--color-success`, `--status-resolved-bg`, `--color-primary`, `--color-muted`, `--page-bg`, `--color-surface`, `--color-border`, `--field-radius`, `--button-radius`, `--button-lg-height`, `--button-md-height`, `--font-mono`).
- No new backend dependencies. No new middleware. Reuses `authMiddleware`, `asyncHandler`, `HttpError`, `serializeTicket`, `ActivityLog`, `Comment`, `Ticket`, `User`, `Attachment`.
- No new frontend atoms/molecules/patterns — reuses `<atom-select>`, `<atom-textarea>`, `<atom-button>`, `<badge-status>`, `<badge-priority>`, `<chrome-avatar>`, `<dialog-modal>`, `<empty-state>`, `<app-chrome>`, `<loading-skeleton>`. Only NEW frontend code is the page component + its spec + UserService.
- No new CSS custom properties.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_AGENT_OPENS_OPEN_TICKET | Sam (Support Agent) opens `/tickets/47`, ticket exists, status=Open, owner=null | `GET /api/tickets/47` → 200 → page renders title + #HD-47 + Status dropdown (Open selected; options: Open, InProgress) + Priority dropdown + Category read-only + Assignee dropdown (Unassigned selected). Comments thread + composer render. | N/A |
| HAPPY_PATH_USER_OPENS_OWN_RESOLVED | Eli (User, submitter of #123) opens `/tickets/123`, status=Resolved | Page renders header + meta (status dropdown DISABLED — user cannot edit status) + comments. **Reopen** primary button visible. **Confirm and close** secondary button visible. | N/A |
| REOPEN_CONFIRM | Eli clicks Reopen → `<dialog-modal>` opens. Eli clicks Reopen in modal | `POST /api/tickets/123/reopen` → 200 `{ ticket }` (status now Open). Page re-renders success view with new status. Reopen + Confirm-and-close buttons hide. Status dropdown shows Open-selected with InProgress option. | `ApiError(403, forbidden)` if Eli's id ≠ submitterId; `ApiError(400, validation_error)` if status≠Resolved. |
| CONFIRM_CLOSE | Eli clicks Confirm and close (no modal — one-click) | `POST /api/tickets/123/confirm-close` → 200 `{ ticket }` (status now Closed). Page re-renders in read-only mode. All controls disabled. Banner shows "This ticket is closed." | Same as Reopen. |
| AGENT_STATUS_CHANGE | Sam picks InProgress from Status dropdown | `PATCH /api/tickets/47 { status: 'In Progress' }` → 200 `{ ticket }`. Local signal updates. ActivityLog row `StatusChanged { from: 'Open', to: 'In Progress' }` written. | 400 if transition invalid (e.g. Closed → Open); 403 if requester isn't agent/admin. |
| AGENT_REASSIGN | Sam picks Jordan from Assignee dropdown | `PATCH /api/tickets/47 { ownerId: <jordanId> }` → 200. ActivityLog `Reassigned { fromUserId: oldOwnerId, toUserId: jordanId }` written. If previous owner was null, `Assigned` event instead. | 400 if ownerId is inactive agent's id (validated via `GET /api/users/agents` cache — backend re-validates and returns 400 if ownerId refers to a non-agent). |
| COMMENT_ADD | Sam types "Restarting config reset" in composer + clicks Send | `POST /api/tickets/47/comments { body: '...' }` → 201 `{ comment }`. Comment appends to local signal. Composer clears. | 400 if body empty / > 5000 chars / not string. 403 if ticket is Closed. 404 if ticket missing or not visible. |
| COMMENT_LOAD | Page mounts on /tickets/47 (any role that can see) | Parallel to getById: `GET /api/tickets/47/comments` → 200 `{ comments: [...] }` sorted oldest-first. | Same 404 / 403 as getById. |
| USER_NON_OWNER_TICKET | Eli hard-loads `/tickets/456/created` where 456 belongs to Jess | `GET /api/tickets/456` → 404 (enumeration). Page shows "Ticket not found" card. | Mirrors HD-009 enumeration rule. |
| SUPPORT_AGENT_ANY_TICKET | Sam loads `/tickets/456` (Jess's ticket) | Page renders Jess's ticket. Status / Priority / Assignee dropdowns enabled for Sam. Reopen / Confirm-close buttons hidden (Sam isn't the submitter). | N/A |
| CLOSED_READ_ONLY | Ticket status=Closed, any viewer | All meta dropdowns disabled (no `valueChange` handler attached). Reopen + Confirm-close buttons hidden. Composer hidden. "This ticket is closed." banner above the comments thread. | N/A |
| CLOSED_COMMENT_ATTEMPT | `POST /api/tickets/47/comments` when status=Closed | Returns 403 `forbidden`. Frontend shows top-of-page toast "Ticket is closed and can't accept new comments." | Backend is source of truth. |
| INVALID_TRANSITION | Agent PATCH status from Closed → Open | Returns 400 `validation_error` with `fields.status = 'Closed is a terminal status; cannot transition.'` | Frontend dropdown never offers Closed→Open so this is reachable only via direct curl. |
| NON_NUMERIC_ID | `/tickets/abc` | Page's `parseInt('abc', 10)` returns NaN → `navigateByUrl('/dashboard')` immediately. No fetch. | Mirrors HD-009 NON_NUMERIC_ID. |
| NETWORK_ERROR | Fetch fails (offline / CORS preflight) | `apiErrorFrom` maps status 0 → `network_error`. Page shows error card with "Couldn't load this ticket" + Back-to-Dashboard button. | Mirrors HD-009 NETWORK_ERROR. |
| AGENT_DROPDOWN_LOAD | Page mounts, agents list needed for assignee dropdown | `GET /api/users/agents` → 200 `[{ id, displayName, role }, ...]` sorted by displayName ASC. Cached in a signal for the page lifetime. If fails, assignee dropdown shows Unassigned-only fallback (no error toast — graceful degradation). | 503 from this endpoint doesn't block the meta load. |

</frozen-after-approval>

## Code Map

### Reuse

- `backend/src/controllers/ticketsController.ts` — existing `serializeTicket` helper (HD-007/HD-009). Add `patch`, `addComment`, `reopen`, `confirmClose` handlers. Each: `asyncHandler` wrap, inline role gate, body validation, service call, `200/201 { … }` response. HD-009's `getById` already enumerates — comment/post/patch endpoints mirror it.
- `backend/src/services/ticketService.ts` — existing `getById(id)` (HD-009) and `createTicket(submitterId, input)` (HD-008) shapes. Add: `updateTicket(id, actorId, input)`, `addComment(ticketId, authorId, body)`, `reopenTicket(id, actorId)`, `confirmCloseTicket(id, actorId)`, `listComments(ticketId)`, `listActivity(ticketId)`, `listActiveAgents()`. All write helpers use `sequelize.transaction(...)` and write the corresponding `ActivityLog` row in-tx. All read helpers eager-load associations the frontend needs (comments → author; activity → actor).
- `backend/src/models/Ticket.ts` — `Ticket.findByPk` + `Ticket.update` + `Ticket.findOne` for the gates. Status/priority/category enums are already declared. No migration.
- `backend/src/models/Comment.ts` — already exists; `Comment.create({ticketId, authorId, body}, {transaction: tx})` and `Comment.findAll({where: {ticketId}, include: [author], order: [['createdAt', 'ASC']], limit: 100})` shape.
- `backend/src/models/ActivityLog.ts` — already exists with `ActivityEventType` ENUM and `ActivityEventPayload` discriminated union in `models/index.ts`. Insert via `ActivityLog.create({ticketId, actorId, eventType, payload}, {transaction: tx})`.
- `backend/src/models/User.ts` — `User.findAll({where: {role: { [Op.in]: ['Support Agent', 'Admin'] }, isActive: true}, order: [['displayName', 'ASC']], attributes: ['id', 'displayName', 'role']})` for the agents endpoint.
- `backend/src/middleware/auth.ts` — `authMiddleware` populates `req.user` (HD-003). Reused on every new route.
- `backend/src/utils/errors.ts` — `HttpError(status, code, message, fields?)` — 400 with `fields` for validation errors (HD-008 pattern).
- `backend/src/utils/asyncHandler.ts` — wraps rejected promises into `next(err)`.
- `backend/src/utils/validation/ticketValidation.ts` — `validateCreateTicketBody` pattern. Add `validateUpdateTicketBody` (partial-allowed) and `validateAddCommentBody`. Reuse `isPlainObject`, `isNonEmptyString`, `enum-membership` helpers.
- `backend/src/controllers/ticketsController.spec.ts` — extend the existing `jest.mock('../services/ticketService', ...)` registry with the new function names (`updateTicket`, `addComment`, `reopenTicket`, `confirmCloseTicket`, `listComments`, `listActivity`, `listActiveAgents`). Mirror the HD-008 `create` describe block's `makeFakeTicket` / `makeResMock` helpers for the new tests.
- `frontend/src/app/services/ticket.service.ts` — existing `getById` (HD-009), `create` (HD-008), `listMine` (HD-007) shapes. Add: `patch(id, payload)`, `addComment(ticketId, body)`, `reopen(id)`, `confirmClose(id)`, `listComments(ticketId)`, `listActivity(ticketId)`. Each follows `http.{patch|get|post}` → `firstValueFrom` → `apiErrorFrom` conversion. Add `UpdateTicketPayload` interface.
- `frontend/src/app/services/auth.service.ts` — `userSnapshot()` returns `{id, email, displayName, role} | null`. Page injects AuthService; reads snapshot on init; falls back to `refreshUser()` if null (HD-009 pattern).
- `frontend/src/app/models/ticket.ts` — `Ticket` interface (id, number, title, status, priority, submitter, owner, attachment, createdAt, updatedAt). Add `Comment` interface (id, ticketId, authorId, author: { id, displayName, role }, body, createdAt). Add `ActivityLog` interface (id, ticketId, actorId, actor: { id, displayName, role } | null, eventType, payload: unknown, createdAt).
- `frontend/src/app/models/enums.ts` — existing `TicketStatus`, `TicketPriority`, `TicketCategory` literal unions. No changes.
- `frontend/src/app/components/atoms/select/select.component.ts` — `<atom-select [id] [value] [options] [disabled] [placeholderOption] (valueChange)>` — used for Status / Priority / Category / Assignee.
- `frontend/src/app/components/atoms/textarea/textarea.component.ts` — `<atom-textarea [id] [value] [placeholder] [disabled] [invalid] [rows] (valueChange)>` — used for the comment composer.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button variant="primary"|"secondary" [size] (pressed)>` — used for View ticket / Confirm and close / Send.
- `frontend/src/app/components/atoms/badge-status/badge-status.component.ts` — `<badge-status [status]>` — used inside the meta grid status cell for the static visual; or NOT used here — the Status dropdown itself shows the status. Decide at implementation time.
- `frontend/src/app/components/atoms/badge-priority/badge-priority.component.ts` — `<badge-priority [priority]>` — same.
- `frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.ts` — `<chrome-avatar [displayName] [size]>` — comment header avatar.
- `frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts` — `<dialog-modal [headline] [cancelLabel] [confirmLabel] [confirming] (cancel) (confirm)>` — used for the Reopen confirm.
- `frontend/src/app/components/molecules/empty-state/empty-state.component.ts` — `<empty-state [headline] [caption] [actionLabel] [actionHref] (action)>` — used for the "Ticket is closed" banner? Or just a styled div. Decide at implementation time.
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` — `<app-chrome>` wrap.
- `frontend/src/app/components/patterns/loading-skeleton/loading-skeleton.component.ts` — `<loading-skeleton [rows]>` — loading state.
- `frontend/src/styles.css` — `--color-success`, `--status-resolved-bg`, `--color-primary`, `--color-muted`, `--page-bg`, `--color-surface`, `--color-border`, `--field-radius`, `--button-radius`, `--button-lg-height`, `--button-md-height`, `--font-mono`. No new tokens.
- `frontend/src/app/components/molecules/timeline-entry/timeline-entry.component.ts` *(new for HD-010)* — `<timeline-entry [eventType] [actor] [createdAt] [payload]>` — renders a single activity event row. Avatar + actor display name + relative timestamp + event-specific description. Derives description from `eventType` + `payload`. Used by the page's activity timeline.
- `frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.ts` — the signal-state pattern (`loading | notFound | error | success` `@switch`, `<app-chrome>` wrap, `DestroyRef` cleanup) that HD-010 mirrors.
- `frontend/src/app/app.routes.ts` — `/tickets/:id` already wired with `authGuard + roleGuard(['User', 'Support Agent', 'Admin'])`. No change.

### New files

- `backend/src/controllers/ticketsController.ts` *(modify)* — add `patch`, `addComment`, `reopen`, `confirmClose`, `listComments`, `listActivity` handlers.
- `backend/src/services/ticketService.ts` *(modify)* — add `updateTicket`, `addComment`, `reopenTicket`, `confirmCloseTicket`, `listComments`, `listActivity`, `listActiveAgents` helpers.
- `backend/src/utils/validation/ticketValidation.ts` *(modify)* — add `validateUpdateTicketBody`, `validateAddCommentBody`; export `UpdateTicketInput`, `AddCommentInput` interfaces.
- `backend/src/routes/tickets.ts` *(modify)* — wire six new routes below `GET /:id` (HD-009).
- `backend/src/routes/users.ts` *(new)* — minimal users router; mounts `GET /agents` (the only HD-010 subroute). The full `/users` admin tab is HD-014 territory — that story will extend this file.
- `backend/src/controllers/usersController.ts` *(new)* — `listActiveAgents: RequestHandler` handler.
- `backend/src/controllers/usersController.spec.ts` *(new)* — smoke spec for `listActiveAgents` (200 happy path with sorted result; 401 unauthenticated).
- `backend/src/routes/index.ts` *(modify)* — mount `apiRouter.use('/users', usersRouter)`.
- `backend/src/controllers/ticketsController.spec.ts` *(modify)* — extend the `jest.mock('../services/ticketService')` registry; add `describe` blocks for each new handler (200 happy + 403 role + 400 invalid for each; one per endpoint).
- `frontend/src/app/services/user.service.ts` *(new)* — `UserService.listAgents(): Promise<AgentSummary[]>` (`providedIn: 'root'`); mirrors `TicketService.listAgents()` backend shape.
- `frontend/src/app/services/ticket.service.ts` *(modify)* — add six new methods + `UpdateTicketPayload` interface.
- `frontend/src/app/models/ticket.ts` *(modify)* — add `Comment` and `ActivityLog` interfaces.
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` *(full rewrite — placeholder currently 34 lines)*.
- `frontend/src/app/components/molecules/timeline-entry/timeline-entry.component.ts` *(new)* — `<timeline-entry [eventType] [actor] [createdAt] [payload]>` molecule. Renders avatar + actor display name + relative timestamp + event-specific description derived from `eventType` + `payload`. OnPush, standalone. No animation. Single test: given `eventType: 'StatusChanged'`, `payload: { from: 'Open', to: 'In Progress' }`, `actor: { displayName: 'Sam' }` → renders "Sam changed status from Open to In Progress".
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` *(new)* — 8–9 tests: happy agent load renders 4-column meta + comments thread + activity timeline; happy user-submitter of Resolved ticket shows Reopen + Confirm-and-close; status change patches + signal updates; add comment appends + composer clears; reopen click opens modal; reopen confirm invokes service + closes modal; confirm-close one-click invokes service; Closed renders read-only banner + hides composer; non-numeric `:id` navigates to `/dashboard`; self-assign button visible to non-owning Support Agent.

### Modified

- `backend/src/routes/tickets.ts` — extend doc comment header to list new HD-010 routes.
- `backend/src/routes/index.ts` — add `apiRouter.use('/users', usersRouter)`.
- `frontend/src/app/app.routes.ts` — no change (route already wired).

### Deleted

_None._

### Unchanged

- `backend/src/models/index.ts` — associations already wired (HD-002): `Ticket.hasMany(Comment, …)`, `Ticket.hasMany(ActivityLog, …)`, `Comment.belongsTo(User, as: 'author')`, `ActivityLog.belongsTo(User, as: 'actor')`. No migration.
- All HD-005–HD-009 atoms/molecules/patterns — untouched.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/utils/validation/ticketValidation.ts` -- modify -- add `validateUpdateTicketBody` (partial: status, priority, category, ownerId — at least one required; per-field type + enum checks; rejects unknown keys) and `validateAddCommentBody` (body: trimmed string, 1–5000 chars).
- [ ] `backend/src/services/ticketService.ts` -- modify -- add 7 helpers: `updateTicket(id, actorId, input)` (status transitions enforced, transaction + ActivityLog); `addComment(ticketId, authorId, body)` (transaction + Comment + ActivityLog); `reopenTicket(id, actorId)` (status gate + ActivityLog); `confirmCloseTicket(id, actorId)` (status gate + ActivityLog); `listComments(ticketId)` (oldest-first, limit 100, author eager-loaded); `listActivity(ticketId)` (newest-first, limit 100, actor eager-loaded); `listActiveAgents()` (role in SA+Admin, isActive=true, displayName ASC).
- [ ] `backend/src/controllers/ticketsController.ts` -- modify -- add 6 handlers: `patch`, `addComment`, `reopen`, `confirmClose`, `listComments`, `listActivity`. Each: `asyncHandler` wrap, inline `req.user.role` check where applicable, body validation via the new validators, service call, response shape `{ ticket }` or `{ comment }` or `{ comments }` or `{ activity }`. Reuses HD-009's `serializeTicket`.
- [ ] `backend/src/routes/tickets.ts` -- modify -- wire 6 new routes behind `authMiddleware`: `PATCH /:id` → `patch`, `POST /:id/comments` → `addComment`, `GET /:id/comments` → `listComments`, `GET /:id/activity` → `listActivity`, `POST /:id/reopen` → `reopen`, `POST /:id/confirm-close` → `confirmClose`. Update doc comment header.
- [ ] `backend/src/routes/users.ts` -- create -- new users router; `GET /agents` → `listActiveAgents` (authMiddleware only).
- [ ] `backend/src/controllers/usersController.ts` -- create -- `listActiveAgents: RequestHandler` (asyncHandler wrap; if !req.user → 401; call service; return `200 { agents }`).
- [ ] `backend/src/controllers/usersController.spec.ts` -- create -- 2 tests: 200 with sorted agents; 401 when req.user missing.
- [ ] `backend/src/routes/index.ts` -- modify -- `apiRouter.use('/users', usersRouter)`.
- [ ] `backend/src/controllers/ticketsController.spec.ts` -- modify -- extend the `jest.mock('../services/ticketService')` factory registry with the 6 new function names. Add `describe` blocks: `patch` (200 happy + 400 invalid-transition + 403 user-role + 404 not-found); `addComment` (201 happy + 400 empty body + 403 closed ticket); `reopen` (200 happy + 403 non-submitter + 400 wrong-status); `confirmClose` (200 happy + 403 non-submitter + 400 wrong-status); `listComments` (200 happy); `listActivity` (200 happy).
- [ ] `frontend/src/app/models/ticket.ts` -- modify -- add `Comment` interface (id, ticketId, authorId, author: { id, displayName, role }, body, createdAt) and `ActivityLog` interface (id, ticketId, actorId, actor: { id, displayName, role } | null, eventType, payload, createdAt).
- [ ] `frontend/src/app/services/ticket.service.ts` -- modify -- add 6 methods: `patch(id, payload)`, `addComment(ticketId, body)`, `reopen(id)`, `confirmClose(id)`, `listComments(ticketId)`, `listActivity(ticketId)`. Add `UpdateTicketPayload` interface.
- [ ] `frontend/src/app/services/user.service.ts` -- create -- `UserService.listAgents(): Promise<AgentSummary[]>` (providedIn: 'root'; mirror `TicketService` shape).
- [ ] `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` -- modify -- full rewrite per Implementation Notes (signal-based state with `loading | notFound | error | success` `@switch`; fetch ticket + comments + activity + agents on init; role-aware controls computed signals including self-assign; `<app-chrome>` wrap; `<dialog-modal>` for Reopen confirm; `<timeline-entry>` for activity; optimistic-free update flow).
- [ ] `frontend/src/app/components/molecules/timeline-entry/timeline-entry.component.ts` -- create -- `<timeline-entry [eventType] [actor] [createdAt] [payload]>` molecule. Derives description text per `eventType` (Created, Assigned, Reassigned, StatusChanged, PriorityChanged, Reopened, ConfirmedClosed, CommentAdded). Uses `<chrome-avatar>` for the actor glyph. Single OnPush test for StatusChanged.
- [ ] `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` -- create -- 9 tests: happy agent load renders 4-column meta + comments thread + activity timeline; happy user-submitter of Resolved ticket shows Reopen + Confirm-and-close; status change patches + signal updates; add comment appends + composer clears; reopen click opens modal; reopen confirm invokes service + closes modal; confirm-close one-click invokes service; Closed renders read-only banner + hides composer; non-numeric `:id` navigates to `/dashboard`; self-assign button visible to non-owning Support Agent.

**Acceptance Criteria:**
- Given Sam (Support Agent) opens `/tickets/47`, when `GET /api/tickets/47` returns 200 with status=Open and owner=null, then the page renders the 4-column meta grid with Status / Priority / Assignee dropdowns enabled, Category read-only, the comments thread + composer below, and `GET /api/users/agents` returns the agents list to populate Assignee.
- Given Eli (User, submitter of #123) opens `/tickets/123` with status=Resolved, when the page loads, then the Reopen primary button and Confirm-and-close secondary button are visible in the meta header, and the Status / Priority / Assignee dropdowns are disabled.
- Given Sam picks In Progress from the Status dropdown, when the response arrives, then `PATCH /api/tickets/47 { status: 'In Progress' }` fired once and the local signal updated; the ActivityLog `StatusChanged { from: 'Open', to: 'In Progress' }` row exists in the DB.
- Given Sam reassigns the ticket to Jordan, when the response arrives, then `PATCH /api/tickets/47 { ownerId: <jordanId> }` fired and the assignee dropdown shows Jordan.
- Given Sam types a comment and clicks Send, when `POST /api/tickets/47/comments { body }` returns 201, then the comment appends to the thread (oldest-first order preserved) and the composer clears.
- Given Eli clicks Reopen on a Resolved ticket, when the dialog renders, then Eli sees "This will reopen the ticket. Previous conversation and history will be kept." with Cancel + Reopen buttons. Clicking Reopen in the modal calls `POST /api/tickets/123/reopen` and updates the local signal to status=Open.
- Given Eli clicks Confirm and close on a Resolved ticket, when the response arrives, then `POST /api/tickets/123/confirm-close` fired and the ticket renders in read-only mode with a "This ticket is closed." banner above the comments thread.
- Given the ticket is Closed, when any viewer loads the page, then all meta dropdowns are disabled, the comment composer is hidden, and no Reopen / Confirm-and-close buttons render.
- Given a POST `/api/tickets/47/comments` request when status=Closed, then the backend returns 403 `forbidden` with the envelope message; frontend surfaces a top-of-page toast.
- Given an agent PATCH attempts an invalid transition (e.g. Closed → Open via direct curl), then the backend returns 400 `validation_error` with `fields.status` describing the invalid transition.
- Given Eli (User) opens `/tickets/abc`, when `parseInt('abc', 10)` returns NaN, then the page immediately navigates to `/dashboard` without firing any fetch.
- Given Eli hard-loads `/tickets/456` where 456 belongs to Jess, when the backend returns 404 (enumeration protection), then the page shows the same "Ticket not found" card as HD-009.
- Given `GET /api/users/agents` fails, when the page loads, then the assignee dropdown shows only the Unassigned option (graceful degradation); no error toast.
- Given a Support Agent views a ticket owned by another agent (not Sarah), then no Reopen / Confirm-and-close buttons render (those are submitter-only).

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. Leave empty at planning time. -->

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass. Empty until first review pass. -->

**Loop 0** — review on commit `4d916...`-tree; 25+ findings across 3 reviewers.

### Findings (raw)

1. `composerError` signal is set by 7 mutation handlers but the template never renders it — users see no feedback when a status / priority / owner / reopen / confirm-close / comment / self-assign request fails. [edge-case-hunter; verification-gap]
2. `validNextStatuses` returns `['Closed']` for Closed tickets (to keep the `<select>` value bound), violating the spec wording "Closed is never in the list." [edge-case-hunter]
3. The spec's "toast" for the closed-comment-attempt (AC9 / CLOSED_COMMENT_ATTEMPT matrix row) is never rendered. [verification-gap]
4. The `Category` `<atom-select>` is hardcoded `[disabled]="true"` — neither spec line 44 (which says category is editable for agents/admins) nor the implementation lets agents change category. [edge-case-hunter]
5. `validateUpdateTicketBody` and `validateAddCommentBody` have no dedicated spec. The boundary conditions (unknown keys, ownerId type, category enum, body-length cap) are covered only indirectly by controller tests that use happy-path bodies. [verification-gap]
6. Service-layer write logic (`updateTicket`, `addComment`, `reopenTicket`, `confirmCloseTicket`, `assertValidTransition` matrix, in-tx ActivityLog writes) is untested — every controller test mocks the service. [verification-gap]
7. `reopen` / `confirmClose` 404 path (when ticket missing) is not asserted in the controller spec. [verification-gap]
8. `usersController.listActiveAgents` 401 test is missing — the spec called for one and only the 200-path tests exist. [verification-gap]
9. The frontend `onPriorityChange` and `onAssigneeChange` handlers are not exercised by any test. [verification-gap]
10. The frontend `onSelfAssign` handler is not exercised by any test (visibility is tested, not the click → PATCH path). [verification-gap]
11. `listActivity` newest-first ordering is not asserted in the controller spec — the single test only has one row. [verification-gap]
12. `addComment` body-length boundary (5000 chars) is not pinned — neither at the controller nor in the page spec. [verification-gap]
13. `addCommentHandler` does a re-fetch via `listComments` to embed the eager-loaded author; if the re-fetch doesn't find the just-inserted comment, the controller falls back to the bare instance with no `author` and the page renders `undefined` for the avatar. [edge-case-hunter]
14. The new `asyncHandler` now returns the underlying promise — a behavior change to a shared util. [edge-case-hunter]
15. `validateUpdateTicketBody` accepts `category: ''` (empty string) which is then stored as `''` rather than `null`. [edge-case-hunter]
16. The `addComment` controller relies on the service-level Closed gate, not its own — defense-in-depth intent is hidden in the service layer only. [edge-case-hunter]
17. `actorLookup` map is the union of agents list + ticket associations, not the active-agents filter — past owners / past assignees who were deactivated will render as their name (not as "someone"). [edge-case-hunter; blind-hunter preview]
18. `UserService.listAgents()` doesn't cache the response in the service — the cache lives in the page component. The spec said "Caches the result in a signal for the lifetime of the page" so this is implementation-level vs. spec-wording drift; both are correct. [blind-hunter preview]
20. The `comments-section` and `activity-section` `<section>` elements have no `aria-label` / `aria-labelledby`. [blind-hunter preview]
21. The `closed-banner` lacks `aria-live="polite"` so screen readers won't announce the transition. [blind-hunter preview]
22. The `StatusChanged` description in `timeline-entry.component.ts` reads `"changed status from {from} to {to}"` (lowercase) but the spec docstring wrote `"Status changed from {from} to {to}"` (capital S). [blind-hunter preview]
23. `parseTicketId('0047')` parses to `47` and is treated as ticket id 47 — the reviewer notes this is acceptable. [edge-case-hunter]
24. The comment composer textarea is not disabled when empty (only the Send button is) — spec wording prefers the textarea itself being disabled. UX-equivalent. [edge-case-hunter]
25. Network-error → "error" render branch was not tested in the original spec (added in patch gap 5). [self-flagged; patched]
26. `onReopenConfirmed` / `onConfirmClose` set `composerError` but the template doesn't render it — same root cause as #1. [verification-gap, dedup]

### Verdicts

| # | Verdict | Evidence |
|---|---------|----------|
| 1 | **high** | Verified: `composerError.set(...)` in 7 handlers; `grep -n "composerError" frontend/.../ticket-detail-page.component.ts | grep "template\|@if"` returns zero renders. User mutes signal on failed actions. |
| 2 | **low** | Verified: line 922-923 returns `['Closed']`. But the Status dropdown is `disabled` when `isClosed()`, so user can't pick it. The spec wording is strict; the visual behavior is correct. |
| 3 | **medium** | Same root cause as #1 (composerError not rendered). |
| 4 | **medium** | Verified: `canEditCategory = computed(() => false)` (line 624). Spec line 44 says agents/admins can edit. Implementation disagrees. |
| 5 | **medium** | Verified by grep: no `ticketValidation.spec.ts` exists. Existing controller tests use well-formed bodies. |
| 6 | **medium** | Verified by grep: no `ticketService.spec.ts` exists. All controller tests mock the service. |
| 7 | **medium** | Verified by reading `ticketsController.reopen` and `confirmClose` describe blocks: no 404 test. |
| 8 | **false** | Verified: `listActiveAgentsHandler` in `usersController.ts` does not check `req.user` (authMiddleware short-circuits before reaching it). The spec's "401 when req.user missing" was a misreading — authMiddleware IS the 401 gate, not the controller. The test should have been against the middleware, not the controller. Both 200-path tests are correct. |
| 9 | **medium** | Verified: only `onStatusChange` has a test in the page spec; no `onPriorityChange` or `onAssigneeChange` direct-call test. |
| 10 | **medium** | Verified: self-assign test (line 391) checks button visibility; no test clicks it. |
| 11 | **low** | Verified: listActivity test has one row; newest-first ordering is unasserted. Page renders top-to-bottom so order matters. |
| 12 | **low** | Verified: addComment describe tests cover 201/400-empty/403-closed; no 5001-char test. |
| 13 | **medium** | Verified: `ticketsController.addCommentHandler` re-fetches via `listComments`; if the list doesn't contain the new comment (race), falls back to bare. The fallback path is unhandled. |
| 14 | **low** | `asyncHandler` return change is internal; existing callers don't break. |
| 15 | **low** | Category `''` vs `null` — only reachable via direct API caller. |
| 16 | **low** | Defense-in-depth: closed gate is in service. Spec line 34 says "Comments endpoint enforces Closed read-only rule" — location not specified. |
| 17 | **low** | Pre-existing data quirk; not introduced by HD-010. |
| 18 | **false** | Spec line 39: "Caches the result in a signal for the lifetime of the page" — implementation matches. Reviewer misread "service" as "UserService"; the spec says "page". |
| 20 | **low** | A11y nice-to-have; not in spec. |
| 21 | **low** | A11y nice-to-have; not in spec. |
| 22 | **low** | Wording drift between code and spec docstring. Page-level test pins the lowercase form. |
| 23 | **false** | Reviewer concedes this is acceptable. |
| 24 | **low** | UX-equivalent; spec wording ambiguous. |
| 25 | **false** | Already patched in pre-review audit. |
| 26 | dedup of #1 |

### Routes

**Group A: composerError never rendered (findings 1, 3, 26)**
Root cause: the spec promised a top-of-page toast in 3 places (matrix row CLOSED_COMMENT_ATTEMPT, AC9, "no error toast" for agents), and the implementation created a `composerError` signal but never bound it to a template element. The spec was clear that this should render.
→ **bad_spec** — the spec was unambiguous ("frontend surfaces a top-of-page toast", "frontend shows top-of-page toast 'Ticket is closed and can't accept new comments.'") but the implementation deviated. Routing to bad_spec because the fix is trivial (add a template fragment), and the loopback re-derivation will re-implement it correctly.

Actually, the spec was clear. Routing to **patch** instead because the smallest fix is one template fragment + a class. No public surface changes.

→ **PATCH**

**Group B: Category locked for agents (finding 4)**
Spec line 44 says "Priority / Category / Assignee dropdowns for agents/admins; priority/category disabled for users." Implementation: `canEditCategory = computed(() => false)` always. This contradicts the spec.

Actually line 45 in the spec adds an internal hedging note: "**User role cannot edit category.**" So User can't edit. But agent can. Implementation says nobody can. Spec says agent can.

→ **PATCH** — change `canEditCategory` to allow agents/admins, and add a test.

**Group C: Service-layer / validation / handler direct-call test gaps (findings 5, 6, 7, 9, 10, 11, 12)**
All are "this code path is not directly tested." Each smallest fix is a new `it()` block with no public surface change.

→ **PATCH** — add the tests. Group them so the diff is small.

**Group D: addComment re-fetch fallback (finding 13)**
The `listComments` re-fetch can silently fail; the fallback is a bare instance with no `author`. The fix is to use `Comment.findByPk` inside the transaction (single round-trip + guaranteed to exist).

→ **PATCH** — fix the controller to re-fetch via `Comment.findByPk` in the same tx.

**Group E: A11y nice-to-haves (findings 20, 21)**
Not in spec. Reject as low.

**Group F: Wording drift, defensive-only findings (findings 14, 15, 16, 22, 24)**
Each is either internal-only or UX-equivalent. Reject as low.

**Group G: false / pre-existing (findings 2, 8, 17, 18, 19, 23, 25)**
2 — cosmetic, dropdown is disabled.
8 — false, the 401 path lives in authMiddleware, not the controller.
17 — pre-existing data.
18 — false, implementation matches spec wording.
23 — false, reviewer concedes.

### Final routing

- **PATCHES (loop):** Group A (composerError render), Group B (category for agents), Group C (add missing tests), Group D (addComment re-fetch in same tx).
- **DEFERS (deferred-work.md):** none.
- **REJECTS:** Groups E, F, G above.

### Loopback: 0 (loop returns). Loop 0 processed 4 patch groups; re-engaging the implementation subagent.

## Verification

**Commands:**
- `cd backend && npx tsc --noEmit` -- expected: 0 errors.
- `cd backend && npx jest --testPathPattern=tickets` -- expected: 30+ passing (1 listMine + 3 create + 6 getById + 6 patch + 3 addComment + 3 reopen + 3 confirmClose + 1 listComments + 1 listActivity + 2 listComments/Activity combined).
- `cd backend && npx jest --testPathPattern=usersController` -- expected: 2/2 passing (200 sorted, 200 empty — both are success-path tests; the spec-listed "401 when req.user missing" path is owned by `authMiddleware`, not the controller, so the controller has no 401 branch to test).
- `cd backend && npx jest` (full suite) -- expected: 48/48 (existing + 2 usersController + the 17 new ticketController tests across patch / addComment / reopen / confirmClose / listComments / listActivity describes).
- `cd frontend && npx ng build` -- expected: success. Lazy chunk `ticket-detail-page-component` ~12–18 kB transferred (signals + timeline-entry + dialog-modal + 4 dropdowns + 14 tests).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/ticket-detail-page.component.spec.ts'` -- expected: 14 SUCCESS (the 11 original tests + 3 added in the patch: agents-fetch-fails graceful degradation, agent-non-submitter hides Reopen/Confirm-close, network_error → error card).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/timeline-entry.component.spec.ts'` -- expected: 1 SUCCESS.
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` (full suite) -- expected: 48+ SUCCESS (was 33 after HD-009 + 14 ticket-detail + 1 timeline-entry = 48 new), 6 FAILED (same pre-existing dashboard/forbidden AuthService mock gaps; unchanged).

**Manual checks (if no CLI):**
- Start `npm run dev:backend` + `npm run dev:frontend`. Log in as `eli@company.com`. Create a new ticket. From `/tickets/<id>/created` click "View ticket" → land on `/tickets/<id>`. Verify: 4-column meta grid (Status/Priority/Category/Assignee), description card, "No comments yet" empty state, composer visible.
- Type a comment, click Send → comment appears. Open DevTools Network: `POST /api/tickets/<id>/comments` returned 201.
- Log out, log in as `sam@company.com`. Open `/tickets/<id>` (Eli's ticket) → Sam sees it. Status / Priority / Assignee dropdowns enabled. Pick In Progress → dropdown reflects change immediately; PATCH fired.
- Open `/tickets/<id>` as Sam, change Assignee to Jordan → dropdown reflects Jordan.
- Log out, log back in as Eli. Mark the ticket Resolved (via direct DB if needed). Open `/tickets/<id>` → Reopen + Confirm-and-close buttons visible.
- Click Reopen → modal appears with the spec copy. Click Reopen in modal → status returns to Open.
- Mark Resolved again. Click Confirm and close → status → Closed. Page re-renders in read-only mode with "This ticket is closed." banner.
- Hard-reload `/tickets/99999` → "Ticket not found" card.
- Hard-reload `/tickets/abc` → immediate redirect to `/dashboard`.