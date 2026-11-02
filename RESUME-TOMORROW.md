# RESUME — Admin Workspace rework (session `30945ab7`)

> **Read this first.** It is a snapshot of the other terminal's puku-cli
> session, taken at **2026-11-02 20:25 +06**. The session is still
> running (PID 47174, 7h19m elapsed). This file exists so a *fresh*
> session tomorrow can pick the work up without re-deriving it.
>
> The original session transcript is preserved at:
> `~/.puku-cli/projects/-Users-bs00902-Documents-Training-Projects-Training-Projects/30945ab7-dafc-4457-b597-149ff008391e.jsonl`
> (13.7 MB). You can resume it directly with
> `puku-cli --resume 30945ab7-dafc-4457-b597-149ff008391e`.

---

## 0. The one-paragraph version

The Admin Dashboard was rebuilt as the "WDS-2026 Admin Workspace" — a
three-row widget grid (Priority Distribution / Users Overview / Ticket
Trends / Recent Tickets / Recent Users) replacing the old
Tickets-tab layout. The build is **functionally complete** (22/22
Angular unit tests pass, backend + Playwright were green as of
Iteration 14). What is **not** done is *responsive geometry*: the grid
tracks are pinned to the reference's 1536px pixel measurements, so at
narrower viewports the Users Overview card's contents overflow their
card and the stat strip truncates. That rework — the open tasks below —
is what the other terminal was doing when it was captured.

**Nothing is committed.** All of it is uncommitted working-tree state
(see §4). That is intentional and expected — do **not** discard it.

---

## 1. Where the work stands

### Environment (all currently running)

| Service | Status | Where |
|---|---|---|
| Frontend dev server | ✅ live | `http://localhost:4200` (PID 88564, `ng serve --port 4200`) |
| Backend API | ✅ live | `http://localhost:3000` (PID 61703, child of watcher 40670) |
| Postgres | ✅ healthy | docker `helpdesk-lite-postgres`, port 5432 |
| Backend health check | ✅ `{"status":"ok"}` | `curl localhost:3000/api/health` |

Login for QA: `admin@company.com` / `password123` (admin), plus
`sam@`/`morgan@` (agents) and `eli@`/`jess@`/`noah@`/`priya@` (employees)
— all `password123`.

### The live session's last action

Its final tool call was a **Chrome fixed-layout table experiment**
written to `.qa-tmp/table-exp.mjs`, measuring how the Recent Tickets
table's columns shrink as the card narrows. Result:

```
card 816 → cols [107,228,108,100,160,113]  sum 816
card 780 → cols [107,192,108,100,160,113]  sum 780
card 722 → cols [107,134,108,100,160,113]  sum 722
card 660 → cols [107, 72,108,100,160,113]  sum 660
card 622 → cols [107, 34,108,100,160,113]  sum 622
card 574 → cols [107,  0,108,100,160,113]  sum 588   ← overflows by 14px
card 500 → cols [107,  0,108,100,160,113]  sum 588   ← overflows by 88px
```

**Read:** the table has `table-layout: fixed` with a **fixed 107px
first column** and fixed 108/100/160/113px columns. Only the *second*
column (the title) flexes — and it hits zero at ~574px, after which the
table's fixed columns alone exceed the card and it clips. **That is the
bug task #5 is about.** The fix is to convert the fixed pixel columns
to percentages matching the reference's proportions.

---

## 2. Open tasks (from the session's task store)

These live in `~/.puku-cli/tasks/30945ab7-.../`. Reproduced here so a
fresh session can recreate them.

| # | Status | Subject |
|---|---|---|
| 7 | 🔵 **in_progress** | Fix Users Overview card overflow at 1440px |
| 8 | 🔵 **in_progress** | Fix Users Overview legend percentage clipping at 1536 |
| 3 | ⚪ pending | Fix the stat strip's "Total Tickets" truncation at 1440px |
| 5 | ⚪ pending | Make the Recent Tickets table compress without truncating |
| 6 | ⚪ pending | Update the stale QA gates and Playwright tests for the Admin Workspace |
| 9 | ⚪ pending | Add a QA gate for the Admin Workspace's layout invariants |
| 4 | ⚪ pending | Re-verify everything and log the iteration |

