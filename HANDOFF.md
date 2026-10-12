# HANDOFF — HelpDesk Lite Project

> **Read this first** if you're picking up this project after a break.
> This is the single source of truth for *what was built, why, where it
> lives, and what's left.* All handoff-relevant detail lives here.
> Per-story specs, diffs, and the deferred-work log live under
> `_bmad-output/` (see the Index below).

**Last updated:** 2026-10-12
**Branch state:** `main` in sync with `origin/main`. Working tree clean.
**Test state:** Frontend **370/370 SUCCESS**, Backend **122/122 PASS**.
**Build state:** `ng build --configuration=production` exit 0.

---

## 1. TL;DR — Where We Are

The project is a 2-tier helpdesk system (Express + MySQL backend,
Angular 17 frontend) with a custom design system. **All 18 HD stories
(HD-005 → HD-018) ship; all 12 deferred-work items (D1 → D12) are
closed; all 5 design-fidelity slices from the UX audit are merged and
pushed.**

Nothing is half-done. Nothing is missing against the original plan.
The only "warnings" left are:

- Two pre-existing per-component-style budget warnings on
  `agent-kanban-page` (2.25 kB) and `ticket-detail-page` (3.82 kB)
  vs the 2 kB soft cap. Build still exits 0; the 4 kB hard limit
  is respected.
- A `console.warn` tripwire fires twice in the test run (intentional
  — D5 makes silent field drops loud).

---

## 2. The Project at a Glance

```
Training_Projects/
├── backend/                  # Express + MySQL, TypeScript, Jest
│   ├── src/
│   │   ├── controllers/      # auth, tickets, users, admin, attachments
│   │   ├── services/         # ticketService, userService, authService…
│   │   ├── routes/           # /api/auth, /api/tickets, /api/users…
│   │   ├── middleware/       # auth, errorHandler, rateLimit (D4)
│   │   ├── models/           # Sequelize: User, Ticket, Comment…
│   │   ├── utils/            # errors, validation, jwt
│   │   └── docs/             # OpenAPI spec
│   ├── test/
│   │   ├── unit/             # 118 unit tests
│   │   └── integration/      # 4 createTicket integration tests
│   ├── docker/               # mysql-init
│   ├── jest.config.js        # projects: [unit, integration]
│   └── package.json
├── frontend/                 # Angular 17 standalone, signal-based
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── atoms/         # 13 atoms (button, input-text, link, …)
│   │   │   │   │   └── index.ts   # D6 barrel re-exports
│   │   │   │   ├── molecules/     # 9 molecules (dialog-modal, form-field, …)
│   │   │   │   │   └── index.ts   # D6 barrel re-exports
│   │   │   │   ├── organisms/     # file-drop
│   │   │   │   └── patterns/      # app-chrome, loading-skeleton
│   │   │   ├── pages/             # one folder per page route
│   │   │   ├── services/          # auth, ticket, user, attachment
│   │   │   ├── guards/            # authGuard, roleGuard, loginGuard
│   │   │   ├── interceptors/      # authInterceptor
│   │   │   ├── models/            # user, ticket, comment
│   │   │   └── app.routes.ts
│   │   ├── environments/      # environment.ts (dev) + environment.prod.ts (D3)
│   │   ├── styles.css         # design tokens (DESIGN.md palette)
│   │   └── index.html         # Google Fonts preconnect
│   ├── angular.json           # fileReplacements for prod (D3)
│   └── package.json
├── _bmad-output/             # ALL the project documentation
│   ├── implementation-artifacts/  # per-story specs, deferred-work log
│   ├── planning-artifacts/        # architecture, ADRs, WDS plan
│   ├── brainstorming/             # early ideas
│   ├── d*.diff                    # per-deferred-item diff snapshots
│   └── hd*.diff                   # per-story diff snapshots
├── HANDOFF.md                # this file
├── DESIGN.md                 # color palette, typography, component spec
├── WDS_Planning_UX.md        # web-design-system plan
└── README.md
```

---

## 3. Test & Build Cheat Sheet

