---
title: 'HD-011 — Comments + Activity Log polish'
type: 'feature'
created: '2026-10-12'
status: 'in-progress'
route: 'build'
review_loop_iteration: 0
baseline_commit: '756e67a4db3ecbee249930b7a1a42caecb0d3743'
context:
  - 'design-process/D-UX-Design/ticket-detail.md'
  - '_bmad-output/implementation-artifacts/spec-hd-010-ticket-detail.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** HD-010 shipped the comments thread + activity timeline + composer + the four backend write endpoints (PATCH / POST comments / POST reopen / POST confirm-close) and the two read endpoints (GET comments / GET activity) that the kickoff brief attributes to **HD-011 — Ticket comments + activity log**. The remaining gaps are polish items called out in `design-process/D-UX-Design/ticket-detail.md` that the HD-010 implementation did not deliver:

1. **Role-border colors on comment cards** — UX §3 says "Subtle left border in the role-badge color (Employee `#adb5bd`, Support Agent `#4263eb`) so conversation partners are visually scannable." The current `<li class="comment">` has no left border. This is the main "scannable conversation" affordance the UX doc promised.
2. **Relative vs absolute timestamps on comments** — UX §3 says "timestamp ('Sep 14, 09:42' / '3 hours ago' relative if < 24 h, absolute otherwise)." The page currently shows the raw ISO string (`{{ c.createdAt }}`). Activity log already shows relative ("2 hours ago").
3. **Keyboard shortcut for composer** — UX §3 says "Send triggers on click or Enter (with `Shift+Enter` for newline)." Currently only the Send button works; pressing Enter in the textarea is the textarea's default newline behavior with no submit hook.
4. **Inline submit-error under the comment composer** — UX §3 says "on failure it remains in the field with an inline error under the field: 'Couldn't send your comment. Try again.'" The current implementation surfaces all errors via a top-of-page `composerError` toast. The spec text for the comment case is distinct from the spec text for status/priority/owner/reopen/close (which don't have a specific message), so the comment failure path should render a separate inline error bound to the composer.

**Approach:** Five small, isolated edits to `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` plus a focused test extension:
- Add a `commentRoleClass` computed that maps `User` → `.comment-role-user` and `Support Agent` / `Admin` → `.comment-role-agent` (per UX, "Admin displays as Support Agent here").
- Add a `formatCommentTimestamp` helper that returns a relative string for `now − createdAt < 24h` and an absolute `Sep 14, 09:42` string otherwise; reuse the existing `formatRelative` pattern from `timeline-entry.component.ts`.
- Add a host-listener `keydown` on the comment composer `<atom-textarea>` wrapper: Enter without Shift → call `onSendComment`; Shift+Enter → no-op (let the textarea default newline fire).
- Introduce a separate `commentSubmitError` signal (separate from the global `composerError` toast) and render it inline under the composer with the spec copy `"Couldn't send your comment. Try again."`; the comment-failure handler writes to it; success and other resets clear it.
- Add CSS rules for `.comment-role-user` and `.comment-role-agent` (3px left border in the spec colors); apply the class via `[class]="commentRoleClass(c)"` on the `<li class="comment">`.
- Extend the existing `ticket-detail-page.component.spec.ts` with four targeted tests covering: role-border class, comment timestamp formatting (<24h relative / >=24h absolute), Enter key submits, Shift+Enter inserts newline, and inline error copy.

No backend changes. No new endpoints. No new components. No new design tokens (reuses `--color-border` and the two hard-coded role colors from the UX spec).

## Boundaries & Constraints

**Always:**
- Backend: no change. All four write endpoints + two read endpoints are already in `backend/src/controllers/ticketsController.ts` and `backend/src/services/ticketService.ts` from HD-010.
- Frontend: single file modified — `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` (template + styles + 1 new signal + 1 new helper + 1 host-listener).
- Frontend tests: `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` extended only (no new spec file).
- The new `commentSubmitError` signal is rendered only inside the comment-composer block (under the textarea), not as a top-of-page toast. It is bound to comment-submit failures only — the existing `composerError` toast continues to handle status / priority / owner / reopen / close / self-assign failures.
- `commentRoleClass` uses the author role. `User` → `.comment-role-user`; `Support Agent` and `Admin` → `.comment-role-agent` (per UX §1, Admin displays as Support Agent here).
- `formatCommentTimestamp` returns a relative string for `< 24h` and an absolute `Mon DD, YYYY · HH:mm` string otherwise. Timezone: render in the user's local timezone (the existing `formatRelative` in `timeline-entry` uses `Date.now()`; the comment helper uses the same). Reuse the `formatRelative` step function for the < 24h case.
- Composer keyboard handler: a host listener on the component that, on Enter without Shift, calls `event.preventDefault()` + `onSendComment()`. Shift+Enter does not preventDefault — the textarea default newline behavior fires. The listener is bound at the composer wrapper level (`<div class="composer">`); the handler inspects `event.target` to ensure the event originated from a `<textarea>` inside the wrapper.
- The keyboard listener only fires when `canSubmitComment()` is true (Enter on an empty / disabled composer is a no-op).
- The `<atom-textarea>` component continues to receive `(valueChange)` from typing — the host listener is additive.
- The Send `<atom-button>` continues to be the fallback for click / a11y / no-keyboard users.

**Never:**
- No backend changes. No migration. No new model.
- No new atoms / molecules / patterns. Reuses `<atom-textarea>`, `<atom-button>`, `<chrome-avatar>`, existing CSS variables.
- No new CSS custom properties. The two role-border colors (`#adb5bd`, `#4263eb`) are inline on the rule selectors (mirroring how the UX doc lists them in the role-badge section).
- No new files except the optional `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` extension.
- No "activity log" structural change (timeline-entry molecule is unchanged; that molecule already shows relative time).
- No "comments-section" / "activity-section" `aria-label` change (deferred-work item from HD-010 D2 area; not in HD-011 scope).
- No retry button on the inline composer error (spec text is one line: "Couldn't send your comment. Try again." — implied "user re-edits and re-submits" flow, matching the "remains in the field" wording).
- No automatic timestamp refresh (no setInterval / OnPush strategy change). The "X minutes ago" label freezes at mount time, same as the activity timeline. The user sees fresh labels on next page load.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_AGENT_COMMENT | Sam posts a comment, ticket Open | `POST /comments` → 201 → comment appends to thread + composer clears + no inline error | N/A |
| USER_COMMENT_ROLE_BORDER | Eli (User) posts a comment, ticket Open | Comment row has class `comment-role-user` (3px left border `#adb5bd`) | N/A |
| AGENT_COMMENT_ROLE_BORDER | Sam (Support Agent) posts a comment, ticket Open | Comment row has class `comment-role-agent` (3px left border `#4263eb`) | N/A |
| ADMIN_COMMENT_ROLE_BORDER | Admin posts a comment, ticket Open | Comment row has class `comment-role-agent` (Admin renders as Support Agent per UX §1) | N/A |
| COMMENT_RELATIVE_TIMESTAMP_FRESH | Comment created 5 minutes ago | Comment-time shows "5 minutes ago" | N/A |
| COMMENT_RELATIVE_TIMESTAMP_DAY | Comment created 3 hours ago | Comment-time shows "3 hours ago" | N/A |
| COMMENT_ABSOLUTE_TIMESTAMP | Comment created 3 days ago | Comment-time shows absolute `Jan 12, 2026 · 11:00` | N/A |
| COMMENT_INVALID_TIMESTAMP | Comment createdAt is `null` or unparseable | Comment-time shows empty string (no `Invalid Date`, no `undefined`) | N/A |
| COMPOSER_ENTER_SUBMITS | User types "test" in composer, presses Enter (no Shift) | `onSendComment()` fires; POST `/comments` → 201; composer clears | N/A |
| COMPOSER_SHIFT_ENTER_NEWLINE | User types in composer, presses Shift+Enter | Newline is inserted into the textarea; `onSendComment()` does NOT fire | N/A |
| COMPOSER_ENTER_EMPTY | Composer empty, user presses Enter | `onSendComment()` is a no-op (canSubmitComment is false); no API call | N/A |
| COMPOSER_INLINE_ERROR | User types "test", clicks Send; backend returns 500 | Inline error element below the composer renders: "Couldn't send your comment. Try again."; comment text remains in the composer; the top-of-page toast is NOT shown for this case | `ApiError(500, 'internal_server_error')` → `commentSubmitError.set(specCopy)` |
| COMPOSER_INLINE_ERROR_CLEARED_ON_RETRY_SUCCESS | User retries after inline error; POST succeeds | Inline error clears; comment appends; composer clears | `onSendComment` resets `commentSubmitError` to null on success |
| COMPOSER_INLINE_ERROR_403_CLOSED | User types, clicks Send on a Closed ticket (shouldn't be possible — composer is hidden — but tests the branch) | Inline error renders the spec copy for 403; top-of-page toast renders the closed-specific message. (Both signals are separate; both render.) | `ApiError(403, 'forbidden', 'Ticket is closed…')` → `commentSubmitError.set(specCopy)`; the top-of-page `composerError` toast uses `formatApiError` to render the "closed" specific message |
| COMPOSER_STATUS_CHANGE_ERROR_REMAINS_TOAST | User changes Status, backend 500 | Top-of-page `composerError` toast renders "Couldn't change status." (unchanged). Inline `commentSubmitError` is NOT shown. | `onStatusChange` writes only to `composerError`; the new signal is comment-only |
| ACTIVITY_TIMELINE_UNCHANGED | Existing activity row, e.g. "Reassigned" | The activity-time line continues to use the existing `timeline-entry` relative format ("2 hours ago"). HD-011 does not touch this. | N/A |

## Code Map

### Reuse

- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` — the file being modified. Reuses:
  - `composerError` signal (top-of-page toast for status/priority/owner/reopen/close/self-assign failures).
  - `onSendComment` handler — add `commentSubmitError.set(null)` on success, `commentSubmitError.set(specCopy)` on failure. Keep the existing `composerError.set(...)` for backward compat with the closed-attempt path.
  - `comments()` signal (already oldest-first, from HD-010).
  - `canSubmitComment` computed (gates Enter key on empty / over-limit / in-flight).
  - `canComment` computed (gates whether the composer is rendered at all; if Closed, no composer → no inline error path is reachable in normal flow).
  - `Comment` model (`author.role`, `createdAt`).
- `frontend/src/app/components/atoms/textarea/textarea.component.ts` — `<atom-textarea>` already exposes `(valueChange)`. HD-011 adds a host `keydown.enter` listener at the page level; the atom itself is unchanged.
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button [disabled] [loading] (pressed)>` — Send button unchanged.
- `frontend/src/app/components/molecules/timeline-entry/timeline-entry.component.ts` — the `formatRelative` helper inside that file is private; HD-011 duplicates a minimal version (5–10 lines) in the page file rather than extract a shared util. (Trivial; pulling a util into `frontend/src/app/utils/time.ts` is out of scope.)
- `frontend/src/app/services/api-error.ts` — `ApiError(status, errorCode, message)`. The new `onSendComment` catch branch sets `commentSubmitError` with the spec copy; the existing `composerError` branch is unchanged.

### New files

_None._

### Modified

- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` — five small edits:
  1. Template: `[class.comment-role-user]="c.author.role === 'User'"` and `[class.comment-role-agent]="c.author.role !== 'User'"` on the `<li class="comment">` row. (Both are bound simultaneously so tests can assert one OR the other cleanly; `:not(.comment-role-user)` and `.comment-role-agent` are the rules that win via CSS specificity order. The simpler approach: a single `[ngClass]`-equivalent via `[class]="commentRoleClass(c)"`.)
  2. Template: replace `{{ c.createdAt }}` inside `<time class="comment-time">` with `{{ formatCommentTimestamp(c.createdAt) }}`.
  3. Template: add a `<div class="composer-error" data-testid="composer-inline-error" role="alert">` between `</atom-textarea>` and the `<div class="composer-actions">` block, bound to `@if (commentSubmitError(); as msg)`.
  4. Template: add a host keydown listener on the `<div class="composer">` wrapper via `(keydown.enter)="onComposerKeydown($event)"`.
  5. Class: add `commentRoleClass(c: Comment): string` returning `'comment-role-user'` or `'comment-role-agent'`; add `formatCommentTimestamp(iso: string): string`; add `onComposerKeydown(event: KeyboardEvent): void` that calls `event.preventDefault()` + `onSendComment()` when `canSubmitComment()` is true; add `commentSubmitError = signal<string | null>(null)`; add CSS rules for `.comment-role-user` / `.comment-role-agent` and `.composer-error` to the inline `styles`.
  6. Class: modify `onSendComment` to write to `commentSubmitError` on failure (in addition to `composerError` for the closed-attempt edge case) and to clear `commentSubmitError` on success.
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` — add 4 tests:
  1. **ROLE_BORDER** — Eli comment row has class `comment-role-user`; Sam comment row has class `comment-role-agent`; Admin comment row has class `comment-role-agent` (three sub-asserts in one test).
  2. **TIMESTAMP** — comment with `createdAt = now − 5 min` renders "5 minutes ago"; comment with `createdAt = now − 3 h` renders "3 hours ago"; comment with `createdAt = now − 3 d` renders the absolute `Mmm DD, YYYY · HH:mm`; comment with `createdAt = 'not-a-date'` renders empty.
  3. **KEYBOARD_ENTER_SUBMITS** — fire a `KeyboardEvent('keydown', {key: 'Enter'})` from the composer textarea; assert `onSendComment` fired (via the `addComment` spy); composer cleared.
  4. **KEYBOARD_SHIFT_ENTER_NEWLINE** — fire `Enter` with `shiftKey: true`; assert `addComment` was NOT called.
  5. **INLINE_ERROR** — set `addComment` to reject with `ApiError(500, 'internal_server_error', 'oops')`; click Send; assert `[data-testid="composer-inline-error"]` renders the spec copy; comment text remains in the composer.

### Deleted

_None._

### Unchanged

- `backend/**` — no change.
- `frontend/src/app/components/**` — no change.
- `frontend/src/app/services/**` — no change.
- `frontend/src/app/models/**` — no change.
- `frontend/src/app/app.routes.ts` — no change.
- `frontend/src/styles.css` — no new tokens.

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts` -- modify -- add `commentRoleClass`, `formatCommentTimestamp`, `onComposerKeydown`, `commentSubmitError`; modify template (role border class, formatted timestamp, inline error element, keydown host listener); modify `onSendComment` to write to `commentSubmitError`; add CSS rules for the three new classes.
- [ ] `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts` -- modify -- add 10 tests (role border for User/Agent/Admin; comment timestamp relative/absolute/unparseable; Enter submits; Shift+Enter inserts newline; Enter empty no-op; inline error on failure; inline error clears on success; status-change failure does NOT render inline error).

**Acceptance Criteria:**
- Given Eli (User) posts a comment, when the comment row renders, then the `<li class="comment">` has the class `comment-role-user` (3px left border `#adb5bd`).
- Given Sam (Support Agent) or Admin posts a comment, when the comment row renders, then the `<li class="comment">` has the class `comment-role-agent` (3px left border `#4263eb`).
- Given a comment was created 5 minutes ago, when the row renders, then the comment-time shows "5 minutes ago".
- Given a comment was created 3 hours ago, when the row renders, then the comment-time shows "3 hours ago".
- Given a comment was created 3 days ago, when the row renders, then the comment-time shows an absolute `Mmm DD, YYYY · HH:mm` string in the user's local timezone.
- Given a comment's `createdAt` is unparseable, when the row renders, then the comment-time is empty (no `Invalid Date`, no `undefined`).
- Given the user types in the composer and presses Enter (no Shift), when the keydown fires, then `onSendComment()` is invoked; `POST /comments` fires; composer clears on success.
- Given the user types in the composer and presses Shift+Enter, when the keydown fires, then a newline is inserted into the textarea (default behavior) and `onSendComment()` is NOT invoked.
- Given the composer is empty and the user presses Enter, when the keydown fires, then `onSendComment()` is a no-op (no API call) — guarded by `canSubmitComment()`.
- Given the user types in the composer and the Send click fails (500), when the response arrives, then an inline element below the composer renders "Couldn't send your comment. Try again." and the comment text remains in the composer.
- Given the inline error is showing and the user re-submits successfully, when the response arrives, then the inline error clears and the comment appends to the thread.
- Given the user changes Status and the backend returns 500, when the response arrives, then the top-of-page `composerError` toast renders (unchanged) and the inline `commentSubmitError` does NOT render (comment-only).
- Given the activity timeline renders an existing row, when the row appears, then it continues to use the existing `timeline-entry` relative timestamp — HD-011 does not touch this.

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises encountered. Leave empty at planning time. -->

## Spec Change Log

<!-- Append-only. Empty until first review-loop patch. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass. Empty until first review pass. -->

## Verification

**Commands:**
- `cd frontend && npx tsc --noEmit` -- expected: 0 errors.
- `cd frontend && npx ng build` -- expected: success. No size change to speak of (5 small edits to a single component file).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/ticket-detail-page.component.spec.ts'` -- expected: 29 SUCCESS (the 19 HD-010 tests + 10 new HD-011 tests).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` (full suite) -- expected: 24+ ticket-detail + 1 timeline-entry + others = 53+ SUCCESS, 6 FAILED (same pre-existing dashboard/forbidden AuthService mock gaps; unchanged).

**Manual checks (if no CLI):**
- Start `npm run dev:backend` + `npm run dev:frontend`. Log in as `eli@company.com`. Create a ticket. Land on `/tickets/<id>`. Verify each comment row has the 3px left border in `#adb5bd`.
- Log in as `sam@company.com`. Post a comment on the same ticket. Refresh. Verify Sam's comment row has the 3px left border in `#4263eb`.
- Verify comment timestamp shows "X minutes ago" for fresh comments, absolute for old.
- Click into the comment textarea. Type "test". Press Enter. The comment posts; composer clears.
- Type "line1". Press Shift+Enter. A newline is inserted. Type "line2". Press Enter. The multi-line comment posts.
- Type "fail" in a new comment. With the backend stopped, click Send. The inline error renders below the composer: "Couldn't send your comment. Try again." The comment text remains in the field.
- Change Status while the backend is stopped. The top-of-page toast renders (not the inline error).
