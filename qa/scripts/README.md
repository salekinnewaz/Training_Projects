# QA scripts

Verification and measurement scripts for HelpDesk Lite.

Two kinds of script live here:

1. **The reference-measurement pipeline** — everything to do with
   the WDS-2026 reference mockup for the Employee Dashboard's stat
   strip. This is the chain that proves the local render matches
   the mockup, and it is the only place the reference's numbers
   live.
2. **The project-wide wireframe audit** — scripts that check the
   live app against the nine Phase 4 page specs. These predate the
   stat-strip work and are referenced from `HANDSOFF.md`.

There is also a third family, added with the WDS-2026 shared ticket
table: **`verify-shared-table.js`**, which proves the reference's
filter bar, ten columns and pagination against the live DOM for the
**User**, the **Support Agent** and the **Admin** — and that the
three agree.

---

## The stat-strip reference pipeline

Run them in this order. Each stage feeds the next.

```
ref-measurements.js      the reference's numbers, in code
        │
        ├── verify-ref-measurements.js   re-derive them from the PNG
        │                                (are the recorded numbers true?)
        ▼
ref-payload.js           the API payload that reproduces the
                         reference's numbers (counts, series, delta)
        │
        ├── build-ref-series.js          how the series was solved
        ▼
verify-strip.js          the live DOM vs the reference, 149 checks
        │
        ├── compare-text-ink.js          the glyph ink, side by side
        ▼
compare-ref-shape.js / compare-side-by-side.js / compare-tile-geometry.js
                         visual comparisons of the render vs the PNG

verify-scenarios.js      the strip's OTHER states — the ones the
                         reference PNG cannot show (breakpoints,
                         zero totals, negative deltas, long labels)
```

### `ref-measurements.js`

**The single source of truth for what the reference looks like.**

Every measured value — card bounds, card widths, element geometry,
the type sizes and tracking, the accent palette, the alpha values,
the delta, the breakpoints — recorded here, together with *how* it
was measured and the pitfall that would bite someone re-deriving it.

Three things to know before changing anything in it:

- **Offsets are CARD-RELATIVE.** The reference's "176" for the
  sparkline is 176px from the Open card's LEFT EDGE, not from the
  strip's. Measuring strip-relative produces plausible-looking but
  wrong numbers, and did exactly that once.
- **The card widths were measured twice, and the first answer was
  wrong.** An early pass recorded 291 / 248 / 237 / 241 / 316px from
  the LOCAL render instead of the reference. The true extents are
  305 / 249 / 240 / 259 / 299px. `verify-ref-measurements.js` now
  guards against a repeat.
- **The progress bar has NO fixed width.** The four bars' tracks
  measure 101 / 92 / 109 / 132px, because the bar's LEFT edge moves
  with the card (48–53px right of the value column) while its RIGHT
  edge stays 18px inside the border. The reference's "106" was the
  **Open card's** width applied to all four — and the old
  `rightInset: 14` recorded here was the **sparkline's** inset, not
  the bar's (the bar's own is 17–19px). A fixed width overflows the
  narrower cards and leaves a gap on the wider ones.
- **The type sizes were SOLVED, not eyeballed.** The reference's ten
  digit widths (`"156"` → 9, 14, 14, `"42"` → 15, 13, …) pin the
  number at **26px**, and the label's 11px cap height pins it at
  **14px**. Both need **negative tracking** (−0.5px per character)
  to reach the reference's ink widths. `verify-ref-measurements.js`
  re-solves the size from scratch and asserts the answer.
- **The strip's width is set by `--content-column-width`.** The
  reference's strip is **1384px** wide, which the global token
  (**1448px**) produces — the reference's strip plus the chrome's
  64px of gutters. The Employee Dashboard used to override the
  token locally to 1408px, and the Agent and Admin pages used the
  global 1280px *plus* a second 32px padding layer, so their strips
  came out at 1152px. On a strip that narrow "In Progress" was
  clipped by a pixel.

### `verify-ref-measurements.js`

Re-derives the recorded measurements from the reference PNG and
fails if they disagree. This is what catches a hand-transcription
error or a stale measurement. It also **solves** the value's font
size by sweeping 22–30px and asserting that 26px has the lowest
total error against the reference's ten digit widths.

```
node qa/scripts/verify-ref-measurements.js
```

Currently 97 checks, all passing.

### `ref-payload.js`

The `/api/tickets/stats/mine` payload that reproduces the
reference's numbers exactly:

| | |
|---|---|
| counts | total 156, open 42, inProgress 28, resolved 62, closed 24 |
| `previousPeriod` | 73 |
| recent 30-day sum | 82 → delta `round(9 / 73 × 100)` = **+12%** |