```bash
# Backend
cd backend
npm test                    # 122 tests (118 unit + 4 integration)
npm run test:unit           # unit only (Jest "unit" project)
npm run test:integration    # integration only (needs Docker MySQL)
npm run typecheck           # tsc --noEmit
npm run build               # tsc

# Frontend
cd frontend
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox   # 370 tests
npx ng build --configuration=production                       # prod build
npx ng build                                                  # dev build
```

---

## 4. The 18 HD Stories — Index

Each row links to its spec in `_bmad-output/implementation-artifacts/`.
All stories are **shipped + tested + on `main`**.

| Story | Title | Spec | What it built |
|---|---|---|---|
| HD-005 | Login form | `spec-hd-005-login-form.md` | Login page, form validation, 401/400/network error UX, password visibility toggle, roleHomePath redirect |
| HD-006 | Route guards | `spec-hd-006-route-guards.md` | `authGuard`, `roleGuard`, `loginGuard`; deep-link `return_to`; `/forbidden` page |
| HD-007 | Employee dashboard | `spec-hd-007-employee-dashboard.md` | My-tickets list, loading + empty + error states, 4-card stat strip (Slice B) |
| HD-008 | Create ticket | `spec-hd-008-create-ticket.md` | Reactive form, file-drop upload (later via HD-016), category helper text (Slice B) |
| HD-009 | Submission confirmation | `spec-hd-009-submission-confirmation.md` | `HD-N` number display, chrome wrap (closed D11) |
| HD-010 | Ticket detail | `spec-hd-010-ticket-detail.md` | Status / priority / assignee / timeline + comments, 7 system-error toasts auto-dismiss 5s (Slice D) |
| HD-011 | Comments + activity polish | `spec-hd-011-comments-activity-polish.md` | Comment composer, optimistic UI, activity log |
| HD-012 | Agent kanban | `spec-hd-012-agent-kanban.md` | 4-column board, drag-drop + keyboard fallback (Slice D), status filter (Slice B) |
| HD-013 | Admin dashboard | `spec-hd-013-admin-dashboard.md` | Admin landing page, ticket volume breakdown |
| HD-014 | Users tab | `spec-hd-014-users-tab.md` | Per-user row, role select, active toggle, isSelf/isUpdating states |
| HD-015 | Swagger / OpenAPI | `spec-hd-015-swagger.md` | Generated `/api/docs`, schema validation tests |
| HD-016 | Attachments | `spec-hd-016-attachments.md` | Upload + download endpoints, frontend file-drop wiring, 10 MB cap, mimetype allowlist (closed D8) |
| HD-017 | Comments write path | `spec-hd-017-comments-write-path.md` | Refetch activity after addComment, race-condition fix |
| HD-018 | Password change | `spec-hd-018-password-change.md` | Settings page, current + new + confirm, re-login after success |

---

## 5. The 12 Deferred-Work Items (D1–D12) — All Closed

Full table in `_bmad-output/implementation-artifacts/deferred-work.md`.
Status snapshot:

| ID | Topic | Closed by | Commit |
|---|---|---|---|
| D1 | No test harness for atoms | D1 slice | pre-D1 |
| D2 | No tests for LoginPageComponent | D1 slice (rolled in) | pre-D1 |
| D3 | `environment.prod.ts` missing | D3 slice | `5cc58d3` |
| D4 | No 429 `rate_limited` handler | D4 slice (backend + frontend) | `b8703eb` |
| D5 | `asFieldMap` drops `string[]` silently | D5 tripwire (console.warn) | `e24de7e` |
| D6 | No barrel `index.ts` for components | D6 slice | `437f328` |
| D7 | `dialog-modal` hand-rolls `.btn-*` | D7 slice (uses `<atom-button>`) | `de99d5c` |
| D8 | Attachment upload endpoint | HD-016 | `5e3c3d5` |
| D9 | Backend integration test for createTicket | D9 slice (Jest projects split) | in `d9.diff` |
| D10 | `roleGuard` redirects on cold load | D10 fix (await refreshUser) | in `d10.diff` |
| D11 | Submission page missing chrome wrap | HD-009 | `b4736a6` |
| D12 | `apiErrorFrom` double-wrap bug | D12 fix (short-circuit ApiError) | in `d12.diff` |

