# Sam the Support Agent — Runs the queue from morning scan to closure

**Archetype:** Sam the Support Agent
**Entry:** Sam opens HelpDesk Lite as their primary working surface during the work day. Login is the entry point. There is no discovery phase — Sam was assigned the Agent role when the tool was introduced and the dashboard is now where work happens. Emotional state on arrival: alert, scanning. The first scan of the day is a triage ritual — looking for orphans, claims, and slips. Calm when nothing has aged; mildly tense when something has. The dashboard has to answer Sam's morning questions in seconds or it has failed.
**Goal:** Keep the queue visible, keep every ticket owned, move work through Open → In Progress → Resolved, hand off cleanly when needed, and let Eli confirm closure. The day ends when the queue state is legible and nothing is slipping.

## Screens

1. **Login**
   Same Login screen as Eli: brand mark, email field, password field, "Log in" primary button, "Forgot password?" secondary link. No SSO in MVP. The role determined at login drives what dashboard Sam lands on. Header elements (My Profile, Logout) are present on every screen after Login and are shared between Employee and Support Agent — no separate profile surface for either role.

2. **Agent Dashboard (Kanban board)**
   Sam's command center — the highest-weighted single feature in the Trigger Map. Four columns: **Open**, **In Progress**, **Resolved**, **Closed**. Cards within each column are sorted **oldest-first** so aging tickets float up and queue hygiene is visible. Each card shows ticket number, title (truncated), priority badge, owner (with empty avatar = orphan), and last-updated timestamp. Orphans (no owner) are pinned to the top of the Open column with a clearly visible "Unassigned" badge — the orphan problem is the first thing Sam must see in the morning scan. **All tickets** are visible by default across all owners; "Mine" is a filter, not a separate board. Header strip: search (by ticket number / title / submitter name), filters (priority, category, owner), and a **Users tab** (visible only to Admin role; non-Admin Support Agents do not see it).

3. **Ticket Detail View — from Sam's side (any state)**
   The same role-aware Ticket Detail page used by Eli, but with Agent-side actions enabled. Header block: ticket number, title, status badge, priority badge, category, **owner** (with reassign control — click to change), submitter, created-at timestamp. Below: Description (Eli's original text, displayed as the first message in the thread), Comments thread (each comment with author, role badge "Employee" or "Support Agent", and timestamp), Attachments (Eli's uploaded file, viewable/downloadable if present), Activity log (chronological history of status changes, reassignments, priority changes, reopens — each with author and timestamp). Actions available to Sam: **Add comment** (always available — Sam's primary ongoing action), **Change status** (Open ↔ In Progress; Open / In Progress → Resolved; Sam cannot transition to Closed — only Eli confirms closure), **Reassign owner** (one-action reassignment), **Change priority** (Sam can adjust priority during triage; change is recorded in the activity log with author and timestamp). **No Reopen / No Close actions for Sam** — those are Eli-only.

4. **Status transition (drag-and-drop on the Kanban board)**
   Sam drags a card between columns to change status. The card moves immediately as visual feedback; status updates in the data; the activity log records "Status changed [old] → [new] by Sam" with timestamp. Drag works Open ↔ In Progress and Open / In Progress → Resolved. The Closed column is **read-only for Sam** — it exists to display Eli's confirmed-closed tickets for history reference; Sam cannot drag into or out of it. If Sam has unsaved changes on the Ticket Detail page (e.g., a comment in progress), the drag is blocked with a clear inline message so context is preserved.

5. **Reassign owner (one-action)**
   From the Ticket Detail header, Sam clicks the owner field. A dropdown lists all active Support Agents (and Admins who can also take tickets). Sam picks the new owner; the field updates immediately. The activity log records "Reassigned from [old owner] to [new owner] by [actor]." Goal 3's ownership-handover integrity objective (100% of reassignments reflected with timestamp) lives in this event.

6. **Users tab (Admin only)**
   Visible in the header strip **only when Sam's role is Admin**. Lists all users with name, email, role (User / Support Agent / Admin), and status (active / inactive). Admin actions: change role (one-action dropdown change), activate / deactivate (one-action toggle). Admin uses the same Agent Dashboard as the Support Agent — this is a permission overlay on the same screen, not a separate dashboard. **Non-Admin Support Agents do not see the Users tab.**

7. **Ticket Detail View — Resolved state (success state)** ✓
   Sam has dragged a ticket to Resolved (or it was already Resolved by Sam from In Progress). The status badge shows "Resolved" and Sam's resolution comment is the most recent message in the thread. The card sits in the Resolved column on the Kanban board, oldest-first like every other column. Status stays Resolved until Eli acts. **Two valid outcomes — both are successes:**

   *Valid ending A (happy path):* Eli reviews Sam's resolution comment, agrees the issue is fixed, clicks Confirm. Status moves to Closed. Terminal. Sam's queue is one shorter, the activity log has the full chain (Open → In Progress → Resolved → Closed) with all actors and timestamps. Goal 1 (resolution latency < 2 days, reopen rate < 15%) is satisfied.

   *Valid ending B (reopen path):* Eli reviews Sam's resolution comment, decides the issue is not actually fixed, clicks Reopen. Status returns to Open, owner kept, full history preserved (Sam's previous resolution comment, the reopen event, Eli's reopen reason). The card reappears at the top of the Open column. Sam's day has one more item in the queue. **This is also a success** — Goal 1's reopen-rate objective is being honored in real time, not papered over with premature closures. The product's quality mechanism worked because the trust contract held.
