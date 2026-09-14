# Check Circle

**Category:** Atom
**Phase 4 source:** Submission Confirmation

---

## Overview

The success-state glyph: a green circle with a check mark inside. Used as the dominant visual on the Submission Confirmation page to communicate "the action you took succeeded."

## Variants

### Standard

- **Circle:** 64px diameter, `color-status-resolved-bg` (`#d3f9d8`) fill, 2.5px stroke `color-status-resolved-text` (`#2b8a3e`)
- **Check glyph:** polyline drawn as an SVG path inside the circle. Two strokes: short (lower-left to mid-bottom) and long (mid-bottom to upper-right). Stroke `color-status-resolved-text` (`#2b8a3e`), 2.5px wide, rounded line caps and joins.
- **Position:** centered horizontally on the page content column.

## States

Check circles are display-only; they have no interactive states.

## Tokens Used

- `color-status-resolved-bg` (`#d3f9d8`)
- `color-status-resolved-text` (`#2b8a3e`)

## Used In

- **Submission Confirmation** (`submission-confirmation.md`): dominant visual, centered above the "Ticket created" headline.

## Usage Guidelines

**When to use:**
- To communicate "the action succeeded" at-a-glance.
- As the dominant visual on a confirmation / success page.

**When NOT to use:**
- For status badges in tables (use [badge-status](badge-status.md)).
- For partial success or warning states (use a different glyph — out of MVP).
- Inline (the check circle is large and centered; for inline success indicators, use a small ✓ glyph in `color-success`).

## Accessibility

- **Decorative:** the visual is reinforced by the "Ticket created" headline (text label). The check circle itself can be `aria-hidden="true"` or carry an `aria-label="Success"` if the surrounding text doesn't already convey success.
- **Color:** green is the success semantic; color-blind users see the same check glyph + headline.
- **Color contrast:** `#2b8a3e` on `#d3f9d8` = 3.6:1 (passes AA for graphical elements).
