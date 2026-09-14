# Eli the End-User — Files a request and tracks it to closure

**Archetype:** Eli the End-User
**Entry:** Eli opens HelpDesk Lite from a bookmark or team link when they realize they are blocked. They arrive already knowing they need help — no exploration phase. Emotional state: blocked, mildly frustrated, sometimes time-pressured. They want to get the request down quickly and return to their work.
**Goal:** Submit a support request, get an immediate receipt, track its progress, and either confirm the resolution is real (Close) or signal that the issue is not actually fixed (Reopen).

## Screens

1. **Login**
   Brand mark, email field, password field, "Log in" primary button, "Forgot password?" secondary link. No SSO, Google, or Microsoft option in MVP. Header elements: My Profile (link) and Logout (link) — present on every screen after Login.

2. **Employee Dashboard (My Tickets)**
   After Login, Eli lands here directly (no intermediate Welcome screen). The page shows Eli's own tickets only — no team-wide visibility, no other employees' tickets, no Agent queue state, no admin data. Each ticket row shows the ticket number, title, current status (Open / In Progress / Resolved / Closed), priority (Low / Medium / High), and last-updated timestamp. The list is sorted newest-first by default. A single "Create Ticket" primary button is fixed at the top right.

3. **Create Ticket**
   The submission form. Fields in this order, top to bottom: Title (required, single line) → Description (required, multi-line) → Category (optional, dropdown: IT / HR / Finance / General) → Priority (required, default Medium, dropdown: Low / Medium / High) → Attachment (optional, single file upload, 10 MB size cap) → Submit button. No welcome copy. The fewer steps between "I'm blocked" and "I've asked for help," the better — this is Eli's friction surface.

4. **Submission Confirmation** ✓ (intermediate success)
   After Submit, Eli sees a confirmation screen with three signals at once: a "Ticket created" headline, the unique ticket number prominently displayed (e.g., #HD-47), and the initial status ("Open"). Two actions: primary CTA "View ticket" (goes to Ticket Detail View) and secondary "Back to My Tickets" (returns to the Dashboard, where the new ticket is now visible at the top of the list). This screen is the 5-second trust moment — it converts "submission" into a returnable artifact.

5. **Ticket Detail View — Open / In Progress state**
   The atomic unit of the product. Role-aware: this same page is used by both Eli and Sam, with action availability determined by role and status. From Eli's side at this state, the page shows: header block (ticket number, title, status badge, priority badge, category, owner, submitter, created-at timestamp), Description (Eli's original text, displayed as the first message), Comments thread (each comment with author, role badge "Employee" or "Support Agent", and timestamp), Activity log (chronological history of status changes, reassignments, and reopens, each with author and timestamp). Actions available to Eli here: **Add comment**. Reopen and Confirm (Close ticket) are not visible at this state — they only appear when the ticket is Resolved. No welcome or onboarding copy; the ticket number and details are immediately visible.

6. **Ticket Detail View — Resolved state** ✓ (success state, two valid endings)
   The same Ticket Detail View, now showing status "Resolved." The header and history are unchanged; Sam's resolution comment is visible in the thread. Two actions appear for Eli at this state: **Confirm (Close ticket)** — moves the ticket to Closed, terminal, no further Reopen available. **Reopen** — moves the ticket back to Open with full history preserved; ticket appears in Sam's queue again. If status is Closed (after Eli confirmed), neither action is available; the ticket is terminal and Eli must create a new ticket if the issue returns.

   *Valid ending A (happy path):* Eli reviews, sees Sam's resolution comment, agrees the issue is fixed, clicks Confirm. Ticket moves to Closed. The scenario completes: a request was visible, owned, and traced from creation to confirmed closure.

   *Valid ending B (reopen path):* Eli reviews, decides the issue is not actually fixed, clicks Reopen. Status returns to Open, owner kept, full history preserved. The scenario completes: the trust contract held — closure is real because Eli got to disagree. (This ending is a success because the product's quality mechanism worked, not because the issue was fixed.)
