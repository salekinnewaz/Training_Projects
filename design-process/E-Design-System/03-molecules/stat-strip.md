# Stat Strip (molecule)

**Component:** `components/molecules/stat-strip/stat-strip.component.ts`
**Selector:** `<stat-strip>`
**Used by:** all three roles — the Employee Dashboard (`/dashboard`), the Support Agent's Tickets page (`/tickets`) and the Admin dashboard (`/admin`).

## Purpose

A single horizontal band of five cards summarising a ticket set: a wider **Total** card carrying a period-over-period delta, followed by four **status** cards each with a sparkline and a progress bar.

The strip is purely presentational. It takes its numbers from the caller; it never fetches.

**There is one strip for the whole app.** The geometry, the anatomy and the behaviour are identical everywhere — only the **data scope** differs:

| Role | Page | Counts from |
|---|---|---|
| User | `/dashboard` | `GET /api/tickets/stats/mine` — filtered to the caller's own ticket IDs **in SQL** |
| Support Agent | `/tickets` | `GET /api/tickets/stats` — team-wide |
| Admin | `/admin` | `GET /api/tickets/stats` — team-wide |

> **The Agent page used to carry its own band of five `<stat-card>` elements** — a different molecule, 169px tall with equal-width cards and outline glyphs, which did **not** match the WDS-2026 reference. It now renders this shared molecule like the other two roles, and the old `<stat-card>` band is gone from the page. The Admin had no strip at all until the same change.

## Anatomy

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  ▣  Total    │  ●  Open     │  ▶  Progress │  ✓  Resolved │  ✕  Closed   │
│  Tickets     │              │              │              │              │
│     156  ⬆12%│      42  ~~~│      28  ~~~│      62  ~~~│      24  ~~~│
│        12%   │         ▓▓▓░░│         ▓▓░░░│         ▓▓▓░│         ▓░░░│
│ vs last month│              │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
   tinted tile    tinted tile    tinted tile    tinted tile    tinted tile
   + clipboard    + disc         + play         + check        + ×
```

### Total card

- A **lavender rounded-square tile** (52×52, 14px radius, `#F0EAFE`) with a **solid** purple clipboard glyph (`#7433FE`).
- The label ("Total Tickets", 14px semibold) above the number (26px bold).
- A **delta pill** top-right: green `#09C05B` on `#E1F9EE` when the period is up, red `#D92D20` on `#FEE2E2` when down, and **hidden entirely** when there is no previous period to compare against. A misleading "+100%" is worse than no pill at all.
- A **caption** ("vs last month", 15px `#A7ACCC`) bottom-right.
- The pill and the caption stack in the **same right-hand column**, so they read as one block.

### Status cards

- A **tinted square tile** (52×52) holding a **solid 25px disc** in the status's accent colour:
  - Open — a plain disc (a resting state carries no inner mark)
  - In Progress — a white play triangle
  - Resolved — a white check
  - Closed — a white ×
- The label above the number.
- A **54px sparkline** in the top-right corner, drawn as a pale wash.
- A **progress bar** bottom-right, **8px tall**. Its width is *not* fixed — its **left** edge is anchored at card+129 and its **right** edge at 18px inside the card's border, so the bar spans the gap between them. The bar's filled portion is `value / total`, so the four bars together account for the whole row.

The sparkline and the bar are **not** anchored to the same edge. The sparkline's **box** sits 14px inside the card's right border; the bar's **track** sits 18px inside it. Their *ink* comes out flush (the reference's spark ink ends at inset 19–20 while its bar track ends at inset 17–18), which is why they read as sharing an edge — but the boxes do not, and the implementation keeps them 4px apart.

## Geometry

All values are measured against the reference screenshot; offsets are relative to each card's own left edge.

