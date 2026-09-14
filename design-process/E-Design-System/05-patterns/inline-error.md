# Inline Error Pattern

**Category:** Pattern
**Phase 4 source:** Form validation errors (Login, Create Ticket, Ticket Detail comment composer)

---

## Overview

A cross-page pattern for client-side validation errors that render directly below the offending field. The pattern enforces:
- **Inline, not toast** — the error appears below the field, in the visual flow of the form.
- **Field retains focus and value** — the user's work is preserved; only the affordance is added.
- **Field border highlights** — the field's border becomes `#c92a2a` 1.5px so the field itself signals the error.
- **Specific, actionable message** — the error tells the user what to fix, not just "invalid."
- **First invalid field receives focus** — when multiple errors exist, the first one gets focus.

## When to use

- For client-side validation errors on form fields (Login, Create Ticket, comment composer).
- Whenever the user submits a form with invalid input.
- On field blur (per field, after the first form-level submit attempt).

## When NOT to use

- For server errors (use [server-error-state](server-error-state.md) instead — different position, different message).
- For 401 / 403 / 404 / 5xx responses (those have their own patterns).
- For success states (no error pattern).

## Anatomy

### Visual treatment

- **Field border:** `#c92a2a` 1.5px (replaces the default `#adb5bd` 1px and the focus `#212529` 1.5px while the error is showing).
- **Error message:** 14px `#c92a2a` regular text, positioned 8px below the field.
- **Field retains focus and value.**
- **Field label unchanged** — labels don't carry error indicators; the message + border do.

### ARIA

- The field gets `aria-invalid="true"` and `aria-describedby="<error-id>"` while the error is showing.
- The error message element has `id="<error-id>"` so the association works.
- When the user starts editing the field, the error clears in-place (the message disappears, the border returns to focus `#212529`).

## Behavior

### Validation timing

- **On form submit:** all fields are validated. Errors render simultaneously. First invalid field receives focus.
- **On field blur (per field, after first submit):** the field is validated. Error renders below if invalid; clears if now valid.
- **On field edit:** error clears as the user types (live clearing).

### Multi-error handling

When the form has multiple errors:
- **All errors render at once.** No "fix one, then re-submit to see the next" pattern.
- **First invalid field receives focus.** The Tab order from the first invalid field naturally walks through the rest.
- **No error summary** at the top of the form in MVP. The pattern trusts the per-field errors + focus management.

## Messages

The error messages are specific and actionable. They tell the user what to fix, not just "invalid."

### Login

- **Email empty or invalid format:** "Enter a valid email address."
- **Password empty:** "Enter your password."
- **Wrong credentials (server-side, not inline validation):** "Email or password is incorrect. Try again." (rendered below password field; not strictly inline validation but uses the same visual treatment)
- **Account inactive:** "Your account is inactive. Contact your administrator."
- **Rate-limited:** "Too many attempts. Try again in a few minutes."

### Create Ticket

- **Title empty:** "Enter a title."
- **Title > 120 chars:** "Keep the title under 120 characters."
- **Description empty:** "Describe the issue."
- **Description > 5000 chars:** "Description is limited to 5000 characters." (Char counter appears at 4500+ chars as a hint.)
- **Attachment > 10 MB:** "File is larger than 10 MB. Pick a smaller file."

### Ticket Detail comment composer

- **Empty comment on Send:** "Type a comment before sending." (Composer-focused.)
- **Server-side send failure:** "Couldn't send your comment. Try again." (Uses [server-error-state](server-error-state.md) treatment — same visual but positioned below the composer.)

## Tokens Used

- `color-error` (`#c92a2a`) for field border + error message
- `font-size-body` (14px), `font-weight-regular` for error message
- `space-error-message-gap` (8px between field and message)

## Accessibility (consolidated)

- **ARIA association:** `aria-invalid="true"` on the field; `aria-describedby="<error-id>"` pointing to the message element.
- **Live announcement:** the error message element has `aria-live="polite"` (or `role="alert"`) so screen readers announce the error when it appears.
- **Focus management:** first invalid field receives focus on form submit. User can `Tab` from there to the next invalid field.
- **Color contrast:** `#c92a2a` on `#ffffff` = 5.6:1 (AAA). Error border `#c92a2a` 1.5px on `#ffffff` = 5.6:1 (AAA for graphical elements).
- **No reliance on color alone:** error message + `aria-invalid` + field border all communicate the error. The same information is available to all users.
- **Error clearing:** when the user starts editing, the error clears. Screen readers re-announce the field state as it transitions from `aria-invalid="true"` to `aria-invalid="false"`.

## Why inline, not toast?

- **Inline errors stay attached to the field.** A toast in the corner might disappear before the user reads it, or might be missed by users who are looking at the field they need to fix.
- **Inline errors preserve context.** The user is already looking at the field; the error is right there.
- **Inline errors support multi-error display.** Toasts typically show one error at a time; forms can have multiple errors that need to be visible simultaneously.

## Why no error summary at the top?

- **The per-field errors + focus management are sufficient.** A summary duplicates information and adds visual chrome.
- **The first invalid field receives focus,** so the user is immediately oriented to where to start.
- **If accessibility audit shows this is insufficient** (e.g., cognitive accessibility needs a summary), the summary can be added in v1.x without removing the per-field errors.

## See also

- [form-field](../03-molecules/form-field.md) — Login + Create Ticket field atom-level spec.
- [server-error-state](server-error-state.md) — for server-side errors (different position).
- [dialog-modal](../03-molecules/dialog-modal.md) — for modal-form errors (e.g., Logout dialog).