The delta arithmetic is the fiddly part. `round((recent − previous)
/ previous × 100) === 12` has no integer solution for small
`previous` values that also look right — with `previous = 64` the
only integer `recent` is 72, giving 12.5% → 13%. The 73/82 pair
lands on 12.33% → 12%.

### `build-ref-series.js`

Prints the 60-day `dailyCreated` series and the sums that produce
the +12% delta, with a monotonic last 14 days so the sparkline
reads as the reference's soft diagonal rise. Run it when you need
to re-solve the payload.

### `verify-strip.js`

**The main gate.** Boots the app with Playwright, stubs the stats
API with `ref-payload.js`, and asserts every measured reference
value against the LIVE DOM — geometry, colours, glyphs, bar fills,
width ratios, gaps, text, the font metrics, and a **live ink
comparison** (the strip is screenshotted at 1x — the reference's own
scale — and the label's and the value's glyph ink is compared with
the reference's, row for row).

```
node qa/scripts/verify-strip.js
```

Exits non-zero on any drift. Currently 149 checks, all passing.

Requirements: the app running on `localhost:4200` and the backend on
`localhost:3000` (the login is real — `jess@company.com` /
`password123`).

### `compare-text-ink.js`

Prints the reference's and the local render's glyph ink **side by
side**, card by card — the label's and the value's ink box, its
height and its per-digit widths. This is the script that solved the
type sizes, and it is the quickest way to see a baseline or
font-size drift.

```
node qa/scripts/compare-text-ink.js
```

### `verify-scenarios.js`

The reference PNG shows **one** state — five populated cards at one
width. This script covers the rest of the contract, the states the
mockup cannot show (46 checks):

| # | Scenario |
|---|---|
| 1 | The full strip at the reference's width — five cards, all 88px tall |
| 2 | The 1180px breakpoint — three equal columns |
| 3 | The 760px breakpoint — two equal columns |
| 4 | A narrow phone — the sparkline and the bar stay INSIDE their card |
| 5 | A zero total — the bars render empty rather than dividing by zero |
| 6 | A missing previous period — the delta pill is hidden entirely |
| 7 | A negative delta — the pill turns red with a down arrow |
| 8 | No series — the sparkline is omitted but the bar remains |
| 9 | A long label — it is ellipsised, not wrapped |
| 10 | The strip is the USER dashboard's only — the Agent's ticket list has NOT adopted it, and a User is redirected away from it |

```
node qa/scripts/verify-scenarios.js
```

Exits non-zero on any drift. Same requirements as `verify-strip.js`.

> **Scenario 9 earned its keep.** It caught a real bug: the label
> had only `left: 81px` and no `right`, so its box grew to fit the
> text and a long label spilled over the card's edge instead of
> being clipped. The fix was a right bound — but **not** the card's
> right padding edge, which is what the first attempt used. The
> bound has to stop short of whatever the card's right-hand column
> holds: the **sparkline** on a status card (91px, less 4px for
> the trailing letter-spacing) and the **delta pill / caption**
> aside on the Total card (135px). Both are per-card-kind
> `--label-right-inset` custom properties.
>
> It also caught a **second** bug, one level down: the fix's CSS
> comment used backticks around the word `left`, and a backtick
> inside an Angular `styles: [\`...\`]` template literal terminates
> the TS template string. The compiler failed, the dev server kept
> serving a **stale bundle**, and the change looked like it simply
> hadn't taken. The tell was the compile error in `ng serve`'s
> output — not the browser. **Always read the dev server's log
> before concluding a CSS change is inert.**

> **Scenario 10's premise was wrong**, and that was worth fixing
> too. It originally logged in as Jess (role=User) and expected the
> Agent's ticket list to render — but `/tickets` is role-gated, so a
> User is redirected to `/forbidden` and the page never renders at
> all. It now logs in as Eli (role=Support Agent) and counts the
> **molecule elements** (`stat-strip` vs `stat-card`) rather than
> the wrapper's `data-testid`, which both pages use.

---

## The shared ticket table

### `verify-shared-table.js`

The WDS-2026 reference defines **one** ticket-table layout, and it is
used by all three roles — the User's `/dashboard`, the Support
Agent's `/tickets` and the Admin's `/admin`. This script proves the
reference is real on all three, and that the three **agree**
(67 checks):

| # | Scenario |
|---|---|
| 1 | The reference filter bar — the search placeholder verbatim, five selects, the default labels, the purple "More filters" button |
| 2 | The reference's ten table columns, in order |
| 3 | A populated row — category glyph, number, title + muted description, both pills, customer, assignee, relative timestamp, kebab |
| 4 | The pagination footer — "Showing 1–10 of N tickets", the numbered pager, the "10 / page" picker |
| 5 | All three roles render the SAME layout — the columns and the filter labels are compared role-to-role |
| 6 | The search filter narrows the rows |
| 7 | Each dropdown filter narrows the rows |
| 8 | The sort control reorders the rows |
| 9 | The pagination navigates between pages |
| 10 | The page-size picker changes the rows per page |
| 11 | An empty result set renders the table's empty row, not a broken table |
| 12 | A narrow phone scrolls the table rather than squashing it — and no role's page overflows sideways |
| 13 | The User sees only their OWN tickets — asserted at the API, `GET /api/tickets/mine` |

```
node qa/scripts/verify-shared-table.js
```

Exits non-zero on any drift. Same requirements as `verify-strip.js`:
the app on `localhost:4200`, the backend on `localhost:3000`, and a
real login for each of the three personas (`jess@company.com`,
`eli@company.com`, `admin@company.com` — all `password123`).

> **Scenario 12 caught a real bug.** The shared table carries a
> `min-width: 1040px` so its columns are not squeezed to nothing on a
> phone — but that width was propagating up through each page's grid
> column, dragging the whole page (and the stat strip beside it) out
> to 1042px. Two things had to be true: the page's grid column must
> be `minmax(0, 1fr)`, and the table's scroll wrapper must be
> `position: relative` — the `.sr-only` cells inside the table are
> absolutely positioned, and without a positioned ancestor in the
> scroll container they resolved against the **viewport**, so the
> hidden "Actions" label at the far right of the wide table stretched
> the page sideways.
>
> It also caught the **backtick trap** a second time: the CSS comment
> explaining the fix used backticks around `min-width: 0`, which
> terminated the `styles: [\`...\`]` template literal. The compiler
> failed and the dev server kept serving the **stale bundle**, so the
> edit looked inert. **Read `ng serve`'s log before concluding a CSS
> change did not take.**

> **Scenario 13 measures at the API, not the DOM.** Asserting that the
> User's table is a subset of the Agent's queue is weak — both show
> ten rows. The scope is enforced **server-side** by
> `GET /api/tickets/mine`, so that is where the check belongs: every
> ticket that endpoint returns must have been submitted by the
> caller.

---

## The stat strip across all three roles

### `verify-stat-strip-roles.js`

There is **one** stat strip in the app — the `<stat-strip>`
molecule, verified pixel-for-pixel against the WDS-2026 reference by
`verify-strip.js`. All three roles render that same molecule:

| Role | Page | Counts |
|---|---|---|
| User | `/dashboard` | their own tickets (`GET /api/tickets/stats/mine`) |
| Support Agent | `/tickets` | team-wide (`GET /api/tickets/stats`) |
| Admin | `/admin` | team-wide (`GET /api/tickets/stats`) |

Only the **data scope** differs. The geometry, the anatomy and the
behaviour are identical, and that is what this script proves
(45 checks):

- each role's strip is the shared `<stat-strip>` molecule, with
  five cards (Total + four statuses), a tinted icon tile per card,
  a sparkline and a progress bar per status card, and the
  "vs last month" caption;
- every card is **88px tall** — the reference's height — and the
  cards carry the reference's **unequal** widths (the Total card is
  the widest);
