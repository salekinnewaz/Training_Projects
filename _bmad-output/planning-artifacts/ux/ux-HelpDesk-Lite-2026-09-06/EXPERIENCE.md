---
title: HelpDesk Lite — Experience
status: final
created: 2026-09-06
updated: 2026-09-06
project: Training_3
form_factor: web
---

# HelpDesk Lite — Experience

> Behavioral spec, IA, journeys, and accessibility. Visual specs live in DESIGN.md. Cross-references use `{path.to.token}` syntax.

## Foundation

- **Form factor**: Web app, desktop-first. Responsive down to mobile (single-column reflow) but no dedicated mobile surface.
- **UI system**: None inherited. Hand-rolled component primitives defined in DESIGN.md.
- **Visual identity**: See DESIGN.md (tokens cross-referenced below).

## Information Architecture

### Sitemap

```
/login
/register
/password-reset
/                       → redirects to role landing
/dashboard              → User Dashboard (role=user) | Agent Dashboard (role=agent or admin)
/tickets/new            → Create Ticket (any authenticated role)
/tickets/:id            → Ticket Details (role-aware controls)
/users                  → User Management (admin only)
/profile                → Profile / Account (any authenticated role)
```

### Role-based landing

| Role | Lands on |
|---|---|
| User | `/dashboard` (User view: "My Tickets") |
| Support Agent | `/dashboard` (Agent view: Kanban board) |
| Admin | `/dashboard` (Agent view) + access to `/users` |

Admin does **not** get a separate dashboard. Admin shares the Agent Kanban and adds the Users tab to the top bar.

### Navigation

- **Top bar only.** No sidebar.
- Logo (left) · Search (center, agents/admins only) · Users link (admin only) · Profile menu (right)
- Active route is reflected in the top bar (e.g., Users link gets active styling when on `/users`)

### Screen inventory (10)

1. Login
2. Registration
3. Password Reset
4. User Dashboard ("My Tickets")
5. Create Ticket
6. Agent Dashboard (Kanban) — Admin sees the same
7. Ticket Details (role-aware)
8. User Management (admin only)
9. Profile / Account

(Auth: 3, Functional: 5, Admin: 1 — Profile shared across roles.)

## Voice and Tone

- **Microcopy** is direct, neutral, and short.
- Status labels are facts: "Open", "In Progress", "Resolved", "Closed".
- The system never anthropomorphizes ("I'm working on it") — it reports state.
- Reopen prompt copy: "**This issue isn't fixed.**" — direct, not apologetic, not playful.
- Errors: one sentence describing what went wrong, one sentence describing what to do. No exclamation points.

## Component Patterns (behavioral)

> Visual specs: DESIGN.md `## Components`. Below: how they *behave*.

### Status Pill
- Always displays the text label + glyph (color is supplementary, never the only signal — see `colors.status.*` in DESIGN.md).
- Pill is non-interactive when shown on lists; clickable on Ticket Details to open a status-change dropdown (agent/admin only).

### Priority Pill
- Same rules as Status Pill.
- Editable inline on Ticket Details by agents/admins (dropdown, not a modal).

### Assignee
- On lists/cards: shows assignee's name + initials avatar. Empty state: gray "Unassigned" badge.
- On Ticket Details: clickable (agents/admins) to open assignee dropdown listing all active agents.

### Comment Composer
- Single textarea + Send button. No rich text, no @mentions, no attachments (out of scope).
- Empty comments are prevented (textarea disabled until non-empty).
- After successful send: textarea clears, new comment appears at bottom of thread with a brief 150ms highlight fade.

### Reopen Control
- Visible **only** when `ticket.status == "Resolved"` AND `currentUser.role == "user"` AND `currentUser.id == ticket.createdBy.id`.
- Renders as a primary button: **Reopen**
- On click: confirm modal — "This will reopen the ticket. Previous conversation and history will be kept." [Cancel] [Reopen]
- After confirm: status returns to Open, ticket appears at top of agent Kanban "Open" column, activity log appended.

