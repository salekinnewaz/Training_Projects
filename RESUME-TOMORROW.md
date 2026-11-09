# RESUME — Admin Workspace rework (session `30945ab7`)

> **✅ This rework is COMPLETE as of Iteration 16 (2026-11-04), and
> Iteration 19 (2026-11-06) added the notification matrix.**
> The whole tree is green: **652/652 QA gate checks**, **610/610
> Angular unit tests**, **189/189 backend tests** (153 unit + 36
> integration), **145 Playwright E2E passed / 1 skipped / 0 failed**,
> both `tsc --noEmit` runs clean, and `npm run build` clean on both
> sides. Read **`HANDSOFF.md` → `## Iteration 16`** and
> **`## Iteration 19`** for the full write-ups: what changed, why, and
> the measurements.
>
> The one remaining job is **to commit** the working tree (§4).
>
> **Nothing is committed yet.** All of it is uncommitted working-tree
> state (see §4). That is intentional and expected — do **not**
> discard it.

---

## 0. The one-paragraph version

The Admin Dashboard was rebuilt as the "WDS-2026 Admin Workspace" — a
three-row widget grid (Priority Distribution / Users Overview / Ticket
Trends / Recent Tickets / Recent Users) replacing the old
Tickets-tab layout. It is now **functionally complete AND
geometrically complete**: the Users Overview card no longer overflows
its card, the stat strip no longer truncates, the Recent Tickets table
compresses, and all three "View all" links are live.

**Iteration 19 (2026-11-06)** then audited the notification rules for
all three roles, found three real gaps (Admins were never notified of
new tickets; nobody outside the ticket's owner was notified of
comments; status / priority / assignment changes emitted no
notification at all), and implemented the full matrix in a new
`backend/src/services/notificationService.ts`.

**Still uncommitted.** All of it is uncommitted working-tree state
(see §4). That is intentional and expected — do **not** discard it.

---

## 1. Where the work stands

### Environment (all currently running)

| Service | Status | Where |
|---|---|---|
| Frontend dev server | ✅ live | `http://localhost:4200` (`npm start` from `frontend/`) |
| Backend API | ✅ live | `http://localhost:3000` |
| Postgres | ✅ healthy | docker `helpdesk-lite-postgres`, port 5432 |
| Backend health check | ✅ `{"status":"ok"}` | `curl localhost:3000/api/health` |

Login for QA: `admin@company.com` / `password123` (admin), plus
`sam@`/`morgan@` (agents) and `eli@`/`jess@`/`noah@`/`priya@` (employees)
— all `password123`.

### The notification matrix (Iteration 19)

| Event | Recipients |
|---|---|
| `ticket_created` | every active Support Agent + every active Admin |
| `comment_added` (User author) | the ticket's assigned owner + every active agent + every active Admin |
| `comment_added` (staff author) | the submitter + the assigned owner + every active Admin |
| `ticket_status_changed` | the submitter + the assigned owner + every active Admin |
| `ticket_priority_changed` | the submitter + the assigned owner + every active Admin |
| `ticket_assigned` | the submitter + the new owner + the prior owner + every active Admin |

Two invariants: **the actor is never notified of their own action**,
and **the ticket submitter is notified of every activity on their own
ticket**. Inactive users are excluded throughout.

---

## 2. Open tasks — ALL RESOLVED

See `HANDSOFF.md` → `## Iteration 16` (the Admin Workspace rework)
and `## Iteration 19` (the notification matrix). Both are done and
logged.

| # | Status | Subject |
|---|---|---|
| 7 | ✅ done | Fix Users Overview card overflow at 1440px |
| 8 | ✅ done | Fix Users Overview legend percentage clipping at 1536 |
| 3 | ✅ done | Fix the stat strip's "Total Tickets" truncation at 1440px |
| 5 | ✅ done | Make the Recent Tickets table compress without truncating |
| 6 | ✅ done | Update the stale QA gates and Playwright tests |
| 9 | ✅ done | Add a QA gate for the Admin Workspace's layout invariants |
| 4 | ✅ done | Re-verify everything and log the iteration |
| — | ✅ done | **Notification matrix for all three roles** (Iteration 19) |

