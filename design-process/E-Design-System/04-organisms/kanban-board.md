# Kanban Board (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + heading row + filter strip (search + 3 dropdowns + clear link) + 4 × column body (each with column header + [kanban-card](../03-molecules/kanban-card.md) list)
**Phase 4 source:** Agent Kanban (`agent-kanban.md`)

---

## Overview

The Support Agent's command center. A four-column board (Open · In Progress · Resolved · Closed) showing every ticket in the system, with drag-and-drop between columns and click-to-open into Ticket Detail. Support Agents only — Admin does not see this page; Admin's home is `/admin`.

The board is Sam's working surface. The morning scan answers three questions in seconds: *what's open, what's mine, what's slipping*. The page must support that scan without scroll friction and let Sam act on any ticket without losing context.

## Anatomy (top-down)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **Heading row** (y=88..128):
   - "Queue" — 24px semibold `#212529`, top-left of page content (x=40).
   - *(No Users tab on this page.)* Admin has its own home at `/admin`; Support Agents do not have a path to user management from this page.
3. **Filter strip** (y=128..184, 56px tall, one row):
   - **Search box** (left, x=40..360, 320px wide) — `<input type="search">`, placeholder "Search queue…", 40px tall, 4px radius. Substring match on ticket number / title / submitter. Debounced 200ms.
   - **Priority filter** (x=380..520, 140px wide) — `Priority: All ▾`.
   - **Category filter** (x=540..680) — `Category: All ▾`.
   - **Owner filter** (x=700..840) — `Owner: All ▾` (options: All · Mine · Unassigned · <each active Support Agent>).
   - **Clear filters** — small `× Clear` link, muted, appears only when at least one filter is non-default.
4. **Kanban board** (y=200..880, scrollable below) — 4 columns of 320px each:
   - **Column order (left → right):** Open · In Progress · Resolved · Closed.
   - **Column header** (48px tall, sticky on scroll): status name + count badge (`Open (4)`).
   - **Column body:** vertical list of [kanban-card](../03-molecules/kanban-card.md)s, 12px gap between cards.
   - **Column widths:** 320px each. Total board: 4 × 320 + 3 × 16 gap + 2 × 32 outer padding = 1360px (40px outer margin on each side of a 1440px canvas).
5. **Empty column states** — centered muted text:
   - Filtered empty: "No tickets match your filters."
   - Genuinely empty: "Nothing here."
   - Orphan-pinned cluster: top N unassigned cards in Open column sit on `#fff5d6` 12% tint.

## Behavior summary

- **Sort within columns:** `created_at` ascending (oldest-first); unassigned (orphan) cards pinned to top of Open.
- **Filter persistence:** state lives in URL (`?priority=high&category=it&owner=me&q=vpn`). Bookmarkable.
- **Drag-and-drop:**
  - Whole card grabbable on mousedown. Click vs drag: mousedown + movement > 4px before mouseup = drag.
  - Hover: card lifts (translateY -2px + card-hover shadow), cursor `grab`.
  - Drag: source column shows ghost placeholder; dragged card follows cursor; valid drop columns highlight.
  - Valid drops per the action matrix: Open → In Progress / Resolved; In Progress → Open / Resolved. Resolved → Closed is not a drag target (Eli only). Closed is read-only.
  - Invalid drop: muted `#fff5f5` background + `—` icon. Drop rejected; card returns with brief shake.
  - Drop success: server confirms, activity log entry written.
  - Keyboard alternative: `Tab` to card, `Enter` to open Ticket Detail, use Change status dropdown there.
- **Click-to-open:** click anywhere on a card body (not the drag surface in motion) → routes to `/tickets/:id`.
- **Admin role and this page:** Admin does not land on `/queue`. Direct-arrival to `/queue` returns 403.

## Layout dimensions

- Page width: 1440
- Board outer margin: 40px each side (x=40..1400 occupied by the board, 1360px wide)
- Column width: 320px fixed
- Column gap: 16px
- Card padding: 12px
- Card-to-card vertical gap: 12px
- Card title row: ~40px (2 lines × 20px)
- Card meta row: 28px
- Card total height: ~96px (stride 108px between cards)
- Filter strip height: 56px
- Heading row height: 40px
- Column header height: 48px (sticky)
- Avatar diameter: 24px

## States (cross-reference)

- **Default (loaded)** — heading + filter strip + 4-column kanban.
- **Default (loaded, Admin direct-arrival)** — 403 Forbidden card: "You don't have access to this page. Back to Admin Dashboard."
- **Filtered (no-result column)** — empty columns show muted text.
- **Dragging** — ghost placeholder, lifted card at cursor, drop zones highlighted.
- **Drag blocked (unsaved comment)** — inline toast at the bottom: "You have an unsaved comment. Save or discard it before moving tickets around."
- **Loading** — skeleton: heading + filter strip with disabled look, 4 columns each with 3 card skeletons.
- **Server error** — inline error above the kanban: "Couldn't load the queue. Refresh to try again."
- **Empty queue (all columns empty)** — each column shows "Nothing here."
- **Session expired** — redirect to `/login?return_to=/queue`.

## Tokens Used

- All app-header-chrome tokens
- All [kanban-card](../03-molecules/kanban-card.md) tokens (lift shadow, orphan tint, unassigned badge)
- All [form-field-dropdown](../03-molecules/form-field-dropdown.md) tokens for filter dropdowns
- [form-field](../03-molecules/form-field.md) tokens for the search input
- [badge-status](../02-atoms/badge-status.md) tokens (column header count badges)
- [badge-priority](../02-atoms/badge-priority.md) tokens (card meta)
- [avatar](../02-atoms/avatar.md) tokens (card owner)
- `color-page-bg` (`#f8f9fa`) for page background
- `space-board-width` (1360px), `space-column-width` (320px), `space-column-gap` (16px)

## Used In

- **Agent Kanban** (`agent-kanban.md`): the canonical organism. Only Support Agents see this page.

## See also

- [kanban-card](../03-molecules/kanban-card.md) — the card atom-level spec.
- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [form-field-dropdown](../03-molecules/form-field-dropdown.md) — filter dropdowns.
- [role-aware-action-matrix](../05-patterns/role-aware-action-matrix.md) — determines valid drag targets.
- [server-error-state](../05-patterns/server-error-state.md) — fetch error pattern.
- [loading-skeleton](../05-patterns/loading-skeleton.md) — initial fetch loading pattern.
