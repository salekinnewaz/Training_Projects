# Employee Dashboard (My Tickets)

**Route:** `/dashboard`
**Scenario:** Eli the End-User (priority 03). Sam does not pass through here — Agents land on the Agent Kanban Dashboard at `/queue`.
**Purpose:** Show Eli her own tickets and the single path to file a new one. The page is the destination after Login, the return path after Submission Confirmation, and Eli's standing queue view.

## User Context

Eli lands here directly from Login (per scenario 1, screen 2) — no Welcome screen, no onboarding. Her cognitive state on landing: usually mid-task; she's back to scan "did anyone respond?" or "did anything move?". The page must answer her question in one glance and put the file-new-request affordance within reach.

The product brief calls this the **adoption meter** — the page Eli returns to habitually. If the queue is legible and the Create Ticket button is always reachable, she keeps using it. If it becomes noisy or slow, the Slack-DM temptation returns. So: clean rows, newest-first, one button, no noise.

## Design Decisions (locked during discussion)

- **Empty state:** Centered card: "No tickets yet" headline + 1-sentence explanation + a "Create Ticket" CTA button. Reassures Eli the system is working and gives her an in-place path to the first request.
- **No search, no filter, no sort control** on this page. Newest-first only. The MVP team of 5–20 users will not outgrow this in the launch window. If Eli's personal queue grows past ~20 tickets, a search box is a v1.1 follow-up.
- **Single primary CTA in the page header:** "Create Ticket" button, fixed top-right. Always visible regardless of scroll.
- **Row composition:** ticket number (mono) · title (semibold, single line, ellipsised) · status badge · priority badge · last-updated timestamp (right-aligned).
- **No team-wide visibility, no other employees' tickets, no Agent queue state, no admin data.** This is *Eli's* surface; if she's curious about Sam's work she doesn't see it here.
- **Newest-first sort** is fixed. The page does not offer re-sort controls in MVP.
- **Click target:** the entire row is clickable and routes to Ticket Detail. The Create Ticket button at top-right is the only other interactive element.
- **Stat strip (added HD-020, restyled HD-021):** a horizontal strip of five cards between the header and the list summarising **Eli's own** tickets — Total · Open · In progress · Resolved · Closed. Sourced from `GET /api/tickets/stats/mine`, whose counters are filtered to the caller's own ticket IDs **in SQL**. This preserves the "no team-wide visibility" rule above: Eli sees her own counts and never learns the team's queue state. The strip is optional — if the stats request fails it is omitted and the list still renders.
  - **Layout (HD-021):** one row, five cards, all **88px tall** but of **unequal width**. Measured against the reference screenshot the cards are **305 · 249 · 240 · 259 · 299px** — the Total card is the widest (it carries the label, the number, the delta pill *and* the caption) and Closed is second widest. The strip shares its width across five fractional grid tracks (`22.56fr 18.42fr 17.75fr 19.16fr 22.12fr`), 8px gap. Below 1180px the row collapses to three equal columns; below 760px, two.
  - **Total card:** a lavender rounded-square tile (52×52, 14px radius, `#F0EAFE` fill) with a **solid** purple clipboard glyph (`#7433FE`), the label ("Total Tickets", 14px semibold) above the number (26px bold), a period-over-period delta pill top-right (green `#09C05B` on `#E1F9EE` when up, red `#D92D20` on `#FEE2E2` when down; hidden when there is no previous period to compare against), and a "vs last month" caption (15px, `#A7ACCC`) bottom-right. The pill and the caption stack in the same right-hand column.
  - **Status cards:** a tinted square tile (52×52) holding a **solid 25px disc** in the status's accent colour — a plain disc for Open, a white play triangle for In progress, a white check for Resolved, a white × for Closed — with the label above the number, a 54px **sparkline** in the top-right corner, and an 8px-tall horizontal **progress bar** bottom-right. The bar's width is not fixed: its left edge is anchored at card+129 and its right edge 18px inside the card's border, so it spans the gap between them (the four bars measure 101 / 92 / 109 / 132px). The sparkline's **box** is 14px inside the card's right border — its *ink* comes out flush with the bar's track, but the boxes are 4px apart. The bar's filled portion is `value / total`, so the four bars together account for the whole row.
  - **Label clearance:** each card's label is bounded on the right so it can never run under the card's right-hand visual — the sparkline on a status card (bound at card width − 91px, less 4px for the trailing letter-spacing) and the delta pill / caption aside on the Total card (card width − 135px). A label too long for its bound is ellipsised, never spilled.
  - Labels and order: **Total Tickets** · **Open** · **In Progress** · **Resolved** · **Closed**.
  - Accent colours are the strip's **own** palette, deliberately separate from the shared `--status-*-dot` family (which the Ticket Detail pills and Kanban columns also read): Total `#7433FE` · Open `#0674FE` · In progress `#FEAF11` · Resolved `#08D076` · Closed `#5D749D`. The sparklines use their own set again — Open `#6366F1` · In progress `#B4BEEB` (periwinkle, so the amber bar stays the card's only warm element) · Resolved `#02C878` · Closed `#87A0D0`.
  - The sparkline is a **pale wash**, not a solid line: stroke opacity 0.34 over a gradient fill at 0.10, compounding to the reference's ~0.406 effective alpha.
  - **Counts are the caller's own.** A User with 7 open tickets sees "7" on the Open card regardless of how many open tickets the team has.
  - Built as the `stat-strip` molecule (`components/molecules/stat-strip/`), which supersedes the older `stat-card` molecule for this use case. The agent Tickets page (HD-019) and the Admin dashboard render the **same** molecule; only the data scope differs.