### Two things that will bite you again

**Karma must use `--browsers=ChromeHeadlessDesktop`.** Plain
`ChromeHeadless` defaults to a ~741px viewport, which trips the
stat-strip's responsive breakpoints and produces three phantom
geometry failures. The config's launcher (1440×900) is correct.

**The frontend suite hangs if the notifications poll runs under
test.** `NotificationsService.startPolling()` installs a `setInterval`,
and a pending interval keeps the zone's microtask queue non-empty, so
`await fixture.whenStable()` never resolves. There is now an
`isTestEnvironment()` guard that skips the recurring tick (the
leading-edge refresh still runs). Any page spec that renders the
chrome must provide `provideHttpClientTesting()` — otherwise the
bell's leading-edge fetch opens a real socket and Karma reports
"Disconnected, because no message in 30000 ms".

---

## 3. The performance problem (why the other terminal is slow)

**The other terminal is not hung — it is throttled.** Measured over
the session's 7.24h span:

- **Context grew to ~137k tokens** and compaction fired only **3
  times** (the 2-day-old session compacted 27 times). Every request
  re-reads a 137k-token context.
- **70% of wall-clock is waiting, not working** — 5.06h of the 7.24h
  span was gaps longer than 1 minute; 3.80h in gaps over 3 minutes.
  The worst single gap was **28 minutes**.
- **Screenshots are base64'd straight into the context.** The live
  session has **96 embedded base64 images = 7.7 MB** of raw base64;
  the two-day-old transcript has **807** (which is why it is 97 MB).
- The QA loop is a **pixel-peeping treadmill**: 69 test runs, 42
  "measure" passes, 31 screenshot reviews, 20 PNG ops, 13 compares,
  12 pixel ops, 10 Chrome launches — probing percentage-cell ink boxes
  at 3×/4×/6× zoom against reference shots.

### The fix, for whoever picks this up tomorrow

**Do not put PNGs in the context.** Have the QA scripts write their
metrics to a **JSON/text file** and read *that*. Comparing numbers is
~1 KB; comparing images is ~300 KB+ of base64 per shot. This single
change is worth more than everything else combined.

Also: batch the pixel checks — one Chrome launch that captures all
breakpoints at once, rather than 10+ separate launches.

**Prefer a fresh session** over resuming `30945ab7`. The context is
already 137k tokens; a new session starts near zero and is fast
immediately. This file + the task list above is the handoff.

---

## 4. Uncommitted state — do NOT discard

Branch `main`, tracking `origin/main`, **no commits yet**. Working tree:

**Modified:**

```
backend/src/controllers/adminController.ts
backend/src/docs/openapi.paths.ts
backend/src/docs/openapi.ts
backend/src/models/Notification.ts
backend/src/services/ticketService.ts
frontend/angular.json
frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.ts
frontend/src/app/components/atoms/select/select.component.ts
frontend/src/app/components/molecules/admin-hero/admin-hero.component.ts
frontend/src/app/components/molecules/admin-sidebar/admin-sidebar.component.ts
frontend/src/app/components/molecules/header-chrome/header-chrome.component.spec.ts
frontend/src/app/components/molecules/header-chrome/header-chrome.component.ts
frontend/src/app/components/molecules/stat-strip/stat-strip.component.ts
frontend/src/app/components/molecules/user-row/user-row.component.spec.ts
frontend/src/app/components/molecules/user-row/user-row.component.ts
frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.spec.ts
frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts
frontend/src/app/pages/submission-confirmation-page/submission-confirmation-page.component.spec.ts
frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts
frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts
frontend/src/app/pages/tickets-list-page/tickets-list-page.component.ts
frontend/src/app/pages/users-tab-page/users-page-shell.component.ts
frontend/src/app/pages/users-tab-page/users-tab-page.component.spec.ts
frontend/src/app/pages/users-tab-page/users-tab-page.component.ts
frontend/src/app/services/notifications.service.ts
frontend/src/styles.css
qa/scripts/README.md
qa/scripts/verify-admin-workspace.js
qa/scripts/verify-shared-table.js
qa/scripts/verify-stat-strip-roles.js
qa/tests/admin-users-tab.spec.ts
qa/tests/feature.spec.ts
qa/tests/fixtures.ts
qa/tests/users-regression.spec.ts
```

