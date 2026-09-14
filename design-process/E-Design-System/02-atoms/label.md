# Label

**Category:** Atom
**Phase 4 source:** All form fields, status / priority / role badges, table column headers

---

## Overview

A label is text that names something else: a form field (above the input), a badge (inside the pill), a table column (above the column), or a micro-label (e.g., "12 users · 11 active · 1 inactive"). Labels are not interactive; they describe.

## Variants

### Form field label

- **Text:** `color-label` (`#495057`), `font-size-body` (14px), `font-weight-medium`
- **Position:** directly above the input, 8px gap from input top
- **Optional micro-label:** `(required)` or `(optional)` to the right of the label in `color-muted` (`#868e96`), `font-size-micro` (11px)

### Badge label

- **Text:** depends on badge type — see [badge-status](badge-status.md), [badge-priority](badge-priority.md), [badge-role](badge-role.md).
- **Position:** centered inside the pill.
- **Size:** `font-size-micro` (11px), `font-weight-semibold`.

### Table column header

- **Text:** `color-muted` (`#868e96`), `font-size-micro` (11px), `font-weight-semibold`, uppercase, `letter-spacing-caps` (1.2).
- **Position:** above the column, left-aligned (or right-aligned for numeric columns like timestamps).

### Micro-label

- **Text:** `color-muted` (`#868e96`), `font-size-micro` (11px), `font-weight-regular`.
- **Use cases:** active-count summary, self-row micro-label ("You cannot change your own role."), footer copy ("Showing 12 of 47"), error copy ("Couldn't update. Try again.").

## States

Labels have no state changes; they are descriptive.

## Tokens Used

- `color-label`, `color-muted`, `color-primary` (for high-emphasis labels like dialog headline)
- `font-size-micro`, `font-size-body`
- `font-weight-regular`, `font-weight-medium`, `font-weight-semibold`
- `letter-spacing-caps` (for column headers)

## Used In

- **All form fields** across Login, Create Ticket, Ticket Detail composer.
- **Status, priority, role badges** on Ticket Detail, Employee Dashboard, Agent Kanban, Admin Dashboard, Users tab.
- **Table column headers** on Users tab.
- **Micro-labels** everywhere (active count, self-row protection, footer copy).

## Usage Guidelines

**When to use:**
- To name a form field (always).
- To name a table column (always).
- To describe a state or condition (e.g., "(required)", "Self-row").

**When NOT to use:**
- For interactive elements (use [link](link.md) or [button](button.md)).
- For long-form body content (use body text styling).

## Accessibility

- **Form field labels:** always paired with the input via `<label for="...">` or wrapping `<label>`. Never rely on placeholder text alone.
- **Required state:** indicated by the `(required)` micro-label AND the `required` attribute on the input (not just visual).
- **Column headers:** `<th>` element in HTML, paired with `scope="col"`.
- **Micro-labels:** if they convey critical state (e.g., self-row protection), use `aria-describedby` to associate with the disabled control.
