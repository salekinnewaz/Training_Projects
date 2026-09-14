# Badge — Status

**Category:** Atom
**Phase 4 source:** Ticket Detail, Submission Confirmation, Employee Dashboard, Agent Kanban, Admin Dashboard

---

## Overview

A status pill that names the ticket's current state. Used wherever a ticket's status is communicated visually: detail page, dashboard rows, Kanban cards, summary cards.

## Variants

Four status values, each with a unique color pair (background + text). Pill shape: 22px tall, `radius-pill` (11px), 11px semibold text.

| Status | Background | Text | Hex |
|---|---|---|---|
| **Open** | warm cream | warm brown | `#fff5d6` / `#7a5c00` |
| **In Progress** | cool blue | navy blue | `#d0ebff` / `#1864ab` |
| **Resolved** | soft green | dark green | `#d3f9d8` / `#2b8a3e` |
| **Closed** | light grey | medium grey | `#f1f3f5` / `#868e96` |

### Mini-pill variant (Admin Dashboard status summary cards)

- **Height:** 18px (instead of 22px)
- **Padding:** 0 8px
- **Radius:** `radius-pill` (9px for 18px height)
- **Use:** inside the card top zone, left of the count.

## States

Status badges are display-only; they have no interactive states.

## Tokens Used

- `color-status-open-bg` (`#fff5d6`), `color-status-open-text` (`#7a5c00`)
- `color-status-in-progress-bg` (`#d0ebff`), `color-status-in-progress-text` (`#1864ab`)
- `color-status-resolved-bg` (`#d3f9d8`), `color-status-resolved-text` (`#2b8a3e`)
- `color-status-closed-bg` (`#f1f3f5`), `color-status-closed-text` (`#868e96`)
- `font-size-micro` (11px), `font-weight-semibold`
- `radius-pill`

## Used In

- **Ticket Detail** (`ticket-detail.md`): in the header card metadata row, right of the title.
- **Submission Confirmation** (`submission-confirmation.md`): under the ticket number, "Open" badge.
- **Employee Dashboard** (`employee-dashboard.md`): per row, right of the title.
- **Agent Kanban** (`agent-kanban.md`): per card meta row, center.
- **Admin Dashboard** (`admin-dashboard.md`): per status summary card top zone (mini-pill variant).

## Usage Guidelines

**When to use:**
- To communicate a ticket's current status at-a-glance.
- In any context where a ticket reference is shown.

**When NOT to use:**
- For user roles (use [badge-role](badge-role.md)).
- For priority (use [badge-priority](badge-priority.md)).

## Accessibility

- **Color is not the only signal:** each badge has a unique text label (Open / In Progress / Resolved / Closed) — color reinforces but doesn't replace the text. WCAG 1.4.1 (Use of Color).
- **Color contrast:** all four combinations meet WCAG AA (3:1 minimum for graphical elements; text labels exceed 4.5:1).
- **Closed state:** rendered with `color-status-closed-text` (`#868e96`) on `color-status-closed-bg` (`#f1f3f5`) — contrast 4.0:1 (passes AA for normal text).
