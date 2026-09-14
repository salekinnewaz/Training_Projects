# Divider

**Category:** Atom
**Phase 4 source:** Header dropdown panel (between header zone and Logout action), table rows (bottom border), app-header (bottom border)

---

## Overview

A horizontal hairline that separates regions. Used to mark the boundary between two sections without a heavy visual break.

## Variants

### Hairline (1px default)

- **Stroke:** `1px solid #dee2e6` (`color-border-default`)
- **Span:** full width of parent surface
- **Use:**
  - Inside the My Profile dropdown panel (between header zone and Logout action zone)
  - Between rows in the Users table (bottom border of each row)
  - Between rows in the Employee Dashboard (bottom border of each row)
  - Bottom of the app-header chrome strip
  - Between sections inside the Ticket Detail page (above Comments, above Activity log)

### Strong (3px emphasis)

- **Stroke:** `3px solid #212529` (`color-border-emphasis`)
- **Use:** left border on the self-row in the Users tab (the Admin viewing the page). Marks "this is you" with a visual differentiator beyond the row background.

## States

Dividers have no state changes; they are decorative separators.

## Tokens Used

- `color-border-default` (`#dee2e6`) for hairline
- `color-border-emphasis` (`#212529`) for strong

## Used In

- **Header dropdown** (`header-profile-logout.md`): 1px `#dee2e6` divider inside the panel.
- **Users tab** (`users-tab.md`): 1px row separators between users; 3px left border on self-row.
- **Employee Dashboard** (`employee-dashboard.md`): 1px row separators between tickets.
- **App-header chrome** (all post-login pages): 1px bottom border.
- **Ticket Detail** (`ticket-detail.md`): 1px between Description / Comments / Activity log sections.

## Usage Guidelines

**When to use:**
- To separate sections within a single surface (within a panel, between rows in a table).
- When a heavier break (background change) would be too noisy.

**When NOT to use:**
- Between top-level regions of a page (use whitespace + heading hierarchy).
- As a button or interactive element (it's purely decorative).

## Accessibility

- **Decorative:** rendered as `<hr>` element or pure CSS `border-bottom`. If `<hr>`, mark `aria-hidden="true"` if purely decorative; otherwise use `<hr role="separator">` to convey structure.
- **Color contrast:** 1px `#dee2e6` on `#ffffff` = 1.5:1 — this is intentional (subtle separator). If a stronger visual break is needed for accessibility (e.g., low-contrast screens), use a 2px hairline or a labeled section heading instead.
