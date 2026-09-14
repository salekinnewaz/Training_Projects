# Kanban Card

**Category:** Molecule
**Composed of:** [badge-priority](../02-atoms/badge-priority.md) + [avatar](../02-atoms/avatar.md) + ticket row patterns (mono number, title, timestamp) + drag affordance
**Phase 4 source:** Agent Kanban (the four-column board)

---

## Overview

A compact ticket representation rendered inside one of the four Kanban columns. Each card is a single draggable surface that summarizes a ticket's title and meta in two stacked rows. The whole card is grabbable — there is no specific drag handle.

The card is the unit of triage: Sam reads the title, scans the meta, and either drags the card to a new column (status change) or clicks it (open Ticket Detail). Both gestures operate on the whole card.

## Variants

### Standard card (assigned)

- **Width:** fills the column (320px inside the column body, minus column internal padding).
- **Height:** ~96px (title row ~40px + meta row 28px + 12px internal padding × 2 + 4px gap).
- **Background:** `#ffffff`.
- **Border:** `#dee2e6` 1px, 6px radius.
- **Title row:**
  - Ticket title, 14px medium `#212529`.
  - Truncated to 2 lines with `-webkit-line-clamp: 2` (ellipsis on overflow).
- **Meta row (single 28px-tall row):**
  - **Ticket number** — mono 12px `#868e96`, left-aligned.
  - **Priority badge** — centered.
  - **Owner** — 24px avatar (`#adb5bd` bg with white initials) + name + `· ` + relative timestamp, right-aligned. Text 12px `#495057`.

### Unassigned card

- Same chrome as Standard, with the owner replaced by an "Unassigned" badge.
- **Unassigned badge:** pill, `#fff5d6` bg, `#7a5c00` text, 11px semibold — same visual treatment as the Open status pill, so Sam's eye lands on it without it screaming.
- **Pinned visualization:** in the Open column only, the top N unassigned cards sit on a faint `#fff5d6` background tint (12% opacity) so Sam sees the orphan cluster as one visual unit at the top of the column. The tint fades to white below the orphans.

### Card lift / drag state

- **Hover (mouse over a non-dragging card):** `transform: translateY(-2px)` + `box-shadow: 0 4px 8px rgba(33, 37, 41, 0.08)`. Cursor changes to `grab`.
- **Dragging:** the source column shows a faded ghost placeholder where the card was; the dragged card renders at the cursor with elevated shadow; cursor changes to `grabbing`.
- **Drop success:** the card lands in the destination column at the insertion point. The lift animation completes with the card at rest.

### Closed-column card

- Same chrome as Standard, but rendered muted to signal "read-only / terminal."
- Text uses `#868e96` throughout (title, meta, owner).
- No hover tint. No cursor change. The card is not draggable.

## States

| State | Display |
|---|---|
| Default | White surface, normal text colors, no shadow |
| Hover | Lifts (translateY -2px, card lift shadow), cursor `grab` |
| Active drag | Dragged card follows cursor; source column shows ghost |
| Drop target (valid) | Destination column header highlights `#e9ecef`; column body shows dashed insertion indicator |
| Drop target (invalid) | Destination column header highlights `#fff5f5`; matches the action-matrix rejection rule |
| Drop success | Card lands at insertion point; activity log entry written server-side |
| Drop failure | Card returns to source position with a brief shake; inline toast: "Couldn't move the ticket. Try again." |
| Closed (terminal) | Muted text, no hover, no drag |
| Unassigned | Owner replaced by Unassigned badge; in Open column, sits on orphan-pin tint |

## Tokens Used

- `color-surface` (`#ffffff`) for card background
- `color-border-default` (`#dee2e6`) for card border
- `color-primary` (`#212529`) for title text
- `color-muted` (`#868e96`) for ticket number, timestamp, Closed-card text
- `color-body` (`#495057`) for owner name
- `color-orphan-tint` (`#fff5d6` 12%) for orphan pin background (new token, unique to Agent Kanban)
- `color-unassigned-bg` (`#fff5d6`), `color-unassigned-text` (`#7a5c00`) for Unassigned badge
- `shadow-card-hover` (`0 4px 8px rgba(33, 37, 41, 0.08)`)
- `shadow-card-drag` (more elevated variant of card-hover shadow, used during active drag)
- `radius-card` (6px)
- `font-size-body` (14px), `font-weight-medium` for title
- `font-size-small` (12px) for meta

## Used In

- **Agent Kanban** (`agent-kanban.md`): the only place cards appear. Cards are bound to columns by status.

## Usage Guidelines

**When to use:**
- Inside a Kanban-style status board where each ticket occupies exactly one cell.
- When drag-to-change-status is a primary interaction.

**When NOT to use:**
- For non-kanban list views (use [ticket-row](ticket-row.md) instead).
- For dense data tables where 96px per row would be wasteful (use the row variant).

**Drag-and-drop:**
- Whole card is grabbable on mousedown. Click vs drag is detected at >4px movement before mouseup.
- Only columns matching the legal status transitions per the action matrix are valid drop targets:
  - Open → In Progress, Resolved
  - In Progress → Open, Resolved
  - Resolved → (no drag for Agent; Resolved awaits Eli's verdict)
  - Closed → (no drag from this column)
  - Any → Closed (Sam cannot drop into Closed)
- Keyboard alternative: `Tab` to focus the card, `Enter` to open Ticket Detail, use the Change status dropdown there.

**Sort:**
- Oldest-first by `created_at` within each column so aging tickets float up.
- Unassigned (orphan) cards pin to the top of the Open column only.

## Accessibility

- **Whole-card click target:** card body is wrapped in a focusable element. One `Tab` stop per card.
- **Drag-and-drop:** drag-and-drop is mouse-driven. Keyboard users use `Tab` to reach the card, `Enter` to open Ticket Detail, then use the Change status dropdown on the detail page (same outcome).
- **Drop validation feedback:** invalid drop targets are visually communicated via background color change and a `—` icon; the user hears no extra signal. The shake animation on invalid drop is visual-only.
- **Color contrast:** title `#212529` on `#ffffff` = 16.8:1 (AAA). Unassigned badge text `#7a5c00` on `#fff5d6` bg = 5.4:1 (AA). Closed-card muted text `#868e96` on `#ffffff` = 4.6:1 (AA for normal text).
- **Lift shadow:** purely decorative; not load-bearing for comprehension.