| Element | Value | Notes |
|---|---|---|
| Card height | 88px | Every card, Total included |
| Card widths | 305 · 249 · 240 · 259 · 299px | **Unequal** — Total widest, Closed second |
| Card width fractions | 22.56 · 18.42 · 17.75 · 19.16 · 22.12fr | The grid tracks these declare |
| Card gap | 8px | The reference's four gaps take 33px — 8.25 each |
| Breakpoints | 1180px → 3 equal columns · 760px → 2 equal columns | |
| Icon tile | 52×52, 14px radius | At card+18..70 |
| Status disc | 25px (r 12.5 on a 30-unit viewBox) | Centred in the tile |
| Label | Inter 600 at 14px, −0.5px tracking, `--color-text-soft` `#334155` | At card+82; ink card+24..34 (11px cap height) |
| Number | Inter 700 at 26px, −0.5px tracking | At card+82; ink card+47..65 (19px digit height) |
| Sparkline | 54×26px | Box at card+176..230, top-right; the box's right edge is 14px inside the card's border |
| Progress bar | 8px tall, **not fixed-width** | Left edge at card+129, right edge 18px inside the card's border |
| Bar left offset | card+129 | 48px right of the value column's left edge (47 on In Progress, 49 on Resolved, 53 on Closed) |
| Sparkline box / bar track right edge | card width − 14px / − 18px | **Not** the same edge — the boxes are 4px apart |
| Sparkline stroke | 0.34 opacity | Over a 0.10 gradient fill → ~0.406 effective alpha |
| Label right bound (status cards) | card width − 91px | The spark box's left edge minus the reference's 24px clearance. The CSS carries 4px more (`--label-right-inset: 87px`) for the trailing letter-spacing. |
| Label right bound (Total card) | card width − 135px | The caption column's left edge minus the reference's 37px clearance |
| Value column | Fixed **44px** wide, at card+81 | The widest the reference's own value column ever reaches (the Closed card's three digits). It keeps the number clear of the progress bar; a number too wide for the column ellipsises rather than colliding. |
| Strip width | **1384px** | Requires `--content-column-width: 1448px` — see below |

> **The card widths were re-measured.** An earlier pass recorded
> 291 / 248 / 237 / 241 / 316px, but those numbers had been read off
> the LOCAL render rather than off the reference — which made the
> Closed card 1.4 percentage points too wide and the Resolved card
> 1.4 too narrow. The table above is the reference's true extents,
> taken at the widest scan row. `qa/scripts/ref-measurements.js`
> re-derives them from the PNG, and `qa/scripts/verify-strip.js`
> asserts the rendered ratios against them.

> **The type sizes were SOLVED, not guessed.** The reference's ten
> digit widths were measured one digit at a time —
> `"156"` → 9, 14, 14 · `"42"` → 15, 13 · `"28"` → 14, 14 ·
> `"62"` → 15, 13 · `"24"` → 14, 15 — and Inter 700 reproduces all
> ten at **26px** and at no other size. At the 30px the component
> originally used, the digits came out 17–18px wide, three pixels
> too fat, and the reference's "156" ink box (41×19) did not fit.
>
> The label follows the same route: its 11px cap height matches
> Inter 600 at 14px exactly, but Inter 600 at 14px with normal
> tracking renders "Total Tickets" 86px wide where the reference
> is 80px — so the tracking is **negative** at −0.5px per
> character, which closes the six-pixel gap precisely.
>
> `qa/scripts/verify-ref-measurements.js` re-derives all of this
> from the PNG and *solves* the size (it sweeps 22–30px and asserts
> that 26px has the lowest total error), so the numbers cannot drift
> away from the mockup.

> **The reference's text column is not consistent.** Its mockup
> places each card's label at a different offset — card+91 (Total),
> 82 (Open), 83 (In Progress), 85 (Resolved), 95 (Closed) — and the
> *same* glyph ("2" in "28" and "24") appears at two of them, so it
> is not a side-bearing effect but the mockup's cards being laid out
> individually. The implementation therefore uses ONE text column
> (card+82, where four of the five sit) rather than reproducing the
> inconsistency. The vertical ink and the ink widths, which carry the
> typographic information, are matched exactly.

### Why the label and number are absolutely positioned

The label and the number are `position: absolute` rather than grid items. A grid row cannot land their baselines on the reference's exactly, because a 26px face needs a 29px line box that overflows whatever row it sits in. Absolute `top`/`left` gives exact control over where the glyphs land.

> **Gotcha:** absolute offsets are measured from the **padding box**, so a 1px border shifts them by 1px. The label's `top: 20px` / the value's `top: 42px` account for that — the boxes land at card+21 and card+43, and their glyph ink at card+24 and card+47.

### Why the bar and sparkline are absolutely positioned

The reference's bar starts at card+129, alongside the value column (card+82..110). A grid track would either squeeze the value into an ellipsis or push the curve past the card's border.

The bar's width is **not** a constant. Measured off the reference, the four bars' tracks are 101, 92, 109 and 132px wide — the four status cards are different widths, and the bar's left edge moves with the card (48–53px right of the value column) while its right edge stays at 18px inside the border. So the implementation anchors the bar at **both** ends (`left: 128px; right: 17px` in CSS, i.e. card+129 and card width − 18) and lets the width fall out of the space between them. An earlier version gave the bar a fixed 106px width, which was simply the **Open card's** measurement applied to all four — it overflowed the narrower cards and left a gap on the wider ones.

