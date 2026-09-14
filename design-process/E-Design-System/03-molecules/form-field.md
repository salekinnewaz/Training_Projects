# Form Field (label + text input)

**Category:** Molecule
**Composed of:** [label](../02-atoms/label.md) + [input-text](../02-atoms/input-text.md)
**Phase 4 source:** Login (Email, Password), Create Ticket (Title, Description)

---

## Overview

A vertical stack of a visible label above a text input, with consistent label-to-field spacing, height, and radius. The form field is the most-reused molecule in the app — Login renders two of them; Create Ticket renders four (Title, Description as a textarea variant, plus Attachment which is a specialized drop zone); the Ticket Detail composer borrows the same vertical rhythm for its inline comment field.

The molecule enforces "label always visible" — no placeholder-only inputs. Labels sit above the field (never inside it) so the input's purpose is unambiguous when the field has content.

## Variants

### Standard text field

- **Label:** 14px medium `#495057`, baseline sits 12px above the field top.
- **Input:** 44px tall, 4px radius, `#adb5bd` 1px border, `#212529` text, `#adb5bd` placeholder.
- **Padding:** 16px horizontal inside the input.
- **Width:** fills the parent column (100% within a 720px form column on Create Ticket; 400px on Login; full-width within the comment composer).
- **Required indicator:** the label itself reads e.g., `Title` with no asterisks — see Usage Guidelines.

### Password field (with show/hide toggle)

- Same as Standard, plus an eye-icon button positioned at the right end of the input (x ≈ 28px from the right edge of the field).
- Eye glyph: 9×5 ellipse + 2px central pupil, `stroke #495057` 1px.
- Toggles `type="password"` ↔ `type="text"`. `aria-label` flips between `"Show password"` and `"Hide password"` with state.
- Toggle is keyboard-focusable; `Enter` / `Space` activates.

### Search field

- `<input type="search">`, 320px wide, 40px tall (smaller than the 44px form-field default — search sits in filter strips, not in primary forms).
- Same radius, border, and color tokens as Standard.
- Native browser "×" appears when the field has content (browser-rendered).

### Textarea (variant)

- Used for the Create Ticket Description field and the Ticket Detail comment composer.
- Minimum 5 rows (Description) / 1 row growing to 4 max (composer). Auto-resizes with content.
- Same label + spacing + radius as Standard; only the input height changes.

### File-drop zone (variant)

- Used only on Create Ticket's Attachment field. Not a true text input — a `<input type="file">` triggered by clicking a dashed drop zone.
- Same vertical rhythm (label above, error below), but the drop zone is 96px tall with `#adb5bd` 1.5px dashed border and centered instructional text `Drop file or click to upload · 10 MB max`.

## States

| State | Display |
|---|---|
| Default | `#adb5bd` 1px border, label `#495057`, no extra adornment |
| Hover | Border deepens slightly to `#868e96` (subtle; not all surfaces implement this) |
| Focus | Border becomes `#212529` 1.5px; label remains unchanged |
| Filled | Text `#212529`; no visual change to the field itself |
| Error (validation failed) | Border becomes `#c92a2a` 1.5px; inline error message `#c92a2a` 14px renders 8px below the field; field retains focus and value |
| Submitting (parent form in flight) | Field bg becomes `#f8f9fa`; `cursor: not-allowed`; native `disabled` attribute applied |
| Disabled (structural) | Same as Submitting; used on fields the user can't edit (none in MVP forms, but the pattern is reserved) |

## Tokens Used

- `color-label` (`#495057`) for label text
- `color-primary` (`#212529`) for filled input text and focused border
- `color-border-default` (`#adb5bd`) for default border
- `color-placeholder` (`#adb5bd`) for placeholder text
- `color-error` (`#c92a2a`) for validation error border + message
- `color-page-bg` (`#f8f9fa`) for disabled/background tint
- `font-size-body` (14px), `font-weight-medium` for label
- `radius-input` (4px) on field radius
- `space-field-height` (44px / 40px for search)
- `space-label-field-gap` (12px)

## Used In

- **Login** (`login.md`): Email field, Password field (with show/hide toggle).
- **Create Ticket** (`create-ticket.md`): Title field, Description field (textarea variant), Attachment field (drop zone variant).
- **Ticket Detail** (`ticket-detail.md`): Comment composer (textarea variant, anchored at bottom of Comments thread).
- **Agent Kanban** (`agent-kanban.md`): Search box in the filter strip (search variant).

## Usage Guidelines

**When to use:**
- Whenever the user enters free-form text or file content.
- Any time the field's purpose benefits from a visible label (i.e., always).

**When NOT to use:**
- For choices among a fixed set (use [form-field-dropdown](form-field-dropdown.md) instead).
- For pure yes/no or one-of-two toggles (use [button](../02-atoms/button.md) or a toggle atom — out of MVP).
- Without a label (placeholders are not labels).

**Required-field signaling:**
- Spec does **not** use asterisks (`*`) or "Required" suffixes. The label is just `Title` / `Email` / etc. Required-ness is communicated through the validation message after an empty submit attempt.
- Optional fields carry an inline micro-label right of the label, e.g., `(optional, 10 MB max)` or `(optional)`. Style: 12px `#868e96`.

**Validation timing:**
- Runs on field blur (per field, after first form-level submit attempt) and on form submit.
- First submit attempt: errors render and focus moves to the first invalid field.
- Subsequent edits clear the error in-place as the user types; re-validation happens on blur.

## Accessibility

- **Label association:** every input has a `<label for="id">` pairing — the `for` attribute matches the input's `id`. Visual label position (above the field) and DOM association are both required.
- **Required state:** `aria-required="true"` on required inputs. Visual label does not change.
- **Error association:** inline error renders in an element with `id="<field-id>-error"` and the input has `aria-describedby="<field-id>-error"` and `aria-invalid="true"` while the error is showing.
- **Password toggle:** keyboard-focusable; announces state via `aria-label` ("Show password" / "Hide password"). Toggle does not steal focus from the input on activation.
- **Color contrast:** `#212529` input text on `#ffffff` = 16.8:1 (AAA). Label `#495057` on `#ffffff` = 8.6:1 (AAA). Error `#c92a2a` on `#ffffff` = 5.6:1 (AAA).
