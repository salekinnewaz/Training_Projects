# App-Header Chrome (persistent strip)

**Category:** Molecule
**Composed of:** brand mark (logomark + wordmark, custom composition) + [link](../02-atoms/link.md) ("My Profile ▾" trigger) + [caret](../02-atoms/caret.md)
**Phase 4 source:** Header / My Profile / Logout (canonical spec); reused on every post-login page

---

## Overview

The 64px-tall persistent strip at the top of every post-login page. It contains the brand mark on the left (logomark + wordmark, both clickable as a single home affordance) and a single "My Profile ▾" trigger on the right that opens a dropdown panel for identity display and the Logout action.

The chrome is the **only persistent UI** across every post-login page. It has three jobs:
1. Brand mark — "this is HelpDesk Lite," one-click return to role-correct Dashboard.
2. Identity affordance — "My Profile ▾" reveals who is logged in (avatar + name + role).
3. Logout — accessed only via the dropdown panel (not in the static chrome); protected by a confirmation dialog.

## Variants

### Standard chrome

- **Height:** 64px.
- **Background:** `#ffffff`.
- **Bottom border:** `#dee2e6` 1px.
- **Layout:** `[brand mark group] ........................ [My Profile ▾ trigger]` — single right-side link, not two.
- **Brand mark group (left side):**
  - Logomark: 40×40 dark square (`#212529` fill, 6px radius) at x=32, y=12.
  - Wordmark: "HelpDesk Lite" — 22px semibold, `#212529`, baseline y=40, x=84.
  - Whole group is clickable as one anchor (routes to role-correct Dashboard).
- **Trigger (right side):**
  - "My Profile" — 14px, `#495057`. Position: right-aligned to x=1408.
  - Caret polyline (`▾`) immediately right of the text, drawn as `M0,-4 L4,0 L8,-4` at x=1372, y=40.
  - Active state (dropdown open): text `#212529` semibold, caret `#212529`.
- **No separate "Logout" link in the static chrome.** Logout lives inside the dropdown panel.

## States

| State | Display |
|---|---|
| Default (chrome only, dropdown closed) | Standard chrome: brand mark + "My Profile ▾" |
| Dropdown open | Panel anchored below the trigger; trigger in active state (`#212529` semibold + caret `#212529`) |
| Brand-mark hover | Subtle color shift `#212529` → `#495057` on the wordmark; logomark unchanged |
| Brand-mark focus (keyboard) | Outline ring `#4263eb` 2px (`focus-visible` only) on the brand-mark group |
| Trigger hover | Text color `#495057` → `#212529` |
| Trigger focus (keyboard) | Outline ring `#4263eb` 2px on the trigger link |
| Logout dialog open (modal) | Modal scrim `rgba(33, 37, 41, 0.4)` over the page; dropdown behind it dimmed |
| Post-logout | Chrome no longer rendered (route is `/login`, which is un-authenticated) |

## Tokens Used

- `color-surface` (`#ffffff`) for chrome background
- `color-border-default` (`#dee2e6` 1px) for chrome bottom border
- `color-primary` (`#212529`) for logomark fill, wordmark, trigger active state
- `color-label` (`#495057`) for wordmark hover, trigger default text
- `color-focus-ring` (`#4263eb` 2px) for keyboard focus outline
- `font-size-wordmark` (22px), `font-weight-semibold` for wordmark
- `font-size-body` (14px), `font-weight-regular` for trigger
- `radius-logomark` (6px)
- `space-chrome-height` (64px)

## Used In

- **Header / My Profile / Logout** (`header-profile-logout.md`): canonical chrome spec.
- **Ticket Detail** (`ticket-detail.md`): persistent chrome above the page content.
- **Submission Confirmation** (`submission-confirmation.md`): persistent chrome above the success content.
- **Create Ticket** (`create-ticket.md`): persistent chrome above the form.
- **Employee Dashboard** (`employee-dashboard.md`): persistent chrome above the dashboard.
- **Agent Kanban** (`agent-kanban.md`): persistent chrome above the filter strip + board.
- **Admin Dashboard** (`admin-dashboard.md`): persistent chrome above the heading row + tabs.
- **Users tab** (`users-tab.md`): persistent chrome above the table.

## Usage Guidelines

**When to use:**
- On every authenticated page (every post-login page in MVP).
- Whenever the user is "in" the app and needs persistent identity / logout / home affordances.

**When NOT to use:**
- On `/login` — Login is the unauthenticated surface; chrome is not rendered.
- On 403 / 404 / session-expired pages — chrome is omitted because the user has no session context.
- On any modal or overlay — modals are full-screen scrim overlays; the chrome is not rendered behind them in a way that interacts with the modal.

**Brand mark click target:**
- The logomark and wordmark are wrapped in a single `<a>` element. One `Tab` stop, one `Enter` activation. Routes to the role-correct Dashboard (`/dashboard` for Employee; `/queue` for Support Agent; `/admin` for Admin).

**Trigger click behavior:**
- Single click toggles the dropdown panel. Click again to close. Click anywhere outside to close. `Esc` to close.

**Why one right-side link, not two?**
- Prior specs / wireframes had two right-side links (`My Profile` + `Logout`). The current spec consolidates identity display and logout action into a single dropdown to reduce visual chrome and create a cleaner header. The trade-off: one extra click to log out (open dropdown → click Logout → confirm). The confirmation dialog adds friction deliberately to prevent accidental logout.

## Accessibility

- **Brand mark group:** wrapped in a single focusable element with `aria-label="HelpDesk Lite — go to dashboard"`.
- **Trigger:** native `<button>` (or `<a>` with `role="button"` if navigation isn't relevant); `aria-expanded="true|false"` reflects the dropdown state; `aria-haspopup="menu"` announces the dropdown's nature.
- **Focus-visible:** keyboard focus shows a 2px `#4263eb` outline ring; mouse focus does not (standard `focus-visible` behavior).
- **Skip-to-content link:** a visually-hidden "Skip to main content" link is the first focusable element on every page that uses this chrome. This is the standard accessibility affordance for persistent chrome — the user can jump past the chrome to the page content.
- **Color contrast:** wordmark `#212529` on `#ffffff` = 16.8:1 (AAA). Trigger text `#495057` on `#ffffff` = 8.6:1 (AAA). Trigger active `#212529` = 16.8:1.
- **Hover state:** purely visual; not required for comprehension. The active state (dropdown open) carries the same color shift as hover, so users who don't hover (touch) still see the active feedback.
