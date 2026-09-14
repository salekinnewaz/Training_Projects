# Empty State

**Category:** Molecule
**Composed of:** typography tokens + [button](../02-atoms/button.md) (primary CTA) + optional muted illustration
**Phase 4 source:** Employee Dashboard (empty queue state), Agent Kanban (empty column states), Admin Dashboard (Closed card empty state)

---

## Overview

A centered card or text block rendered when a list / column / surface has no content. The empty state reassures the user that the system is working and provides a clear next step (when one exists). Empty states never use alarming language ("Nothing here!" / "Error!" / "Oops!") — they use calm, factual phrasing.

The molecule appears in three contexts:
1. **Page-level empty state** (Employee Dashboard "No tickets yet") — large centered card with headline + caption + primary CTA.
2. **Column-scoped empty state** (Agent Kanban column bodies when filtered to zero) — small muted single-line text inside the column.
3. **Section-scoped empty state** (Admin Dashboard Closed card when count is zero) — single-line muted text inside the card body.

## Variants

### Page-level empty state (with CTA)

- **Width:** 480px centered horizontally inside the parent content column.
- **Vertical position:** upper-third of the available list area (not bottom-pushed — the user should see it on first load, not have to scroll past a phantom footer).
- **Headline:** 20px semibold `#212529`. Examples:
  - "No tickets yet"
  - "No users yet" (reserved for future)
- **Caption:** 14px `#495057`. Single sentence explaining what will appear when the user takes the relevant action. Examples:
  - "When you file a request it'll appear here."
- **CTA:** primary [button](../02-atoms/button.md). Examples:
  - "Create Ticket" (Employee Dashboard empty state) — same primary button as the header CTA, but slightly taller (48px) so the empty-state CTA is the most prominent affordance.
  - 32px gap above the button; vertically stacked headline → caption (8px gap) → button (32px gap).
- **Centered horizontally** within the column.

### Column-scoped empty state (filtered)

- **Width:** fills the column body.
- **Vertical position:** centered vertically within the column body.
- **Text:** 14px `#868e96` (muted), single line.
- **Examples:**
  - "No tickets match your filters." (Agent Kanban column with active filter, zero matches)
- **No CTA.** Filters are the user's responsibility; the empty state just confirms "yes, zero matches."

### Column-scoped empty state (no filter, genuinely empty)

- **Same chrome as filtered empty state** (14px `#868e96`, centered).
- **Text:** "Nothing here."
- **No CTA.**
- Used when the queue is genuinely empty across the system — Sam's calm "no work to do" message.

### Section-scoped empty state (card body)

- Used inside Admin Dashboard status cards when the count is zero.
- **Text:** "No tickets in this status." or "No Open tickets." (whichever reads cleaner)
- **Style:** 14px `#868e96`, centered horizontally inside the card body.

## States

| State | Display |
|---|---|
| Default (page-level, with CTA) | Headline + caption + primary CTA, centered |
| Default (column-scoped, filtered) | Single muted line, centered in the column body |
| Default (column-scoped, no filter) | "Nothing here.", centered in the column body |
| Default (section-scoped) | Single muted line, centered in the card body |
| Loading | Skeleton (out of scope for empty state; loading is handled at the parent surface level) |

## Tokens Used

- `color-primary` (`#212529`) for headline text (page-level)
- `color-body` (`#495057`) for caption text (page-level)
- `color-muted` (`#868e96`) for column/section-scoped empty state text
- `color-on-primary` (`#ffffff`) for primary CTA text
- `font-size-headline-sm` (20px), `font-weight-semibold` for page-level headline
- `font-size-body` (14px) for caption and muted text
- `font-weight-medium` for caption
- `space-empty-state-gap-caption` (8px) between headline and caption
- `space-empty-state-gap-button` (32px) between caption and CTA

## Used In

- **Employee Dashboard** (`employee-dashboard.md`): page-level empty state when Eli has zero tickets ("No tickets yet" + Create Ticket CTA).
- **Agent Kanban** (`agent-kanban.md`): column-scoped empty states (filtered: "No tickets match your filters."; no filter: "Nothing here.").
- **Admin Dashboard** (`admin-dashboard.md`): section-scoped empty state inside status cards ("No tickets in this status.").

## Usage Guidelines

**When to use:**
- Whenever a list / column / section has zero items to show.
- Whenever the user has just landed on a page and might wonder "did the system work?"

**When NOT to use:**
- For loading states (use skeleton placeholders instead — see [loading-skeleton](../05-patterns/loading-skeleton.md)).
- For error states (use [server-error-state](../05-patterns/server-error-state.md) instead — different message, different CTA).
- For filter results that are partial (e.g., "showing 0 of 5 results" — use the filtered column-scoped variant).

**Wording rules:**
- Calm, factual, present tense. "Nothing here." is preferred over "No items found!" (no exclamation, no alarm).
- Page-level empty state should answer "what would change this?" — i.e., the next step.
- Column-scoped empty state should distinguish between filtered (the user chose this) and no-filter (the system is genuinely empty).
- Never use "Error" / "Failed to load" / "Oops" in empty states — those are reserved for error states.

**Visual treatment:**
- No illustrations in MVP. The empty state is text-only (with CTA where applicable). Illustrations are a v1.x enhancement.
- No icons (no sad-face icon, no empty-box icon). Just text.

**CTA placement:**
- The page-level empty state CTA is the most prominent affordance on the page (slightly larger than the header CTA, vertically centered). When the list is empty, the CTA is the only thing that matters.
- Column / section-scoped empty states have no CTA — the user is already in a flow that doesn't need a next-step prompt.

## Accessibility

- **Landmark:** the page-level empty state can be wrapped in a `<section>` with `aria-labelledby` pointing to the headline. Screen readers announce "region: No tickets yet."
- **Heading semantics:** the headline is a heading element (`<h2>` typically, since the page heading `<h1>` is rendered above). Screen readers can navigate to it directly.
- **CTA:** primary CTA is a standard button — keyboard-focusable, `Enter`-activatable.
- **Color contrast:** headline `#212529` on `#ffffff` = 16.8:1 (AAA). Caption `#495057` on `#ffffff` = 8.6:1 (AAA). Muted text `#868e96` on `#ffffff` = 4.6:1 (AA for normal text).
- **No reliance on color:** empty states communicate via text, not via color. The same message reads the same to all users.
