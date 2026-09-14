# Role-Aware Action Matrix Pattern

**Category:** Pattern
**Phase 4 source:** Ticket Detail action matrix; propagated to Kanban drag validation, Admin Dashboard routing

---

## Overview

A cross-page pattern that determines which actions a user can take on a ticket, based on the intersection of (role × ticket status). The matrix is the single source of truth for action visibility — Ticket Detail's action zone, Agent Kanban's drag validation, and Admin Dashboard's row-click routing all consult the same matrix.

The matrix lives as a single table; every page that shows ticket actions renders only the rows the matrix allows for the current (role × status) pair.

## The matrix

| Role | Status | Add comment | Change status | Reassign owner | Change priority | Reopen | Confirm (close) |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Employee | Open | ✓ | — | — | — | — | — |
| Employee | In Progress | ✓ | — | — | — | — | — |
| Employee | Resolved | ✓ | — | — | — | ✓ | ✓ |
| Employee | Closed | — | — | — | — | — | — |
| Agent | Open | ✓ | ✓ | ✓ | ✓ | — | — |
| Agent | In Progress | ✓ | ✓ | ✓ | ✓ | — | — |
| Agent | Resolved | ✓ | — | ✓ | ✓ | — | — |
| Agent | Closed | — | — | — | — | — | — |
| Admin | (same as Agent) | ✓ | ✓ | ✓ | ✓ | — | — |

## Rules encoded in this matrix

- **Sam (Agent) cannot transition to Closed from any state.** Closed is Eli-only.
- **Eli cannot transition statuses at all.** She can only Confirm (Resolved → Closed) or Reopen (Resolved → Open).
- **Comment addition is the only action available in all non-Closed states for both roles.** It is the always-on conversation channel.
- **Closed is terminal:** no actions, no editing, no comments. (Activity log can gain a final "Confirmed closed by Eli" entry retroactively.)
- **In Resolved state, Sam cannot change status back to Open / In Progress directly.** The path back is Eli's Reopen. Sam can still add a comment and reassign / change priority at Resolved in case handoff is needed during the wait-for-Eli window.
- **Admin = Agent on the action matrix.** Admin has identical ticket actions to Support Agent. Admin's exclusivity is the Users tab (role + status management), not ticket actions.

## Propagation across pages

The matrix determines action visibility on:

1. **Ticket Detail** (`ticket-detail.md`) — the action zone in the header renders only the matrix-allowed buttons for the current (role × status) pair.
2. **Agent Kanban** (`agent-kanban.md`) — drag-and-drop validation: only columns matching the matrix-allowed transitions are valid drop targets. Invalid drops show a muted `#fff5f5` background + `—` icon and are rejected on release.
3. **Admin Dashboard** (`admin-dashboard.md`) — row click routing: Admin sees the same action matrix as Agent when opening a ticket from a status card row. Closed rows are not clickable (Closed is terminal for all roles).

## When this pattern applies

- Whenever a ticket action is rendered (button, dropdown option, drag target).
- Whenever ticket status changes affect the visible action set (e.g., a ticket moves to Resolved, the action zone changes from `[+ Comment] [Change status ▾] ...` to `[+ Comment] [Reopen] [Confirm]` for Eli).

## When this pattern does NOT apply

- For non-ticket actions (e.g., role changes on Users tab have their own matrix: Admin demotion requires confirmation; non-demotion does not).
- For navigation / chrome actions (My Profile dropdown, brand mark click).
- For form-level actions (Submit / Cancel on Create Ticket — not role-gated; Eli only).

## Edge cases

### Single Admin

If a team has only one Admin, that Admin cannot demote or deactivate themselves. They must hand off Admin role to a Support Agent first (which means another Admin must exist, which means the team needs to grow Admin headcount before this becomes a constraint). The pattern enforces this gracefully via the [self-row-table](../03-molecules/self-row-table.md) — disabled controls communicate the constraint without an error message.

### Admin direct-arrival to Support-Agent-only routes

Admin does not land on `/queue` (Support Agent only). Direct-arrival returns 403. This is route-level enforcement, not matrix-level — Admin's matrix is identical to Agent's, but Admin's home is `/admin` with its own Dashboard / Users tab structure. See [app-chrome](app-chrome.md) for the role-correct Dashboard routing.

### Sam's "undo Resolved"

Per the matrix, Agent's `Change status` is hidden at Resolved. There is a known operational case where Sam wants to undo her own Resolved if she decides it was premature. This is currently handled by adding a comment that triggers an in-app notification to Eli, plus an internal "I want to undo this" flow. Out of MVP; documented for v1.1.

## Accessibility

- **Action visibility = action availability.** Hidden actions are also unavailable to assistive technology (`aria-hidden="true"` on disabled / non-rendered buttons; not just visually hidden). Screen-reader users hear only the matrix-allowed actions for their (role × status) pair.
- **Disabled buttons:** when a button is rendered but disabled (e.g., future matrix row), native `disabled` attribute is applied. Screen readers announce "dimmed" or "unavailable" depending on platform.
- **Drag-and-drop:** drag is mouse-driven. Keyboard users use `Tab` to focus a card, `Enter` to open Ticket Detail, then use the matrix-rendered Change status dropdown there. The matrix is the same; only the interaction path differs.

## See also

- [ticket-detail-page](../04-organisms/ticket-detail-page.md) — primary matrix consumer.
- [kanban-board](../04-organisms/kanban-board.md) — drag validation consumer.
- [admin-dashboard-page](../04-organisms/admin-dashboard-page.md) — row-click routing consumer.
- [dialog-modal](../03-molecules/dialog-modal.md) — Reopen / Confirm dialogs (triggered by matrix-allowed actions).
- [self-row-table](../03-molecules/self-row-table.md) — Admin self-row protection (a different matrix — for role / status management, not ticket actions).
