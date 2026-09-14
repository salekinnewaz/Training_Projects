# Admin Dashboard Page (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + heading row + [tab-switcher](../03-molecules/tab-switcher.md) (Dashboard / Users) + Dashboard tab content (4 × [status-summary-card](../03-molecules/status-summary-card.md)) OR Users tab content (Users table)
**Phase 4 source:** Admin Dashboard (`admin-dashboard.md`)

---

## Overview

Admin's home page (`/admin`). Two tabs, two distinct jobs: **Dashboard** (cross-status summary view — see the shape of the queue at a glance) and **Users** (role + active management). Admin never sees the Support Agent Kanban (`/queue`); Admin's oversight role is expressed through this dedicated surface.

The page is Admin's command center for *oversight*, not triage. Admin doesn't move tickets (that's Support Agents' job per the action matrix) and Admin doesn't take new tickets (that's End-Users' job). Admin's two jobs are:
1. See the queue's shape (Dashboard tab).
2. Manage who has access (Users tab).

## Anatomy (top-down)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **Heading row** (y=88..128):
   - **Heading text** (left, x=40, y=108, 24px semibold `#212529`): reflects the active tab. `Dashboard` when the Dashboard tab is active; `Users` when the Users tab is active.
   - **Tab switcher** (right, x=1000..1160): two tabs, `Dashboard` and `Users`. Active tab: 14px semibold `#212529` with 2px underline at y=124. Inactive: 14px regular `#868e96`, no underline.
3. **Tab content** (y=144..):

   ### Dashboard tab (default)

   Four [status-summary-card](../03-molecules/status-summary-card.md)s in a single horizontal row, each 320px wide:

   | Open (12) | In Progress (5) | Resolved (3) | Closed (47) |
   |---|---|---|---|

   Each card (y=144..864, ~720px tall):
   - **Card top zone** (y=156..200): status badge mini-pill (left) + count (right, 28px semibold).
   - **Card body** (y=212..840): vertical list of 12–14 [ticket-row](../03-molecules/ticket-row.md) (status-card row variant). 40px row stride.
   - **Card footer** (y=848..864, only if more than 14 tickets): muted `Showing 14 of 47` text.

   ### Users tab

   - Same surface as `/users` — see [users-table-page](users-table-page.md) for the full anatomy.
   - Heading: `Users`.
   - Sub-heading micro-label: `12 users · 11 active · 1 inactive`.
   - Table with 5 columns: Name · Email · Role · Status · Last active.
   - Self-row highlight: 3px left border + disabled controls + micro-label "You cannot change your own role."
   - Confirmation dialogs for Admin demotion and Admin deactivation.

## Behavior summary

### Page lifecycle

- **Entry from Login** (role = Admin): redirect to `/admin`.
- **Direct-arrival to `/admin`** while logged in: served if Admin, 403 Forbidden card if non-Admin, redirect to `/login?return_to=/admin` if logged out.
- **Browser back/forward:** preserves tab state via URL hash.

### Tab switching

- **Click on inactive tab:** content swaps; URL hash updates (`#dashboard` / `#users`); active tab styling updates.
- **Direct-arrival to `/admin#dashboard` or `/admin#users`:** serves the requested tab active.
- **Direct-arrival to `/admin#anything-else`:** defaults to Dashboard tab.
- **Keyboard:** `Tab` to tab switcher; `←` / `→` to move between tabs; `Enter` activates.

### Row click lifecycle (Dashboard tab)

- **Click on a row in Open / In Progress / Resolved:** routes to `/tickets/:id`.
- **Click on a row in Closed:** no-op (cursor `default`, not `pointer`).
- **Hover on Open / In Progress / Resolved:** row background `#f1f3f5`. Hover on Closed: no tint.

### Card interactions

- **Click on card header (status badge / count):** no action in MVP (display-only).
- **Click on card footer "Show all N →":** out of scope in MVP (muted and non-interactive).

## Layout dimensions

- Page width: 1440
- Heading row height: 40px
- Tab switcher right edge: x=1160
- Card width: 320px each
- Card gap: 16px
- Card height: ~720px (fits up to 14 rows + top zone + footer)
- Row height (card body): 40px
- Status badge mini-pill: 18px tall
- Count font size: 28px semibold
- App-header chrome strip height: 64px

## States (cross-reference)

- **Default (Dashboard tab)** — heading + tab switcher + 4 status cards.
- **Default (Users tab)** — heading + tab switcher + user list table.
- **Loading (Dashboard tab)** — heading + tab switcher + 4 card skeletons.
- **Loading (Users tab)** — heading + tab switcher + row skeletons.
- **Server error (Dashboard tab)** — inline error above the cards: "Couldn't load the queue. Refresh to try again."
- **Server error (Users tab)** — inline error above the table: "Couldn't load users. Refresh to try again."
- **Permission denied (non-Admin direct arrival)** — centered card: "You don't have access to this page. Back to Dashboard."
- **Session expired** — redirect to `/login?return_to=/admin`.
- **Action error (Users tab)** — inline error below the affected row.
- **Confirmation dialog (Users tab)** — modal for Admin demotion / deactivation.

## Tokens Used

- All app-header-chrome tokens
- All [tab-switcher](../03-molecules/tab-switcher.md) tokens
- All [status-summary-card](../03-molecules/status-summary-card.md) tokens
- All [self-row-table](../03-molecules/self-row-table.md) tokens (when Users tab is active)
- All [dialog-modal](../03-molecules/dialog-modal.md) tokens (for Admin demotion / deactivation)
- All [badge-status](../02-atoms/badge-status.md) tokens (mini-pill in card top)
- All [ticket-row](../03-molecules/ticket-row.md) tokens (status-card row variant)
- `color-page-bg` (`#f8f9fa`)
- `space-tab-switcher-right` (x=1160)

## Used In

- **Admin Dashboard** (`admin-dashboard.md`): the canonical organism.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [tab-switcher](../03-molecules/tab-switcher.md) — Dashboard / Users tab pair.
- [status-summary-card](../03-molecules/status-summary-card.md) — the four cards on Dashboard tab.
- [users-table-page](users-table-page.md) — Users tab content (same as `/users`).
- [role-aware-action-matrix](../05-patterns/role-aware-action-matrix.md) — Admin = Agent on tickets.
- [confirmation-dialog](../05-patterns/confirmation-dialog.md) — Admin demotion / deactivation dialogs.
- [server-error-state](../05-patterns/server-error-state.md) — fetch error pattern.
- [loading-skeleton](../05-patterns/loading-skeleton.md) — initial fetch loading pattern.
