# Server Error State Pattern

**Category:** Pattern
**Phase 4 source:** Every authenticated page's fetch-failure state; form-submit failures on Login and Create Ticket

---

## Overview

A cross-page pattern for when the server returns 5xx or the network fails. The pattern uses an inline error message above the affected content area, leaving the page chrome and (where possible) the heading visible. The error message tells the user what failed and what to do next (typically "refresh to try again").

The pattern distinguishes between **page-load errors** (initial fetch failed) and **action errors** (a specific action's POST/PUT failed). Both use the same visual treatment but render in different positions.

## When to use

- **Page-load errors:** when the initial page fetch fails. Inline error above the content area.
- **Action errors:** when an inline action (e.g., role change, comment submit) fails. Inline error below the affected row or control.
- **Form-submit errors:** when Login POST or Create Ticket POST fails. Inline error above the form's primary CTA.

## When NOT to use

- For client-side validation errors (use [inline-error](inline-error.md) instead — different message, different visual).
- For 401 / 403 / 404 (use page-level redirect / forbidden card / not-found card instead — these have their own patterns).
- For success states (no error pattern).

## Anatomy

### Page-load error

- **Position:** inline error above the affected content area (e.g., above the kanban board on Agent Kanban; above the table on Users tab; above the cards on Admin Dashboard).
- **Style:** 14px `#c92a2a` regular text. Single line.
- **Heading + Create Ticket / filter strip / tab switcher remain rendered.** Only the content area is replaced by the error.
- **Message:** "Couldn't load <thing>. Refresh to try again."
  - Examples:
    - Agent Kanban: "Couldn't load the queue. Refresh to try again."
    - Employee Dashboard: "Couldn't load your tickets. Refresh to try again."
    - Admin Dashboard (Dashboard tab): "Couldn't load the queue. Refresh to try again."
    - Admin Dashboard (Users tab): "Couldn't load users. Refresh to try again."
    - Users tab: "Couldn't load users. Refresh to try again."

### Action error (inline)

- **Position:** inline error below the affected row or control.
- **Style:** 14px `#c92a2a` regular text. Single line.
- **Affected control reverts** to its prior state.
- **Message:** "Couldn't update. Try again."
  - Examples:
    - Users tab role change failure: "Couldn't update. Try again."
    - Users tab active toggle failure: "Couldn't update. Try again."
    - Kanban drag-and-drop failure: same message + the card returns to source with a brief shake animation.

### Form-submit error

- **Position:** inline error above the form's primary CTA (Login: above the Log in button; Create Ticket: above the Submit button).
- **Style:** 14px `#c92a2a` regular text. Single line.
- **Form state preserved** — all fields retain their values; Submit re-enabled.
- **No retry button** — the user clicks Submit again.
- **Message:**
  - Login: "Something went wrong. Please try again."
  - Create Ticket: "Couldn't submit your ticket. Please try again."

### Logout error (dialog)

- **Position:** inline error inside the Logout confirmation dialog.
- **Style:** 14px `#c92a2a` regular text. Single line.
- **Dialog stays open.**
- **Message:** "Couldn't log you out. Try again."

## Behavior

- **Page-load error:** no automatic retry. The user refreshes the browser (F5 / Cmd-R) to retry the fetch. No "Retry" button in MVP — refresh is the standard browser affordance.
- **Action error:** the affected control reverts to its prior state. The user can retry the action by clicking again. No "Retry" button — the standard click is the retry.
- **Form-submit error:** form state preserved; user clicks Submit again.
- **Dialog error:** dialog stays open; user clicks the Confirm button again to retry.

## Tokens Used

- `color-error` (`#c92a2a`) for error message text
- `font-size-body` (14px), `font-weight-regular` for error message
- `space-error-message-margin` (12px above / below the message)

## Why no "Retry" button?

- **Browser refresh is universal.** Every user knows how to refresh. Adding a "Retry" button duplicates the browser's affordance and adds chrome that doesn't earn its keep.
- **Form submits don't need Retry** — the Submit button is right there. The user clicks it again.
- **Action errors don't need Retry** — the original control (toggle, dropdown) is right there. The user clicks it again.

## Accessibility

- **ARIA live region:** error messages render in elements with `role="alert"` (or `aria-live="assertive"`). Screen readers announce the error as soon as it appears.
- **Form field error association:** for form-submit errors, the error is associated with the form via `aria-describedby` on the form element.
- **Control error association:** for action errors, the error appears adjacent to the affected control. Visual association is sufficient; aria-describedby is optional.
- **Color contrast:** `#c92a2a` on `#ffffff` = 5.6:1 (AAA for normal text).
- **No reliance on color alone:** error messages communicate via text ("Couldn't load..."), not just via red color.

## See also

- [inline-error](inline-error.md) — for client-side validation errors.
- [loading-skeleton](loading-skeleton.md) — for the loading state that precedes either success or server error.
- [empty-state](../03-molecules/empty-state.md) — for the empty (no items) variant.
- [confirmation-dialog](confirmation-dialog.md) — for the Logout dialog error pattern.
