---
title: 'HD-017 — Comments write path (close the activity-refresh gap)'
---

# HD-017 — Comments write path (close the activity-refresh gap)

## Intent

HD-010 shipped `POST /api/tickets/:id/comments` end-to-end: the
backend writes the comment + the `CommentAdded` ActivityLog row
in the same transaction, and the frontend appends the returned
comment to the local signal so the user sees it immediately in
the thread.

The one gap that HD-010 deferred: the **activity timeline** at
the bottom of the page is loaded once on init and never
refetched. After a user submits a comment, the timeline keeps
showing the stale `Created` / `StatusChanged` rows without the
new `CommentAdded` entry. The thread updates; the timeline
does not. The only way to see the new timeline entry is to
reload the page.

HD-017 closes that gap with a targeted, low-risk change: after
a successful `addComment`, refetch the activity timeline and
replace the local signal with the fresh payload. The refetch
failure is non-blocking — the comment is already created, the
thread already shows it; a stale timeline is a tolerable
degraded state and the user can reload to recover.

The other write paths (`patch`, `reopen`, `confirmClose`) are
**not** refetched. They were intentionally excluded in HD-010
per the "no realtime updates" spec rule, and HD-017 is scoped
to the one writer that produces a new conversation entry the
user would expect to see appear immediately (the timeline is
the primary affordance for "I just said something — is it
recorded?").

The backend was already complete; the work for HD-017 is
entirely frontend.

## Boundaries

### In scope

- 1 frontend component edit
  (`ticket-detail-page.component.ts`): ~10 lines in
  `onSendComment` to chain a `listActivity` call after
  `addComment` resolves, plus a header comment update.
- 1 frontend component spec extension
  (`ticket-detail-page.component.spec.ts`): 2 new tests for
  the refetch happy-path and the non-blocking-failure path.
- 1 backend spec extension
  (`ticketValidation.spec.ts`): 11 new tests for
  `validateAddCommentBody` (closes the unit-test gap that
  HD-010 left).
- 1 new frontend service spec
  (`ticket.service.spec.ts`): 9 new tests pinning the
  `addComment` / `listComments` / `listActivity` / `getById`
  wire contract.

### Out of scope

- No realtime / push / SSE / WebSocket updates (still
  out-of-MVP per the HD-010 spec).
- No optimistic-update strategy for the activity timeline
  (we trust the backend's refetch; the round-trip is <100 ms
  in dev).
- No refetch on `patch` / `reopen` / `confirmClose`. Those
  stay as-is — the local `ticket` signal already updates from
  the response, and the activity row the backend writes
  in-tx is acceptable to lag until the next page load.
- No backend changes (the `POST /tickets/:id/comments` endpoint
  and the in-tx ActivityLog write are already correct).
- No backend integration test for the controller endpoint
  (HD-010's coverage is unchanged; the gap is in the
  *frontend* activity-refresh contract, not the API).
- No `multer`/storage / attachment-anything — HD-016 owns
  that domain.

## I/O matrix

| User action | System response |
|---|---|
| Submit a comment on a ticket | Comment appears in the thread (unchanged). Activity timeline is refetched; the new `CommentAdded` row appears in the timeline within ~100 ms. |
| Submit a comment + the activity refetch 5xx's | Comment is in the thread. Timeline keeps the pre-submit rows. No inline error, no top-of-page toast — the failure is swallowed. |
| Submit a comment that fails (400/403/404/401) | No refetch fires (refetch is gated on addComment success). The existing inline composer error renders. |
| Patch status / priority / category / owner | No activity refetch (unchanged from HD-010). |
| Reopen / Confirm-and-close | No activity refetch (unchanged from HD-010). |
| Initial page load | Ticket + comments + activity are loaded in parallel (unchanged from HD-010). |

## Test plan

### Unit (Jasmine) — frontend

`frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts`
gains 2 new tests:

- **HD-017: refetches the activity timeline after a successful
  addComment** — set initial `activity` to a one-row array,
  re-stub `listActivity` to return a different two-row array
  on the second call, fire `onSendComment` with a non-empty
  composer, and assert (a) `addComment` was called, (b)
  `listActivity` was called twice (init + refetch), (c) the
  `activity()` signal now equals the refreshed payload.
- **HD-017: the post-addComment activity refetch failure is
  non-blocking** — re-stub `listActivity` so the second call
  rejects with a 503. After `onSendComment` resolves, assert
  (a) the new comment is in the local `comments()` signal,
  (b) `activity()` is still the init payload (not replaced),
  (c) `composerError()` and `commentSubmitError()` are both
  null (no user-facing error).

`frontend/src/app/services/ticket.service.spec.ts` (new file)
covers the four most-trafficked methods on `TicketService` so
the spec doubles as working wire documentation:

- `addComment`: POST `/api/tickets/:id/comments` with
  `{ body }`, unwraps `{ comment }` on 201. Throws
  `ApiError(400, validation_error)` with `fields.body` on a
  validation error (the same shape the page renders into
  `composerError`). Throws `ApiError(403, forbidden)` on
  Closed, `ApiError(404, not_found)` on missing tickets,
  `ApiError(401, unauthenticated)` on session expiry.
- `listComments`: GET `/api/tickets/:id/comments`, unwraps
  `{ comments, count }`.
- `listActivity`: GET `/api/tickets/:id/activity`, unwraps
  `{ activity, count }`. Empty payload returns `[]`.
- `getById`: GET `/api/tickets/:id`, unwraps `{ ticket }`.

The spec uses `provideHttpClient(withInterceptorsFromDi()) +
provideHttpClientTesting` (not the functional `authInterceptor`)
to test the service in isolation, matching the pattern in
`user.service.spec.ts` (HD-014). The interceptor's
HttpErrorResponse → ApiError conversion is exercised in
`login-page.component.spec.ts` and the ticket-detail page
spec, so the double-wrap is still end-to-end covered.

### Unit (Jest) — backend

`backend/src/utils/validation/ticketValidation.spec.ts` gains a
second `describe` block (`validateAddCommentBody`) with 11
tests, closing the unit-test gap that HD-010 left:

- Happy path returns `{ body: <trimmed> }` (trimmed
  leading / trailing whitespace).
- Rejects a non-object body (array / null) with
  `fields._body = "Request body must be a JSON object."`.
- Rejects a missing / non-string / empty / whitespace-only
  `body` with `fields.body = "Comment body is required."`.
- Rejects a body over 5000 chars with
  `fields.body = "Comment is limited to 5000 characters."`.
- Accepts a body at exactly 5000 chars (boundary).
- Rejects an unknown extra key with
  `fields._body = "Unknown field \"<name>\". Allowed: body."`.

### Manual browser smoke

- Log in as a Support Agent, open any ticket, submit a comment.
  The comment appears in the thread AND the new
  `CommentAdded` row appears in the activity timeline below,
  within ~100 ms.
- Stop the backend mid-session, submit a comment. The thread
  update succeeds (HTTP 201); the timeline refetch 5xx's. The
  page still shows the comment, the timeline keeps its old
  rows, no error toast or inline error appears. Reload the
  page to recover the timeline.
- Submit a 5001-char comment. The composer shows the inline
  error "Comment is limited to 5000 characters." and the
  activity is NOT refetched (the request never fires because
  validation fails client-side — or 400s server-side and the
  page's error path runs without a follow-up refetch).

## Files

**New:**
- `frontend/src/app/services/ticket.service.spec.ts`
- `_bmad-output/implementation-artifacts/spec-hd-017-comments-write-path.md`
  (this file)
- `_bmad-output/hd017.diff`

**Modified:**
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts`
  (chain `listActivity` after `addComment` in `onSendComment`,
  update the file header comment)
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts`
  (add 2 HD-017 tests; update file header)
- `backend/src/utils/validation/ticketValidation.spec.ts`
  (add 11 tests in a new `validateAddCommentBody` describe)

## Implementation order

1. Extend `ticketValidation.spec.ts` with the
   `validateAddCommentBody` describe block. Run
   `cd backend && npm test` — confirm 30/30 pass.
2. Write `ticket.service.spec.ts`. Run
   `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox
   --include='src/app/services/ticket.service.spec.ts'` —
   confirm 9/9 pass.
3. Edit `ticket-detail-page.component.ts`: chain
   `listActivity` after `addComment` in `onSendComment`,
   update the header comment.
4. Extend `ticket-detail-page.component.spec.ts` with 2 new
   tests. Run the same spec in isolation — 33/33 pass.
5. Run the full frontend suite — 316/322 (was 304/311 in the
   D10 baseline; +11 net tests, 0 new failures, 0 new
   baseline failures).
6. `cd frontend && npx ng build --configuration=development`
   — exits 0.
7. Generate `hd017.diff` against the D10 baseline
   (`git diff e712a59..HEAD`).
8. Two-commit pattern:
   - `feat(HD-017): refetch activity after addComment + spec coverage`
   - `docs: HD-017 implementation diff snapshot`
9. Push to `origin/main`.

## Verification

1. `cd backend && npm test` — **30/30 pass** (was 19, +11
   new `validateAddCommentBody` tests).
2. `cd backend && npm run typecheck` — exits 0.
3. `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox` — **316/322 pass**
   (was 304/311 in the D10 baseline; +9 new ticket.service
   tests + 2 new ticket-detail tests = +11; same 6
   pre-existing baseline failures; same 1 Jasmine afterAll
   global error). Final result: 316/322.
4. `cd frontend && npx ng build --configuration=development`
   — exits 0.
5. Manual browser smoke per the I/O matrix.

## Reuse (no new patterns)

- **In-component Promise chain** for the refetch — the same
  pattern `load()` uses for the initial parallel
  `Promise.all`. No new service, no new event, no new
  observable.
- **`apiErrorFrom`-style swallow** for the refetch failure
  is identical to how the page swallows `listAgents`
  failures (graceful degradation in `load()`). Same shape
  (try / catch / no-op), different reason.
- **Service spec pattern** mirrors `user.service.spec.ts`
  (HD-014): `provideHttpClient(withInterceptorsFromDi())` +
  `provideHttpClientTesting` + `HttpTestingController` for
  URL / method / body / response-unwrap coverage. The
  `authInterceptor` has its own coverage in the page specs.
- **Header comment delta** in
  `ticket-detail-page.component.ts` follows the file's
  existing convention (top-of-file doc-comment, plain
  English, "HD-XXX" stamps).

## Notes for the implementer

- **Why not refetch on every mutation?** The activity
  timeline is the primary affordance for "I just contributed
  to the conversation" — that's the comment use case. The
  status / priority / category / owner / reopen / close
  mutations are *actions on the ticket itself*, not
  conversation. The user can see the result of those
  mutations in the meta grid (status / priority / category
  / owner) or the read-only banner (Closed) immediately;
  the timeline entry is informational and tolerable to lag.
- **Why fire-and-forget the refetch (no `await` in the
  caller's `try` block)?** The comment was already
  successfully created; the thread signal was already
  updated; the composer was already cleared. The refetch
  is a UX nicety, not a correctness requirement. We don't
  want a slow refetch to delay the user typing their next
  comment. Inside `onSendComment` the refetch is awaited
  (so the function returns after the timeline settles) but
  the *try block surrounding it* is its own — so a failure
  there can't take down the success path.
- **`postingComment` lifecycle** — set to `true` at the
  top of `onSendComment`, cleared in the outer `finally`.
  The inner refetch reuses the same loading flag so the
  Send button stays disabled for the full
  `addComment + listActivity` round-trip. Total worst-case
  is ~200 ms (sequential 50 ms each on localhost).
- **Backend test gap** — HD-010 shipped the controller + the
  ActivityLog write without an end-to-end test for the
  comment write path. The unit-test gap on
  `validateAddCommentBody` is closed here. The bigger gap
  (an integration test for "POST /comments creates a
  Comment + an ActivityLog in the same tx") is still
  deferred — the repo has no in-memory DB, so the test
  pattern would have to be set up first. Filed as D9 in
  deferred-work.md (still open).
- **Ticket wire shape** — unchanged. The existing
  `ActivityLog` type already includes the
  `CommentAdded` discriminator, and the timeline-entry
  molecule already renders it (HD-011). The refetched
  payload flows through the existing render path
  untouched.
