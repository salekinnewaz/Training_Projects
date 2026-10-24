# Ticket Category Icon (atom)

**Component:** `components/atoms/ticket-category-icon/ticket-category-icon.component.ts`
**Selector:** `<ticket-category-icon>`
**Used by:** [shared-ticket-table](../03-molecules/shared-ticket-table.md) — the category column of the WDS-2026 table, on all three role dashboards.

## Purpose

A small tinted tile carrying the ticket's category. The WDS-2026 reference gives each category a **colour**; this component keeps that colour **and adds a distinct shape**, so the column is readable without relying on hue alone (WCAG 1.4.1 — Use of Colour).

## Anatomy

A 28×28 rounded square (8px radius) with a tinted background and a solid glyph in the category's accent colour.

| Category | Background | Accent | Glyph |
|---|---|---|---|
| `IT` | `#EAF2FE` | `#0674FE` | laptop |
| `HR` | `#FEE2E2` | `#D92D20` | person |
| `Finance` | `#F0EAFE` | `#7433FE` | document |
| `General` | `#EBEEF6` | `#5D749D` | folder |

The tile carries a `cat-tile` class plus a variant class (`it`, `hr`, `finance`, `general`), so a host stylesheet can target a single category.

## API

| Input | Type | Notes |
|---|---|---|
| `category` | `'IT' \| 'HR' \| 'Finance' \| 'General' \| null` (required) | `null` falls back to the **General** glyph — a ticket with no category still reads as a category, rather than an empty cell. |

## Accessibility

The tile is `aria-hidden="true"`. The row's text carries the meaning — the category is a visual shorthand for a column that would otherwise need a label, and the ticket's own record is the authoritative source. The shape, not the colour, is what distinguishes the categories for a reader who cannot separate the hues.

## Edge cases

| Input | Result |
|---|---|
| `null` | The **General** glyph — a null category is not an error state, it is the absence of a more specific category. |
| An unrecognised value | The General glyph. The component never throws on unexpected data. |
