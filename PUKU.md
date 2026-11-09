# PUKU.md — project context for this repo

## Current work in progress

**There is an uncommitted working tree.** Before doing anything else,
read **`RESUME-TOMORROW.md`** — it is a full handoff snapshot: what was
built, what is broken, the exact open tasks, the measured reference
geometry, and the uncommitted-file inventory.

The **WDS-2026 Admin Workspace** (Admin Dashboard widget grid) rework
is now **functionally and geometrically complete** (Iteration 16 in
`HANDSOFF.md`): the Users Overview card no longer overflows its card,
the stat strip no longer truncates, and all three "View all" links are
live.

**Iteration 19 (2026-11-06)** added the **notification matrix** for
all three roles. The recipient rules now live in
`backend/src/services/notificationService.ts`; Admins are notified of
every ticket event, and the ticket submitter is notified of every
activity on their own ticket. See `HANDSOFF.md` → `## Iteration 19`.

It is still **uncommitted**, so the working tree below still matters.

**Do not discard the uncommitted working tree.** It contains new
untracked components (`donut-chart/`, `stacked-bar-chart/`,
`admin-hero/`, `admin-sidebar/`, `adminDashboardService.ts`,
`notificationService.ts`) that are not in git and would be lost.

## Standing rules for this repo

- `HANDSOFF.md` is the **QA loop log** — append every iteration to it
  as an `## Iteration N — <date> — <title>` section. `HANDOFF.md`
  (no "S") is the *developer* handoff; they are different documents.
- The frontend suite runs with
  `npx ng test --watch=false --browsers=ChromeHeadlessDesktop`.
  Plain `ChromeHeadless` defaults to a ~741px viewport, which trips
  the stat-strip's responsive breakpoints and produces three phantom
  geometry failures that are not real bugs.
- Any page spec that renders the shared chrome must provide
  `provideHttpClientTesting()`. Without it the bell's leading-edge
  fetch opens a real socket and Karma reports "Disconnected, because
  no message in 30000 ms".
- The reference wireframes in `design-process/D-UX-Design/wireframes/`
  are the source of truth for geometry. Measure against them; do not
  eyeball.
- The Admin Dashboard's grid tracks are pinned to **exact pixel**
  measurements from the 1536px reference, and its gutters are
  **deliberately unequal** (9px and 11px) — a single `gap` rounds them
  wrong. Preserve this when editing.
- A `minmax(floor, Xfr)` **floor above the Xfr share steals the
  difference from its neighbours.** Floors must sit *below* their own
  share, or the row lands on the wrong widths (497 / 327 / 380 became
  495 / 330 / 379).
- The stat strip is **one shared component** on all three roles
  (User / Support Agent / Admin). Only the *data scope* differs. Do not
  fork it per-role. Its ladder is a **container query** (1115px /
  683px), not a media query — the strip sits in a column whose width
  differs per role, so a viewport breakpoint cannot express it.
- QA verify gates live in `qa/scripts/verify-*.js` and run against the
  **live** dev server. Login `admin@company.com` / `password123`.
- The **frontend port is not fixed at 4200** — two IDEs run this
  project at the same time. Each session starts its own `ng serve`
  on a different port and points its QA at it via `BASE_URL`:
  ```
  BASE_URL=http://localhost:4300 node qa/scripts/verify-strip.js
  ```
  Gates default to `http://localhost:4200` when `BASE_URL` is unset.
  The **backend is shared** on `:3000` — its CORS allowlist covers
  `4200` and `4300` (see `FRONTEND_PORTS` in `backend/src/server.ts`).
  Start a second instance with `npm run start:alt` in `frontend/`.
- `.qa-tmp/` and `qa/225` are scratch — gitignored, safe to clear.

## Performance rule for QA work (important)

**Never read a screenshot PNG into the conversation.** The QA loop
previously base64'd 96 screenshots into one session's context (7.7 MB),
which is what made it crawl.

Instead: have the probe script write its measurements to a **JSON or
text file**, and read that file. Numbers are ~1 KB; a PNG is ~300 KB+ of
base64. Batch multiple breakpoints into a single Chrome launch.

