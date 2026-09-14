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

## Content & Actions

The page contains exactly these elements, in this order:

1. **App-header chrome strip** — same shared strip as Ticket Detail / Create Ticket / Submission Confirmation.
2. **Page heading "My Tickets"** — 24px semibold, `#212529`, top-left of page content.
3. **"Create Ticket" primary button** — `#212529` fill, white 15px semibold label, 40px tall, 6px radius. Right-aligned in the page header row, horizontally aligned with the heading. Routes to `/tickets/new`.
4. **List area** — 880px-wide content column, full row backgrounds (`#ffffff` with 1px `#dee2e6` bottom border), 64px tall per row.
   - Each row: ticket number (left, mono) · title · status badge · priority badge · last-updated timestamp (right-aligned).
   - Hover state: row background tints to `#f1f3f5` to confirm clickability.
   - Click anywhere on the row → routes to `/tickets/:id` (Ticket Detail).
5. **Empty state card** (only rendered when Eli has zero tickets) — centered horizontally inside the content column, vertically positioned in the upper-third of the available list area (not pushed to the bottom — she should see it on first load, not have to scroll past a phantom "your list is empty" footer).
   - Headline: "No tickets yet" — 20px semibold, `#212529`.
   - Caption: "When you file a request it'll appear here." — 14px, `#495057`.
   - CTA: `Create Ticket` — same primary button as the header (button label `#ffffff`, fill `#212529`, 6px radius, 48px tall — slightly taller than the header's 40px so the empty-state CTA is the most prominent affordance).
   - Vertically stacked: headline → caption (8px gap) → button (32px gap). Centered horizontally within the column.
6. **"Load more" / pagination** — out of MVP. If Eli's queue grows past the visible window, the page is scrollable; she scrolls. The MVP team will not hit a pagination need.

**No other content.** No welcome message. No "Did you know you can also Slack us?" anti-pattern. No summary stats ("3 open, 1 closed") — those would imply team-wide visibility. No calendar/date picker. No "Activity since you last logged in" panel.

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
| **Default (with tickets)** | Page loaded, Eli has ≥ 1 ticket | Heading + Create Ticket button + list area with rows. Newest-first. |
| **Default (empty)** | Page loaded, Eli has 0 tickets | Heading + Create Ticket button (in header) + centered empty-state card. |
| **Loading** | Initial fetch in flight | Skeleton: heading placeholder, button placeholder, 5 row skeletons (16px tall bars where content would be). No spinner overlay. |
| **Server error** | Fetch fails (network / 5xx) | Inline error above the list area: "Couldn't load your tickets. Refresh to try again." Heading + Create Ticket still rendered. No list. |
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