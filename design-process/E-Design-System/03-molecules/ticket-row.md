# Ticket Row (Dashboard row)

**Category:** Molecule
**Composed of:** typography tokens + [divider](../02-atoms/divider.md) (bottom border) + [badge-status](../02-atoms/badge-status.md) + [badge-priority](../02-atoms/badge-priority.md) + mono ticket number
**Phase 4 source:** Employee Dashboard (My Tickets list), Agent Kanban row equivalents

---

## Overview

A single row in a ticket list, rendered as a horizontal stack of metadata. Used on Employee Dashboard (Eli's personal queue) and re-used visually on Agent Kanban card meta rows and Admin Dashboard status-card rows. The whole row is clickable and routes to Ticket Detail.

The row is the "atomic view" of a ticket in list contexts: enough metadata to identify the ticket, identify its state, and decide whether to open it, without showing the full ticket content.

## Variants

### Standard dashboard row

- **Height:** 64px fixed.
- **Background:** `#ffffff`, with a 1px `#dee2e6` bottom border separating it from the row below.
- **Hover state:** background tints to `#f1f3f5`; cursor pointer.
- **Layout (left-to-right, single row):**
  - **Ticket number** — monospace 11px (or 12px depending on context) `#868e96`. Positioned at the left of the row.
  - **Title** — 14px medium `#212529`, ellipsised to one line with `text-overflow: ellipsis`. Tooltip on hover (500ms delay) reveals the full title.
  - **Status badge** — [badge-status](../02-atoms/badge-status.md), positioned center-left.
  - **Priority badge** — [badge-priority](../02-atoms/badge-priority.md), positioned center-right of status.
  - **Last-updated timestamp** — 12px `#868e96`, right-aligned at the row's right edge. Relative format (`2h ago`, `3 days ago`).
- **Padding:** 16px horizontal.

### Status-card row (Admin Dashboard)

- Denser variant used inside the four status cards on the Admin Dashboard.
- **Height:** 40px (smaller than the 64px dashboard row).
- **Background:** `#ffffff` (no hover tint in MVP for Closed rows).
- **Layout:**
  - **Ticket number** — mono 11px `#868e96`, left.
  - **Title** — 13px `#212529`, ellipsised to one line.
  - **Relative timestamp** — 11px `#868e96`, right-aligned.
  - **No status badge** (the parent card already declares the status).
  - **Hover:** background `#f1f3f5` (Open / In Progress / Resolved rows only).
  - **Click:** routes to `/tickets/:id` (Open / In Progress / Resolved only — Closed is non-interactive).
  - **Closed rows:** muted text `#868e96` throughout, no hover, no click.

### Kanban card meta row

- The bottom 28px-tall row of a Kanban card (see [kanban-card](kanban-card.md)).
- **Layout:**
  - **Ticket number** — mono 12px `#868e96`, left.
  - **Priority badge** — centered.
  - **Owner** — 24px avatar + name + `· ` + relative timestamp, right-aligned. If unassigned, the avatar is replaced by an "Unassigned" badge.

## States

| State | Display |
|---|---|
| Default | White surface, 1px `#dee2e6` bottom border, content in normal text colors |
| Hover (clickable) | Background `#f1f3f5`, cursor `pointer` |
| Focus (keyboard) | Native focus ring on the row's wrapping anchor; same tint as hover |
| Muted / read-only (Closed rows on Admin Dashboard) | Text `#868e96`, no hover, no cursor change |

## Tokens Used

- `color-surface` (`#ffffff`) for row background
- `color-border-default` (`#dee2e6`) for row separator
- `color-hover-tint` (`#f1f3f5`) for row hover
- `color-primary` (`#212529`) for title text
- `color-muted` (`#868e96`) for ticket number and timestamp
- `color-body` (`#495057`) for owner name
- `font-size-body` (14px), `font-weight-medium` for title
- `font-size-small` (12px or 13px) for meta and timestamps
- `font-size-mono-small` (11–12px) for ticket number
- `font-stack-mono` for ticket number
- `space-row-height` (64px dashboard, 40px status card, 28px kanban meta)

## Used In

- **Employee Dashboard** (`employee-dashboard.md`): the list of Eli's tickets. Each row is a clickable link to `/tickets/:id`.
- **Admin Dashboard** (`admin-dashboard.md`): inside each of the four status summary cards, as the card body rows.
- **Agent Kanban** (`agent-kanban.md`): inside each kanban card, as the bottom meta row.

## Usage Guidelines

**When to use:**
- Whenever a list of tickets needs to be displayed in tabular / linear form.
- When the user needs to scan many tickets quickly and pick one to act on.

**When NOT to use:**
- When the ticket is already the focus of the page (use Ticket Detail).
- When more than the bare-minimum metadata is needed (e.g., the latest comment preview — out of MVP; row is intentionally lean).

**Sort:**
- Dashboard rows are sorted newest-first by `updated_at`.
- Status-card rows are sorted newest-first within the card; the card itself is fixed-position in the row of four cards.
- Kanban card meta rows: sort is per-card (oldest-first inside Open / In Progress / Resolved / Closed), so aging tickets float up — see [kanban-card](kanban-card.md).

**Click target:**
- The entire row is a single clickable region. No per-cell keyboard nav in MVP — `Tab` moves to the next row's anchor; `Enter` activates.
- For status-card rows on Admin Dashboard, the Closed column's rows are explicitly non-interactive (cursor `default`, no hover) since Closed is terminal.

## Accessibility

- **Single focusable element per row:** the row wraps in an `<a href="/tickets/:id">` (or a `<button>` if non-navigable actions are added later). One `Tab` stop per row.
- **Title ellipsis:** the visual ellipsis is purely a layout decision; the full title is in the DOM (`title` attribute or `aria-label`) and the 500ms-hover tooltip reveals it.
- **Badge semantics:** status and priority badges are decorative — the textual status ("Open" / "In Progress" / "Resolved" / "Closed") is the screen-reader announcement. The badge's color + label communicate the state redundantly for sighted users.
- **Closed rows (Admin Dashboard):** rendered with `aria-disabled="true"` and `tabindex="-1"` so they're skipped in keyboard nav and announced as "dimmed" or "unavailable" depending on platform.
- **Color contrast:** title `#212529` on `#ffffff` = 16.8:1 (AAA). Muted meta `#868e96` on `#ffffff` = 4.6:1 (AA for normal text). Hover tint `#f1f3f5` on `#ffffff` has near-identical text contrast.
