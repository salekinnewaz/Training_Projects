# PUKU.md — project context for this repo

## Current work in progress

**There is an unfinished rework in the working tree.** Before doing
anything else, read **`RESUME-TOMORROW.md`** — it is a full handoff
snapshot: what was built, what is broken, the exact open tasks, the
measured reference geometry, and the uncommitted-file inventory.

The rework is the **WDS-2026 Admin Workspace** (Admin Dashboard widget
grid). It is functionally complete but its **responsive geometry is
unfinished**: grid tracks are pinned to the 1536px reference
measurements, so the Users Overview card overflows its card at narrower
viewports and the stat strip truncates.

**Do not discard the uncommitted working tree.** It contains new
untracked components (`donut-chart/`, `stacked-bar-chart/`,
`admin-hero/`, `admin-sidebar/`, `adminDashboardService.ts`) that are
not in git and would be lost.

## Standing rules for this repo

- `HANDSOFF.md` is the **QA loop log** — append every iteration to it
  as an `## Iteration N — <date> — <title>` section. `HANDOFF.md`
  (no "S") is the *developer* handoff; they are different documents.
- The reference wireframes in `design-process/D-UX-Design/wireframes/`
  are the source of truth for geometry. Measure against them; do not
  eyeball.
- The Admin Dashboard's grid tracks are pinned to **exact pixel**
  measurements from the 1536px reference, and its gutters are
  **deliberately unequal** (9px and 11px) — a single `gap` rounds them
  wrong. Preserve this when editing.
- The stat strip is **one shared component** on all three roles
  (User / Support Agent / Admin). Only the *data scope* differs. Do not
  fork it per-role.
- QA verify gates live in `qa/scripts/verify-*.js` and run against the
  **live** dev server at `http://localhost:4200`. Login
  `admin@company.com` / `password123`.
- `.qa-tmp/` and `qa/225` are scratch — gitignored, safe to clear.

## Performance rule for QA work (important)

**Never read a screenshot PNG into the conversation.** The QA loop
previously base64'd 96 screenshots into one session's context (7.7 MB),
which is what made it crawl.

Instead: have the probe script write its measurements to a **JSON or
text file**, and read that file. Numbers are ~1 KB; a PNG is ~300 KB+ of
base64. Batch multiple breakpoints into a single Chrome launch.

