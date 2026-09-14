# Agent Kanban Dashboard (Queue)

**Route:** `/queue`
**Scenario:** Sam the Support Agent (priority 02). **Support Agents only** — Admin does not see this page. Admin has a distinct home at `/admin` (see `admin-dashboard.md`). Eli the End-User does not land here — Employees land on `/dashboard`.
**Purpose:** Sam's command center. Show every ticket in the system across four status columns so the morning scan answers three questions in seconds: *what's open, what's mine, what's slipping*. The page also provides the fastest path to act (drag-to-status, click-to-open, change filters).

## User Context

Sam arrives from Login (role = Support Agent or Admin → `/queue`). On entry, Sam is alert and scanning — the first scan of the day is a triage ritual, looking for orphans (no owner), claims (who took what), and slips (tickets aging). The morning scan must answer Sam's questions in seconds or the page has failed.

Mid-day Sam returns here between Ticket Detail visits; the page is a working surface, not a destination. Sam should be able to perform quick actions (drag to change status, click to open detail) without losing context.

## Design Decisions (locked during discussion)

- **Card layout:** Compact. Title on top (truncated, 2 lines max), meta row below: ticket number (mono, left) · priority pill (center) · owner avatar + name + timestamp (right). At ~320px column width this reads cleanly without density pressure.
- **Drag affordance:** Whole card is grabbable on mousedown; no specific handle visible by default. Visual cue on hover: card lifts (subtle shadow + slight upward translate). On drag-start, the source column shows a "ghost" placeholder; the destination column highlights as the drop zone.
- **Header strip:** Single horizontal strip directly below the page heading. Search box on the left, filters in the middle (Priority / Category / Owner), Users tab on the right (Admin only). One row.
- **Sort within columns:** Oldest-first by `created_at` so aging tickets float up. Orphans (no owner) pinned to the top of the Open column with a clearly visible "Unassigned" badge — the orphan problem is the first thing Sam must see in the morning scan.
- **"All tickets" is the default view across all owners.** "Mine" is a filter toggle in the filter strip, not a separate board.
- **Closed column is read-only.** Sam cannot drag into or out of Closed — Closed is Eli-only. The column exists for history visibility.
- **Drag-and-drop vs click-to-change-status:** Drag is the primary mechanism. If drag is unavailable (touch, accessibility), the alternative is to open the ticket and use the Change status dropdown on Ticket Detail.

## Content & Actions

The page contains exactly these elements, in this order:

### 1. App-header chrome strip

Same shared strip as elsewhere: brand mark on left, My Profile / Logout on right.

### 2. Page heading row

- "Queue" — 24px semibold, `#212529`, top-left of page content.
- *(No Users tab on this page.)* Admin has its own home at `/admin` and never lands here. Support Agents do not have a path to user management from this page; they triage tickets and that's it.

### 3. Filter strip

A single horizontal row below the heading, with these controls:

- **Search box** (left) — `<input type="search">`, 320px wide, placeholder `Search queue…`, 40px tall, 4px radius, `#adb5bd` 1px border. Matches on ticket number, title, submitter name (case-insensitive substring). Debounced 200ms.
- **Priority filter** — dropdown `Priority: All ▾`, options `All · High · Medium · Low`. Default = All. 40px tall.
- **Category filter** — dropdown `Category: All ▾`, options `All · IT · HR · Finance · General`. Default = All.
- **Owner filter** — dropdown `Owner: All ▾`, options `All · Mine · Unassigned · <each active Support Agent by name>`. Default = All. The "Mine" option is the filter-equivalent of the per-board toggle. The "Unassigned" option is a fast-path for Sam to focus on orphans.
- **Clear filters** — small `× Clear` link, muted, appears only when at least one filter is non-default.

### 4. Kanban board — 4 columns

Below the filter strip. Each column has:

- **Column header** — sticky to the top of the column on scroll. Shows status name + count badge: `Open (4)`. The count updates as filter/sort state changes.
- **Column body** — vertical list of cards. Cards inside are stacked with 12px gap. Column body scrolls independently if content exceeds the viewport height.
- **Column widths:** each column is 320px wide. Total board width = 4 × 320px + 3 × 16px gaps + 2 × 32px outer padding = 1360px. Fits inside a 1440px canvas with 40px outer margin on each side.
- **Column order (left → right):** Open · In Progress · Resolved · Closed. Closed is always last.

