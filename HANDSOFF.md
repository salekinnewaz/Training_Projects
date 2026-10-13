# HANDSOFF — QA Loop Log

> **What this is.** A working log for the post-deployment QA
> loop. Every action taken, gap found, fix applied, and test
> result is recorded here. Maintained continuously by the QA
> agent so the human reviewer can audit the run without having
> to scrape shell history.
>
> **Audience.** The senior QA engineer who asked for the loop.
> Not a developer handoff — that lives in `HANDOFF.md`.

---

## 0. Loop Goal

Catch every UI gap, broken feature, and wireframe divergence
on the live deployment (https://helpdesk-lite-tawny.vercel.app)
via automated Playwright tests, fix the gaps, and re-test
until the suite is green and the rendered UI matches the
approved wireframes in `design-process/D-UX-Design/wireframes/`.

The loop continues **without asking the human** for each
decision; the human reviews the final green suite and the
changelog of fixes.

---

## 1. Source-of-Truth Inventory

### Wireframes
`design-process/D-UX-Design/wireframes/*.svg` (+ matching `.png`
+ matching `.md` in the parent dir). Nine surfaces:

- login
- employee-dashboard
- admin-dashboard
- admin-dashboard-users-tab
- agent-kanban
- create-ticket
- ticket-detail
- submission-confirmation
- header-profile-logout
- users-tab (the bare `/users` page; same surface as the
  Admin tab)

### Routes
`frontend/src/app/app.routes.ts`. Twelve pages:

| Path                          | Page                          | Roles                         |
| ----------------------------- | ----------------------------- | ----------------------------- |
| `/login`                      | LoginPage                     | public (redirects if logged in) |
| `/dashboard`                  | EmployeeDashboardPage         | User                          |
| `/tickets/new`                | CreateTicketPage              | User                          |
| `/tickets/:id/created`        | SubmissionConfirmationPage    | User                          |
| `/tickets/:id`                | TicketDetailPage              | User, Support Agent, Admin    |
| `/queue`                      | AgentKanbanPage               | Support Agent                 |
| `/admin`                      | AdminDashboardPage            | Admin                         |
| `/users`                      | UsersTabPage                  | Admin                         |
| `/forgot-password`            | ForgotPasswordPage            | public                        |
| `/register`                   | RegisterPage                  | public                        |
| `/profile`                    | ProfilePage                   | any authed                    |
| `/profile/password`           | ChangePasswordPage            | any authed                    |
| `/forbidden`                  | ForbiddenPage                 | authed                        |
| `**` (404)                    | NotFoundPage                  | public                        |

### Live deployment
- App: https://helpdesk-lite-tawny.vercel.app
- API: same origin under `/api/*` (Vercel Function)
- DB: Neon Postgres (project `sweet-boat-76912606`)
- Seeded users: see `backend/src/seeders/20260915000000-demo-data.js` —
  1 Admin (admin@company.com), 2 Support Agents (sam@, morgan@),
  5 Users (eli@, jess@, noah@, priya@, tomas@—inactive). All
  share password `password123`.

---

## 2. Test Plan (per iteration)

For each iteration, the QA loop runs:

1. **Feature smoke tests** — for every page, verify it loads,
   the happy path works (login → role-correct dashboard →
   feature → expected output), and error states render.
2. **Wireframe layout tests** — compare the rendered DOM
   geometry (key elements present, in the right zones, with
   the right tokens) against the wireframe spec.
3. **Cross-page navigation** — every back link, breadcrumb,
   "Cancel", "Back to My Tickets" returns to the expected
   page.
4. **Auth and role gates** — every protected route returns
   403 for the wrong role and redirects to `/login` when
   logged out.

Each iteration's findings get appended below; fixes are
committed to `main` and re-tested.

---

## 3. Iteration Log

### Iteration 1 — baseline smoke (2026-10-13)

**Action.** Installed Playwright (chromium 1248), created
`qa/playwright.config.ts` targeting
`https://helpdesk-lite-tawny.vercel.app`, wrote
`qa/tests/smoke.spec.ts` (6 sanity tests) and
`qa/tests/fixtures.ts` (login/logout helpers, seeded users).

**Result.**

- 4 of 6 smoke tests pass on first run.
- 2 fail on the live deployment:

  - **smoke 15** — `login page renders the brand mark and both fields`
    — `getByRole('button', { name: /log in/i })` returns no element.
  - **smoke 24** — `login button is disabled until both fields have content`
    — same root cause: the login button does not exist with the
    name "Log in".

**Diagnosis.** Inspected the live `/login` DOM directly:

- Title: "Sign in · HelpDesk Lite" (wireframe says SR-only H1 "Sign in" — title is fine, but the page is the page).
- Button text is `Sign in` (wireframe §"Content & Actions" #6:
  **"Log in button"**).
- Submitting label is `Signing in…` (wireframe §"States" → Submitting:
  **"Logging in…"**).
- Page contains a left-side hero panel with marketing copy:
  - "One queue. Zero chaos."
  - "Triage, assign, and resolve support requests in one calm,
    focused workspace — built for teams of 5 to 20."
  - "Trello-style board for agents" / "Full ticket history &
    comments" / "Reopen with one click"
  Wireframe §"Content & Actions": **"No other content. No marketing
  copy, no value prop, no signup link (accounts are
  Admin-provisioned), no SSO buttons, no Remember-me checkbox, no
  accessibility / terms / version footer."**
- Page contains a "Remember me" checkbox — wireframe forbids it.
- Page contains a "Don't have an account? Register" link — wireframe
  forbids it (accounts are Admin-provisioned; there is no public
  registration flow).

**Gap logged — LOGIN page diverges from wireframe in 5 ways.**

| # | Element             | Wireframe        | Live             |
|---|---------------------|------------------|------------------|
| 1 | Submit button label | "Log in"         | "Sign in"        |
| 2 | In-flight label     | "Logging in…"    | "Signing in…"    |
| 3 | Left hero panel     | (not present)    | present + marketing copy |
| 4 | "Remember me"       | (not present)    | present          |
| 5 | "Register" link     | (not present)    | present          |

**Next.** Bring the Login page back to the wireframe; re-run the
smoke tests; expand coverage to other pages.

---

### Iteration 2 — login fix shipped (commit `8236f21`)

**Action.** Removed the left hero panel + marketing copy + Remember
me + Register link; renamed "Sign in" → "Log in" (and "Signing in…"
→ "Logging in…"); re-centered the form in a 400px column at the
720px mid-line; promoted the page H1 ("Sign in") to an
`visually-hidden` landmark; updated the existing `login-page`
spec to assert the wireframe-forbidden elements are NOT rendered
(three net new negative assertions).

**Smoke test updates.** Tightened the button-name regex to
`exact: true` for "Log in"; added a new smoke test that asserts
the live login page contains no "zero chaos" / "trello-style" /
"remember me" / "don't have an account" copy. Switched all
input selectors from `getByLabel(...)` to `locator('input#login-X')`
because the `<form-field>` host element shares the same `id` as
the inner `<input>`, and Playwright's `getByLabel` was matching
the host (a non-form-control custom element) rather than the
input. Same fix applied to `qa/tests/fixtures.ts`.

**Result.** 7/7 smoke tests pass on the live deployment.
Login page now shows the 6 wireframe-listed elements and
nothing else.

**Deploy verification.** Vercel picked up commit `8236f21`
within 60s. Confirmed via the inspector script — body text on
live `/login` is now exactly:

```
HL
HelpDesk Lite
Sign in
Email *
Password *
Log in
Forgot password?
```

---

### Iteration 3 — feature tests + more wireframe gaps (2026-10-13)

**Action.** Wrote `qa/tests/feature.spec.ts` covering: role-correct
landing, Employee Dashboard structure, Agent Kanban structure,
role-gate / 403 behavior, logged-out redirects, `/api/health`,
`/api/auth/me`. Added wireframe-anchored tripwire assertions:

- Employee Dashboard must NOT have a stat-strip
  (`data-testid="stat-strip"`)
- Agent Kanban must NOT have a Users tab
- Logged-out `/dashboard` and `/queue` must redirect to
  `/login?return_to=…`

**Result.** 12/14 feature tests pass on first run; 2 fail:

- `Employee Dashboard › has no stat strip` — **GAP**
- `Agent Kanban › renders the Queue heading + filter strip + 4 columns`
  — search input placeholder is `Search…` (live) vs. `Search queue…`
  (wireframe §"Content & Actions" #3.1) — minor text gap.

**Gap logged — Employee Dashboard has a wireframe-forbidden stat strip.**

The live page renders a 4-card strip above the ticket list with
the labels `OPEN / IN PROGRESS / RESOLVED / CLOSED` and a count
under each. This violates wireframe §"Content & Actions" #6:

> **No other content.** No welcome message. No "Did you know
> you can also Slack us?" anti-pattern. **No summary stats
> ("3 open, 1 closed") — those would imply team-wide
> visibility.**

It also violates wireframe §"User Context":

> **No team-wide visibility, no other employees' tickets, no
> Agent queue state, no admin data.** This is *Eli's* surface;
> if she's curious about Sam's work she doesn't see it here.

The stat strip also reads the COUNT of *all* statuses on
*Eli's* tickets — but if Eli has zero "In Progress" tickets
because she's a User and tickets move through the agent queue,
the counts mislead her into thinking there's no work in motion.
The counts are also a noise tax Eli's spec explicitly rules
out: "the page reads in one glance" + "no noise" is the
adoption-meter goal.

**Fix (next iteration).** Remove the `stat-strip` from the
template, drop the `STAT_CARDS` / `statusCounts` /
`stat-strip`-related styles, and add a `data-testid="stat-strip"`
negative assertion to the existing `employee-dashboard-page`
spec.

**Next.** Push the Employee Dashboard stat-strip removal; ship
the other small text-alignment fixes; expand feature coverage
to Ticket Detail, Create Ticket, Admin Dashboard, Users tab,
Profile, Change Password, Register, Forgot Password, 404.

---

### Iteration 4 — dashboard fix shipped + agent kanban placeholder (commits `c0d76e7`, `a02f954`)

**Action.** Deployed the stat-strip removal; updated the
placeholder text on the Agent Kanban search input from
"Search…" to "Search queue…" per the wireframe. Hardened
`feature.spec.ts` selectors (target `input#filter-search` to
avoid the atom-input host/inner-input collision; wait for
first `ticket-row` to be visible before counting).

**Result.** 21/22 feature tests pass on live deployment. 7/7
smoke tests pass. 29 total tests green.

The remaining gap was a selector regex on the Agent Kanban
test (the live "Open"/"In Progress"/etc. labels are duplicated
as `<option>` inside the Status filter select, which Playwright
picked first as "hidden"). Fixed by targeting the column
headers as `heading[level=2]` instead.

**Result.** 22/22 feature tests pass after the kanban selector
fix.

**Live verification.**

- `/dashboard` (logged in as eli@company.com): no stat-strip.
  Renders the page heading "My Tickets" + Create Ticket
  primary button + a list of `ticket-row` elements. Matches
  the wireframe's "Default (with tickets)" frame.
- `/queue` (logged in as sam@company.com): "Queue" heading +
  filter strip with "Search queue…" placeholder + 4 columns
  (Open / In Progress / Resolved / Closed), each with cards.

**New feature tests added (iteration 4)**

- **Create Ticket** (4 tests) — renders the wireframe-listed
  fields (Title / Description / Category / Priority /
  Attachment), Submit disabled until Title + Description are
  filled, Cancel closes the form, valid submit lands on
  `/tickets/:id/created`.
- **Submission Confirmation** (1 test) — after a fresh submit,
  the page shows the wireframe-anchored signals: "Ticket
  created" headline, `#HD-#` ticket number, "Open" status chip,
  "View ticket" CTA, "Back to My Tickets" link.
- **Ticket Detail** (1 test) — employee can open their own
  ticket from the dashboard list and the page shows the
  back-to-dashboard link.
- **Admin Dashboard** (1 test) — admin lands on `/admin` and
  the page shows the "Dashboard" heading + Users tab.
- **404** (1 test) — unknown route renders the 404 page.

**Next.** Add the remaining feature tests (Profile, Change
Password, Forgot Password, Register, Users Tab, Forbidden),
expand to ticket lifecycle (status change / comment add /
reopen / close), and audit the ticket-detail wireframe
against the live page.

---

