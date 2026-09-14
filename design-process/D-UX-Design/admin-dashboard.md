# Admin Dashboard

**Route:** `/admin`
**Scenario:** Admin only. Non-Admin Support Agents cannot reach this page; direct-arrival to `/admin` returns 403 for non-Admin, redirect to `/login` if logged out.
**Purpose:** Admin's home page. Two tabs, two distinct jobs: **Dashboard** (cross-status summary view — see the shape of the queue at a glance) and **Users** (role + active management). Admin never sees the Support Agent Kanban (`/queue`); Admin's oversight role is expressed through this dedicated surface.

## User Context

Admin arrives from Login (role = Admin) at `/admin`. The page is Admin's command center for *oversight*, not triage. Admin doesn't move tickets (that's Support Agents' job per the action matrix in `ticket-detail.md`) and Admin doesn't take new tickets (that's End-Users' job per `create-ticket.md`). Admin's two jobs are:

1. **See the queue's shape.** Are we drowning in Open? Is anything slipping past Resolved without Eli's confirmation? How fast are tickets closing? The Dashboard tab answers these at-a-glance questions without forcing Admin to scroll through the Agent Kanban.
2. **Manage who has access.** The Users tab is for role changes (Admin / Support Agent / Employee) and active-status toggles. Same vocabulary as before; just reached from a different chrome.

The two-tab structure keeps these jobs visually separate. Admin never needs both at the same time; a single click switches.

## Design Decisions (locked during discussion)

- **Admin is a distinct surface, not an overlay on Agent.** Admin does not see the Support Agent Kanban (`/queue`). Admin's "see all tickets" view is the new Dashboard tab. This eliminates the "Admin sees Agent's page + one extra affordance" model from earlier in the design loop.
- **Two tabs on `/admin`:**
  - **Dashboard** (default landing tab) — cross-status summary view, four status cards in a horizontal row.
  - **Users** — the same role + active management surface as `/users`. Same table, same controls, same self-row highlight.