The file `_bmad-output/implementation-artifacts/deferred-work.md` is
append-only. **Do not edit rows in place** — the convention is
"Closed by X slice" in the Notes column, and a reference to the
spec doc + commit. New findings get a new row at the bottom.

---

## 6. The 5 Design-Fidelity Slices (UX Audit Closure) — All Shipped

Triggered by a deep-dive audit comparing the implementation to
`DESIGN.md` and the wireframes. All 5 landed in a single working
session on 2026-10-12.

| Slice | Title | Commit | Key changes |
|---|---|---|---|
| A | Color palette + typography | `5218b7f` | Google Labs palette (`#2563EB`); Inter + JetBrains Mono via Google Fonts; 3 spec stability fixes for portaled dialog teardown |
| B | 8 wireframe-element gaps | `3e49601` | "Remember me" + "Register" + "Sign in" on login; 4-card stat strip on employee dashboard; required asterisks + helper text on create-ticket; status filter + view-list on kanban; breadcrumb + back link on ticket-detail; container widths 1280/480; top-bar 56px |
| C | Status pill icon glyphs | `035a081` | SVG glyphs: filled circle (Open), play triangle (In Progress), checkmark (Resolved), X (Closed); 8×8 viewBox, currentColor, `aria-hidden` |
| D | Error-toast + drag-drop keyboard | `3245fab` | 5s auto-dismiss on agent-kanban + ticket-detail (7 sites); keyboard move mode: M opens, 1-4/arrows pick target, Enter commits, Esc cancels; aria-live announcements |
| E | Close D7 | `2dd1cc1` | `dialog-modal` → `<atom-button>`; `ButtonComponent.focus()` method; `.btn-primary`/`.btn-secondary` hand-rolled styles removed |

---

## 7. Architectural Patterns Worth Knowing

These are the conventions the codebase has converged on. New code
should follow them.

### Frontend

- **Standalone components only.** No NgModules. Routes are loaded
  via `loadComponent` in `app.routes.ts`.
- **Signal-based inputs** (`input.required<T>()`,
  `input<T>(default)`) — not `@Input()` decorators.
- **Signal-based outputs** still use `@Output()` + `EventEmitter`
  for now. When the spec count gets noisy, migrate to
  `output<T>()`.
- **OnPush change detection** on every component.
- **`viewChild`/`viewChildren` signal API**, not `@ViewChild`.
- **Atoms use `display: contents`** on `:host` so the host element
  is invisible to layout.
- **CSS custom properties** for all design tokens. No hard-coded
  hex in component styles. See `styles.css` `:root` block.
- **TestBed uses real Router** via `provideRouter([])` when the
  component imports `<atom-link>` (which wraps `RouterLink`,
  which subscribes to `Router.events$` in its constructor).
  Stubbing `Router` via `useValue` breaks this.
- **AuthService stub for page tests** needs `user$` as a real
  `BehaviorSubject` (not a plain object) because `<app-chrome>`
  → `<header-chrome>` subscribes to it. Stub also needs
  `refreshUser: () => Promise.resolve()` and
  `logout: () => Promise.resolve()`.

### Backend

- **HttpError class** is the only way to send a non-200 from a
  controller. `errorHandler` middleware serializes the standard
  envelope: `{ error, message, fields? }`. Don't `res.status(401).json(…)`
  by hand.
- **ApiErrorCode is the wire vocabulary.** New error codes go in
  `frontend/src/app/services/api-error.ts` (union + status mapping
  in `mapStatusToCode`) and the login page's `applyApiError` switch.
- **Rate limiting** (D4) is per-IP, in-memory, 10 attempts per
  15 minutes on `POST /api/auth/login`. `skipSuccessfulRequests: true`
  so legitimate logins don't burn budget. For multi-instance prod,
  swap to a Redis store — flagged in code comment.