- the three roles agree on the card heights and on the card width
  **ratios** (not the absolute pixels: the User's content column
  is wider than the Agent's, so the same fractions produce
  different absolute widths);
- the data scope really does differ: the Agent and the Admin show
  identical numbers (both see the whole queue), and the User's
  total is both different from and smaller than the team-wide one.

```
node qa/scripts/verify-stat-strip-roles.js
```

> The Agent page used to carry its own band of five `<stat-card>`
> elements — a different molecule, 169px tall with equal-width
> cards and outline glyphs, which did **not** match the reference.
> It now renders the shared `<stat-strip>` like the other two
> roles, and the old `<stat-card>` band is gone from the page.

---

## The chrome at narrow widths

### `verify-header-narrow.js`

The `header-chrome` is rendered above **every** post-login page, so
a horizontal overflow there is a page-wide bug on all three roles.
This script proves two things at each of eight widths (1440 down to
320), for all three personas (62 checks):

- the page does **not** overflow sideways, and
- the profile trigger still shows its 28px **avatar**.

The second one is the load-bearing check. The obvious way to stop
an overflow is to let the trigger's grid track shrink to zero — but
a track that shrinks to zero takes the avatar with it, leaving the
user with an unidentifiable button. The chrome instead drops the
optional display name (below 640px) and then the wordmark (below
440px), so the identity affordance always survives.