> **Gotcha:** absolutely positioned children resolve against the containing block's **padding box**, whose edges sit 1px inside the card's border box. That is why the CSS reads `left: 128px; right: 17px` where the measurements say 129 and 18, and why the label's right bound is `--label-right-inset − 1px`.

### Why the label and the value are bounded on the right

With only a `left`, an absolutely positioned box **grows to fit its content**, so a long label ("Awaiting Customer Response") would spill over the card's border and run under the sparkline instead of being clipped. The bound makes `text-overflow: ellipsis` engage, so a long label degrades to an ellipsis on one line rather than pushing the card taller than its siblings.

But the bound is **not** the card's right padding edge. It has to stop short of whatever the card's right-hand column holds, and that column differs per card:

- On a **status card** the right-hand column is the sparkline, whose box starts at card width − 68. The reference leaves 24px of clearance between the label's ink and the spark box, so the label's right bound is **card width − 91px**. The implementation carries 4px more (`--label-right-inset: 87px`) to absorb the trailing letter-spacing CSS adds *after* the final glyph — without it, "In Progress" was clipped by a single pixel.
- On the **Total card** the right-hand column is the delta pill and the caption, whose ink starts at card width − 98. The reference's clearance there is 37px, so the Total card's label is bounded proportionally at **card width − 135px**.

The value is bounded differently: it is a **fixed 44px column** (`right: auto; width: 44px`) rather than a right-bound, because the reference's value is a column of its own rather than text that grows rightward. 44px is the widest the reference's value column ever reaches — the Closed card's three digits — and it keeps the number clear of the progress bar beneath it. A number too wide for the column ellipsises rather than colliding.
> **A bound expressed as a percentage of the card width does not work.** The first attempt used `right: calc(100% - var(--label-right-inset))`, but `100%` resolves against the padding box (the card's width *minus* the 2px of border), so the arithmetic was off by the border as well as by the inset — and the label collapsed to a 10px sliver. Because both the label's `left` and its right bound are **constants**, the right bound is a constant too: `right: calc(var(--label-right-inset) - 1px)`. The width then falls out of the card's width as `w − 173` (status) or `w − 217` (Total).

### The strip's width is set by the content column

The strip is a grid of five **fractional** tracks (22.56 / 18.42 / 17.75 / 19.16 / 22.12fr), so the cards' absolute widths follow from the strip's width. The reference's strip is **1384px** wide, giving cards of 305 / 249 / 240 / 259 / 299px.

That width comes from the global `--content-column-width` token, which is **1448px** — the reference's 1384px strip plus the chrome's 64px of `.page-content` gutters. The Employee Dashboard used to override the token locally to 1408px, and the Agent and Admin pages used the global 1280px *and* added a second layer of 32px horizontal padding — so their strips came out at 1152px, 17% narrower than the reference's. On a strip that narrow the "In Progress" label did not fit and was clipped.

The token is now raised globally, the page-local override is gone, and the duplicate padding is removed from the Agent and Admin pages. **All three roles render a 1384px strip with cards pixel-identical to the reference.**

> **Gotcha:** the styles live in an inline `styles: [\`...\`]` template literal, so a **backtick** anywhere in the CSS terminates the TS template string. The compiler then fails — but the dev server keeps serving the **previous** bundle, so the change looks like it simply did not take. Read `ng serve`'s output before concluding a CSS edit is inert.

## Tokens

The strip carries its **own** accent palette, deliberately separate from the shared `--status-*-dot` family — that family is also read by the Ticket Detail status pills and the Kanban column dots, so changing it would shift the rest of the app. The reference's Open disc is a pure blue (not the pill's indigo) and its Closed disc is a slate *blue* (not a neutral grey).

| Token | Value | Where used |
|---|---|---|
| `--stat-accent-total` | `#7433FE` | Total card glyph |
| `--stat-accent-open` | `#0674FE` | Open disc |
| `--stat-accent-in-progress` | `#FEAF11` | In Progress disc |
| `--stat-accent-resolved` | `#08D076` | Resolved disc |
| `--stat-accent-closed` | `#5D749D` | Closed disc |
| `--stat-tile-total` | `#F0EAFE` | Total card tile fill |
| `--stat-tile-open` | `#EAF2FE` | Open card tile fill |
| `--stat-tile-in-progress` | `#FEF4E0` | In Progress card tile fill |
| `--stat-tile-resolved` | `#E1F9EE` | Resolved card tile fill |
| `--stat-tile-closed` | `#EBEEF6` | Closed card tile fill |
| `--stat-spark-open` | `#6366F1` | Open sparkline stroke |
| `--stat-spark-in-progress` | `#B4BEEB` | In Progress sparkline stroke |
| `--stat-spark-resolved` | `#02C878` | Resolved sparkline stroke |
| `--stat-spark-closed` | `#87A0D0` | Closed sparkline stroke |