- **Jest projects** (D9): `npm test` runs both `unit` and
  `integration` projects. Integration needs a real MySQL container
  on `localhost:3306` with the `helpdesk_lite_test` DB seeded
  (see `docker/mysql-init/01-helpdesk_lite_test.sql`).

### Cross-cutting

- **No new dev dependencies** without a deferred-work row
  justifying it. The 5 design-fidelity slices shipped with zero
  new npm packages.
- **Append-only `deferred-work.md`.** Add rows at the bottom;
  mark old rows "Closed by X slice" in the Notes column.
- **Per-slice artifacts**: every non-trivial slice produces
  1) a spec doc (`spec-d{N}-{slug}.md`), 2) a diff snapshot
  (`_bmad-output/d{N}.diff`), and 3) one or more commits.
  Existing slices (D9, D10, D12) set the pattern.

---

## 8. Where to Look If You Need to…

| Need | Go to |
|---|---|
| Understand what HD-N was supposed to do | `_bmad-output/implementation-artifacts/spec-hd-{NNN}-{slug}.md` |
| See the wireframes referenced by the design | `_bmad-output/brainstorming/` + the WDS plan |
| Understand why a deferred item was filed | `_bmad-output/implementation-artifacts/deferred-work.md` (Notes column) |
| See the actual code change for a deferred item | `_bmad-output/d{N}.diff` + the git log entry |
| Add a new error code to the API | `frontend/src/app/services/api-error.ts` (union + mapStatusToCode) + `backend/src/utils/errors.ts` (HttpError class) + `login-page.component.ts` `applyApiError` switch |
| Add a new atom | `frontend/src/app/components/atoms/{name}/{name}.component.ts` + re-export from `index.ts` (D6 barrel) |
| Add a new molecule | Same as atom, under `molecules/` |
| Add a new page | `frontend/src/app/pages/{name}/{name}.component.ts` + lazy route in `app.routes.ts` |
| Run just the create-ticket integration test | `cd backend && npx jest --selectProjects integration` |
| Add an integration test | `backend/test/integration/{name}.integration.spec.ts` — uses `test/integration/setup.ts` for DB bootstrap |
| See the design tokens | `frontend/src/styles.css` `:root` block — palette per DESIGN.md |
| See all design decisions | `_bmad-output/planning-artifacts/` |

---

## 9. The Audit Story (How We Got to "Done")

This is the chronological arc so a new contributor understands the
shape of the work that was already done, not just the end state.

1. **HD-001 → HD-018 (the 18 stories)**: feature work, one story
   per slice, each with spec + diff + commit. Spans roughly the
   full calendar arc of the project.

2. **D1–D12 deferred-work cleanup pass**: each finding from
   `deferred-work.md` was either closed by a later HD story
   (e.g. D8 closed by HD-016, D11 closed by HD-009) or by a
   dedicated slice (D3, D4, D5, D6, D7, D9, D10, D12). All
   closed by 2026-10-12.

3. **Baseline test-fix pass** (commit `f2bc100`): 7 pre-existing
   frontend test failures (3 employee-dashboard, 3 forbidden-page,
   1 user-row) were diagnosed as (a) AuthService stubs missing
   `user$` BehaviorSubject + `refreshUser`/`logout`, (b) stubbed
   Router breaking `<atom-link>` which needs the real Router's
   `events$` Observable, (c) hard-coded ISO date in user-row spec
   drifting with wall-clock time. Fix: `provideRouter([])` +
   `spyOn(router, 'navigate')` + `new Date(Date.now() - 2*86400000).toISOString()`.
   After fix: 354/354 SUCCESS.

4. **UX-fidelity audit pass** (2026-10-12): a deep-dive comparing
   the implementation to `DESIGN.md` and the wireframes surfaced
   gaps in (a) color palette (Bootstrap dark vs Google Labs blue),
   (b) typography (Inter + JetBrains Mono not loaded),
   (c) status pill iconography, (d) container widths + top-bar
   height, (e) 8 missing wireframe elements (Remember me, Register,
   stat cards, asterisks, status filter, breadcrumb, back link,
   etc.), (f) error-toast no auto-dismiss, (g) drag-drop no
   keyboard fallback. Resolved via the 5 design-fidelity slices
   (Slices A–E above), all shipped in a single session via 5
   parallel background agents.

