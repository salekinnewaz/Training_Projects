# UX Scenarios — HelpDesk Lite

2026-09-14 · 2 scenarios · 9 screens (5 surfaces; Ticket Detail View counted once)

| # | Scenario | Archetype | Screens | Entry |
|---|----------|-----------|---------|-------|
| 1 | Eli the End-User — files a request and tracks it to closure | Eli the End-User (secondary, priority 03) | 6 (Login, Employee Dashboard, Create Ticket, Submission Confirmation, Ticket Detail [Open / In Progress state], Ticket Detail [Resolved state]) | Login → Employee Dashboard |
| 2 | Sam the Support Agent — runs the queue from morning scan to closure | Sam the Support Agent (primary, priority 02) | 7 (Login, Agent Dashboard / Kanban, Ticket Detail [any state], Status transition [drag], Reassign owner, Users tab [Admin only], Ticket Detail [Resolved success state]) | Login → Agent Dashboard |

Notes on screen counting: Login and Ticket Detail View are shared surfaces used by both archetypes. The Ticket Detail page is one role-aware screen with state-dependent actions, counted once in the surface count but walked twice because the action availability differs by role and status.

## All Screens

Flat design inventory — every screen across both scenarios, for reference by Phase 4 (UX Design).

1. **Login** — email + password, no SSO. Used by all roles.
2. **Employee Dashboard (My Tickets)** — Eli's tickets only, role-scoped, no team visibility. Newest-first by default. Single "Create Ticket" CTA.
3. **Create Ticket** — Title, Description, Category (optional), Priority (default Medium, required), Attachment (optional, 10 MB). Eli-only entry point.
4. **Submission Confirmation** — "Ticket created," ticket number, status "Open," View ticket / Back to My Tickets. Eli-only intermediate success.
5. **Agent Dashboard (Kanban board)** — four columns (Open / In Progress / Resolved / Closed), oldest-first within columns, orphans pinned to top of Open with "Unassigned" badge, drag-and-drop transitions, all tickets visible by default with "Mine" filter, header strip (search, filters, Users tab for Admin only). Sam's command center.
6. **Ticket Detail View (role-aware)** — one page, multiple states. Header (number, title, status, priority, category, owner, submitter, timestamps), Description, Comments, Attachments, Activity log / history. Actions depend on role and status:
   - Employee + Open / In Progress: Add comment
   - Employee + Resolved: Add comment, Reopen, Confirm (Close ticket)
   - Employee + Closed: read-only (no Reopen, no Close)
   - Support Agent + any non-Closed: Add comment, Change status, Reassign owner, Change priority
   - Support Agent + Closed: read-only (Sam cannot reopen or close)
   - Admin = Support Agent permissions plus access to the Users tab
7. **Status transition (drag)** — surfaces only on the Agent Dashboard; drag-and-drop changes ticket status and writes to the activity log.
8. **Reassign owner** — surfaces only on the Ticket Detail View; click owner field → dropdown → pick new owner → history recorded.
9. **Users tab (Admin only)** — list of users with role and active/inactive status. Same Agent Dashboard, additional tab. Activates only when role = Admin.

## Header elements (every screen after Login)

- **My Profile** (link)
- **Logout** (link)

These are persistent header elements, not screens. The My Profile page itself is a generic account settings surface (name, email, password change) and is not part of either scenario walk.

## Out of MVP (gap analysis flags)

These were considered during scenario walks and explicitly excluded per the brief's "no enterprise features in MVP" gating principle. They are listed here so future iterations have a captured backlog:

- **Email / Slack notifications** when a ticket status changes (would close the silent-ticket gap but adds messaging surface).
- **Internal notes** — comments not visible to the requester (would help Sam collaborate but introduces a parallel channel on the same ticket, contradicting the founding principle of one record).
- **Related tickets / merge duplicates** — would help Sam with duplicate requests but introduces graph reasoning inside the ticket model.
- **Custom workflows / per-category routing** — explicitly forbidden by the brief.
- **SLA / time-to-response timers** — Goal 1 already measures resolution latency in the data; timers would duplicate.
- **SAML / SSO identity** — deferred to first-team deployment per the brief's constraints.

Notably, the **attachment upload on Create Ticket** was initially deprioritized in MVP during the Trigger Map phase, then explicitly added back during the Eli scenario walk to address the screenshot-fallback path that pushes Eli to Slack. The feature-impact file's deprioritized list was updated to reflect this reversal.
