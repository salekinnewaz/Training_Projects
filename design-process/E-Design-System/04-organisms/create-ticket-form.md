# Create Ticket Form (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + "Back to My Tickets" link + page heading + 5 form fields ([form-field](../03-molecules/form-field.md) × 2: Title, Description; [form-field-dropdown](../03-molecules/form-field-dropdown.md) × 2: Category, Priority; file-drop zone variant: Attachment) + [button](../02-atoms/button.md) primary Submit + "Cancel" link
**Phase 4 source:** Create Ticket (`create-ticket.md`)

---

## Overview

Eli's friction surface: the form she uses to translate her blockage into a returnable artifact. The form is intentionally minimal — single column, no welcome copy, defaults chosen so Eli can submit without touching optional fields, and validation that says what to fix when something's wrong.

This is where the trust handshake begins. If the form is heavy, the handshake breaks. The job is to get from "I'm blocked" to "I've asked for help" with the smallest possible ceremony.

## Anatomy (top-down, 720px form column centered at x=720)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **"← Back to My Tickets" link** (y=108) — 14px `#868e96`, top-left.
3. **Page heading "New ticket"** (y=148, 24px semibold `#212529`) — single H1 landmark.
4. **Title field** (y=200..256):
   - Label: `Title` (required). 14px medium `#495057`, baseline y=200.
   - Input: `<input type="text">`, single line, placeholder "Short summary of the issue", 44px tall, 4px radius, `#adb5bd` 1px border.
   - Required, max 120 chars (server-enforced).
5. **Description field** (y=288..424):
   - Label: `Description` (required). 14px medium `#495057`, baseline y=288.
   - Input: `<textarea>`, 5 rows min, grows to 10 rows max, placeholder "Describe what's happening — what you expected, what's actually happening, and anything you've already tried."
   - Required, max 5000 chars (server-enforced; char counter appears at 4500+ chars).
   - 4px radius on the textarea.
6. **Category field** (y=456..512):
   - Label: `Category` (optional). 14px medium `#495057`, baseline y=456.
   - Input: `<select>` with options `Select category… (placeholder) · IT · HR · Finance · General`. Defaults to "Select category…".
   - 44px tall.
   - Optional; no validation, no inline error if empty.
7. **Priority field** (y=544..600):
   - Label: `Priority` (required, default Medium). 14px medium `#495057`, baseline y=544.
   - Input: `<select>` with options `Low · Medium · High`. Default `Medium`.
   - 44px tall.
   - Required in the sense that a non-empty value must be submitted — since Medium is the default, the field is never invalid.
8. **Attachment field** (y=632..740):
   - Label: `Attachment` with inline micro-label "(optional, 10 MB max)" right of the label.
   - Input: file-drop zone (96px tall, dashed `#adb5bd` 1.5px border, centered text `Drop file or click to upload · 10 MB max`) + native `<input type="file">` (click to browse, single file).
   - After file picked: shows file name + size + small `×` remove button; drop zone retains its dashed border.
   - Cap: 10 MB. Exceeding the cap → inline error under the drop zone.
9. **Submit button** (y=772..820):
   - Primary CTA `Submit ticket`, full 720px width, 48px tall, 6px radius, `#212529` fill, white 16px semibold label.
   - Disabled until Title and Description have content.
10. **"Cancel — return to My Tickets" link** (y=848) — 14px `#868e96`, left-aligned. Same destination as the top-left back link.

**Field spacing:** 24px vertical between Title → Description → Category → Priority → Attachment.

## Behavior summary

### Field validation

- **Client-side** runs on Submit click and on field blur (per field, after first submit attempt).
- **Title empty:** "Enter a title." Inline error, focus stays on field.
- **Title > 120 chars:** "Keep the title under 120 characters."
- **Description empty:** "Describe the issue."
- **Description > 5000 chars:** "Description is limited to 5000 characters." (Char counter appears at 4500+ chars.)
- **Category empty / placeholder:** no error — optional.
- **Priority empty:** cannot happen — default is Medium.
- **Attachment > 10 MB:** "File is larger than 10 MB. Pick a smaller file." Field resets to empty.
- **Multiple errors:** all show at once; first invalid field receives focus.

### Submit lifecycle

- **Submit click:** both required fields valid + Priority not empty → request fires.
- **In-flight state:** Submit button label changes to `Submitting…` + small spinner. Title, Description, Category, Priority, Attachment, Submit all become disabled. The Cancel link remains enabled.
- **On success (201 Created):** navigate to Submission Confirmation (`/tickets/:id/created`). Form state discarded.
- **On failure (network / 5xx):** inline error above the Submit button: "Couldn't submit your ticket. Please try again." Form state preserved, all fields re-enabled.
- **On 401 (session expired):** redirect to `/login?return_to=/tickets/new`. After re-auth, Eli lands back here with form state preserved (via sessionStorage).

### Cross-page

- **Entry from Employee Dashboard:** the "Create Ticket" primary button routes here (`/tickets/new`).
- **Exit via Cancel / Back:** both link to `/dashboard`. Browser warning on unsaved input via `beforeunload`.
- **Direct-arrival to `/tickets/new`:** allowed — anyone with the link can land here. Submission still requires Login (server-side gate).

## States (cross-reference)

- **Default (empty)** — Title and Description empty; Category at placeholder; Priority = Medium; Attachment empty; Submit disabled.
- **Partially filled** — values preserved; Submit enabled only when Title and Description are non-empty.
- **Validating (after first Submit attempt)** — inline error(s) under offending field(s). Field retains focus. Submit re-enabled.
- **Submitting** — all fields + Submit disabled, button label `Submitting…` + spinner. Cancel link still enabled.
- **Server error** — inline error above Submit: "Couldn't submit your ticket. Please try again." Form state preserved.
- **Attachment over-cap** — inline error under drop zone. Attachment field resets.
- **Session expired** — redirect to `/login?return_to=/tickets/new`. Form state preserved client-side.

## Tokens Used

- All [form-field](../03-molecules/form-field.md) tokens (Title, Description, Attachment drop zone)
- All [form-field-dropdown](../03-molecules/form-field-dropdown.md) tokens (Category, Priority)
- All [button](../02-atoms/button.md) tokens (Submit primary)
- [link](../02-atoms/link.md) tokens (Back link, Cancel link)
- `color-error` (`#c92a2a`) for inline validation
- `color-border-dashed` (`#adb5bd` 1.5px dashed) for Attachment drop zone
- `space-form-column` (720px), `space-field-height` (44px), `space-field-gap` (24px)
- `space-page-top` (32px below chrome)
- `font-size-body-lg` (16px), `font-weight-semibold` for Submit button label

## Used In

- **Create Ticket** (`create-ticket.md`): the canonical organism.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [form-field](../03-molecules/form-field.md) — Title, Description, Attachment atom-level spec.
- [form-field-dropdown](../03-molecules/form-field-dropdown.md) — Category, Priority atom-level spec.
- [inline-error](../05-patterns/inline-error.md) — validation error pattern.
- [server-error-state](../05-patterns/server-error-state.md) — submit failure pattern.
