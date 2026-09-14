# Ticket Detail View

**Route:** `/tickets/:id` (e.g., `/tickets/HD-47`)
**Scenario:** Both — Eli the End-User (on her own tickets), Sam the Support Agent (on any ticket), Admin (on any ticket, with Agent capabilities).
**Purpose:** Show everything about one ticket — header, description, comments, activity log — and provide role-aware, state-dependent actions so the right person can move the ticket forward without ceremony. This is the atomic unit of the product: every other screen pivots on a click that lands here.

## User Context

Eli arrives after creating a ticket or returning from the dashboard. She wants to know: *what happened since I last looked?*. She reads top-to-bottom and wants the latest signal (status, latest comment) to be unmistakable. She acts only at one of two decision points: when she has something to add (a comment) or when she has a verdict (Reopen or Confirm).

Sam arrives from the Kanban board or a notification. Sam wants: *is this mine, what's blocking it, what's the next action*. Sam skims the header (status / owner / priority), reads the most recent comment, then acts — Add comment, Change status, Reassign, or Change priority — in roughly that order of frequency. The morning scan rhythm is "look at header, look at last comment, act." This page has to honor all three steps without scroll friction.

Admin uses the same view as Sam; the only Admin-exclusive surface is the Users tab on the Dashboard, so Admin's presence here is invisible.

## Design Decisions (locked during discussion)

- **Action placement:** Inline in the header block, right of badges. Sam is the most-action-heavy role; actions must be reachable without scroll for the morning triage rhythm. Eli sees a narrower set on the same row.
- **Closed-state chrome:** Same layout; the header action zone collapses to a single subdued "Closed · read-only" indicator (no buttons). Activity log gains a final "Confirmed closed by Eli" entry.
- **Comments + Activity log structure:** Single column. Order: Description → Comments → Activity log. The conversation and the audit trail are part of the same story.
- **Comment composer:** Inline at the bottom of the Comments thread, anchored like a chat interface. Send on click or Enter.

## Content & Actions

The page has a fixed four-section structure. Sections render in this order, top-down:

### 1. Header block

Left side (stacked metadata, single column on the left):
- **Ticket number** — monospace-ish, muted. Click copies to clipboard; toast confirms.
- **Title** — large, semibold. Single line, ellipsised. Full title visible on hover tooltip and never truncated in the data.
- **Status badge** — pill, color per status.
- **Priority badge** — pill, color per priority.
- **Owner** — name + role-tagged badge ("Support Agent" / "Unassigned"). For Agent: editable in place (click → dropdown → pick). For Employee: read-only.
- **Submitter** — Eli's name + "Employee" badge. Read-only for all roles (immutable after creation in MVP).
- **Created-at timestamp** — "Created Sep 14, 2026 · 09:14" format. Read-only.
- **Category** — IT / HR / Finance / General chip. Read-only (set at Create Ticket; editing category is out of MVP).

Right side (action zone, role- and state-dependent — see § Action Matrix below):
- When the active state is Open or In Progress and the role is Agent or Admin: `[+ Comment]` `[Change status ▾]` `[Reassign]` `[Change priority ▾]`.
- When the active state is Resolved and the role is Employee (Eli): `[+ Comment]` `[Reopen]` `[Confirm (close)]`.
- When the active state is any and the role is Employee and not Resolved: `[+ Comment]`. (Reopen and Confirm are not visible until status = Resolved.)
- When the active state is Closed (any role): single subdued text indicator `Closed · read-only`. No buttons.

### 2. Description block

- Section heading: **Description**.
- Body: Eli's original Create Ticket Description text, displayed as the first message of the conversation thread (not duplicated). Styled identically to a comment from "Eli (Employee) — Sep 14" with no preceding meta divider.
- Read-only; edit-description-after-create is out of MVP.

### 3. Comments block

- Section heading: **Comments** with a count, e.g., "Comments (3)".
- Each comment: author name · role badge "Employee" or "Support Agent" · timestamp ("Sep 14, 09:42" / "3 hours ago" relative if < 24 h, absolute otherwise). Body text below the meta. Subtle left border in the role-badge color (Employee `#adb5bd`, Support Agent `#4263eb`) so conversation partners are visually scannable.
- Composer at the bottom: single-line textarea that grows to 4 lines max, placeholder "Type a comment…", Send button (right-aligned, primary action). Send is disabled until the field has content.
- Submission: appends the new comment at the bottom of the thread, scrolls into view. Server-side idempotency + client-side dedup.

