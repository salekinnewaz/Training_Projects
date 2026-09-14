# Input (Text)

**Category:** Atom
**Phase 4 source:** Login (email, password), Create Ticket (title), Agent Kanban (search), Ticket Detail (comment composer)

---

## Overview

A single-line text input field. Used for short-form text entry where the user types a single value (email, password, title, search query, comment).

## Variants

### Default

- **Background:** `color-surface` (`#ffffff`)
- **Border:** `border-strong` (`1px solid #adb5bd`)
- **Radius:** `radius-input` (4px)
- **Height:** 44px (form fields on Login, Create Ticket)
- **Padding:** 12px vertical, 12px horizontal
- **Placeholder:** `color-muted` (`#868e96`)
- **Text:** `color-primary` (`#212529`), `font-size-body` (14px)

### Search

A specialization of text input for the Agent Kanban search strip.

- **Same as Default**, plus a leading search icon (left, 16px from edge).
- **Width:** 320px (the longest input on the search strip).
- **Placeholder:** `Search queue…` (`color-muted`).
- **Debounced** 200ms before firing the search query.

## States

| State | Display |
|---|---|
| Default | white bg, `#adb5bd` border, placeholder muted |
| Focus | white bg, `focus-ring` (`2px solid #4263eb`) on the border |
| Filled | placeholder hidden, value in `color-primary` |
| Error | border `color-error` (`#c92a2a`), helper text below in `color-error` |
| Disabled | bg `color-surface-disabled`, text `color-disabled-text` |

## Tokens Used

- `color-surface`, `color-primary`, `color-muted`, `color-error`, `color-surface-disabled`, `color-disabled-text`
- `border-strong`, `radius-input`
- `font-size-body`, `font-weight-regular`
- `space-3` (padding)
- `focus-ring`

## Used In

- **Login** (`login.md`): Email field, Password field — both 44px tall, 4px radius, in a 400px form column.
- **Create Ticket** (`create-ticket.md`): Title field — 44px tall, full-width within the 720px form column.
- **Agent Kanban** (`agent-kanban.md`): Search box — 320px wide, 40px tall (filter strip variant), in the filter strip.
- **Ticket Detail** (`ticket-detail.md`): Comment composer — single-line text input at the top of the inline composer; multi-line expansion uses [textarea](textarea.md).

## Usage Guidelines

**When to use:**
- Single-line text entry: emails, passwords, titles, search queries, single-line comment fields.
- Anywhere the expected input length is < 100 chars.

**When NOT to use:**
- Multi-line content (use [textarea](textarea.md) — Create Ticket Description, Ticket Detail composer expansion).
- Selection from a known set (use [select](select.md) — Category, Priority, Owner, Role).
- Date / time / numeric ranges (out of MVP).

## Accessibility

- **Keyboard:** native `<input type="text">` (or `type="email"`, `type="password"`, `type="search"`).
- **Label:** always paired with a visible [label](label.md) above; `for`/`id` linkage or wrapping `<label>` element.
- **Focus visible:** `focus-ring` (2px `#4263eb`) on keyboard focus.
- **Required state:** paired with a `(required)` micro-label per `create-ticket.md` §Form field micro-labels.
- **Error state:** error text below input in `color-error`, paired with `aria-invalid="true"` and `aria-describedby` pointing to the error message.
- **Password:** masked input by default; visibility toggle is a v1.x follow-up.
