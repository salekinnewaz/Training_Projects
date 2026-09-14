# App Chrome Pattern (persistent strip + brand mark + dropdown)

**Category:** Pattern
**Phase 4 source:** Header / My Profile / Logout (canonical); reused on every post-login page

---

## Overview

The persistent UI across every authenticated page in HelpDesk Lite. Three responsibilities, one strip:
1. **Brand mark** (left) — "this is HelpDesk Lite," one-click return to role-correct Dashboard.
2. **Identity affordance** (right) — single "My Profile ▾" trigger that opens a dropdown panel showing the user's avatar, name, role, and the Logout action.
3. **Logout** — accessed only via the dropdown panel, protected by a confirmation dialog before clearing the session.

The pattern is intentionally minimal. The chrome is the most-shared surface in the app; every other post-login page renders it as the top strip. Its only job is to be invisible when the user is doing their work and reliably accessible when they need to identify themselves or leave the session.

## What the pattern enforces

- **One right-side link, not two.** Prior specs had `My Profile` + `Logout` as separate right-side links. The current pattern consolidates into `My Profile ▾` only; Logout lives inside the dropdown. This reduces visual chrome and gives Logout a protective click.
- **Brand mark is the home affordance.** Clicking the logomark or wordmark routes to the role-correct Dashboard (`/dashboard` for Employee; `/queue` for Support Agent; `/admin` for Admin). One `Tab` stop, one `Enter` activation.
- **Logout is protected.** Clicking Logout inside the dropdown panel opens a confirmation dialog. Cancel preserves the session. Confirmed logout clears the session and redirects to `/login`.
- **No editable profile fields.** The dropdown panel displays identity (name + role) but does not allow editing. Profile changes are via the auth backend (out of MVP).

## When applied

The chrome is rendered on every authenticated page:
- **Ticket Detail** (`ticket-detail.md`)
- **Submission Confirmation** (`submission-confirmation.md`)
- **Create Ticket** (`create-ticket.md`)
- **Employee Dashboard** (`employee-dashboard.md`)
- **Agent Kanban** (`agent-kanban.md`) — Support Agents only; Admin does not see this page.
- **Admin Dashboard** (`admin-dashboard.md`)
- **Users tab** (`users-tab.md`) — also rendered as Users tab content on Admin Dashboard.

The chrome is NOT rendered on:
- **Login** (`login.md`) — unauthenticated.
- **403 / 404 / session-expired pages** — no session context.

## Composition

- **App-header chrome strip** — see [app-header-chrome](../03-molecules/app-header-chrome.md) for the strip anatomy.
- **Dropdown panel** — see [dropdown-panel](../03-molecules/dropdown-panel.md) for the panel that opens below "My Profile ▾".
- **Dialog modal** — see [dialog-modal](../03-molecules/dialog-modal.md) for the Logout confirmation dialog.

## Behavior (consolidated)

### Dropdown open/close

- Click "My Profile ▾": panel opens.
- Click "My Profile ▾" again: panel closes (toggle).
- Click anywhere outside the panel: panel closes.
- `Esc`: panel closes.
- Click on "Logout" inside panel: confirmation dialog opens; panel stays open behind it (dimmed). On Cancel, panel remains open. On Log out, session ends.

### Brand-mark click

- Mouse: click anywhere on logomark or wordmark → routes to role-correct Dashboard.
- Keyboard: `Tab` focuses the brand mark group; `Enter` activates.

### Logout lifecycle

- POST `/api/auth/logout` clears the session cookie.
- Success: redirect to `/login`. No "You've been logged out" toast.
- Failure: inline error in the dialog: "Couldn't log you out. Try again." Dialog stays open. User can retry or cancel.
- Concurrent session invalidation: if session already expired server-side, the Logout POST may return 401; treat as success and redirect to `/login`.

### Cross-page state

- **Persistent across navigation:** rendered on every post-login page.
- **State on role change:** if Admin changes a user's role (e.g., Sam from Support Agent to Admin), the chrome updates on next page load. No live updates within a session.
- **State on deactivation:** if Admin deactivates the current user, the next request returns 403; the chrome doesn't change in-place, but the page redirects to a session-expired state.

## Accessibility (consolidated)

- **Skip-to-content link:** visually-hidden "Skip to main content" link is the first focusable element on every page that uses this chrome. Standard accessibility affordance for persistent chrome.
- **Brand mark group:** single focusable element with `aria-label="HelpDesk Lite — go to dashboard"`.
- **Trigger:** native `<button>` with `aria-haspopup="menu"`, `aria-expanded="true|false"`, `aria-controls="<panel-id>"`.
- **Focus-visible:** keyboard focus shows 2px `#4263eb` outline ring; mouse focus does not.
- **Dialog focus trap:** when Logout dialog is open, focus is trapped inside the dialog. Initial focus on Confirm button. `Esc` cancels.

## Open questions / v1.x follow-ups

None of the structural design decisions remain unresolved. Implementation-level follow-ups:
- Editable profile fields (name, email, password change): out of MVP.
- "Active sessions" list (see / sign out of other devices): out of MVP.
- Profile picture upload: out of MVP. Avatars are initials-on-grey.
- Notification preferences: out of MVP. Email notifications themselves are out of MVP.
- Dark mode / theme switcher: out of MVP.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — strip anatomy.
- [dropdown-panel](../03-molecules/dropdown-panel.md) — panel anatomy.
- [dialog-modal](../03-molecules/dialog-modal.md) — Logout dialog anatomy.
- [confirmation-dialog](confirmation-dialog.md) — cross-page confirmation pattern.