### Task #7 — Users Overview overflow *(in progress)*

The card's legend/divider/roles blocks are **absolutely positioned at
`left: 166px; width: 195px`**, so the card needs 396px of interior
width — but the `1fr` third track only yields 396px at a 1536px
viewport.

- at 1440 the card is 300px → **82px overflow**
- at 1366 the card is 226px → **156px overflow**

The session's last thinking considered three options and had **not
chosen**:

- **A** — pin the UOV track to a fixed 396px, let Recent Tickets absorb
  the shrinkage.
- **B** — make the UOV interior responsive: donut shrinks, legend
  re-proportions at narrower widths.
- **C** — give the whole Admin Workspace a minimum content width and
  let the page scroll horizontally below it.

The session leaned toward **B/C** ("keep the reference's geometry, and
let it scroll/scale rather than squash" per the design-system
doctrine), and had also floated "stack the donut above the legend
below ~1400px". **This decision is still open — make it first.**

Relevant CSS — `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts`:

- `.users-overview .legend` → `left:166px; top:21px; width:195px` (line ~899)
- `.users-overview .divider` → `left:166px; top:134px; width:195px` (line ~929)
- `.users-overview .legend.roles` → `left:166px; top:152px; width:195px` (line ~939)
- `.users-overview .legend .legend-row` → `grid-template-columns: 13px 30px 120px 32px` (line ~920)
- `.users-overview .legend.roles .role-cell` → same 4-column grid (line ~949)

### Task #8 — legend percentage clipping at 1536

The `pct` column is **32px** wide but `"87.5%"` needs **36px**, so the
percentage is clipped *even at the reference width*. Measured ink
bounds:

