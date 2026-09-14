# Dropdown Panel (My Profile)

**Category:** Molecule
**Composed of:** [avatar](../02-atoms/avatar.md) (32px) + [badge-role](../02-atoms/badge-role.md) (pill) + [divider](../02-atoms/divider.md) (1px) + [button](../02-atoms/button.md) (Logout action)
**Phase 4 source:** Header / My Profile / Logout (the panel that opens below the "My Profile ▾" trigger)

---

## Overview

A 240px-wide panel anchored below the "My Profile ▾" trigger in the app-header chrome. The panel consolidates identity display (avatar, display name, role badge) and the Logout action into a single surface, replacing the prior pattern of two separate right-side links.

The panel is dismissable by clicking outside, pressing `Esc`, or clicking the trigger again (toggle). It exists once per app-header chrome instance — there is no other use of this pattern in MVP.

## Variants

### Standard panel

- **Width:** 240px. Height: auto, based on content (≈96px tall).
- **Position:** right-aligned to the "My Profile ▾" trigger; 16px below the bottom of the chrome strip.
- **Background:** `#ffffff`.
- **Border:** `#dee2e6` 1px.
- **Radius:** 6px.
- **Shadow:** `0 4px 12px rgba(33, 37, 41, 0.12)` — lifts the panel off the page.

### Panel layout (top-down)

#### Header zone (top, padded 16px)

- **Avatar:** 32×32 circle, `#adb5bd` bg with white initials (12px semibold). Standard avatar atom.
- **Display name:** 14px semibold `#212529`, positioned right of the avatar.
- **Role badge below name:** "Employee" / "Support Agent" / "Admin" — pill, 11px semibold. Uses the [badge-role](../02-atoms/badge-role.md) styling:
  - Employee: `#adb5bd` text/border, no fill (or transparent fill)
  - Support Agent: `#edf2ff` bg, `#4263eb` text/border
  - Admin: `#fff5d6` bg, `#7a5c00` text/border (warm tone for visual distinction)

#### Divider

- 1px `#dee2e6`, full panel width. Standard [divider](../02-atoms/divider.md) atom.

#### Action zone (bottom, padded 8px)

- "Logout" — full-width button-style link, 14px medium `#212529` text, `#f8f9fa` background.
- **Hover:** background `#f1f3f5`.
- **Padding:** 8px vertical, 16px horizontal.
- Clicking opens the logout confirmation dialog (see [dialog-modal](dialog-modal.md)).

## States

| State | Display |
|---|---|
| Closed | Panel not rendered |
| Open (default) | Panel rendered, anchored to trigger; trigger in active state |
| Open + trigger hover | Trigger active state maintained; panel unaffected |
| Open + outside click | Panel closes; trigger returns to default |
| Open + `Esc` | Panel closes; trigger returns to default |
| Logout dialog open | Panel stays open behind the modal scrim; the modal is the foreground interaction |
| Logout error | Modal stays open with inline error; panel behind is dimmed |

## Tokens Used

- `color-surface` (`#ffffff`) for panel background
- `color-border-default` (`#dee2e6` 1px) for panel border + internal divider
- `color-primary` (`#212529`) for display name + Logout text
- `color-page-bg` (`#f8f9fa`) for action zone background
- `color-hover-tint` (`#f1f3f5`) for action zone hover
- `color-avatar-bg` (`#adb5bd`) for avatar background
- Role badge colors (per [badge-role](../02-atoms/badge-role.md))
- `shadow-dropdown` (`0 4px 12px rgba(33, 37, 41, 0.12)`)
- `radius-dropdown` (6px)
- `font-size-body` (14px), `font-weight-semibold` for display name + Logout
- `font-size-small` (11px), `font-weight-semibold` for role badge
- `space-dropdown-width` (240px)
- `space-dropdown-anchor-gap` (16px)

## Used In

- **Header / My Profile / Logout** (`header-profile-logout.md`): the only place this molecule appears in MVP. Anchored to the "My Profile ▾" trigger.

## Usage Guidelines

**When to use:**
- When identity display and a single primary action (Logout) need to coexist in the chrome without cluttering the static strip.
- When the action is destructive / sensitive and benefits from being one click away but not directly visible (the dropdown adds a protective click).

**When NOT to use:**
- For non-identity panels (use a menu or popover pattern — out of MVP).
- For multi-action menus (use a menu — out of MVP).
- As a substitute for visible primary actions that should always be reachable.

**Why consolidate into a dropdown?**
- Prior specs had two right-side links (My Profile + Logout). The dropdown consolidation reduces visual chrome (one trigger instead of two) and gives Logout a protective click (open dropdown → click Logout) that prevents accidental logout. The trade-off: one extra click to log out, which is acceptable given the destructive nature of the action.

**Dismissal:**
- Click outside closes the panel without firing any action.
- `Esc` closes the panel.
- Click on the trigger again toggles the panel.
- Clicking the Logout action does NOT close the panel first — it opens the confirmation dialog while the panel stays open behind it.

## Accessibility

- **ARIA:** the trigger is a `<button>` with `aria-haspopup="menu"`, `aria-expanded="true|false"`, and `aria-controls="<panel-id>"`. The panel is `role="menu"` with `aria-labelledby="<trigger-id>"`.
- **Menu items:** the Logout action is `role="menuitem"`. The header zone (avatar + name + role) is informational; not a menu item — screen readers announce "menu: Logout, menuitem" only.
- **Keyboard navigation:**
  - Trigger focused: `Enter` / `Space` / `↓` opens the panel and moves focus to the first menu item.
  - Inside panel: `↓` / `↑` move between menu items; `Enter` activates; `Esc` closes and returns focus to trigger.
  - Only one menu item in MVP (Logout); the keyboard navigation pattern is in place for v1.x when more items might be added.
- **Focus management:** when the panel opens, focus moves into it. When the panel closes, focus returns to the trigger.
- **Color contrast:** display name `#212529` on `#ffffff` = 16.8:1 (AAA). Logout text `#212529` on `#f8f9fa` (or `#f1f3f5` on hover) = 16.4:1 (AAA). Role badge text on its bg passes WCAG AA for graphical elements.
- **Shadow:** purely decorative lift effect; not load-bearing for comprehension.