## Content & Actions

The page contains exactly these elements, in this order:

1. **App-header chrome strip** — same shared strip as Ticket Detail / Create Ticket / Submission Confirmation.
2. **Page heading "My Tickets"** — 24px semibold, `#212529`, top-left of page content.
3. **"Create Ticket" primary button** — `#212529` fill, white 15px semibold label, 40px tall, 6px radius. Right-aligned in the page header row, horizontally aligned with the heading. Routes to `/tickets/new`.
4. **Stat strip** (HD-020, restyled HD-021) — five cards in one row, between the header and the list.
   - Labels and order: **Total Tickets** · **Open** · **In Progress** · **Resolved** · **Closed**.
   - **Card geometry:** all five cards are **88px tall**; widths are **unequal** (305 · 249 · 240 · 259 · 299px in the reference), shared across five fractional tracks with an 8px gap. Three equal columns below 1180px, two below 760px.
   - **Total card** (widest): a lavender rounded-square tile (52×52, 14px radius) with a **solid** purple clipboard glyph, the label above a bold number, a period-over-period delta pill top-right, and a "vs last month" caption bottom-right — pill and caption stacked in one right-hand column.
   - **Status cards:** a tinted square tile (52×52) holding a **solid 25px disc** in the status accent colour, the label above a bold number, a 54px sparkline top-right and an 8px-tall progress bar bottom-right. The bar's width is not fixed — it is anchored at card+129 on the left and 18px inside the card's right border. Bar fill = `value / total`.
   - Glyph per card (inline SVG, `currentColor`): clipboard (Total) · plain disc (Open) · disc with a white play triangle (In progress) · disc with a white check (Resolved) · disc with a white × (Closed).
   - Accent colours are the strip's own palette, separate from the shared `--status-*-dot` family: Total `#7433FE` · Open `#0674FE` · In progress `#FEAF11` · Resolved `#08D076` · Closed `#5D749D`.
   - The delta compares the caller's own tickets created in the last **30 days** against the **30 days** before that. It is hidden when there is no previous period to compare against — a misleading "+100%" is worse than no pill at all.
   - Built as the `stat-strip` molecule (`components/molecules/stat-strip/`), which supersedes the older `stat-card` molecule for this use case. The agent Tickets page (HD-019) and the Admin dashboard render the **same** molecule; only the data scope differs.
   - **Counts are the caller's own.** A User with 7 open tickets sees "7" on the Open card regardless of how many open tickets the team has.
5. **List area** — 880px-wide content column, full row backgrounds (`#ffffff` with 1px `#dee2e6` bottom border), 64px tall per row.
   - Each row: ticket number (left, mono) · title · status badge · priority badge · last-updated timestamp (right-aligned).
   - Hover state: row background tints to `#f1f3f5` to confirm clickability.
   - Click anywhere on the row → routes to `/tickets/:id` (Ticket Detail).
