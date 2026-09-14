# Button

**Category:** Atom
**Phase 4 source:** Login (Submit), Ticket Detail (Confirm, Reopen), Submission Confirmation (View ticket), Create Ticket (Submit, Cancel), Employee Dashboard (+Create Ticket), Header / My Profile / Logout (Log out, Cancel)

---

## Overview

The button is the primary action trigger across the app. It has two visual variants: **primary** (high-emphasis action) and **secondary / muted** (low-emphasis action). All buttons have a consistent 6px radius, 14px semibold label, and explicit focus ring.

## Variants

### Primary

- **Background:** `color-primary` (`#212529`)
- **Text:** `color-on-primary` (`#ffffff`)
- **Height:** 48px (Submit, Log out, View ticket), 40px (Confirm, Reopen)
- **Padding:** 8px vertical, 16px horizontal
- **Radius:** `radius-input` (4px) for inline actions; `radius-card` (6px) for full-width Submit-style buttons

### Secondary / muted

- **Background:** `color-surface` (`#ffffff`)
- **Border:** `border-default` (`1px solid #dee2e6`)
- **Text:** `color-label` (`#495057`)
- **Height:** 32–40px (Cancel, Reopen — same family as primary but visually quieter)
- **Padding:** 8px vertical, 16px horizontal
- **Radius:** `radius-input` (4px)

## States

| State | Primary | Secondary |
|---|---|---|
| Default | `#212529` fill, white text | white fill, `#dee2e6` border, `#495057` text |
| Hover | (no explicit color change in MVP; CSS hover can darken 5%) | border darkens to `#adb5bd` |
| Active / pressed | (no explicit color change; CSS active can darken 10%) | bg `color-surface-hover` (`#f1f3f5`) |
| Disabled | bg `#f8f9fa`, text `color-disabled-text` (`#adb5bd`) | same |
| Focus (keyboard) | `focus-ring` (`2px solid #4263eb`) | same |

## Tokens Used

- `color-primary`, `color-on-primary`, `color-surface`, `color-surface-hover`, `color-label`, `color-disabled-text`
- `font-size-body`, `font-weight-medium` or `font-weight-semibold`
- `space-2` (vertical padding), `space-4` (horizontal padding)
- `radius-input` (4px) or `radius-card` (6px)
- `focus-ring`

## Used In

- **Login** (`login.md`): Submit button (primary, 48px tall, full-width within form column).
- **Ticket Detail** (`ticket-detail.md`): "Confirm resolved" (primary, in header action zone), "Reopen" (secondary, in header action zone at Resolved state).
- **Submission Confirmation** (`submission-confirmation.md`): "View ticket" (primary, 48px tall, centered).
- **Create Ticket** (`create-ticket.md`): Submit (primary, 48px tall, full-width); Cancel (secondary, left of Submit).
- **Employee Dashboard** (`employee-dashboard.md`): "+ Create Ticket" (primary, 40px tall, top-right of heading row).
- **Header / My Profile / Logout** (`header-profile-logout.md`): "Log out" (primary, in confirmation dialog); "Cancel" (secondary, in confirmation dialog).

## Usage Guidelines

**When to use primary:**
- The main action on a page or in a dialog (e.g., Submit, Confirm, Log out, View ticket).
- Destructive actions (e.g., Log out, demote Admin, deactivate Admin) — destructive semantics come from copy, not button color.

**When to use secondary / muted:**
- Cancel / dismiss actions.
- Optional or reversible actions (e.g., Reopen — reversible, secondary).
- Actions that share visual space with a primary action (one primary + one secondary per row / dialog is the consistent pattern).

**When NOT to use:**
- For navigation (use a [link](../03-molecules/...link not used — see inline `link` atom)).
- More than one primary per visible region (visual hierarchy collapses if multiple primaries compete).

## Accessibility

- **Keyboard:** `Tab` focuses, `Enter` or `Space` activates. (HTML `<button>` element handles this natively.)
- **Focus visible:** `focus-ring` (2px `#4263eb`) on keyboard focus only; not shown on mouse click.
- **Disabled state:** `aria-disabled="true"` on the button when not interactive (instead of `disabled` attribute if there's a tooltip or other context to surface).
- **Color contrast:** Primary button (white on `#212529`) = 16.1:1 (AAA). Secondary button (`#495057` text on white) = 8.6:1 (AAA).
- **Touch target:** Minimum 32px tall in MVP; primary CTAs are 48px to match Material/Apple HIG guidance.
