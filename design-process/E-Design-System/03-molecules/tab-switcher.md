# Tab Switcher

**Category:** Molecule
**Composed of:** [link](../02-atoms/link.md) (active and inactive variants) + 2px underline indicator
**Phase 4 source:** Admin Dashboard (Dashboard / Users tabs)

---

## Overview

A horizontal pair of text-link tabs in the page heading row that switches the visible content between two sub-surfaces within the same route. The active tab carries a 2px underline; the inactive tab is muted. Tab switching is in-page (URL hash update), not separate routes — the same route serves both tabs.

The tab switcher is used on the Admin Dashboard only. The Users tab page (`/users`) does not have its own tab switcher (Admin navigates between Dashboard and Users via the tab switcher on `/admin`, not via a switcher on `/users`).

## Variants

### Standard tab switcher

- **Position:** right-aligned in the page heading row, horizontally aligned with the heading baseline. On Admin Dashboard: x=1000..1160, y=88..128.
- **Tab text:**
  - **Active:** 14px semibold `#212529`. `aria-current="page"`.
  - **Inactive:** 14px regular `#868e96`. No `aria-current`.
- **Active underline:** 2px `#212529` solid line beneath the active tab's text, full text width. Position: y=124 (just below the text baseline).
- **Tab spacing:** ~15px horizontal gap between tabs (the active tab's underline extends to fit the text width).
- **URL hash:** the active tab's hash is in the URL (`#dashboard` / `#users`) for back-button friendliness and bookmarkability.

### Layout dimensions

- Tab switcher height: 40px (matches heading row height).
- Tabs sit on the same baseline as the page heading (24px semibold `#212529`).
- Heading row total height: 40px (heading + tab switcher aligned on baseline).

## States

| State | Display |
|---|---|
| Default (loaded, Dashboard active) | "Dashboard" semibold with 2px underline; "Users" muted, no underline |
| Default (loaded, Users active) | "Users" semibold with 2px underline; "Dashboard" muted, no underline |
| Hover on inactive tab | Text color darkens slightly (`#868e96` → `#495057`) — subtle; not a strong state change |
| Active tab focus (keyboard) | Outline ring `#4263eb` 2px on the tab element |
| Inactive tab focus (keyboard) | Outline ring `#4263eb` 2px on the tab element |
| Switching tabs | Instant content swap; no animation in MVP |

## Tokens Used

- `color-primary` (`#212529`) for active tab text + underline
- `color-muted` (`#868e96`) for inactive tab text
- `color-label` (`#495057`) for inactive tab hover
- `color-focus-ring` (`#4263eb` 2px) for keyboard focus outline
- `font-size-body` (14px), `font-weight-semibold` for active tab
- `font-size-body` (14px), `font-weight-regular` for inactive tab
- `space-tab-underline` (2px)

## Used In

- **Admin Dashboard** (`admin-dashboard.md`): the only place this molecule appears in MVP. Two tabs: Dashboard (default) and Users.

## Usage Guidelines

**When to use:**
- When a single route serves two distinct sub-surfaces that share the same page chrome (heading, app-header) but present different content.
- When the user toggles between the sub-surfaces frequently and the toggle should be in the heading row (not behind a separate navigation).

**When NOT to use:**
- For navigation between separate routes (use a regular link or button).
- For more than ~5 tabs (tab switcher doesn't scale; navigation menu is more appropriate — out of MVP).
- When the sub-surfaces need their own URLs (use separate routes with a header navigation instead).

**Why in-page, not separate routes?**
- Both sub-surfaces share the same page chrome, the same data fetch lifecycle, and the same permission gate. A single route with URL hash state keeps the back-button working, preserves the heading + chrome, and avoids route-handling duplication.

**Direct-arrival behavior:**
- `/admin#dashboard` → serves Dashboard tab active on initial render.
- `/admin#users` → serves Users tab active on initial render.
- `/admin#anything-else` → defaults to Dashboard tab.
- `/admin` (no hash) → defaults to Dashboard tab.

**Keyboard navigation:**
- `Tab` moves focus to the tab switcher (lands on the active tab).
- `←` / `→` arrow keys move focus between tabs.
- `Enter` activates the focused tab.
- Standard ARIA tablist pattern: `role="tablist"` on the container, `role="tab"` on each tab, `aria-selected="true|false"`, `aria-controls="<panel-id>"`.

## Accessibility

- **ARIA tablist pattern:** container has `role="tablist"`; each tab has `role="tab"` and `aria-selected="true|false"`; tab panels have `role="tabpanel"` and `aria-labelledby="<tab-id>"`.
- **Active indicator:** the 2px underline is the visual active indicator; `aria-selected="true"` is the screen-reader announcement. Both carry the same information redundantly.
- **Focus management:** when switching tabs, focus moves to the newly-activated tab (standard ARIA tabs pattern). The user can `Tab` past the tab switcher to reach the tab panel content.
- **Color contrast:** active tab text `#212529` on `#ffffff` = 16.8:1 (AAA). Inactive tab text `#868e96` on `#ffffff` = 4.6:1 (AA for normal text; intentional muted semantic). Underline `#212529` on `#ffffff` = 16.8:1.
- **Hover state:** color shift on inactive tabs is purely visual; not load-bearing for keyboard users (focus ring provides the keyboard equivalent).