6. **Empty state card** (only rendered when Eli has zero tickets) — centered horizontally inside the content column, vertically positioned in the upper-third of the available list area (not pushed to the bottom — she should see it on first load, not have to scroll past a phantom "your list is empty" footer).
   - Headline: "No tickets yet" — 20px semibold, `#212529`.
   - Caption: "When you file a request it'll appear here." — 14px, `#495057`.
   - CTA: `Create Ticket` — same primary button as the header (button label `#ffffff`, fill `#212529`, 6px radius, 48px tall — slightly taller than the header's 40px so the empty-state CTA is the most prominent affordance).
   - Vertically stacked: headline → caption (8px gap) → button (32px gap). Centered horizontally within the column.
7. **"Load more" / pagination** — out of MVP. If Eli's queue grows past the visible window, the page is scrollable; she scrolls. The MVP team will not hit a pagination need.

**No other content.** No welcome message. No "Did you know you can also Slack us?" anti-pattern. No calendar/date picker. No "Activity since you last logged in" panel.

> **Amendment (HD-020).** This spec originally forbade summary stats outright: *"No summary stats ('3 open, 1 closed') — those would imply team-wide visibility."* The stat strip in item 4 supersedes that ban **only** in its user-scoped form. The concern the ban encoded was real: un-scoped counters would tell Eli about the team's queue. The HD-020 endpoint resolves that by filtering to the caller's own tickets server-side, so the strip answers "how is *my* request history doing?" without exposing anyone else's data. The team-wide `GET /api/tickets/stats` endpoint remains Support Agent + Admin only.

## Behavior

### Page lifecycle

- **Entry from Login:** `/login` POST success with `role = User` redirects to `/dashboard`.
- **Entry from Submission Confirmation:** `← Back to My Tickets` link routes to `/dashboard`. The newly-created ticket is at the top of the list (per scenario 1).
- **Entry from Ticket Detail:** "← Back to Dashboard" link on Ticket Detail routes to `/dashboard`.
- **Entry from Create Ticket (Cancel):** both Cancel and Back-to-My-Tickets routes land here.
- **Direct-arrival to `/dashboard`** while logged in: served normally. **While logged out:** redirect to `/login?return_to=/dashboard`.

### Sort and refresh

- **Newest-first by `updated_at` (timestamp of the most recent activity-log event on the ticket).** Sort is fixed; no user-controlled sort in MVP.
- **No auto-refresh.** The page reads at load time. If Eli wants fresh data, she refreshes the browser. Live updates are a v1.x follow-up; out of MVP for the same reason as Ticket Detail comments.
- **Create-Ticket → Submit → return:** after Submission Confirmation's "← Back to My Tickets" lands Eli here, the new ticket appears at the top. The page is re-rendered (not just appended); her existing tickets remain in place below.

### Row click

- **Click anywhere on a row** → routes to `/tickets/:id` for that ticket.
- **Hover state:** row background `#f1f3f5`; cursor pointer. Tooltip on the title (full title, useful when ellipsised) appears after 500ms.
- **Keyboard:** `Tab` moves through rows as a single focusable element each (row wrapped in a link/anchor); `Enter` activates. No per-cell keyboard nav in MVP.

### Create Ticket button

- **Click in header:** routes to `/tickets/new`.
- **Click in empty state:** same route. Two CTAs in one page is fine; the empty-state CTA is slightly larger and centered, which is the right hierarchy when there's no other content.
- **Keyboard:** button is a native focusable button. Focusable via `Tab`.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (with tickets)** | Page loaded, Eli has ≥ 1 ticket | Heading + Create Ticket button + stat strip + list area with rows. Newest-first. |
| **Default (empty)** | Page loaded, Eli has 0 tickets | Heading + Create Ticket button (in header) + centered empty-state card. The stat strip still renders, with every counter at 0. |
| **Loading** | Initial fetch in flight | Skeleton: heading placeholder, button placeholder, 5 row skeletons (16px tall bars where content would be). No spinner overlay. |
| **Server error** | Fetch fails (network / 5xx) | Inline error above the list area: "Couldn't load your tickets. Refresh to try again." Heading + Create Ticket still rendered. No list. |
| **Stats unavailable** | The stats request fails but the ticket list succeeds | Stat strip omitted; heading + Create Ticket + list area render normally. The strip is supplementary — a stats failure never blanks the list. |
| **Session expired** | Fetch returns 401 | Redirect to `/login?return_to=/dashboard`. After re-auth, Eli lands back here. |

**Note on the wireframe:** the canonical frame is **Default (with tickets)** — the most common and the one that establishes the row layout. Empty state is documented; would render as a separate frame if needed.

## Visual Tokens

Inherited from Login + Ticket Detail + Create Ticket. New tokens introduced on this page: **none** — row layout uses existing surface/border/badge/timestamp tokens.

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface | `#ffffff` | App-header strip; row background; empty-state card background |
| Primary (button bg) | `#212529` | Create Ticket button |
| Row border | `#dee2e6` 1px (bottom only) | Between rows |
| Row hover | `#f1f3f5` | On hover |
| Heading text | `#212529` | "My Tickets" heading |
| Muted text | `#868e96` | Last-updated timestamps, ticket numbers |
| Body text | `#495057` | Title text (semibold), empty-state caption |
| Status badge tokens | (from Ticket Detail) | Status column |
| Priority badge tokens | (from Ticket Detail) | Priority column |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | `ui-monospace, SFMono-Regular, Menlo, monospace` | Ticket number only |

### Stat-strip tokens (HD-021)

The strip introduces its **own** accent palette, deliberately separate from the shared `--status-*-dot` family — changing those would shift the Ticket Detail pills and the Kanban columns too. Every value is measured from the reference screenshot.

| Token | Value | Where used |
|---|---|---|
| `--stat-accent-total` | `#7433FE` | Total card glyph |
| `--stat-accent-open` | `#0674FE` | Open disc |
| `--stat-accent-in-progress` | `#FEAF11` | In Progress disc |
| `--stat-accent-resolved` | `#08D076` | Resolved disc |
| `--stat-accent-closed` | `#5D749D` | Closed disc |
| `--stat-tile-total` | `#F0EAFE` | Total card tile fill |
| `--stat-tile-open` | `#EAF2FE` | Open card tile fill |
| `--stat-tile-in-progress` | `#FEF4E0` | In Progress card tile fill |
| `--stat-tile-resolved` | `#E1F9EE` | Resolved card tile fill |
| `--stat-tile-closed` | `#EBEEF6` | Closed card tile fill |
| `--stat-spark-open` | `#6366F1` | Open sparkline stroke |
| `--stat-spark-in-progress` | `#B4BEEB` | In Progress sparkline stroke |
| `--stat-spark-resolved` | `#02C878` | Resolved sparkline stroke |
| `--stat-spark-closed` | `#87A0D0` | Closed sparkline stroke |
| Delta up | text `#09C05B`, bg `#E1F9EE` | Delta pill, period up |
| Delta down | text `#D92D20`, bg `#FEE2E2` | Delta pill, period down |
| Caption | `#A7ACCC` | "vs last month" |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Content column width | 880px | Centered at x=720 (matches Ticket Detail center) |
| Page top margin | 32px below app-header strip | First content row |
| Heading row height | 40px | Heading + Create Ticket button aligned on baseline |
| Row height | 64px | Fixed; comfortable for 2-line ellipsised title + meta |
| Row-to-row spacing | 0 (border only) | Adjacent rows share the visual rhythm of the bottom border |
| Status badge width | auto-fit | Same pill style as Ticket Detail |
| Priority badge width | auto-fit | Same pill style |
| Empty-state card width | 480px | Centered horizontally inside the content column |
| Empty-state vertical position | ~y=300 | Upper-third of available list area (not bottom-pushed) |

### Stat-strip geometry (HD-021)

Measured against the reference screenshot; offsets are relative to each card's own left edge.

| Element | Value | Notes |
|---|---|---|
| Strip card height | 88px | Every card, Total included |
| Card widths | 305 · 249 · 240 · 259 · 299px | Unequal — Total widest, Closed second |
| Card gap | 8px | Between adjacent cards (The reference's four gaps take 33px — 8.25 each) |
| Breakpoints | 1180px → 3 columns · 760px → 2 columns | Equal columns at both |
| Icon tile | 52×52, 14px radius | At card+18..70 |
| Status disc | 25px (r 12.5 on a 30-unit viewBox) | Centred in the tile |
| Label | Inter 600 at 14px, −0.5px tracking | At card+82; ink card+24..34 (11px cap height) |
| Number | Inter 700 at 26px, −0.5px tracking | At card+82; ink card+47..65 (19px digit height) |
| Sparkline | 54×26px | At card+176..230, top-right |
| Progress bar | 8px tall, not fixed-width | Left edge at card+129, right edge 18px inside the card's border |
| Sparkline / bar right edge | card width − 14px | Shared by both |
| Label right bound (status) | card width − 91px | Stops short of the sparkline's box |
| Label right bound (Total) | card width − 135px | Stops short of the delta pill / caption aside |
| Value column | Fixed 44px wide, at card+81 | The widest the reference's own value column ever reaches; it keeps the number clear of the progress bar |
| Sparkline stroke | 0.34 opacity | Over a 0.10 gradient fill → ~0.406 effective |
| Delta pill | 15px bold, 999px radius | Top-right of the Total card |
| Caption | 15px, `#A7ACCC` | Bottom-right, under the pill |

**Content column:** the strip's five cards are sized as fractions of a **1384px** strip, which the global `--content-column-width` token (**1448px**) produces — the reference's strip plus the chrome's 64px of gutters. The token used to be overridden to 1408px on this page while the Agent's and Admin's pages used the global 1280px *plus* a second 32px padding layer, so their strips came out at 1152px and the "In Progress" label was clipped. The token is now raised globally and the page-local override removed, so **all three roles render the same 1384px strip** with cards pixel-identical to the reference (305 / 249 / 240 / 259 / 299px).

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is **Default (with tickets)** with 5 representative rows.

- App-header chrome strip: y=0..64.
- Heading row: "My Tickets" at x=280, y=108, 24px semibold. Create Ticket button right-aligned at x=1080..1160, y=88..128 (40px tall).
- List area: x=280..1160 (880px wide).
- Row 1: y=160..224 (64px tall). Ticket number mono at x=296, title at x=400, status pill (left of priority), priority pill, timestamp right-aligned at x=1144.
- Row 2: y=224..288.
- Row 3: y=288..352.
- Row 4: y=352..416.
- Row 5: y=416..480.
- Rows 6–N (if present) continue the same y-stride of 64px; the page is scrollable.

## Success

Eli lands here, sees the newest of her tickets at the top, and reads the queue in 2 seconds. The Create Ticket button is always where she left it (top-right). If her queue is empty, she sees a clear "No tickets yet" with the next step one click away. There is no noise — no team stats, no admin chrome, no other employees' tickets — so the page never feels like a place where someone is watching over her shoulder.

For Eli's adoption meter to read positive, this page has to be the one she reflexively opens when she wonders "what's happening with my requests?". The newest-first sort, the fixed header button, and the clean row composition are what make that reflex work.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking the spec):
- **Search box** is explicitly out of MVP for the Employee Dashboard. Spec marks v1.1 as the first reasonable place to add it (when Eli's personal queue grows past ~20 tickets, which the MVP team of 5–20 will not hit in the launch window).
- **Status/priority filters:** same v1.1 follow-up if needed.
- **Live updates / auto-refresh:** out of MVP; matching Ticket Detail's stance on comments.
- **Bulk actions** (close-multiple, archive-multiple): out of MVP; Eli has her own tickets only, and MVP teams will not have bulk-action needs.
- **Pagination:** the page is scrollable. A "Load more" or infinite-scroll is a v1.1 follow-up if needed.

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md (Screen 2), design-process/D-UX-Design/login.md (visual tokens), design-process/D-UX-Design/ticket-detail.md (status/priority badge tokens, app-header chrome, hover-state pattern), design-process/D-UX-Design/create-ticket.md (Create Ticket button styling)_
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._