### Ticket Status Workflow Controls
Agent/Admin on Ticket Details sees a single "Status" dropdown:
- Open → In Progress → Resolved
- Resolved → Open (reopen, agents/admins only)
- In Progress → Open (revert)
- Closed is **not** selectable by agent — only the user (creator) confirms close.

### Close Confirmation (User-initiated)
- On Resolved tickets where `currentUser == ticket.createdBy`: button **"Confirm and close"** appears.
- One-click (no modal — it's an explicit action).
- On confirm: status → Closed, ticket becomes read-only (no edits, no comments, no reopen).

## State Patterns

### Empty States
- **User Dashboard, no tickets**: "No tickets yet — create your first one." + primary button "Create Ticket"
- **Agent Kanban, all empty columns**: each column shows a 1-line hint ("No open tickets")
- **Ticket Details comments, none yet**: "No comments yet. Start the conversation."
- **User Management, all users deactivated**: rare; show empty state with explanation

### Loading States
- Skeleton placeholders on ticket lists (rows) and Kanban columns (cards)
- Form submit buttons: disable + label change ("Creating…", "Saving…", "Sending…") — no spinners unless > 500ms

### Error States
- Form errors: inline under the field, red border, helper text
- System errors (save failed, network): top-of-page toast, 5s auto-dismiss, with "Retry" action where applicable
- 404/403: dedicated page with back-to-dashboard action

### Permission Failures (defense in depth)
- Even if a control is hidden by role, the backend must enforce. UX shows a friendly "You don't have access to this" page if URL is manipulated.

## Interaction Primitives

- **Click**: primary action everywhere
- **Drag** (Kanban only): drag a card across columns to change status. Drop zone highlights on hover. Optimistic update with rollback on server reject.
- **Keyboard**: every interactive control reachable by Tab; Enter activates; Esc closes modals/dropdowns
- **Search**: agents/admins only; matches ID, title, description; debounced 200ms; results update inline (no submit button)
- **Filter**: agents only; multi-select dropdowns for status, priority, category, assignee; filters compose (AND); URL reflects filter state for shareability
- **No infinite scroll** — paginated lists (page size 25) — small dataset, predictable

## Accessibility Floor

- All form inputs have associated `<label>` elements (not just placeholders)
- Status and priority rely on color + icon + text (never color alone) — per DESIGN.md
- Keyboard navigation works for all controls; visible focus ring at 2px `colors.action.primary`
- Modal traps focus; Esc closes; returns focus to trigger on close
- Page landmarks: `<header>` (top bar), `<main>` (page content), `<nav>` (top nav)
- Contrast: body text passes WCAG AA on `colors.surface.base`; muted text passes AA on `colors.surface.subtle`
- Screen reader: ticket cards expose title, status, priority, assignee as a single labeled region
- Drag-and-drop has a keyboard fallback: select card, press M to move, arrow keys to choose column, Enter to confirm

## Key Flows

### Flow A — "Priya's broken laptop" (User, primary path)
> Priya, an employee, can't log into her laptop. She opens HelpDesk Lite, clicks **+ Create Ticket**, fills in title + description + picks High priority, hits submit. She lands back on "My Tickets" and sees her ticket with Open status. 30 seconds from idea to ticket.

**Steps:**
1. Priya logs in (Flow-context: previously authenticated in this session).
2. Lands on User Dashboard. Sees her existing tickets.
3. Clicks the **+ Create Ticket** button (top-right of dashboard, also reachable via top-bar shortcut).
4. Form opens (modal or full page — see open question below). Title, Description, Priority are required; Category is optional.
5. Picks "High" priority. Submits.
6. Modal closes, ticket appears at top of "My Tickets" with status "Open".
7. Optional: she clicks the ticket to see the detail view, leaves a comment with more context.

**Climax beat:** the form-to-list transition is instant; status is visible in <1s; Priya's confidence that "this is now in the queue" is immediate.

### Flow B — "Sam picks up the queue" (Agent, primary path)
> Sam, a support agent, logs in Monday morning. The Kanban board shows 4 Open, 2 In Progress, 1 Resolved. He clicks an unassigned Open card, the detail view opens, he clicks "Assign to me," updates status to In Progress, leaves a comment ("Restarting VPN — back in 10"). He drags the card to In Progress column. Done in 15 seconds.

**Steps:**
1. Sam lands on Agent Dashboard. Kanban board visible.
2. Scans "Open" column. Sees 4 unassigned cards.
3. Clicks the top one (or drags it directly to In Progress — both paths supported).
4. Ticket Details opens in a side panel (preferred) or full page (fallback). Header shows title, status, priority, assignee.
5. Clicks "Assign to me" → assignee updates, reflected immediately on the open Kanban card.
6. Clicks "Status" dropdown, picks "In Progress" → reflected on the open Kanban card.
7. Types a comment, hits Send → comment appears at the bottom of the thread.

**Climax beat:** every action Sam takes is reflected on the still-visible Kanban card behind the panel — his mental model of "the queue is moving" stays accurate.

### Flow C — "Priya reopens a not-fixed ticket" (User, critical edge)
> Priya's ticket was Resolved. She opens it, sees "This issue is not fixed" prompt and a single **Reopen** button. She clicks it, adds a quick comment ("Still broken"), status returns to Open. The agent's previous comments and history are all still there. No new ticket created.

**Steps:**
1. Priya opens her Resolved ticket from the dashboard.
2. Status pill reads "Resolved". A primary **Reopen** button is visible (control only renders in this state for the creator).
3. She clicks Reopen. Confirm modal: "This will reopen the ticket. Previous conversation and history will be kept."
4. Confirms. Status changes to Open. Ticket reappears in agent Kanban's Open column with full history.
5. Priya adds a quick comment: "Still broken — same error."
6. Agent (Sam) sees the ticket pop back into his Open column on next refresh.

**Climax beat:** the reopen is one click + confirm; history is preserved; the agent doesn't have to piece together context from scratch.

### Flow D — "Sam hands off to Jordan" (Agent, handoff)
> Sam realizes this is a hardware issue better handled by Jordan. He opens the assignee dropdown on the ticket, picks Jordan, saves. Jordan sees the ticket in his board on next refresh. Audit trail intact.

**Steps:**
1. Sam has an In Progress ticket assigned to him.
2. On Ticket Details, clicks the Assignee field. Dropdown shows all active agents.
3. Picks "Jordan". Saves (inline — no modal).
4. Ticket moves off Sam's "My Tickets" view (still visible on the All view). Jordan sees it next refresh.

### Flow E — "Admin deactivates a departed user" (Admin, edge)
> Admin opens User Management, finds the user, toggles Active → Inactive. The user can't log in; their tickets remain for history; no new tickets can be created by them.

**Steps:**
1. Admin clicks **Users** in the top bar.
2. User Management page opens: list of all users with role + active/inactive status.
3. Admin finds the user, clicks their row.
4. Side panel opens with user details + actions.
5. Admin clicks **Deactivate**. Confirm modal: "Deactivating will prevent login and ticket creation. Existing tickets and history are preserved."
6. Confirms. User's status pill changes to Inactive. They cannot log in.

**Climax beat:** the deactivation is reversible (Admin can re-activate from the same panel) — no destructive pressure beyond the confirm modal.

## Open Questions

- **Create Ticket as modal vs full page**: PRD shows it as a screen. Modal is faster (less nav) but harder to deep-link. Default to **modal**, deep-linkable via `/tickets/new`. Confirm at finalize.
- **Ticket Details as side panel vs full page**: side panel keeps the queue visible (better for Flow B). Full page is simpler. Default to **side panel** for agents/admins, **full page** for users. Confirm at finalize.
- **Empty-state illustrations**: kept as muted icons only — confirm we don't add illustrations later.