- **No filter strip on Dashboard.** Admin is reading the queue's shape, not slicing it. Filters live on the Agent Kanban for Support Agents who triage actively.
- **No drag-and-drop on Dashboard.** Admin never moves tickets (the action matrix is identical for Agent and Admin, but Admin doesn't perform triage actions in MVP). To move a ticket, the support workflow requires a Support Agent.
- **No "Create Ticket" button on Dashboard.** Admin doesn't create tickets. End-Users create tickets.
- **Closed is read-only / muted.** Consistent with `agent-kanban.md` §Drag-and-drop: Closed is terminal. The Closed card renders in muted text; rows are not clickable (no Ticket Detail from Closed — the ticket is closed, period).
- **Click any row in Open / In Progress / Resolved → `/tickets/:id`.** Same click-to-open behavior as the Kanban.

## Content & Actions

The page contains exactly these elements, in this order:

### 1. App-header chrome strip

Same shared strip as all post-login pages: brand mark on left, `My Profile ▾` on right. (See `header-profile-logout.md` for the canonical chrome spec.)

### 2. Page heading row

- **Heading text** (left, x=40, y=108, 24px semibold `#212529`): reflects the active tab. `Dashboard` when the Dashboard tab is active; `Users` when the Users tab is active.
- **Tab switcher** (right side, x=1000..1160, y=88..128): two tabs, `Dashboard` and `Users`. The active tab is 14px semibold `#212529` with a 2px underline beneath the text at y=124; the inactive tab is 14px regular `#868e96`, no underline. `aria-current="page"` on the active tab.

### 3. Tab content

#### Dashboard tab (default)

Four **status summary cards** in a single horizontal row, each 320px wide:

| Open (12) | In Progress (5) | Resolved (3) | Closed (47) |
|---|---|---|---|

Each card has:
- **Card top zone** (y=156..200, padded 16px): a status badge mini-pill on the left + the count on the right.
  - Status badge: 11px semibold, 18px tall pill, padding 0 8px. Reuses the four status colors from `ticket-detail.md`:
    - Open → `#fff5d6` bg, `#7a5c00` text
    - In Progress → `#d0ebff` bg, `#1864ab` text
    - Resolved → `#d3f9d8` bg, `#2b8a3e` text
    - Closed → `#f1f3f5` bg, `#868e96` text
  - Count: 28px semibold `#212529` (Closed uses `#868e96` for muted/terminal semantic), right-aligned.
- **Card body** (y=212..840, padded 12px): vertical list of the most recent 12–14 tickets in that status, each row 40px tall:
  - **Mono ticket number** (e.g., `#HD-47`) — left, 11px `#868e96`.
  - **Title** — center-left, 13px `#212529`, truncated to one line with ellipsis (`text-overflow: ellipsis`).
  - **Relative timestamp** (e.g., `2h ago`) — right, 11px `#868e96`.
  - **Row hover:** background `#f1f3f5`; cursor pointer.
  - **Click:** routes to `/tickets/:id` (Open / In Progress / Resolved only).
  - **Closed rows:** muted text throughout (`#868e96`), no hover, no click.
- **Card footer** (y=848..864, only if the card has more than 14 tickets): muted `Show all 47 →` link, 11px `#868e96`. Click expands the card to show all tickets in that status (in MVP this is a v1.x enhancement; for MVP, footer reads "Showing 14 of 47" muted and is non-clickable).

#### Users tab

The same surface as `/users`. See `users-tab.md` for the full spec. Summary:
- Heading: `Users`.
- Sub-heading micro-label: `12 users · 11 active · 1 inactive`.
- Table with 5 columns: Name · Email · Role · Status · Last active.
- Self-row (the Admin viewing the page) has disabled role dropdown + active toggle + micro-label "You cannot change your own role."
- Confirmation dialogs for Admin demotion and Admin deactivation only.
- **No tab switcher on this page.** (Removed: Admin now bounces between Dashboard and Users via the `/admin` tab switcher, not via a switcher on `/users` itself.)

### 4. Tab-switcher behavior

- **Click `Dashboard` tab:** switches to Dashboard content. Heading changes to "Dashboard". Dashboard tab becomes `aria-current="page"`. URL hash updates to `#dashboard` (for back-button friendliness; not a separate route).
- **Click `Users` tab:** switches to Users content. Heading changes to "Users". Users tab becomes `aria-current="page"`. URL hash updates to `#users`.
- **Direct-arrival to `/admin#users`:** serves the Users tab active on initial render.
- **Direct-arrival to `/admin#dashboard`:** serves the Dashboard tab active on initial render.
- **No `/admin#anything-else`:** unknown hash → default to Dashboard tab.

## Behavior

### Page lifecycle

- **Entry from Login** (role = Admin): redirect to `/admin`.
- **Direct-arrival to `/admin`** while logged in: served if Admin, 403 Forbidden card if non-Admin, redirect to `/login?return_to=/admin` if logged out.
- **Browser back/forward:** preserves tab state via URL hash.
- **Refresh on Users tab:** stays on Users tab (hash is in URL).

### Tab switching

- **Click on inactive tab:** content swaps; URL hash updates; active tab styling updates.
- **No animation required in MVP.** Instant swap is fine.
- **Keyboard:** `Tab` cycles to the tab switcher, `←` / `→` arrow keys move focus between tabs, `Enter` activates the focused tab. (Tab-switcher ARIA pattern: `role="tablist"`, `role="tab"`, `aria-selected="true|false"`.)

### Row click lifecycle (Dashboard tab)

- **Click on a row in Open / In Progress / Resolved:** routes to `/tickets/:id`. Same routing as Agent Kanban click-to-open.
- **Click on a row in Closed:** no-op (cursor is `default`, not `pointer`). The ticket is closed.
- **Hover on an Open / In Progress / Resolved row:** background tints `#f1f3f5`. Hover on Closed row: no tint.

### Card interactions

- **Click on the card header (status badge or count):** no action in MVP. The badge and count are display elements. If Admin wants to filter, the spec defers a status-filter to v1.x.
- **Click on a card footer "Show all N →" link:** out of scope in MVP; the footer just shows a muted count summary.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (loaded, Dashboard tab)** | Page loaded, Admin viewing, default tab | Heading "Dashboard" + tab switcher (Dashboard active, Users inactive) + 4 status summary cards with ticket lists. |
| **Default (loaded, Users tab)** | Page loaded with `#users` hash, or Admin clicked Users tab | Heading "Users" + tab switcher (Dashboard inactive, Users active) + user list table (sorted alphabetical, self-row highlighted with disabled controls). |
| **Loading (Dashboard tab)** | Initial fetch in flight on Dashboard tab | Heading + tab switcher (Dashboard tab active, skeleton look); 4 card skeletons (rounded, 720px tall, grey bars where text would be). No spinner overlay. |
| **Loading (Users tab)** | Initial fetch in flight on Users tab | Heading + tab switcher (Users tab active); row skeletons (5 rows, 64px tall, grey bars where text would be). |
| **Server error (Dashboard tab)** | Fetch fails on Dashboard tab | Inline error above the cards: "Couldn't load the queue. Refresh to try again." Tab switcher still rendered. |
| **Server error (Users tab)** | Fetch fails on Users tab | Inline error above the table: "Couldn't load users. Refresh to try again." Tab switcher still rendered. |
| **Permission denied (non-Admin direct arrival)** | Non-Admin routes directly to `/admin` | Single centered card: "You don't have access to this page. Back to Dashboard." (`/dashboard` for Employee; `/queue` for Support Agent.) |
| **Session expired** | Fetch returns 401 | Redirect to `/login?return_to=/admin`. Hash state is preserved in URL; after re-auth, Admin lands back on the same tab. |
| **Action error (Users tab only)** | A role/status change fails on Users tab | Inline error below the affected row: "Couldn't update. Try again." The control reverts to its prior state. |
| **Confirmation dialog (Users tab only)** | Admin demotes or deactivates an Admin | Modal dialog with the warning copy + Cancel + Confirm. Cancel closes; Confirm applies. |

**Note on the wireframes:** the canonical frame is **Default (loaded, Dashboard tab active)** with representative data on each card. A second wireframe shows the same page with the **Users tab active** as a sanity-check that the tab switcher + table content fit within the same chrome.

## Visual Tokens

Inherited from Login + Ticket Detail + Agent Kanban + Users tab + Header / My Profile / Logout. New tokens introduced:

- Status summary card surface: `#ffffff`, `#dee2e6` 1px border, 6px radius, no shadow (read-only surface; no lift effect).
- Status summary card internal padding: 12px (body) / 16px (top zone).
- Status summary card count font: 28px semibold.
- Status summary row height: 40px; row stride 40px; row hover `#f1f3f5`.
- Tab switcher active underline: `#212529` 2px (already in token table from Users tab spec).
- Status badge mini-pill: 18px tall, 11px semibold, padding 0 8px, radius 9px (pill shape).

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface (cards, app-header) | `#ffffff` | Status summary cards, Users table rows, app-header strip |
| Primary | `#212529` | Heading text, count text (non-Closed) |
| Muted text | `#868e96` | Count text (Closed only), ticket numbers, timestamps, "Showing N of M" footer, inactive tab |
| Border default | `#dee2e6` 1px | Card borders, row borders, app-header bottom |
| Status colors (Open) | `#fff5d6` bg / `#7a5c00` text | Open status badge mini-pill |
| Status colors (In Progress) | `#d0ebff` bg / `#1864ab` text | In Progress status badge mini-pill |
| Status colors (Resolved) | `#d3f9d8` bg / `#2b8a3e` text | Resolved status badge mini-pill |
| Status colors (Closed) | `#f1f3f5` bg / `#868e96` text | Closed status badge mini-pill |
| Active green | `#2b8a3e` | (Users tab — Active indicator; reused) |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | `ui-monospace, SFMono-Regular, Menlo, monospace` | Ticket numbers in card rows |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Heading row height | 40px | Same as Employee Dashboard |
| Tab switcher right edge | x=1160 | "Dashboard" tab at x=1000..1085; "Users" tab at x=1100..1160 (approx) |
| Card width | 320px | Fixed; 4 cards fit 1440px canvas with 16px gaps and 56px outer padding |
| Card gap | 16px | Between cards |
| Card height | ~720px (fits up to 14 rows + top zone + footer) | Card body grows with row count; max 14 rows visible, footer if more |
| Row height (card body) | 40px | Single-line ticket row |
| Status badge mini-pill | 18px tall, ~85px wide | Pill shape, padding 0 8px |
| Count font size | 28px semibold | Right-aligned in card top zone |
| App-header chrome strip height | 64px | Same shared chrome |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is **Default (loaded, Dashboard tab active)** with representative data.

- App-header chrome strip: y=0..64.
- Heading row: "Dashboard" at x=40, y=108, 24px semibold. Tab switcher right-aligned at x=1000..1160.
  - "Dashboard" tab: x=1000, y=113, 14px semibold `#212529`. Active underline: x=1000..1085, y=124, `#212529` 2px.
  - "Users" tab: x=1100, y=113, 14px `#868e96`.
- 4 status summary cards (y=144..864, ~720px tall):
  - **Open card:** x=56..376. Top: status badge mini-pill at x=68..153, y=156..174; count `12` at x=358, y=176, 28px semibold, text-anchor end. Body: 14 rows starting y=200, 40px stride. Footer (if applicable): y=848..864.
  - **In Progress card:** x=392..712. Top: badge `In Progress` at x=404..498, y=156..174; count `5` at x=694, y=176.
  - **Resolved card:** x=728..1048. Top: badge `Resolved` at x=740..816, y=156..174; count `3` at x=1030, y=176.
  - **Closed card:** x=1064..1384. Top: badge `Closed` at x=1076..1140, y=156..174; count `47` at x=1366, y=176, 28px semibold `#868e96` (muted).

## Success

Admin lands at `/admin`, sees the Dashboard tab, and in three seconds answers the morning questions:

1. **Open / 12** — how many new tickets need attention.
2. **In Progress / 5** — what's being worked on right now.
3. **Resolved / 3** — what's awaiting Eli's verdict (Eli confirms Resolved → Closed per the action matrix).
4. **Closed / 47** — historical volume (muted; not actionable).

One click on the Users tab → manage roles + active status. One click back to Dashboard → back to the queue shape. Admin never needs to scroll through Support Agents' Kanban to see what's happening.

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking this spec):
- **Status-filter drill-down:** clicking a card top (status badge or count) could deep-link to a filtered view of the queue — v1.x follow-up. MVP keeps card top as display-only.
- **"Show all N →" expansion:** footer is muted and non-interactive in MVP; making it expand the card to show all tickets in that status is a v1.x follow-up.
- **Date-range filter on Closed card:** "Closed this week" / "Closed this month" — v1.x follow-up. MVP shows all-time totals.
- **Search across all tickets:** Admin doesn't search in MVP; Support Agents search on the Kanban filter strip. Cross-status search is a v1.x follow-up.
- **Sort by column on Users table:** alphabetical only in MVP; sortable column headers are a v1.x follow-up.
- **Touch / mobile:** out of MVP per existing Phase 4 stance; desktop-first.

---

_Produced by Freya — 2026-09-14_
_Source: design-process/A-Product-Brief/product-brief.md (Admin = permission overlay on Agent, distinct from Sam), design-process/D-UX-Design/users-tab.md (Users tab content + self-row highlight + tab-switcher pattern), design-process/D-UX-Design/agent-kanban.md (status badge tokens, Closed terminal semantic, click-to-open row pattern), design-process/D-UX-Design/ticket-detail.md (status badge color tokens, action matrix for Admin = Agent), design-process/D-UX-Design/header-profile-logout.md (shared chrome strip with `My Profile ▾`)._
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._
