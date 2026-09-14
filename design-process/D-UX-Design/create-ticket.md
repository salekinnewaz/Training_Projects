# Create Ticket

**Route:** `/tickets/new` (or the Employee Dashboard's "Create Ticket" button).
**Scenario:** Eli the End-User only (priority 03). Sam does not file tickets in MVP.
**Purpose:** Translate Eli's blockage into a returnable artifact. The form is Eli's friction surface — every extra step, label, or unnecessary field is a moment where the Slack-DM temptation can win. The job is to get from "I'm blocked" to "I've asked for help" with the smallest possible ceremony.

## User Context

Eli arrives blocked. Her cognitive state is mild frustration + time pressure (per the brief). She does not want a tour, a tooltip, or a help icon. She wants Title + Description filled, optional fields set sensibly, and Submit clicked. She is not reading field copy unless something is wrong.

The product brief calls out adoption (G2) and the silent-ticket failure mode. Create Ticket is where the trust handshake begins — if the form is heavy, the handshake breaks. So: a single column, no welcome copy, defaults chosen so Eli can submit without touching optional fields, and validation that says what to fix when something's wrong.

## Design Decisions (locked during discussion)

- **Form column width:** 720px. Centered on x=720 (matches Ticket Detail's content-column center for visual rhythm across post-login pages), but only 720px wide — Description gets a comfortable prose measure (≈80 chars per line), Title input is generous without being so wide it feels wasteful.
- **Page header:** "← Back to My Tickets" link at top-left, then section heading "New ticket" (24px semibold) — same pattern as Ticket Detail. Gives a clear return path and names the page.
- **Field order:** Title → Description → Category → Priority → Attachment → Submit. Locked by scenario; do not reorder. The "required" fields come first; optional fields come after so Eli can submit without touching them.
- **Defaults:** Priority defaults to "Medium" (the middle setting — most requests are neither urgent nor trivial). Category defaults to "Select category…" (placeholder; no preselection, since Category is optional and guessing creates a wrong-data risk).
- **No welcome copy** — no "Tell us what's blocking you" headline above the form. The "New ticket" heading + the field labels are enough.
- **No tooltips, no inline help text on any field** — if the field is self-evident, no copy. If it's not (Attachment's 10 MB cap), put it in the field's micro-label.

## Content & Actions

The page contains exactly these elements, in this order:

1. **App-header chrome strip** — same shared strip as Ticket Detail / Submission Confirmation.
2. **"← Back to My Tickets" link** — 14px `#868e96`, top-left of page content, below the app-header strip.
3. **Page heading "New ticket"** — 24px semibold, `#212529`. One H1 landmark for screen readers.
4. **Title field** —
   - Label: `Title` (required)
   - Input: `<input type="text">`, single line, placeholder "Short summary of the issue"
   - Required, max 120 chars (server-enforced)
   - Validation: empty → "Enter a title." (inline error, below field, focus stays on field)
   - 44px tall, 4px radius — same as Login fields
5. **Description field** —
   - Label: `Description` (required)
   - Input: `<textarea>`, 5 rows minimum, grows to 10 rows max
   - Placeholder: "Describe what's happening — what you expected, what's actually happening, and anything you've already tried."
   - Required, max 5000 chars (server-enforced; show remaining count when > 4500 chars: "X characters left")
   - Validation: empty → "Describe the issue." (inline error)
   - 4px radius on the textarea
6. **Category field** —
   - Label: `Category` (optional)
   - Input: `<select>` with options `Select category… (placeholder) · IT · HR · Finance · General`
   - Defaults to "Select category…"
   - Optional; no validation, no inline error if empty
   - Same height as a text input (44px) so the dropdown chrome is uniform
7. **Priority field** —
   - Label: `Priority` (required, default Medium)
   - Input: `<select>` with options `Low · Medium · High`, default `Medium`
   - Required in the sense that a non-empty value must be submitted — since Medium is the default, the field is never invalid
   - 44px tall
8. **Attachment field** —
   - Label: `Attachment` with inline micro-label "(optional, 10 MB max)" right of the label
   - Input: a file-drop zone + native `<input type="file">` (click to browse), single file
   - Empty state: dashed border, centered text `Drop file or click to upload · 10 MB max`
   - After file picked: shows file name + size + small `×` remove button; drop zone retains its dashed border so Eli can see she's about to attach (or replace) the file
   - Cap: 10 MB. Exceeding the cap → inline error under the drop zone: "File is larger than 10 MB. Pick a smaller file." Field does not accept the upload.
   - Wrong type (e.g., .exe, .zip, executables) → allowed in MVP (no MIME whitelist in MVP — small team, low-risk surface; flagged for v1.1 hardening). Filename is shown as-is.
9. **Submit button** —
   - Primary CTA `Submit ticket`, full 720px width, 48px tall, 6px radius, `#212529` fill, white 16px semibold label
   - Disabled until Title and Description have content (Priority defaults to Medium so is always valid; Category is optional)
10. **"Cancel — return to My Tickets"** — 14px `#868e96` muted text link below the Submit button, left-aligned. Same destination as the top-left back link.

**No other content.** No "Save as draft" (out of MVP; if Eli leaves mid-form, she loses the work — by design; small team, low-frequency action). No "Submit and create another" (out of MVP). No character-counter on Title (120-char cap rarely matters; if it ever does, validation error covers it). No rich-text on Description (Markdown / WYSIWYG is out of MVP; Description is plain text, line breaks preserved).

## Behavior

### Field validation

- **Client-side** runs on Submit click and on field blur (per field, after first submit attempt).
- **Title empty:** inline error under Title: `Enter a title.` Title field keeps focus, value preserved.
- **Title > 120 chars:** inline error under Title: `Keep the title under 120 characters.` Field keeps focus, value preserved.
- **Description empty:** inline error: `Describe the issue.` Field keeps focus, value preserved.
- **Description > 5000 chars:** inline error: `Description is limited to 5000 characters.` Field keeps focus, value preserved. (Char counter appears at 4500+ chars.)
- **Category empty / placeholder:** no error — Category is optional.
- **Priority empty:** cannot happen — default is Medium and the dropdown can't return to empty.
- **Attachment > 10 MB:** inline error under the drop zone: `File is larger than 10 MB. Pick a smaller file.` Field is reset to empty state.
- **Multiple errors:** all show at once; first invalid field receives focus.

### Submit lifecycle

- **Submit click:** both required fields valid + Priority not empty → request fires.
- **In-flight state:** Submit button label changes to `Submitting…` + small spinner. Title, Description, Category, Priority, Attachment, Submit all become disabled. The Cancel link remains enabled (so Eli can still bail if she changes her mind mid-request).
- **On success (201 Created):** navigate to Submission Confirmation (`/tickets/:id/created`). The form state is discarded — Eli's done.
- **On failure (network / 5xx):** inline error above the Submit button: `Couldn't submit your ticket. Please try again.` Form state preserved, all fields re-enabled. No retry button — Eli clicks Submit again.
- **On 401 (session expired):** redirect to `/login` with `return_to=/tickets/new`. After re-auth, Eli lands back here with form state preserved (server-side draft is out of MVP, so state preserved client-side via sessionStorage).

### Cross-page

- **Entry from Employee Dashboard:** the "Create Ticket" primary button on the Dashboard routes here. The route is `/tickets/new`.
- **Exit via Cancel / Back:** both link to `/dashboard` (Employee Dashboard). **Browser warning on unsaved input:** the form uses `beforeunload` event to prompt if Title or Description has content but Submit has not been clicked. The Cancel and Back links bypass the prompt and discard form state (Eli explicitly chose to leave).
- **Direct-arrival to `/tickets/new`:** allowed — anyone with the link can land here. Submission still requires Login (server-side gate).

## States

| State | Trigger | Display |
|---|---|---|
| **Default (empty)** | Page loaded | Title and Description empty; Category at placeholder; Priority = Medium; Attachment empty; Submit disabled. |
| **Partially filled** | User has typed into some fields | All entered values preserved; Submit enabled only when Title and Description are non-empty. |
| **Validating (after first Submit attempt)** | User has submitted with empty Title or Description | Inline error(s) under the offending field(s). Field retains focus. Submit re-enabled. |
| **Submitting** | Submit request in flight | All fields + Submit disabled, button label `Submitting…` + spinner. Cancel link still enabled. |
| **Server error** | Submit returns 5xx or network fails | Inline error above Submit: `Couldn't submit your ticket. Please try again.` Form state preserved, fields re-enabled. |
| **Attachment over-cap** | User picks a file > 10 MB | Inline error under drop zone. Attachment field resets. Other fields unaffected. |
| **Session expired** | Submit returns 401 | Redirect to `/login?return_to=/tickets/new`. Form state preserved client-side; restored after re-auth. |

**Note on the wireframe:** the canonical frame is **Default (empty)**. Partially filled and Submitting are documented but not rendered; they reuse the same skeleton with disabled-state and inline-error additions.

## Visual Tokens

Inherited from Login + Ticket Detail. New tokens introduced: **none** — this page reuses the field tokens from Login (44px height, 4px radius, `#adb5bd` border) and the button token from Ticket Detail (48px tall, 6px radius, `#212529`). The only new micro-element is the file-drop zone.

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface | `#ffffff` | App-header strip; Submit button label color |
| Primary (button bg) | `#212529` | Submit button |
| Border default | `#adb5bd` 1px | Title, Description, dropdowns |
| Border subtle (file drop zone) | `#adb5bd` 1.5px **dashed** | Attachment drop zone |
| Label text | `#495057` | All field labels (14px medium) |
| Muted text | `#868e96` | Back link, Cancel link, "(optional, 10 MB max)" micro-label |
| Placeholder | `#adb5bd` | Title + Description placeholders |
| Error text | `#c92a2a` | Inline validation messages |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Form column width | 720px | Centered at x=720 (so x=360..1080) |
| Form column horizontal center | x = 720 | Matches Ticket Detail center for cross-page rhythm |
| Page top margin | 32px below app-header strip | First content row |
| Back link position | y=108 | 14px `#868e96`, top-left |
| Section heading position | y=148 | 24px semibold |
| Field-to-field spacing | 24px vertical | Between Title → Description → Category → Priority → Attachment |
| Field height | 44px | All inputs |
| Field radius | 4px | Title, Category, Priority |
| Description textarea | 5 rows min, 10 rows max | 4px radius |
| Drop zone height | 96px | Dashed border, centered text |
| Submit button | 720×48, 6px radius | Same button token as Login / Submission Confirmation |
| Cancel link position | y=688 | 14px muted, left-aligned |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is Default (empty).

- App-header chrome strip: y=0..64.
- "← Back to My Tickets" link: y=108.
- "New ticket" heading baseline: y=148, 24px semibold.
- Title label: y=200. Title input: y=212..256 (44px tall). Placeholder at y=240.
- Description label: y=288. Description textarea: y=300..424 (124px tall ≈ 5 rows at ~24px line-height). Placeholder at y=326.
- Category label: y=456. Category select: y=468..512.
- Priority label: y=544. Priority select: y=556..600.
- Attachment label: y=632 + inline "(optional, 10 MB max)" at y=632 right of label. Attachment drop zone: y=644..740 (96px tall, dashed border).
- Submit button: x=360..1080, y=772..820 (720×48, 6px radius). Button label "Submit ticket" baseline y=802.
- Cancel link: y=848, 14px `#868e96`, left-aligned at x=360.

**Note on the wireframe canvas:** a 900px canvas is tight for a 5-field form with a textarea; the bottom Cancel link lands at y=848, leaving 52px bottom margin. The form fits. If the page grows in implementation (e.g., extra help text), the canvas would need to grow or the page becomes scrollable — both are fine. The wireframe captures the at-rest layout.

## Success

Eli is blocked → opens Create Ticket → fills Title and Description → clicks Submit. Total time: under 30 seconds for a routine request. The fewer fields she touches (Category defaults, Priority defaults, Attachment skipped), the closer she gets to "I've asked for help" with no ceremony.

The trust handshake starts here: the form is unobtrusive, the required fields are obvious, the optional fields are opt-out, and the validation never punishes her for trying. If she leaves mid-form, nothing is lost in the simple case; if she hits Submit and something goes wrong, the error tells her what to fix and her work is preserved. When she lands on Submission Confirmation 200ms later, the artifact exists and is hers.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking the spec):
- **Drag-and-drop on the Attachment drop zone:** the dashed drop zone should accept drag-and-drop of a single file. Click-to-browse is the fallback. Same 10 MB cap applies. Implementation detail; spec only requires the affordance.
- **"Save as draft":** out of MVP. If requested by a team during v1, server-side drafts are scoped as a small feature; not blocking.
- **MIME whitelist on Attachment:** out of MVP. All file types accepted; flagged for v1.1 hardening.
- **Description Markdown / rich text:** explicitly out of MVP. Plain text with line breaks preserved.
- **Auto-save on blur:** out of MVP. Form state is preserved client-side only on 401-redirect; otherwise, leaving the page discards the form.

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md (Screen 3), design-process/D-UX-Design/login.md (field tokens), design-process/D-UX-Design/ticket-detail.md (button tokens, app-header chrome, back-link pattern), design-process/B-Trigger-Map/feature-impact.md (attachment decision reversal applied)_
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._
