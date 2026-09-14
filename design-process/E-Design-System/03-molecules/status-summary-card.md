# Status Summary Card (Admin Dashboard)

**Category:** Molecule
**Composed of:** [badge-status](../02-atoms/badge-status.md) (mini-pill variant) + typography tokens + [ticket-row](ticket-row.md) (status-card row variant)
**Phase 4 source:** Admin Dashboard (the four cards on the Dashboard tab)

---

## Overview

A vertical column-card on the Admin Dashboard that summarizes one ticket status (Open, In Progress, Resolved, or Closed). Each card shows the status as a colored mini-pill, the count of tickets in that status, and a vertical list of the most recent 12–14 tickets. The Closed card is intentionally muted to signal "history, not actionable."

The four cards together are Admin's at-a-glance view of the queue's shape — replacing the need for Admin to scroll through Support Agents' Kanban.

## Variants

### Active card (Open / In Progress / Resolved)

- **Width:** 320px fixed.
- **Height:** ~720px (fits up to 14 status-card rows + top zone + footer); grows with row count up to a 14-row cap.
- **Background:** `#ffffff`, `#dee2e6` 1px border, 6px radius, no shadow.
- **Top zone (y=156..200, padded 16px):**
  - **Status badge mini-pill:** 18px tall, 11px semibold, padding 0 8px, radius 9px (pill shape). Uses the four status colors:
    - Open → `#fff5d6` bg, `#7a5c00` text
    - In Progress → `#d0ebff` bg, `#1864ab` text
    - Resolved → `#d3f9d8` bg, `#2b8a3e` text
  - **Count:** 28px semibold `#212529`, right-aligned.
- **Body (y=212..840, padded 12px):** vertical list of [status-card rows](ticket-row.md). 40px row stride.
- **Footer (y=848..864, only if card has more than 14 tickets):** muted `Showing 14 of 47` text, 11px `#868e96`, non-interactive in MVP.

### Closed card (muted)

- Same chrome as the active variant, but the count is rendered `#868e96` (muted) instead of `#212529` to signal "terminal."
- Body rows are rendered with muted text throughout (`#868e96`), no hover tint, no cursor change.
- Click is a no-op — `cursor: default`, no routing.

## States

| State | Display |
|---|---|
| Default (loaded, active card) | Top zone with mini-pill + count, body with 12–14 status-card rows |
| Default (loaded, Closed card) | Same chrome but count muted, rows muted, no hover, no click |
| Loading | Skeleton: card outline + 5 grey row bars (16px tall where text would be) |
| Empty | Centered muted text "No tickets in this status." inside the body |
| Filtered out (Admin filtered away all tickets) | Same as Empty |
| Hover on a body row (active cards only) | Row background `#f1f3f5`, cursor pointer |

## Tokens Used

- `color-surface` (`#ffffff`) for card background
- `color-border-default` (`#dee2e6`) for card border
- `color-primary` (`#212529`) for count text (active cards)
- `color-muted` (`#868e96`) for Closed-card count, ticket numbers, timestamps, body rows on Closed
- `color-hover-tint` (`#f1f3f5`) for body row hover
- Status colors (Open / In Progress / Resolved / Closed) — see [badge-status](../02-atoms/badge-status.md)
- `radius-card` (6px) for card radius
- `font-size-display` (28px), `font-weight-semibold` for count
- `font-size-small` (11px), `font-weight-semibold` for status mini-pill
- `font-stack-mono` for ticket numbers in body rows

## Used In

- **Admin Dashboard** (`admin-dashboard.md`): the four cards on the Dashboard tab.

## Usage Guidelines

**When to use:**
- When a page needs an at-a-glance summary of items grouped by a single categorical dimension (status, priority, owner, etc.).
- When the summary view replaces navigation into a deeper filtered list.

**When NOT to use:**
- For primary navigation (the cards aren't tabs or routes — they're summaries).
- When the grouping dimension isn't fixed (use a filterable list).

**Closed-card treatment:**
- The muted treatment on Closed is intentional and consistent with the action matrix: Closed is terminal, no agent or employee action makes sense. The visual treatment reinforces the semantic without needing a "this is read-only" label.

**Footer behavior:**
- MVP footer is muted and non-interactive ("Showing 14 of 47"). Making the footer expandable ("Show all 47 →") is a v1.x follow-up.

**Card-top is display-only:**
- Clicking the status badge mini-pill or the count does nothing in MVP. The card top is a visual summary, not an action target. A "click-to-filter" behavior is a v1.x enhancement.

## Accessibility

- **Card container:** rendered as a `<section>` with `aria-labelledby` pointing to a visually-hidden heading (or the heading is the visible count). One focus stop on the card top? No — the card top is non-interactive.
- **Body rows:** each row is a focusable link (anchor) for click-to-open. Closed-card rows are not focusable (`tabindex="-1"`, `aria-disabled="true"`).
- **Count semantics:** the count number is text content; the card's `aria-label` (or the visible status badge) provides the grouping label ("12 Open tickets").
- **Color contrast:** active count `#212529` on `#ffffff` = 16.8:1 (AAA). Closed count `#868e96` on `#ffffff` = 4.6:1 (AA for normal text; intentional muted semantic).
- **Status badge colors:** Open / In Progress / Resolved badge pairs all pass WCAG AA for graphical elements; see [badge-status](../02-atoms/badge-status.md).