It also pins the **degradation ladder** — the order things go:

| Width | What is dropped |
|---|---|
| ≤ 640px | the display name, then the chrome's duplicate search form |
| ≤ 440px | the wordmark (the brand **mark** stays — it is the home button) |

The Cmd+K shortcut falls back to the page-level filter bar's search
field when the chrome's own search input is hidden, so it never
becomes a silent no-op.

```
node qa/scripts/verify-header-narrow.js
```

---

## Running the QA suite locally

`qa/playwright.config.ts` defaults to the live Vercel deployment.
To run it against the local stack, start both servers and point
`BASE_URL` at the frontend:

```
cd backend && npm start          # :3000
cd frontend && npm start         # :4200
cd qa && BASE_URL=http://localhost:4200 npx playwright test
```

The `verify-*.js` scripts run against `localhost:4200` by
default; override with `BASE_URL` if needed:

```
node qa/scripts/verify-ref-measurements.js   #  97 checks — the reference's numbers
node qa/scripts/verify-strip.js              # 149 checks — the stat strip
node qa/scripts/verify-scenarios.js          #  46 checks — the strip's other states
node qa/scripts/verify-shared-table.js       #  67 checks — the shared table, all three roles
node qa/scripts/verify-stat-strip-roles.js   #  45 checks — the strip on all three roles
node qa/scripts/verify-header-narrow.js      #  62 checks — the chrome at narrow widths
```

> **Run them with a pause between.** The backend's login route has
> a rate limiter, and these scripts log in for real on every run.
> Six back-to-back runs can trip the limiter (429) and fail
> spuriously.

The dev server proxies `/api` to `:3000` (`frontend/proxy.conf.json`),
so the suite's direct `request.get('/api/health')` calls resolve
against the frontend origin exactly as they do in production, where
the API sits behind the same reverse proxy.

---

## The wireframe audit

| Script | What it does |
|---|---|
| `wireframe-audit.mjs` | Checks the live app against the nine Phase 4 page specs. Referenced from `HANDSOFF.md`. |
| `visual-tickets-check.mjs` | Verifies the seeded ticket data renders as expected. Referenced from `backend/src/seeders/20260915000000-demo-data.js`. |

`wireframe-audit.mjs` defaults to the **live Vercel deployment** — it
was written as a post-deploy tripwire — but it honours `BASE_URL` like
every other script:

```
BASE_URL=http://localhost:4200 node qa/scripts/wireframe-audit.mjs
```

> **It logs in seven times** (one per persona, plus the Employee
> Dashboard and the two Ticket Detail variants). The backend's login
> limiter allows **10 per 15 minutes per IP**, so this script fits
> inside the budget on its own but not alongside a run of the
> `verify-*.js` scripts. Run it on its own, or wait out the window.
> When the limiter trips, the failure is on the *login*, not on a
> real gap — the script says so explicitly in its error message.

The Employee Dashboard and the User-facing Ticket Detail are audited
as **Jess** (`jess@company.com`, role `User`). Eli is a Support
Agent, and `/dashboard` is role-gated, so an agent would be
redirected to `/forbidden` and the page would never render.

> **The Create Ticket and Submission Confirmation sections also
> use Jess, not Eli.** `/tickets/new` is guarded by
> `roleGuard(['User'])` — ticket creation belongs to the User, not
> to the Admin or the Agent. The audit used to log in as Eli for
> those two sections and navigate to `/tickets/new`, which bounced
> it to `/forbidden` and made the script fail on a
> `waitForSelector('input#title')` timeout. The persona now
> matches the route's guard.

> **The Admin's Tickets page has no "New ticket" button.** Creating
> a ticket is the User's action; the Admin's role is to manage the
> queue that results. The button was removed from the shared
> tickets-list page, along with its `onCreateTicket()` handler and
> the dead `.btn-icon` CSS it needed.

---

## The reference image

`qa/screenshots/local-view/ref-full.png` is the WDS-2026 mockup
crop. Every measurement in this folder is derived from it. If it
changes, re-run `verify-ref-measurements.js` first — the recorded
numbers will tell you exactly what moved.

---

## What was removed

This folder used to hold ~100 scripts: 43 numbered one-off pixel
probes (`measure-ref2.js` … `measure-ref42.js`), plus crop,
compare, solve and probe scripts for the same reference PNG. They
were exploratory — each measured one thing and printed it to
stdout, and the results were transcribed by hand.

They are archived outside the repo. The measurements they produced
now live in `ref-measurements.js` where they can be re-derived and
asserted against, which is strictly better than a transcript that
drifts silently.