The sparkline colours are a **third** set, separate again from the disc accents. The In Progress curve is periwinkle so the amber bar below stays the card's only warm element.

## API

| Input | Type | Default | Notes |
|---|---|---|---|
| `total` | `number` (required) | — | The denominator for every bar. |
| `statusItems` | `StatStripItem[]` (required) | — | The four status cards, in display order. |
| `totalLabel` | `string` | `'Total Tickets'` | The Total card's label. |
| `delta` | `number \| null` | `null` | Signed percentage change. `null` hides the pill. |
| `deltaLabel` | `string` | `''` | Pre-formatted pill copy, e.g. `"12%"` / `"−8%"`. |
| `caption` | `string` | `''` | The Total card's bottom-right caption. |

`StatStripItem`:

| Field | Type | Notes |
|---|---|---|
| `label` | `string` | Shown above the number. |
| `value` | `number` | The number shown; the bar's numerator. |
| `accent` | `'open' \| 'inProgress' \| 'resolved' \| 'closed'` | Selects the tile, disc and bar colours. |
| `series` | `number[]` | The sparkline's series. Omit to hide the sparkline. |
| `total` | `number` | Optional — overrides the strip's `total` for this card's bar only. |

## Behavior

- **Bar fill** is `value / total` as a percentage, clamped to 0..100. A **zero total renders empty bars** rather than dividing by zero.
- **The delta pill's arrow** is a solid glyph, not an outline, matching the reference. The label carries no `+` sign — the arrow already states the direction, and the reference's pill reads "12%".
- **The sparkline is a pale wash**, not a solid line: stroke opacity 0.34 over a gradient fill at 0.10. Because the fill sits *behind* the stroke, the two alphas compound to the reference's ~0.406 effective alpha.
- **The bar and sparkline shrink rather than overflow.** The bar's width is the space between its two anchors, and the sparkline's is `min(54px, calc(100% - 141px))` — so on a narrow phone, where the strip drops to two columns and each card is far narrower than 119px, they stay inside the card instead of spilling over the neighbour.

## Accessibility

- The tile and its glyph are `aria-hidden="true"` — the label and number carry the meaning.
- The delta pill's colour is never the only signal: the arrow's direction and the sign on the label both state it.
- The progress bar is `aria-hidden="true"`; the number above it carries the value.
- The sparkline is `aria-hidden="true"` and `focusable="false"`.

## Verification

`qa/scripts/verify-strip.js` re-checks every measured value above against the live DOM in one pass (**149 assertions**). It renders the strip with the reference payload (`qa/scripts/ref-payload.js`) and exits non-zero on any drift.

It covers, in one pass:

- the card geometry (tile, disc, sparkline, bar, their edges),
- the card widths as **fractions** of the strip and the gaps between them,
- the **font metrics** (size, weight, tracking, typeface),
- and a **live ink comparison**: the strip is screenshotted at 1x — the reference's own scale — and the label's and the value's *glyph ink* is compared with the reference's, row for row.

`qa/scripts/verify-ref-measurements.js` is the other half: it re-derives the recorded measurements from the reference PNG (97 checks) so the numbers cannot silently drift away from the mockup they document.

`qa/scripts/verify-scenarios.js` covers the states the reference PNG **cannot** show (46 checks): the two breakpoints, a narrow phone, a zero total, a missing previous period, a negative delta, no series, a long label, and the guarantee that the Agent page renders this same molecule (and that the User is still locked out of `/tickets` entirely).

`qa/scripts/verify-stat-strip-roles.js` proves the strip is **one** strip across all three roles (45 checks): each role's page renders the shared `<stat-strip>` molecule with five 88px-tall cards, the reference's labels and accents, a sparkline and a bar per status card, and the reference's **unequal** card widths. The three roles are compared on card heights and on card width **ratios** — not absolute pixels, because the User's content column is wider than the Agent's, so the same fractions produce different absolute widths. It also pins the data scope: the Agent and the Admin show identical numbers (both see the whole queue), while the User's total is both different from and smaller than the team-wide one.

`qa/scripts/compare-text-ink.js` prints the side-by-side ink comparison — the reference's and the local render's — for eyeballing.
