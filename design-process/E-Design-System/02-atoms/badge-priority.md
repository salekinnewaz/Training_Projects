# Badge — Priority

**Category:** Atom
**Phase 4 source:** Ticket Detail, Employee Dashboard, Agent Kanban

---

## Overview

A priority pill that communicates how urgent a ticket is. Used wherever a ticket's priority is shown: detail page, dashboard rows, Kanban cards.

## Variants

Three priority values, each with a unique color pair. Pill shape: 20px tall, `radius-pill` (10px), 11px semibold text.

| Priority | Background | Text | Hex |
|---|---|---|---|
| **Low** | light grey | dark grey | `#e9ecef` / `#495057` |
| **Medium** | warm cream | warm brown | `#fff5d6` / `#7a5c00` |
| **High** | soft red | dark red | `#ffe3e3` / `#c92a2a` |

## States

Priority badges are display-only; they have no interactive states.

## Tokens Used

- `color-priority-low-bg` (`#e9ecef`), `color-priority-low-text` (`#495057`)
- `color-priority-medium-bg` (`#fff5d6`), `color-priority-medium-text` (`#7a5c00`)
- `color-priority-high-bg` (`#ffe3e3`), `color-priority-high-text` (`#c92a2a`)
- `font-size-micro` (11px), `font-weight-semibold`
- `radius-pill`

## Used In

- **Ticket Detail** (`ticket-detail.md`): in the header card metadata row, right of the title.
- **Employee Dashboard** (`employee-dashboard.md`): per row, right of the status badge.
- **Agent Kanban** (`agent-kanban.md`): per card meta row, center.

## Usage Guidelines

**When to use:**
- To communicate a ticket's priority at-a-glance.
- In any context where a ticket reference is shown.

**When NOT to use:**
- For status (use [badge-status](badge-status.md)).
- For user roles (use [badge-role](badge-role.md)).

## Accessibility

- **Color is not the only signal:** each badge has a unique text label (Low / Medium / High) — color reinforces but doesn't replace the text.
- **Color contrast:** all three combinations meet WCAG AA. High (`#c92a2a` on `#ffe3e3`) = 5.4:1 (AAA); Medium (`#7a5c00` on `#fff5d6`) = 5.6:1 (AAA); Low (`#495057` on `#e9ecef`) = 8.5:1 (AAA).
- **High priority as urgency signal:** the red color signals urgency; the text label confirms. Color-blind users see the same text; this is by design.
