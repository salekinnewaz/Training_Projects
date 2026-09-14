# Caret

**Category:** Atom
**Phase 4 source:** Header dropdown trigger (My Profile ▾), all `<select>` controls (Priority ▾, Category ▾, Owner ▾, Role ▾)

---

## Overview

A small downward-pointing chevron (▾) that signals "there's a dropdown here." Used in conjunction with [link](link.md) (My Profile trigger) and [select](select.md) (all dropdown controls).

## Variants

### Standard caret

- **Glyph:** small V polyline (3 points), drawn as an SVG path: `M0,-4 L4,0 L8,-4` (relative to anchor).
- **Stroke:** 1.5px wide, rounded line caps and joins.
- **Color:** `color-label` (`#495057`) by default; `color-primary` (`#212529`) when the parent is in active/hover state (e.g., My Profile dropdown open).
- **Disabled:** `color-disabled-text` (`#adb5bd`) when the parent control is disabled (e.g., disabled role dropdown on self-row).

### Caret sizes

- **14px text context:** 8px wide × 4px tall
- **13px text context:** 8px wide × 4px tall (same — caret doesn't scale tightly with text)

## States

| State | Display |
|---|---|
| Default | `color-label` stroke |
| Hover / active | `color-primary` stroke |
| Disabled | `color-disabled-text` stroke |
| Open (dropdown panel open) | `color-primary` stroke (parent link is in active state) |

## Tokens Used

- `color-label`, `color-primary`, `color-disabled-text`

## Used In

- **Header dropdown trigger** (`header-profile-logout.md`): right of "My Profile" text, polyline at x=1372.
- **All `<select>` controls** in Create Ticket (Category, Priority), Agent Kanban (Priority, Category, Owner), Users tab (Role).

## Usage Guidelines

**When to use:**
- To signal that a control opens a dropdown.
- Always paired with a text label (the caret alone is not enough affordance).

**When NOT to use:**
- For navigation arrows (use ←, →, ‹, ›).
- For status indicators (use [badge-status](badge-status.md)).

## Accessibility

- **Decorative:** the caret is purely visual — the parent control's text label and ARIA semantics (link text for My Profile, `<select>` for dropdowns) carry the affordance. `aria-hidden="true"` on the caret polyline is appropriate.
- **Color contrast:** all three color tokens pass WCAG AA against their respective backgrounds (white, white, white).
