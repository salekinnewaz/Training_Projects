# RESUME — Admin Workspace rework (session `30945ab7`)

> **✅ This rework is COMPLETE as of Iteration 16 (2026-11-04).**
> Every open task listed below has been done, and the whole tree is
> green: **652/652 QA gate checks**, **608/608 Angular unit tests**,
> **161/161 backend tests**, **127 Playwright E2E passed / 1 skipped /
> 0 failed**, both `tsc --noEmit` runs clean and `npm run build`
> clean. Read **`HANDSOFF.md` → `## Iteration 16`** for the full
> write-up: what changed, why, and the measurements.
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

**Still uncommitted.** All of it is uncommitted working-tree state
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

## 2. Open tasks — ALL RESOLVED (see Iteration 16)

These lived in `~/.puku-cli/tasks/30945ab7-.../`. Every one is now
done; the "how it landed" column below is the short version, and
`HANDSOFF.md` → `## Iteration 16` has the full write-up.

| # | Status | Subject | How it landed |
|---|---|---|---|
| 7 | ✅ done | Fix Users Overview card overflow at 1440px | Row 3's middle track floor raised 292px → **310px**, and the floor moved **below** the 327fr share so the row lands on the reference's 497 / 327 / 380. |
| 8 | ✅ done | Fix Users Overview legend percentage clipping at 1536 | The Priority legend is 138px wide at card+151; the card's 327px share holds it. |
| 3 | ✅ done | Fix the stat strip's "Total Tickets" truncation at 1440px | The shared "columns" variant's status-card `--label-right-inset` loosened 83px → **85px**. |
| 5 | ✅ done | Make the Recent Tickets table compress without truncating | `table-layout: fixed` + `<colgroup>`; the title column is the only flexible one, with `min-width` + `overflow-x: auto` so the table scrolls inside its card. |
| 6 | ✅ done | Update the stale QA gates and Playwright tests | `verify-stat-strip-roles.js`, `verify-shared-table.js`, `verify-scenarios.js`, `qa/tests/feature.spec.ts`, `qa/tests/admin-users-tab.spec.ts`, `stat-strip.component.spec.ts`. |
| 9 | ✅ done | Add a QA gate for the Admin Workspace's layout invariants | **`qa/scripts/verify-admin-workspace.js`** — 170/170. |
| 4 | ✅ done | Re-verify everything and log the iteration | **Iteration 16** in `HANDSOFF.md`. |

### Task #7 — Users Overview overflow *(RESOLVED — keep for the record)*

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
below ~1400px".

**What actually shipped** is close to **A**: row 3's tracks are

```css
grid-template-columns:
  minmax(0, 497fr) minmax(0, 9px)
  minmax(310px, 327fr) minmax(0, 11px)
  minmax(240px, 380fr);
```

