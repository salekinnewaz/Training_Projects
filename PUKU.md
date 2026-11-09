# PUKU.md — project context for this repo

## Current work in progress

**The working tree is clean and everything is published.** The
Admin Workspace rework and the notification matrix are **committed**
(`b6bea8d`) and **pushed** to `origin/main` (`d21256b..b6bea8d`).

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

**Iteration 20 (2026-11-09)** committed all of it, deployed to Vercel
(via the project's git integration — `git push origin main` is enough),
and **repaired the production Neon schema**: the `notifications` table
had never been created on prod, so `/api/notifications` and
`POST /api/tickets` were 500ing in production. Two migrations
(`...07-create-notifications`, `...08-ticket-priority-nullable`) are
now applied to Neon. See `HANDSOFF.md` → `## Iteration 20`.

**Iteration 21 (2026-11-09)** fixed the last production 500:
`POST /api/attachments` was failing because the Vercel serverless
filesystem is **read-only** (`/var/task` → EROFS) and the storage
backend wrote there. Attachment bytes now go to a **private Vercel Blob
store** on production (`ATTACHMENT_STORAGE_BACKEND=blob`), selected
through the existing storage interface in
`backend/src/utils/attachmentStorage.ts`. The app **refuses to boot**
on Vercel with the `fs` backend, so a missing env var fails loudly
instead of silently breaking uploads. The upload cap is env-derived —
**4 MB in production** (Vercel rejects bodies over 4.5 MB before the
app sees them), 10 MB locally. See `HANDSOFF.md` → `## Iteration 21`.

`RESUME-TOMORROW.md` is now **stale** on the "uncommitted working
tree" and "the only job left is to commit" points — the tree is clean
and the work is published. Treat its §4 inventory and §7 action list
as historical.


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