### 4. Activity log

- Section heading: **Activity log**.
- Each entry: `• <event-type> — <actor> <human-timestamp>` on a single line. Event types: `Created`, `Assigned to <name>`, `Reassigned from <old> to <new>`, `Status changed <old> → <new>`, `Priority changed <old> → <new>`, `Reopened by`, `Confirmed closed by`, `Comment added by`.
- Read-only.
- Order: chronological, oldest first at the top (so newest events appear at the bottom, matching the comment thread's sense of "recent at the bottom").

## Action Matrix

| Role | Status | Add comment | Change status | Reassign owner | Change priority | Reopen | Confirm (Close) |
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

**Rules encoded in this matrix:**
- Sam (Agent) **cannot** transition to Closed from any state. Closed is Eli-only.
- Eli **cannot** transition statuses at all. She can only Confirm (Resolved → Closed) or Reopen (Resolved → Open).
- Comment addition is the only action available in all non-Closed states for both roles — it is the always-on conversation channel.
- Closed is terminal: no actions, no editing, no comments. (Activity log can gain a final "Confirmed closed by Eli" entry retroactively.)
- In the **Resolved** state, Sam cannot change status back to Open/In Progress directly from the action zone — the path back is Eli's Reopen. Sam can still add a comment and reassign / change priority at Resolved in case handoff is needed during the wait-for-Eli window.

## Behavior

### Header actions

- **`+ Comment`** — focuses the composer at the bottom of the Comments section and scrolls it into view (so Sam acts in-place rather than clicking-and-losing-position).
- **`Change status ▾`** (Agent only, not at Resolved/Closed) — dropdown listing the legal next-states per the matrix: `Open → {In Progress, Resolved}`, `In Progress → {Open, Resolved}`, `Resolved → (disabled)`, `Closed → (disabled)`. Selecting a state emits a status-change event in the activity log and immediately updates the badge.
- **`Reassign`** (Agent only, except Closed) — dropdown listing all active Support Agents (Admins are listed too if they can take tickets, per scenario 2). "Unassigned" is the first option to clear ownership; selecting it sets the badge to "Unassigned" and adds a Reassigned event with `null` as the new owner.
- **`Change priority ▾`** (Agent only, except Closed) — dropdown `Low / Medium / High`. Selecting emits a priority-change event in the activity log.
- **`Reopen`** (Employee only, at Resolved) — confirmation dialog: "Reopen this ticket? Sam will be notified and the ticket will return to Open with full history preserved." Confirm → status Open, focus stays on header, activity log gains a `Reopened by Eli` entry, an in-app notification fan-out to the owner. Cancel → no-op.
- **`Confirm (close)`** (Employee only, at Resolved) — confirmation dialog: "Confirm this issue is resolved? The ticket will close and cannot be reopened." Confirm → status Closed, action zone collapses to "Closed · read-only", activity log gains a `Confirmed closed by Eli` entry. Cancel → no-op.

### Description / Comments / Activity log

- **Read-only states:** Description block and Activity log never edit. Comments block appends only via the composer.
- **Composer submit:** Send triggers on click or Enter (with `Shift+Enter` for newline). When clicked, the input clears and the new comment appears immediately at the bottom of the thread; on failure it remains in the field with an inline error under the field: "Couldn't send your comment. Try again."
- **Timestamps:** formatted absolutely for events >24 h old, relatively (<24 h) within comment meta so the recent flow feels alive. Activity log uses absolute timestamps throughout for unambiguous audit ordering.
- **Role-badges next to author names:** "Employee" / "Support Agent". Admin displays as "Support Agent" here — the role distinction is invisible on this page (consistent with the per-page-not-MVP decision).

### Cross-page

- **Source link in dashboard:** Clicking a row on Employee Dashboard or a card on Agent Kanban routes here. The page title's H1 landmark reads "Ticket #HD-47" for screen readers; visually, the ticket number is the prominent signal at top of the header.
- **Header (app-level):** The My Profile / Logout header elements from Scenario 1's screen 1 are present above this page; they live in the app chrome, not in this page's content.
- **Return path:** "Back to <Dashboard>" breadcrumb-style link above the header (top-left of the page) returns Eli to Employee Dashboard / Sam to Agent Kanban. Closes the visual loop and avoids the back button's role-discovery overhead.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (Open or In Progress, Employee)** | Page loaded as Eli on a non-Resolved ticket | Header shows status + owner; action zone has `[+ Comment]` only. Description / Comments / Activity all rendered. Composer at the bottom of Comments ready for typing. |
| **Default (Open or In Progress, Agent)** | Page loaded as Sam on a non-Resolved ticket | Same content; action zone has `[+ Comment] [Change status ▾] [Reassign] [Change priority ▾]`. Composer ready. |
| **Resolved (Employee)** | Page loaded as Eli on a Resolved ticket | Action zone changes to `[+ Comment] [Reopen] [Confirm (close)]`. Same content layout. |
| **Resolved (Agent)** | Page loaded as Sam on a Resolved ticket | Action zone shows `[+ Comment] [Reassign] [Change priority ▾]` — `Change status` is hidden per matrix. |
| **Closed (any role)** | Page loaded on a Closed ticket | Status badge: "Closed". Action zone collapses to a single muted `Closed · read-only` indicator. Composer is hidden. Activity log shows the `Confirmed closed by Eli` entry as the last line. |
| **Loading** | Initial page fetch in flight | Skeleton placeholders for the header (number, title, badges) and the three section blocks. No spinner on the page chrome; the skeleton is the load signal. |
| **Not found** | Server returns 404 (ticket deleted / wrong id) | Single centered card: "Ticket not found." + "Back to Dashboard" button. No edit actions; no header chrome. |
| **Forbidden** | Server returns 403 (Eli tries to view a ticket she doesn't own — but per scenario Eli only ever sees her own tickets from the dashboard, so this should be rare; if it occurs, it's a permission drift and warrants "You don't have access to this ticket. Back to Dashboard." | Single centered card, no ticket info. |

**Note on the "Loading" skeleton:** the wireframe captures the Default-Open / In Progress / Employee state as the canonical frame. State variations are documented here for the implementation phase; they reuse the same skeleton with action-zone and badge differences.

## Visual Tokens

These tokens are inherited from the Login spec and propagate to this page. New tokens introduced here are explicitly marked.

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface (card / input bg) | `#ffffff` | Header card, comment cards, activity rows |
| Primary (button bg, active accents) | `#212529` | Send button, dropdown selected state |
| Border default | `#dee2e6` 1px | Header card border, divider lines between sections |
| Label / strong text | `#212529` | Title, headings |
| Muted text (timestamps, breadcrumb) | `#868e96` | "Created Sep 14…", "Back to Dashboard", role badge muted |
| Body text | `#495057` | Comment bodies, description body, metadata fields |
| Activity log text | `#495057` | All entries |
| Composer border (focused) | `#212529` 1.5px | Composer input focus ring (slightly thicker than default 1px to invite typing) |
| Error text | (to be confirmed by Mimir; recommended `#c92a2a`) | Submit-error inline messages |

Status badge colors (**new**, introduced for this page; tokens shared with future Kanban board page):
- Open: `#fff5d6` bg, `#7a5c00` text
- In Progress: `#d0ebff` bg, `#1864ab` text
- Resolved: `#d3f9d8` bg, `#2b8a3e` text
- Closed: `#e9ecef` bg, `#495057` text

Priority badge colors (**new**):
- Low: `#e9ecef` bg, `#495057` text
- Medium: `#fff5d6` bg, `#7a5c00` text
- High: `#ffe3e3` bg, `#c92a2a` text

Role badge border colors (left-border for comments; **new**):
- Employee: `#adb5bd`
- Support Agent: `#4263eb`

Type stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (inherited from Login).

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Content column width | 880px | Centered: x = 280 to 1160 |
| Content column horizontal center | x = 720 | Aligned with form column center on Login |
| Page top margin | 32px (first content) | Below app header chrome |
| Section spacing | 32px vertical | Between header / Description / Comments / Activity |
| Header card padding | 24px | Inside the header card |
| Comment left border | 3px solid | Uses role-badge color |
| Comment meta → body spacing | 8px | Inside each comment |
| Comment-to-comment spacing | 16px | Between comments in the thread |
| Composer height | single-line, grows to max 4 lines | Min 40px |
| Section heading size | 11px uppercase, tracked | "DESCRIPTION" / "COMMENTS (3)" / "ACTIVITY LOG" |
| Title size | 24px semibold | In the header block |
| Activity log row spacing | 4px | Compact; designed for skimming, not reading |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is the **Employee view at Open / In Progress** state (smallest action set). All other states reuse the same skeleton; action-zone and badge changes are documented in the § Action Matrix above.

- App-header chrome strip: y=0..64 (white, `#dee2e6` 1px bottom border; brand mark left, My Profile + Logout right).
- "‹ Back to Dashboard" link: y=108 (14px `#868e96`, top-left of page content).
- Header card: y=120..288 (168px tall, 880×168, 6px radius, `#dee2e6` 1px border).
  - Ticket number `#HD-47`: y=156, 13px monospace, `#868e96`.
  - Title baseline: y=190, 24px semibold, `#212529`.
  - Status + priority badges: y=210..232 (22px tall pills).
  - Metadata row (Owner / Submitter / Created / Category): labels y=262, values y=278.
  - Action zone right side: `[+ Comment]` button at x=1004..1136, y=148..188 (132×40, 6px radius, `#212529` fill, white semibold label).
- DESCRIPTION section heading: y=316, 11px uppercase tracked, `#868e96`.
- Description-as-first-comment card: y=332..416 (84px tall).
- COMMENTS section heading: y=448.
- Comment 1 (Sam, Support Agent): y=464..540.
- Comment 2 (Eli, Employee): y=556..632.
- Composer: y=664..720 (56px tall; Send button right-aligned at x=1108..1152, y=676..708).
- ACTIVITY LOG section heading: y=760.
- Activity log rows: y=784, 804, 824, 844, 864 (5 entries, 20px row stride).

## Success

A returning user lands on this page and answers three questions in under two seconds:

1. **What is this?** — ticket number, title, and current status are unmistakable at the top.
2. **What's new since I last looked?** — the latest comment and the latest activity log entry are visually distinct (the bottom of each list); updated timestamps are relative if recent, absolute otherwise.
3. **What can I do?** — the role- and state-appropriate action zone is right of the header badges; for Eli at Resolved, the only two paths forward (Reopen / Confirm) and the always-on comment compose are all visible without scroll.

For Sam in the morning scan: open the ticket, read the header, read the last comment, act. Under five seconds for any of those steps.

For Eli in the closure moment: see Sam's "Fixed it" comment, decide "yes/no", click one button, ticket moves — terminal or reopen. The trust contract holds.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved. Implementation-level items flagged for follow-up (not blocking the spec):

- **Comment-real-time updates:** live updates from another user's new comment (websocket / SSE) is MVP-quality-of-life; deferrable to Phase 6 / deployment. This page spec assumes fresh on load + after this user's actions.
- **Attachment display:** the Attachment upload was added to Create Ticket; the wireframe for this page should include the Attachment block in the header (file name + size + download link) when an attachment is present. Spec includes the slot; implementation honors the conditional render.
- **Status-change from Resolved via Agent:** per the matrix, Agent's `Change status` is hidden at Resolved. There is a known operational case where Sam wants to undo her own Resolved if she decides it was premature — this should be done by **adding a comment** that triggers an in-app notification to Eli, plus an internal "I want to undo this" flow. Out of MVP; document for v1.1.
- **Keyboard shortcuts:** J/K to navigate comments, `c` to focus composer, `r` for Reopen (Employee at Resolved), `e` for Confirm (Employee at Resolved). Out of MVP spec; suggested for future.

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md, 02-sam-runs-the-queue.md, design-process/D-UX-Design/login.md (visual tokens), design-process/A-Product-Brief/product-brief.md_
_Wireframe approved 2026-09-14; tokens + layout coordinates synced same day._