- Reference: pct ink runs `card+344 .. card+377` (19px clear of the
  card's 396px right edge).
- Live: pct ink runs `350 .. 385.8` — it collides with the card's 20px
  right padding, and `scrollWidth 36 > clientWidth 32` confirms the
  clip.

Fix: widen the `pct` track from 32px to ~36px and re-derive the
preceding columns so the row still totals 195px.

### Task #3 — stat strip "Total Tickets" truncation at 1440

The Total card's label box is `card-width − 91px` inset, so at a
240px card the 73px "Total Tickets" ink does not fit and ellipsises to
`"Total Tic..."`. The reference's Total card is **261px** wide — give
it that width and let the status cards share the remainder.

### Task #5 — Recent Tickets table compress

See the experiment table in §1. Convert fixed pixel columns to
percentages matching the reference's proportions.

### Task #6 — stale QA gates & Playwright tests

- `verify-stat-strip-roles.js` **times out on `/admin`** — the admin's
  strip is now the "stacked" variant (90px cards, different `testid`).
- `verify-shared-table.js` expects the admin to render the shared
  ten-column table, which the redesign replaced with its own Recent
  Tickets widget.
- `qa/tests/feature.spec.ts` still asserts the old Admin Tickets-tab
  design → **13 failures**.
- `qa/tests/admin-users-tab.spec.ts` hardcodes user ids `1` and `8`.

### Task #9 — new gate: `qa/scripts/verify-admin-workspace.js`

Asserts: the widget grid keeps its reference geometry at 1536; no
card's content escapes its card at **1536/1440/1366/1280/1200/1100**;
the stat strip's cards render the reference's labels; the Recent
Tickets table **scrolls inside** its card rather than clipping.
*(This file does not exist yet.)*

### Task #4 — re-verify & log

Run all six QA gates + the new one, Angular unit tests, backend unit +
integration, `tsc --noEmit`, `ng build`, Playwright E2E. Then log the
iteration in `HANDSOFF.md` and commit.

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
immediately. This file + the task list above are the handoff.

---

## 4. Uncommitted state — do NOT discard

Branch `main`, tracking `origin/main`, **no commits yet**. Working tree:

**Modified (17 files, +3678 / −1093):**

```
backend/src/controllers/adminController.ts          |  63 +
backend/src/docs/openapi.paths.ts                   |  96 ++
backend/src/docs/openapi.spec.ts                    |  11 +-
backend/src/models/Ticket.ts                         |   8 +-
backend/src/routes/admin.ts                         |   7 +-
backend/src/seeders/20260915000000-demo-data.js     | 441 ++++-
backend/src/seeders/20260915000001-notifications-demo.js | 73 +-
frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.ts | 3 +-
frontend/src/app/components/molecules/header-chrome/header-chrome.component.spec.ts | 30 +-
frontend/src/app/components/molecules/header-chrome/header-chrome.component.ts | 120 +-
frontend/src/app/components/molecules/stat-strip/stat-strip.component.ts | 400 ++-
frontend/src/app/patterns/app-chrome/app-chrome.component.ts | 18 +-
frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.spec.ts | 887 ++--
frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts | 1699 ++-
frontend/src/app/services/ticket.service.ts          |  94 +
frontend/src/index.html                              |  21 +
frontend/src/styles.css                              | 800 ++
```

**Untracked — the new components (keep these!):**

```
frontend/src/app/components/atoms/donut-chart/
frontend/src/app/components/atoms/stacked-bar-chart/
frontend/src/app/components/molecules/admin-hero/
frontend/src/app/components/molecules/admin-sidebar/
backend/src/services/adminDashboardService.ts
backend/src/migrations/20260915000008-ticket-priority-nullable.js
backend/scripts/run-seeder.cjs
```

Plus ~380 throwaway probe scripts in `qa/scripts/*.mjs` and
`qa/*.cjs` (gitignored `qa/225` is a stray PNG — delete it).

---

## 5. Where things live

| What | Path |
|---|---|
| Wireframes (source of truth) | `design-process/D-UX-Design/wireframes/*.svg` + `.png` + `.md` |
| QA loop log (append here) | `HANDSOFF.md` — last entry is **Iteration 14**, 2026-10-24 |
| QA verify gates | `qa/scripts/verify-*.js` (6 existing) |
| QA probe scripts | `qa/scripts/*.mjs` (~380 one-off) |
| QA screenshots | `.qa-tmp/` (gitignored, 51 MB, 75 PNGs) |
| Playwright config/tests | `qa/playwright.config.ts`, `qa/tests/` |
| Live deployment | https://helpdesk-lite-tawny.vercel.app |
| Admin dashboard spec | `frontend/.../admin-dashboard-page.component.spec.ts` (22 tests, all passing) |

### Reference geometry (measured, 1536px viewport)

Row 2 — Recent Tickets | 10px gutter | Users Overview:
```
grid-template-columns: minmax(0,818px) minmax(0,10px) minmax(0,1fr);
```
Row 3 — three cards with **unequal** gutters (9px and 11px — a single
`gap` rounds them wrong):
```
grid-template-columns: minmax(0,497px) minmax(0,9px)
                        minmax(0,327px) minmax(0,11px)
                        minmax(0,1fr);
```
Below 1200px both rows collapse to a single column
(`@media (max-width: 1200px)`).

---

## 6. Housekeeping (optional, not urgent)

Two **truly orphaned** backend watchers — no child server, holding no
port, just file-watching:

| PID | Started | Why it's dead |
|---|---|---|
| 61248 / 61267 | Oct 31 23:57 | `tsx watch` with no server child |
| 68596 / 68616 | Nov 2 13:50 | `npm run dev` with no server child |

```bash
kill 61248 61267 68596 68616
```

> ⚠️ **Do NOT kill 40651 / 40670** — those are the *parent* of the live
> `:3000` server (PID 61703). Killing them takes the API down.

Also reclaimable: the dead two-day transcript
`92b1118f-7d00-498f-b9cc-b26ec3dc9f9f.jsonl` (97 MB) plus its 27
compaction subagent files. `~/.puku-cli` is currently **980 MB**.
Disk is fine (137 GB free), so this is optional.

---

## 7. First five actions tomorrow

1. Read this file, then `git status` — confirm the tree matches §4.
2. **Decide task #7's approach (A / B / C)** — everything else depends
   on it. Nothing has been implemented yet for #7.
3. Implement #8 (widen pct track 32→36px), #3 (Total card → 261px),
   #5 (table columns → percentages).
4. Write `qa/scripts/verify-admin-workspace.js` (task #9) and update
   the stale gates + Playwright specs (task #6).
5. Run everything, append **Iteration 15** to `HANDSOFF.md`, commit.

**Throughout: keep screenshots on disk, keep them out of the context.**
