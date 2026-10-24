# Admin Dashboard Page (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + heading row + [tab-switcher](../03-molecules/tab-switcher.md) (Tickets / Users) + Tickets tab content ([stat-strip](../03-molecules/stat-strip.md) + [shared-ticket-table](../03-molecules/shared-ticket-table.md)) OR Users tab content (Users table)
**Phase 4 source:** Admin Dashboard (`admin-dashboard.md`)

---

## Overview

Admin's home page (`/admin`). Two tabs, two distinct jobs: **Tickets** (the queue, team-wide) and **Users** (role + active management). Admin never sees the Support Agent Kanban (`/queue`); Admin's oversight role is expressed through this dedicated surface.

The page is Admin's command center for *oversight*, not triage. Admin doesn't move tickets (that's Support Agents' job per the action matrix) and Admin doesn't take new tickets (that's End-Users' job). Admin's two jobs are:
1. See the queue's shape (Tickets tab).
2. Manage who has access (Users tab).

## Anatomy (top-down)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **Heading row** (y=88..128):
   - **Heading text** (left, x=40, y=108, 24px semibold `#212529`): reflects the active tab. `Tickets` when the Tickets tab is active; `Users` when the Users tab is active.
   - **Tab switcher** (right, x=1000..1160): two tabs, `Tickets` and `Users`. Active tab: 14px semibold `#212529` with 2px underline at y=124. Inactive: 14px regular `#868e96`, no underline.
3. **Tab content** (y=144..):

   ### Tickets tab (default)

   The WDS-2026 layout, shared verbatim with the User's Employee Dashboard and the Support Agent's Tickets page:

   1. **[stat-strip](../03-molecules/stat-strip.md)** — the same five-card band the other two roles render (Total + a card per status, each with a sparkline and a progress bar). The Admin's counts are **team-wide** (`GET /api/tickets/stats`), so the numbers match the Support Agent's exactly.
   2. **[ticket-filter-bar](../03-molecules/shared-ticket-table.md)** — the shared search field, four dimension dropdowns, the sort control and the purple "More filters" button.
   3. **[ticket-table](../03-molecules/shared-ticket-table.md)** — the shared ten-column table, with the pagination footer below it.

   > **The Phase 4 Admin spec described four tall `status-summary-card`s.** The WDS-2026 redesign replaced them with the shared stat strip and the shared table — the same two surfaces the User and the Agent see, differing only in data scope (team-wide). The `status-summary-card` molecule still exists in the library but no page renders it.

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

- **Click on inactive tab:** content swaps; URL hash updates (`#tickets` / `#users`); active tab styling updates.
- **Direct-arrival to `/admin#tickets` or `/admin#users`:** serves the requested tab active.
- **Direct-arrival to `/admin#anything-else`:** defaults to the Tickets tab.
- **Keyboard:** `Tab` to tab switcher; `←` / `→` to move between tabs; `Enter` activates.

### Row click lifecycle (Tickets tab)

- **Click on a table row:** routes to `/tickets/:id` — every role's shared table behaves the same way.
- **Row hover:** a background tint, per the shared table's row styles.
- **Kebab menu:** resolve / close, as the Agent's table offers.

### Stat-strip interactions

- The strip is **display-only** — no drill-down from a card to a filtered table. The "More filters" button in the filter bar is how a user narrows by status.

## Layout dimensions

- Page width: 1448 (the global `--content-column-width` token, with the chrome's 32px gutters giving a 1384px content area)
- Heading row height: 40px
- Tab switcher right edge: x=1160
- Stat strip card height: 88px, gap 8px, five unequal tracks (22.56 / 18.42 / 17.75 / 19.16 / 22.12fr)
- Table row height: 64px
- App-header chrome strip height: 64px

## States (cross-reference)

- **Default (Tickets tab)** — heading + tab switcher + stat strip + filter bar + table.
- **Default (Users tab)** — heading + tab switcher + user list table.
- **Loading (Tickets tab)** — heading + tab switcher + stat-strip skeleton + table skeleton.
- **Loading (Users tab)** — heading + tab switcher + row skeletons.
- **Server error (Tickets tab)** — inline error above the table: "Couldn't load the queue. Refresh to try again."
- **Server error (Users tab)** — inline error above the table: "Couldn't load users. Refresh to try again."
- **Permission denied (non-Admin direct arrival)** — centered card: "You don't have access to this page. Back to Dashboard."
- **Session expired** — redirect to `/login?return_to=/admin`.
- **Action error (Users tab)** — inline error below the affected row.
- **Confirmation dialog (Users tab)** — modal for Admin demotion / deactivation.

## Tokens Used

- All app-header-chrome tokens
- All [tab-switcher](../03-molecules/tab-switcher.md) tokens
- All [stat-strip](../03-molecules/stat-strip.md) tokens
- All [shared-ticket-table](../03-molecules/shared-ticket-table.md) tokens
- All [self-row-table](../03-molecules/self-row-table.md) tokens (when Users tab is active)
- All [dialog-modal](../03-molecules/dialog-modal.md) tokens (for Admin demotion / deactivation)
- All [badge-status](../02-atoms/badge-status.md) tokens (status pill in the table rows)
- `color-page-bg` (`#f8f9fa`)
- `space-tab-switcher-right` (x=1160)

## Used In

- **Admin Dashboard** (`admin-dashboard.md`): the canonical organism.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [tab-switcher](../03-molecules/tab-switcher.md) — Tickets / Users tab pair.
- [stat-strip](../03-molecules/stat-strip.md) — the five-card band above the table.
- [shared-ticket-table](../03-molecules/shared-ticket-table.md) — the filter bar + ten-column table + pagination footer.
- [users-table-page](users-table-page.md) — Users tab content (same as `/users`).
- [role-aware-action-matrix](../05-patterns/role-aware-action-matrix.md) — Admin = Agent on tickets.
- [confirmation-dialog](../05-patterns/confirmation-dialog.md) — Admin demotion / deactivation dialogs.
- [server-error-state](../05-patterns/server-error-state.md) — fetch error pattern.
- [loading-skeleton](../05-patterns/loading-skeleton.md) — initial fetch loading pattern.
