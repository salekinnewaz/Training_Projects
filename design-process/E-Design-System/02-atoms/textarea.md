# Textarea

**Category:** Atom
**Phase 4 source:** Create Ticket (Description), Ticket Detail (comment composer expansion)

---

## Overview

A multi-line text input field. Used for longer-form content where wrapping is expected.

## Variants

### Default

- **Background:** `color-surface` (`#ffffff`)
- **Border:** `border-strong` (`1px solid #adb5bd`)
- **Radius:** `radius-input` (4px)
- **Min height:** 124px (Create Ticket Description)
- **Padding:** 12px all sides
- **Placeholder:** `color-muted` (`#868e96`)
- **Text:** `color-primary` (`#212529`), `font-size-body` (14px)
- **Resize:** vertical only (implementation detail; CSS `resize: vertical`)

## States

| State | Display |
|---|---|
| Default | white bg, `#adb5bd` border, placeholder muted |
| Focus | white bg, `focus-ring` (`2px solid #4263eb`) on the border |
| Filled | placeholder hidden, value in `color-primary` |
| Error | border `color-error`, helper text below in `color-error` |
| Disabled | bg `color-surface-disabled`, text `color-disabled-text` |

## Tokens Used

- `color-surface`, `color-primary`, `color-muted`, `color-error`, `color-surface-disabled`, `color-disabled-text`
- `border-strong`, `radius-input`
- `font-size-body`, `font-weight-regular`
- `space-3` (padding)
- `focus-ring`

## Used In

- **Create Ticket** (`create-ticket.md`): Description field — 124px tall, full-width within the 720px form column. Required. No character limit visible (limit is implicit server-side).
- **Ticket Detail** (`ticket-detail.md`): Comment composer — multi-line expansion of the single-line [input-text](input-text.md) at the top of the composer. Inline at the bottom of the Comments section.

## Usage Guidelines

**When to use:**
- Multi-line content: descriptions, comments, longer notes.
- Anywhere the expected input length may exceed 100 chars.

**When NOT to use:**
- Single-line values (use [input-text](input-text.md)).
- Selection from a known set (use [select](select.md)).

## Accessibility

- **Keyboard:** native `<textarea>`.
- **Label:** always paired with a visible [label](label.md) above.
- **Focus visible:** `focus-ring` (2px `#4263eb`) on keyboard focus.
- **Required state:** paired with a `(required)` micro-label.
- **Error state:** error text below textarea in `color-error`, paired with `aria-invalid="true"`.
- **Drag-and-drop on attachments** (Create Ticket): out of scope for textarea; drag-and-drop is handled by the attachment drop zone (a separate organism).