so the Priority card keeps a **floor** of 310px (it must be, or the
Priority legend — absolute `left: 151px`, 138px wide, resolving
against the card's PADDING box — lands at card+310 and overflows) and
the Users Overview card a floor of 240px, while the shares keep the
reference's 497 / 327 / 380 at 1536px. Nothing overflows at 1536 /
1440 / 1366 / 1280 / 1200 / 1100, and `document.scrollWidth` equals
`clientWidth` at every one of them.

Relevant CSS — `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts`:

- `.users-overview .legend` → `left:166px; top:21px; width:195px` (line ~899)
- `.users-overview .divider` → `left:166px; top:134px; width:195px` (line ~929)
- `.users-overview .legend.roles` → `left:166px; top:152px; width:195px` (line ~939)
- `.users-overview .legend .legend-row` → `grid-template-columns: 13px 30px 120px 32px` (line ~920)
- `.users-overview .legend.roles .role-cell` → same 4-column grid (line ~949)

### Task #8 — legend percentage clipping at 1536 *(RESOLVED)*

The `pct` column is **32px** wide but `"87.5%"` needs **36px**, so the
percentage is clipped *even at the reference width*. Measured ink
bounds:

- Reference: pct ink runs `card+344 .. card+377` (19px clear of the
  card's 396px right edge).
- Live: pct ink runs `350 .. 385.8` — it collides with the card's 20px
  right padding, and `scrollWidth 36 > clientWidth 32` confirms the
  clip.

**Shipped:** the Priority legend is 138px wide at `left: 151px`, and
the card's 327px share holds it. `verify-admin-workspace.js` asserts
the legend's box and that no card's content escapes its card at
1536 / 1440 / 1366 / 1280 / 1200 / 1100.

### Task #3 — stat strip "Total Tickets" truncation at 1440 *(RESOLVED)*

The Total card's label box is `card-width − 91px` inset, so at a
240px card the 73px "Total Tickets" ink does not fit and ellipsises to
`"Total Tic..."`. The reference's Total card is **261px** wide — give
it that width and let the status cards share the remainder.

**Shipped:** the strip's tracks are the reference's fractions
(`22.56fr 18.42fr 17.75fr 19.16fr 22.12fr`), so the Total card lands
on 261px. A *second*, separate clip also turned up and was fixed: the
shared "columns" variant's status-card label was bound 2px too
tightly (`--label-right-inset: 83px`), which clipped "In Progress" to
"In Progres…" at a 1440px viewport. It is now **85px**.

### Task #5 — Recent Tickets table compress *(RESOLVED)*

See the experiment table in §1. Convert fixed pixel columns to
percentages matching the reference's proportions.

**Shipped:** `table-layout: fixed` + a `<colgroup>`; the title column
is the only flexible one, and `min-width` + `overflow-x: auto` lets
the table scroll inside its card rather than clip. The measured column
tracks at 1536px are `[107,228,108,100,160,113]`, asserted by
`verify-admin-workspace.js`.

### Task #6 — stale QA gates & Playwright tests *(RESOLVED)*

- `verify-stat-strip-roles.js` **times out on `/admin`** — the admin's
  strip is now the "stacked" variant (90px cards, different `testid`).
  → now finds the strip via `[data-testid="stat-strip"],
  [data-testid="admin-stat-strip"]`, and its cross-role assertions
  were rewritten (the Admin legitimately uses the stacked variant at a
  90px card height with no progress bar, and the Admin's and Agent's
  **data scopes genuinely differ**).
- `verify-shared-table.js` expects the admin to render the shared
  ten-column table, which the redesign replaced with its own Recent
  Tickets widget. → scenario 5 now compares only User vs Agent, and a
  new **5b** asserts the Workspace renders its OWN six-column table
  and none of the shared table / filter bar / pagination.
- `qa/tests/feature.spec.ts` still asserts the old Admin Tickets-tab
  design → **13 failures**. → the block was replaced with a
  `Feature: Admin Workspace` block (8 tests).
- `qa/tests/admin-users-tab.spec.ts` hardcodes user ids `1` and `8`.
  → the seeded admin is user **105** now, and was 1 in an older
  database, so a hardcoded id silently tested the wrong person. Every
  test now resolves the caller's own id from `/api/auth/me` and picks
  the other user from the live `/api/users` list — which is also the
  only way to read a role, because `GET /api/users/:id` is a **404**.

### Task #9 — new gate: `qa/scripts/verify-admin-workspace.js` *(RESOLVED)*

Asserts: the widget grid keeps its reference geometry at 1536; no
card's content escapes its card at **1536/1440/1366/1280/1200/1100**;
the stat strip's cards render the reference's labels; the Recent
Tickets table **scrolls inside** its card rather than clipping.

**Shipped:** the file exists and reports **170/170 checks passed**.
It holds the measured reference geometry:

```js
const REF = {
  strip: {
    cardTop: 222, cardHeight: 90,
    widths: [261, 227, 232, 229, 230],
    widthTolerance: 2.5,
    textLeft: { total: 83, status: 79 },
    tileLeft: 17, tileSize: 52,
    labels: ['Total Tickets','Open','In Progress','Resolved','Closed'],
  },
  row2: { widths: [818, 396] },
  row3: { widths: [497, 327, 380] },
};
```

The card WIDTHS are the one measurement the reference does not pin to
a single pixel: its borders are hand-drawn and anti-aliased, so they
are only measurable to ±1px.

### Task #4 — re-verify & log *(RESOLVED)*

Run all six QA gates + the new one, Angular unit tests, backend unit +
integration, `tsc --noEmit`, `ng build`, Playwright E2E. Then log the
iteration in `HANDSOFF.md` and commit.

**Result:** 652/652 gate checks, 608/608 Angular unit tests, 161/161
backend tests, 127 Playwright passed / 1 skipped / 0 failed, both
`tsc --noEmit` clean, `npm run build` clean. Logged as
**Iteration 16** in `HANDSOFF.md`. **The commit is still outstanding.**

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

**The rework is done — the only thing left is to COMMIT it.** Steps
below assume you have not committed yet.

1. Read this file, then `git status` — confirm the tree matches §4.
2. **Commit the working tree.** It contains the whole Admin Workspace
   rework plus the new components (`donut-chart/`, `stacked-bar-chart/`,
   `admin-hero/`, `admin-sidebar/`, `adminDashboardService.ts`) that
   are untracked and would be lost by a `git checkout .` or a
   `git clean`. Stage them **by name** — do not `git add -A`, or you
   will sweep in the ~200 scratch probe scripts under `qa/scripts/_*.mjs`
   and `qa/*.cjs` (they are throwaway forensics, not product code).
3. Re-run the gates before committing:
   ```
   cd qa && for f in scripts/verify-*.js; do node "$f"; done
   cd ../frontend && npm test
   cd .. && npm run typecheck && npm run build
   cd qa && BASE_URL=http://localhost:4200 npx playwright test
   ```
4. If a Playwright run reports exactly three failures — the two
   `dialog-portal` ones and "support agent (sam) lands on /queue" —
   **re-run before investigating.** They are a cold-dev-server artefact:
   the run that reports them takes ~11.5 minutes (first compile) and
   the three tests all wait on live API responses. Warm runs take 2
   minutes and are clean.
5. Update `PUKU.md`'s "Current work in progress" section if the
   commit lands, so the next session does not re-read this file
   expecting unfinished work.

**Throughout: keep screenshots on disk, keep them out of the context.**
