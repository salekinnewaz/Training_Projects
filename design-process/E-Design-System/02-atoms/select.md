# Select (Dropdown)

**Category:** Atom
**Phase 4 source:** Create Ticket (Category, Priority), Agent Kanban (Priority, Category, Owner filters), Users tab (Role)

---

## Overview

A dropdown control for single-option selection from a known set. Styled like the form inputs (matching height, border, radius) so it reads as part of the same input family. The native `<select>` element is used; styling overrides the default OS appearance.

## Variants

### Default

- **Background:** `color-surface` (`#ffffff`)
- **Border:** `border-strong` (`1px solid #adb5bd`)
- **Radius:** `radius-input` (4px)
- **Height:** 44px (Create Ticket form fields), 40px (Agent Kanban filter strip)
- **Padding:** 12px vertical, 12px horizontal; right padding 32px (room for caret)
- **Text:** `color-primary` (`#212529`), `font-size-body` (14px)
- **Caret:** [caret](caret.md) polyline (small V) right-aligned at x = right-edge − 16px

### Filter dropdown (Agent Kanban)

- **Same as Default**, plus a label prefix: `Priority: All`, `Category: All`, `Owner: All`.
- **Width:** 140px (Priority, Category), 140px (Owner — same width).

### Role dropdown (Users tab)

- **Same as Default**, but width 140px and rendered disabled on the self-row (Admin viewing their own row).
- **Disabled state:** bg `color-surface-disabled`, text `color-disabled-text`, caret also disabled (greyed-out).

## States

| State | Display |
|---|---|
| Default | white bg, `#adb5bd` border, caret `color-label` |
| Open | white bg, `focus-ring` (border) |
| Hover (mouse over closed state) | border darkens to a slightly darker shade (implementation detail) |
| Selected option | first option in dropdown list shows selected marker; native OS marker or custom check mark |
| Disabled | bg `color-surface-disabled`, text `color-disabled-text`, caret `color-disabled-text` |
| Error (form validation) | border `color-error`, helper text below in `color-error` |

## Tokens Used

- `color-surface`, `color-primary`, `color-label`, `color-error`, `color-surface-disabled`, `color-disabled-text`
- `border-strong`, `radius-input`
- `font-size-body`, `font-weight-regular`
- `space-3` (padding)
- `focus-ring`
- [caret](caret.md) for the dropdown indicator

## Used In

- **Create Ticket** (`create-ticket.md`): Category, Priority dropdowns — 44px tall, full-width within the 720px form column.
- **Agent Kanban** (`agent-kanban.md`): Priority, Category, Owner filter dropdowns — 40px tall, in the filter strip.
- **Users tab** (`users-tab.md`): Role dropdown — 36px tall (compact for table row), 140px wide, per row.

## Usage Guidelines

**When to use:**
- Selecting one option from a known, small set (≤ ~10 options).
- The options don't change frequently (no need for autocomplete).
- The user doesn't need to see all options at once to compare.

**When NOT to use:**
- ≥ 15 options (use a search-enabled combobox — out of MVP).
- Selecting multiple options (use checkboxes — out of MVP).
- Binary on/off (use a toggle, like the Active indicator on Users tab).

## Accessibility

- **Keyboard:** native `<select>` handles keyboard navigation (arrow keys, Enter to open, Esc to close).
- **Label:** always paired with a visible [label](label.md) above (form context) or a label prefix in the displayed value (filter strip context).
- **Focus visible:** `focus-ring` (2px `#4263eb`) on keyboard focus.
- **Disabled state:** `disabled` attribute on `<select>`; also `aria-disabled="true"` if there's a micro-label to surface (e.g., "You cannot change your own role.").
- **Native semantics:** keep `<select>` (not a div-based dropdown) for screen-reader compatibility. Style with CSS, but preserve the native semantics.