### 5. Card anatomy

Each card is a white surface (`#ffffff`, `#dee2e6` 1px border, 6px radius, 12px internal padding). Two-row composition:

- **Title row:** the ticket's title, 14px medium, `#212529`. Truncated to 2 lines with ellipsis (`-webkit-line-clamp: 2`).
- **Meta row:** three pieces of information, on a single 28px-tall row below the title:
  - **Ticket number** — mono, 12px, `#868e96`. Left-aligned.
  - **Priority pill** — same 20px pill as Employee Dashboard, 11px semibold. Centered.
  - **Owner** — avatar circle (24px, `#adb5bd` bg with initials in `#495057`) + name + "· " + relative timestamp (e.g., "Sam · 1d ago"). Right-aligned, text 12px `#495057`. If no owner: avatar shows a subtle "—" placeholder and the text is replaced with an "Unassigned" badge (`#fff5d6` bg, `#7a5c00` text) — same visual treatment as Open status pill so it stands out without screaming.

### 6. Empty column states

- **Empty + filter active** (e.g., Sam filtered to Mine and has no tickets in this column): centered muted text "No tickets match your filters." inside the column body.
- **Empty + no filter** (legitimately empty queue state): centered muted text "Nothing here." — calm, no panic.
- **Orphan-pinned visualization** (in Open column only): the orphan cards sit at the top of the column body with a faint `#fff5d6` background tint that matches the Unassigned badge color, so Sam sees the orphan cluster as one visual unit at the top of the column. The tint fades to white below the orphans.

## Behavior

### Sort and filter

- **Sort within columns:** `created_at` ascending (oldest-first), with orphans (owner = null) pinned to the top of Open.
- **Sort is fixed** — no user-controlled re-sort in MVP. The whole point is that aging tickets float up; per-column re-sort would defeat the morning scan.
- **Filter persistence:** filter state lives in the URL (`?priority=high&category=it&owner=me&q=vpn`). Refreshing or sharing the URL preserves the view. Bookmarkable.
- **Search behavior:** substring match across ticket number, title, submitter name. Case-insensitive. Empty search shows the full unfiltered board.
- **Filter combinations:** AND across filters, OR within a single filter's options (e.g., `priority = High OR Medium`).
- **No-result state:** if filters eliminate all tickets in a column, the column shows the muted "No tickets match your filters." text. Empty-state is column-scoped, not page-scoped.

### Drag-and-drop