**Untracked — the new components and services (keep these!):**

```
backend/src/services/notificationService.ts
backend/test/integration/ticketNotifications.integration.spec.ts
frontend/src/app/components/atoms/donut-chart/
frontend/src/app/components/atoms/stacked-bar-chart/
frontend/src/app/components/molecules/admin-hero/
frontend/src/app/components/molecules/admin-sidebar/
backend/src/services/adminDashboardService.ts
qa/tests/notifications.spec.ts
```

Plus throwaway probe scripts in `qa/scripts/*.mjs` and `qa/*.cjs`
(gitignored `qa/225` is a stray PNG — delete it).

---

## 5. Where things live

| What | Path |
|---|---|
| Wireframes (source of truth) | `design-process/D-UX-Design/wireframes/*.svg` + `.png` + `.md` |
| QA loop log (append here) | `HANDSOFF.md` — last entry is **Iteration 19**, 2026-11-06 |
| Notification recipient rules | `backend/src/services/notificationService.ts` |
| Notification matrix tests | `backend/test/integration/ticketNotifications.integration.spec.ts` |
| Notification E2E tests | `qa/tests/notifications.spec.ts` |
| QA verify gates | `qa/scripts/verify-*.js` (7) |
| QA probe scripts | `qa/scripts/*.mjs` (one-off) |
| QA screenshots | `.qa-tmp/` (gitignored) |
| Playwright config/tests | `qa/playwright.config.ts`, `qa/tests/` |
| Live deployment | https://helpdesk-lite-tawny.vercel.app |

---

## 6. Housekeeping (optional, not urgent)

Also reclaimable: the dead two-day transcript
`92b1118f-7d00-498f-b9cc-b26ec3dc9f9f.jsonl` (97 MB) plus its 27
compaction subagent files. `~/.puku-cli` is currently **980 MB**.
Disk is fine (137 GB free), so this is optional.

---

## 7. First five actions tomorrow

**The work is done — the only thing left is to COMMIT it.** Steps
below assume you have not committed yet.

1. Read this file, then `git status` — confirm the tree matches §4.
2. **Commit the working tree.** It contains the whole Admin Workspace
   rework, the notification matrix, and the new components
   (`donut-chart/`, `stacked-bar-chart/`, `admin-hero/`,
   `admin-sidebar/`, `adminDashboardService.ts`,
   `notificationService.ts`) that are untracked and would be lost by a
   `git checkout .` or a `git clean`. Stage them **by name** — do not
   `git add -A`, or you will sweep in the throwaway probe scripts under
   `qa/scripts/_*.mjs` and `qa/*.cjs`.
3. Re-run the gates before committing:
   ```
   cd qa && for f in scripts/verify-*.js; do node "$f"; done
   cd ../frontend && npx ng test --watch=false --browsers=ChromeHeadlessDesktop
   cd ../backend && npm test
   cd .. && npm run typecheck && npm run build
   cd qa && BASE_URL=http://localhost:4200 npx playwright test
   ```
4. Update `PUKU.md`'s "Current work in progress" section if the
   commit lands, so the next session does not re-read this file
   expecting unfinished work.

**Throughout: keep screenshots on disk, keep them out of the context.**
