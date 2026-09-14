# Empty State Pattern

**Category:** Pattern
**Phase 4 source:** Employee Dashboard (empty queue), Agent Kanban (empty columns), Admin Dashboard (empty status cards)

---

## Overview

A cross-page pattern for surfaces that have no content. The pattern enforces three variants depending on context:

1. **Page-level empty state** — when the entire page has no items. Includes a primary CTA to give the user a next step.
2. **Column-scoped empty state** — when a filtered list (column) has zero matches. Single muted line, no CTA.
3. **Section-scoped empty state** — when a sub-section (a card body) has zero items. Single muted line, no CTA.

The pattern's purpose is to reassure the user that the system is working and (where applicable) provide a clear next step. Empty states never use alarming language — calm, factual phrasing.

## When to use

- Whenever a list / column / section has zero items to show.
- Whenever the user has just landed on a page and might wonder "did the system work?"

## When NOT to use

- For loading states (use [loading-skeleton](loading-skeleton.md) instead).
- For error states (use [server-error-state](server-error-state.md) instead).
- For filter results that are partial (e.g., "showing 0 of 5 results" — use the column-scoped variant).

## The three variants

### 1. Page-level empty state (with CTA)

Used on: **Employee Dashboard** (`employee-dashboard.md`) when Eli has zero tickets.

- **Width:** 480px centered horizontally inside the parent content column.
- **Vertical position:** upper-third of the available list area (not bottom-pushed).
- **Headline:** 20px semibold `#212529`.
- **Caption:** 14px `#495057`. Single sentence explaining what will appear when the user takes the relevant action.
- **CTA:** primary [button](../02-atoms/button.md). 48px tall (slightly larger than the header CTA so the empty-state CTA is the most prominent affordance).
- **Stack:** headline → caption (8px gap) → button (32px gap). Centered horizontally within the column.

**Example (Employee Dashboard):**
- Headline: "No tickets yet"
- Caption: "When you file a request it'll appear here."
- CTA: "Create Ticket" (primary)

### 2. Column-scoped empty state (filtered)

Used on: **Agent Kanban** (`agent-kanban.md`) when a column has zero matches with active filters.

- **Width:** fills the column body.
- **Vertical position:** centered vertically within the column body.
- **Text:** 14px `#868e96` (muted), single line.
- **No CTA.**
- **Example:** "No tickets match your filters."

### 3. Column-scoped empty state (no filter, genuinely empty)

Used on: **Agent Kanban** when the queue is genuinely empty across the system.

- **Same chrome as variant 2** (14px `#868e96`, centered).
- **Text:** "Nothing here." — calm, single-line.
- **No CTA.**
- The page reads as "no work to do" rather than "broken."

### 4. Section-scoped empty state (card body)

Used on: **Admin Dashboard** (`admin-dashboard.md`) inside status cards when the count is zero.

- **Text:** "No tickets in this status." or "No Open tickets." (whichever reads cleaner).
- **Style:** 14px `#868e96`, centered horizontally inside the card body.

## Wording rules (consolidated)

- **Calm, factual, present tense.** "Nothing here." is preferred over "No items found!" (no exclamation, no alarm).
- **Page-level empty state should answer "what would change this?"** — i.e., the next step.
- **Column-scoped empty state should distinguish between filtered** (the user chose this) **and no-filter** (the system is genuinely empty).
- **Never use "Error" / "Failed to load" / "Oops"** in empty states — those are reserved for [server-error-state](server-error-state.md).

## Visual treatment (consolidated)

- **No illustrations in MVP.** The empty state is text-only (with CTA where applicable). Illustrations are a v1.x enhancement.
- **No icons** (no sad-face icon, no empty-box icon). Just text.
- **No background tint** — the empty state sits on the page background like any other content.

## CTA placement (page-level variant only)

- The page-level empty state CTA is the most prominent affordance on the page (slightly larger than the header CTA, vertically centered). When the list is empty, the CTA is the only thing that matters.
- Column / section-scoped empty states have no CTA — the user is already in a flow that doesn't need a next-step prompt.

## Accessibility (consolidated)

- **Landmark:** the page-level empty state can be wrapped in a `<section>` with `aria-labelledby` pointing to the headline. Screen readers announce "region: No tickets yet."
- **Heading semantics:** the headline is a heading element (`<h2>` typically, since the page heading `<h1>` is rendered above). Screen readers can navigate to it directly.
- **CTA:** primary CTA is a standard button — keyboard-focusable, `Enter`-activatable.
- **Color contrast:**
  - Headline `#212529` on `#ffffff` = 16.8:1 (AAA)
  - Caption `#495057` on `#ffffff` = 8.6:1 (AAA)
  - Muted text `#868e96` on `#ffffff` = 4.6:1 (AA for normal text)
- **No reliance on color:** empty states communicate via text, not via color. The same message reads the same to all users.

## See also

- [empty-state](../03-molecules/empty-state.md) — the molecule-level spec for the three variants.
- [loading-skeleton](loading-skeleton.md) — for the loading variant (different message, different visual).
- [server-error-state](server-error-state.md) — for the error variant.
- [button](../02-atoms/button.md) — primary CTA styling.