5. **Final verification** (this state): frontend 370/370,
   backend 122/122, prod build exit 0, working tree clean,
   `origin/main` in sync.

---

## 10. Known Footguns

These are the failure modes that already bit us once. They will
bite again if forgotten.

1. **`<atom-link>` needs a real Router.** A `useValue: {…}`
   Router stub has no `events$` Observable, so `RouterLink`'s
   constructor throws or hangs. Always use
   `provideRouter([])` in tests that import a page using
   `<atom-link>` (which is most pages via `<app-chrome>`).

2. **AuthService stub needs `user$` as a real Observable.**
   `<app-chrome>` → `<header-chrome>` subscribes to it on mount.
   A plain object stub silently never emits, and the header
   renders the unauthenticated shell.

3. **Hard-coded ISO dates in specs drift.** Use
   `new Date(Date.now() - 2*24*60*60*1000).toISOString()` for
   "2 days ago" or any relative timestamp. The user-row test
   was the first casualty.

4. **Portaled dialog modals leak across specs.** Slice A
   discovered the Jasmine HTML reporter's `afterAll` was crashing
   on `appendChild` of a null node because earlier specs had
   portaled dialog markup lingering in `document.body`. Fix is
   `document.body.innerHTML = ''` in `beforeEach`/`afterEach` of
   any spec that opens a dialog (dialog-modal, header-chrome
   logout-confirm, users-tab-page).

5. **`apiErrorFrom` is now idempotent (D12).** A pre-D12 code
   path that did `throw apiErrorFrom(err)` after the
   authInterceptor already wrapped the error as `ApiError` would
   silently drop the `errorCode`. Don't reintroduce that pattern.

6. **The `console.warn` tripwire in `asFieldMap` is intentional
   noise.** Two `WARN: '[api-error] dropping non-string field…'`
   lines during the test run are the D5 tripwire firing on test
   fixtures that intentionally include non-string field values.
   Don't suppress them — they're the regression detector.

7. **Prod env swap.** D3 added `fileReplacements` to
   `angular.json`'s production configuration. The dev
   configuration still uses `environment.ts` (with
   `apiBaseUrl: 'http://localhost:3000'`). A regression here
   would let the dev URL leak into the prod bundle — `grep -r
   'localhost:3000' dist/frontend/browser/` should return zero
   matches after `ng build --configuration=production`.

8. **`atom-button` has a public `focus()` method.** This was
   added for D7's dialog-modal auto-focus. Don't refactor the
   inner `<button>` away without preserving the `viewChild` ref.

---

## 11. Resume Protocol

If you're picking this up after time away:

1. Read this file end-to-end.
2. Skim `_bmad-output/implementation-artifacts/deferred-work.md`
   (it's a 12-row table) — confirm nothing is "Open".
3. `git pull origin main` to make sure you're at HEAD.
4. `cd backend && npm test` and
   `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   to confirm green baselines.
5. If a task is in flight, the new work goes in
   `_bmad-output/implementation-artifacts/spec-{slug}.md` +
   a `_bmad-output/{slug}.diff` snapshot + commits on `main`.
   Add new deferred findings as a new row at the bottom of
   `deferred-work.md`.

---

## 12. Open Questions / Future Work (None Active)

There are no in-flight or blocked items. The next "real" work
would be a new HD story (HD-019+) or a new audit pass. The
infrastructure for both is in place — see the patterns in
section 7.

If a user reports a bug, the first move is to:

1. Reproduce it.
2. Decide: code bug, or new design finding?
3. If code bug: fix + test in the existing spec file, commit
   on `main`.
4. If design finding: add a row to `deferred-work.md` and
   either ship a slice in the same session or schedule it
   for the next pass.

That's the whole project. Welcome back.