- **Grabbable surface:** the whole card. No specific handle. Mouse-down on a card begins a drag; mouse-down elsewhere on the card (e.g., title text) also begins a drag.
- **Hover state:** card lifts (subtle shadow, `transform: translateY(-2px)`). Cursor changes to `grab` on hover, `grabbing` during drag.
- **Drag-start:** source column shows a faded "ghost" placeholder where the card was. The card being dragged renders at the cursor with elevated shadow.
- **Drop zones:** as the dragged card crosses column boundaries, the destination column header highlights (subtle background change `#f1f3f5` → column header `#e9ecef`); the column body shows a dashed horizontal indicator line at the insertion point.
- **Drop target validity:** only the columns matching the legal status transitions per the action matrix are valid drop targets.
  - Open → In Progress, Resolved (drag works)
  - In Progress → Open, Resolved (drag works)
  - Resolved → (no drag target for Agent — Resolved is awaiting Eli's verdict)
  - Closed → (read-only; no drag from this column; column body has cursor: not-allowed on hover)
  - Any → Closed (Sam cannot drop into Closed)
- **Invalid drop visual feedback:** if Sam drags toward an invalid column, the column header shows a muted `#fff5f5` background with a "—" icon. Drop is rejected; the dragged card returns to its source position with a brief shake animation.
- **Unsaved-change guard:** if Sam has an open comment textarea on Ticket Detail, drag is blocked with an inline message: "You have an unsaved comment. Save or discard it before moving tickets around." (Cross-page interaction; spec'd here for completeness, implemented as a global "form dirty" flag.)
- **Drop success:** card lands in the destination column. Server confirms the status change; activity log entry `Status changed <old> → <new> by Sam` is added. On server error, the card returns to source with an inline toast: "Couldn't move the ticket. Try again."
- **Keyboard alternative:** keyboard users (no drag-and-drop) select a card with `Tab` → `Enter` to open Ticket Detail, where the Change status dropdown provides the same outcome.

### Click-to-open

- **Click on a card body** (not the drag surface in motion) → routes to `/tickets/:id` (Ticket Detail). Standard click vs drag detection: mousedown + movement > 4px before mouseup = drag; otherwise click.

### Admin role and this page

- Admin does not land on `/queue`. Admin's home is `/admin` (see `admin-dashboard.md`). If a non-Admin Support Agent shares the same browser session and signs out, an Admin who then signs in lands at `/admin`, not here. If Admin reaches `/queue` directly (typed URL, bookmark, etc.), the route returns 403 — the page is Support-Agent-only.
- Ticket Detail's action matrix is identical for Admin and Agent (per `ticket-detail.md` §Action matrix), so Admin *can* perform the same ticket actions when they reach a ticket — but they reach tickets via the Admin Dashboard, not via this Kanban.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (loaded)** | Page loaded, filters default (All), tickets present | Heading "Queue" + filter strip + 4-column kanban. |
| **Default (loaded, Admin)** | Admin routed directly to `/queue` (should not happen via UI; defense-in-depth) | 403 Forbidden card: "You don't have access to this page. Back to Admin Dashboard." (links to `/admin`.) |
| **Filtered (no-result column)** | Filter applied, some columns are empty | Empty columns show "No tickets match your filters."; non-empty columns render normally. |
| **Dragging** | Mouse-down on a card + movement | Source column shows ghost placeholder; dragged card lifts at cursor; valid drop targets highlight; invalid targets show rejection color. |
| **Drag blocked (unsaved comment)** | Sam has an unsaved comment in Ticket Detail when a drag is initiated | Inline toast at the bottom of the page: "You have an unsaved comment. Save or discard it before moving tickets around." Drag does not start. |
| **Loading** | Initial fetch in flight | Skeleton: heading row + filter strip with disabled look, 4 columns each with 3 card skeletons (rounded, 96px tall). No spinner overlay. |
| **Server error** | Fetch fails | Inline error above the kanban: "Couldn't load the queue. Refresh to try again." Filter strip still visible. |
| **Empty queue (all columns empty)** | Genuinely zero tickets in the system | Each column shows "Nothing here." Calm, single-line. The whole board is intact; the page reads as "no work to do" rather than "broken". |
| **Session expired** | Fetch returns 401 | Redirect to `/login?return_to=/queue`. Filter state is preserved in URL; after re-auth, Eli lands back on the same view. |

**Note on the wireframe:** the canonical frame is **Default (loaded, Support Agent role)**. Filtered / Dragging / Empty queue are documented; they reuse the same skeleton with column-state changes. Admin does not see this page — see `admin-dashboard.md` for Admin's home.

## Visual Tokens

Inherited from Login + Ticket Detail + Employee Dashboard. New tokens introduced on this page:

- Card surface border: `#dee2e6` 1px (already in token table)
- Card lift shadow on hover: `0 4px 8px rgba(33, 37, 41, 0.08)` (new — `box-shadow` for hover/dragged state)
- Drop target column header highlight: `#f1f3f5` (already a hover tint elsewhere; reused here)
- Invalid drop indicator: `#fff5f5` bg with `—` icon (new)
- Orphan card pinned tint: `#fff5d6` 12% (a faded version of the Open status pill color; new)
- Unassigned badge: `#fff5d6` bg, `#7a5c00` text (same as Open status pill — deliberate visual reuse so Sam's eye lands on it without it screaming)

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface (cards, app-header) | `#ffffff` | All cards, app-header strip |
| Primary | `#212529` | Heading text, filter strip headings, button bg if any |
| Border default | `#dee2e6` 1px | Card borders, filter control borders |
| Border strong (column dividers) | `#dee2e6` 1px | Vertical dividers between columns |
| Muted text | `#868e96` | Ticket number mono, timestamps, filter placeholder |
| Body text | `#495057` | Card title, owner name |
| Status badge tokens | (from Ticket Detail) | Cards |
| Priority badge tokens | (from Ticket Detail) | Cards |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | `ui-monospace, SFMono-Regular, Menlo, monospace` | Ticket numbers |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Board outer margin | 40px each side | x=40..1400 occupied by the board (1360px) |
| Column width | 320px | Fixed; 4 columns fit comfortably |
| Column gap | 16px | Between columns |
| Card padding | 12px | Inside each card |
| Card-to-card vertical gap | 12px | Between cards in a column |
| Card title row height | ~40px (2 lines × 20px) | Title clamps to 2 lines |
| Card meta row height | 28px | Single-line meta |
| Card total height | ~96px | Title (40) + meta (28) + padding (12×2) + gap (4) ≈ 96 |
| Filter strip height | 56px | One row of controls |
| Heading row height | 40px | Same as Employee Dashboard |
| Column header height | 48px | Sticky inside each column |
| Avatar diameter | 24px | Owner avatar |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is **Default (loaded, Agent role, no Admin tab)** with 4 columns and several representative cards.

- App-header chrome strip: y=0..64.
- Heading row: "Queue" at x=40, y=108, 24px semibold. (Users tab would be at x=1320..1400 for Admin; absent here.)
- Filter strip: y=128..184 (56px tall).
  - Search box: x=40..360 (320px wide, 40px tall), y=144..184.
  - Priority filter: x=380..520 (140px wide), y=144..184.
  - Category filter: x=540..680, y=144..184.
  - Owner filter: x=700..840, y=144..184.
- Kanban board: y=200..880 (or scrollable below).
  - Open column: x=40..360 (320px wide). Column header at y=200..248, body y=248..880.
  - In Progress column: x=376..696 (gap 16). Header y=200..248.
  - Resolved column: x=712..1032. Header y=200..248.
  - Closed column: x=1048..1368. Header y=200..248.
- Cards within columns: 96px tall, 12px gap. Card stride = 108px.
- Orphan pin: in the Open column, the top card(s) with no owner get the `#fff5d6` 12% tint and Unassigned badge.

## Success

Sam lands here, scans four columns left-to-right in under three seconds:
1. **Open column** — orphans pinned at top with Unassigned badge — first thing Sam sees; pick-and-claim rhythm.
2. **In Progress column** — Sam's own tickets and others' — at-a-glance status of work in motion.
3. **Resolved column** — tickets awaiting Eli's verdict; visible but read-only (Sam can't drag out).
4. **Closed column** — history; read-only; tail-end of scan.

Total scan: 3 seconds for an empty-ish day, 10 seconds for a full queue. The page's job is to give Sam the queue's shape instantly and let Sam act on any ticket without leaving the rhythm.

For Admin: Admin does not see this page; Admin's home is `/admin` (see `admin-dashboard.md`) with its own Dashboard / Users tab structure.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking this spec):
- **Touch / mobile drag-and-drop:** out of MVP. The MVP team uses desktop browsers; mobile is a v1.x follow-up. The page is desktop-first.
- **Keyboard-only drag alternative:** Tab + Enter to open Ticket Detail + Change status dropdown is the keyboard path. A direct "Move with arrow keys" alternative is a v1.x follow-up.
- **Live updates:** out of MVP; same stance as Ticket Detail comments. Sam refreshes the browser to see new tickets.
- **Column-collapse:** a "Hide Closed" toggle to give the kanban more horizontal room is a v1.x follow-up.
- **Saved filter presets:** "My IT tickets" / "Aging > 3 days" / etc. — v1.x follow-up if needed.
- **Drag-and-drop animation timing:** the card lift / drop animations are 150ms ease; the implementation can tune this but the spec calls for "subtle".

---

_Produced by Freya — 2026-09-14_
_Source: 02-sam-runs-the-queue.md (Screen 2), design-process/B-Trigger-Map/feature-impact.md (Kanban = top-weighted feature), design-process/D-UX-Design/ticket-detail.md (status/priority badge tokens, action matrix for valid transitions), design-process/D-UX-Design/employee-dashboard.md (row/badge vocabulary, app-header chrome)_
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._