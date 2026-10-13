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

