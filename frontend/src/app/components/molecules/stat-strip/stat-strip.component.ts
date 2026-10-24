/**
 * stat-strip — molecule (HD-021).
 *
 * The horizontal stat strip from the WDS-2026 reference layout.
 * Five equal-width cards in one row:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ┌────┐  Total Tickets   ↑ 12%                              │
 *   │ │ ▣  │  156             vs last month                      │
 *   │ └────┘                                                      │
 *   └─────────────────────────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ┌────┐  Open                                  ╱╲            │
 *   │ │ ●  │  42              ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░ │
 *   │ └────┘                                                      │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Anatomy, matching the reference screenshot exactly:
 *
 *   1. **Unequal-width cards.** The reference's five cards do NOT
 *      share a footprint: Total is widest (it carries the label,
 *      the number, the delta pill AND the caption) and Closed is
 *      second widest. Measured against the reference strip they
 *      are 305 / 249 / 240 / 259 / 299 px.
 *   2. **Tinted icon tiles with a solid accent glyph.** Each card
 *      has a rounded-square tile in a very pale tint of the accent
 *      colour, with the accent colour itself used for the glyph
 *      inside. Open · Resolved · Closed use a filled circle; In
 *      Progress uses a filled circle with a play triangle.
 *   3. **Total card extras.** The delta pill (green up / red down)
 *      sits in the top-right corner and the "vs last month"
 *      caption directly beneath it, both stacked in a right-hand
 *      column.
 *   4. **Status cards carry two visuals.** A small sparkline in the
 *      top-right corner (accent-tinted, gradient-filled area chart)
 *      and a progress bar along the bottom-right (accent fill +
 *      muted track) encoding that status's share of the total. The
 *      two share the same right edge; the sparkline occupies the
 *      right half of the bar's span.
 *
 * The bar's fill percentage is `value / total`, so the four status
 * bars always sum to 100% of the total across the row. When the
 * total is 0 the bars render empty rather than dividing by zero.
 *
 * All colours come from tokens in `:root` — the accent family is
 * chosen by the `accent` input, exactly as the HD-019 card did.
 *
 * NOTE: this component's styles live in an inline `styles: [...]`
 * template literal, so a BACKTICK anywhere in the CSS terminates
 * the TS template string and the compiler then chokes on the
 * remainder as TypeScript. The symptom is deceptive: the dev
 * server prints the compile error but keeps serving the PREVIOUS
 * bundle, so the change looks like it simply did not take. Use
 * double quotes inside the CSS comments. See the `.label` rule for
 * the note that added this.
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

import { SparklineComponent } from '../../atoms/sparkline/sparkline.component';

export type StatStripAccent =
  | 'primary'
  | 'open'
  | 'inProgress'
  | 'resolved'
  | 'closed';

/**
 * The token each accent family paints with. Read from the same
 * custom properties the component's own CSS uses, so the sparkline
 * stroke always matches the icon tile and the progress bar.
 *
 * These are the stat strip's OWN accent tokens, not the shared
 * --status-*-dot family: the reference's stat cards use a richer
 * palette (a pure blue Open, a slate-blue Closed) than the status
 * pills and the Kanban dots.
 */
const ACCENT_COLORS: Record<StatStripAccent, string> = {
  primary: 'var(--stat-accent-total, #7433FE)',
  open: 'var(--stat-accent-open, #0674FE)',
  inProgress: 'var(--stat-accent-in-progress, #FEAF11)',
  resolved: 'var(--stat-accent-resolved, #08D076)',
  closed: 'var(--stat-accent-closed, #5D749D)',
};

/**
 * The colour each family's SPARKLINE is drawn in.
 *
 * The reference does NOT simply reuse the accent for the trend
 * line. Sampling its pixels shows:
 *
 *   Open        accent blue    -> curve is indigo         (#C3C9FD peak)
 *   InProgress  accent amber   -> curve is PERIWINKLE     (#E1E5F7 peak)
 *   Resolved    accent green   -> curve is GREENER green  (#98E9C6 peak)
 *   Closed      accent slate   -> curve is slate-blue     (#CFD9EC peak)
 *
 * Two families diverge. The amber family's curve is the shared
 * periwinkle rather than the accent, so the warm bar below it
 * stays the card's only warm element. The green family's curve is
 * a more saturated green than the accent it shares with the bar
 * and the icon glyph.
 */
const SPARK_COLORS: Record<StatStripAccent, string> = {
  primary: 'var(--stat-accent-total, #7433FE)',
  open: 'var(--stat-spark-open, #6366F1)',
  inProgress: 'var(--stat-spark-in-progress, #B4BEEB)',
  resolved: 'var(--stat-spark-resolved, #02C878)',
  closed: 'var(--stat-spark-closed, #87A0D0)',
};

export interface StatStripItem {
  /** Card label — "Open", "In Progress", … */
  readonly label: string;
  /** The number shown in the middle of the card. */
  readonly value: number;
  /** Which color family lights the icon tile, glyph, sparkline and bar fill. */
  readonly accent: StatStripAccent;
  /**
   * For status cards: the total the bar is a fraction of. Omit to
   * fall back to the strip's own total.
   */
  readonly total?: number;
  /**
   * For status cards: the series plotted by the sparkline. A
   * 14-element daily-created series is the intended shape, but any
   * non-empty array works. Omit to hide the sparkline.
   */
  readonly series?: number[];
}

@Component({
  selector: 'stat-strip',
  standalone: true,
  imports: [SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ── Summary card (Total) ───────────────────────────────── -->
    <article class="card total" data-testid="stat-total-card">
      <span class="tile tile-total" aria-hidden="true">
        <!-- A SOLID clipboard, matching the reference's filled
             "assignment" glyph: a purple body with a light interior
             panel and a raised tab at the top. -->
        <svg viewBox="0 0 30 30" width="29" height="29">
          <!-- The reference's clipboard is the Material "assignment"
               glyph: a wide rounded body whose top-left corner is
               notched out around a raised tab, a horizontal divider
               near the top, and a light panel filling the lower
               half. -->
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M5.5 3.5 h5.2 a2.2 2.2 0 0 1 2.2 2.2 v1.8 h2.8 V5.7 A2.2 2.2 0 0 1 17.9 3.5 H23 a3 3 0 0 1 3 3 v18 a3 3 0 0 1-3 3 H5.5 a3 3 0 0 1-3-3 v-18 a3 3 0 0 1 3-3 Z M6.5 11.8 h17 v2.2 H6.5 Z M6.5 16.6 h17 v6.6 a1.6 1.6 0 0 1-1.6 1.6 H8.1 a1.6 1.6 0 0 1-1.6-1.6 Z"
          />
        </svg>
      </span>

      <span class="label">{{ totalLabel() }}</span>

      <span class="value">{{ format(total()) }}</span>

      <!-- The delta pill sits in the top-right corner and the
           caption directly beneath it — the reference stacks the
           two in a right-hand column. -->
      <div class="aside">
        @if (delta() !== null) {
          <span class="delta" [class.is-up]="(delta() ?? 0) >= 0" [class.is-down]="(delta() ?? 0) < 0">
            <!-- A SOLID arrow_upward, matching the reference's
                 filled glyph: a triangular head over a thick stem.
                 16px, so the head reads as wide as the reference's. -->
            <svg viewBox="0 0 16 16" width="15" height="15" focusable="false" aria-hidden="true">
              @if ((delta() ?? 0) >= 0) {
                <path d="M8 1.8 L14 8.4 L10.6 8.4 L10.6 14.4 L5.4 14.4 L5.4 8.4 L2 8.4 Z" fill="currentColor" />
              } @else {
                <path d="M8 14.2 L2 7.6 L5.4 7.6 L5.4 1.6 L10.6 1.6 L10.6 7.6 L14 7.6 Z" fill="currentColor" />
              }
            </svg>
            <span>{{ deltaLabel() }}</span>
          </span>
        }
        @if (caption()) {
          <span class="caption">{{ caption() }}</span>
        }
      </div>
    </article>

    <!-- ── Status cards ────────────────────────────────────────── -->
    @for (item of statusItems(); track item.label) {
      <article class="card status" [attr.data-accent]="item.accent" [attr.data-testid]="'stat-card-' + item.accent">
        <span class="tile" aria-hidden="true">
          @switch (item.accent) {
            @case ('open') {
              <!-- A plain disc: Open is a resting state, so it
                   carries no inner glyph. -->
              <svg viewBox="0 0 30 30" width="30" height="30" fill="currentColor">
                <circle cx="15" cy="15" r="12.5" />
              </svg>
            }
            @case ('inProgress') {
              <!-- Disc with a white play triangle. -->
              <svg viewBox="0 0 30 30" width="30" height="30" fill="currentColor">
                <circle cx="15" cy="15" r="12.5" />
                <path d="M11.6 8.9 L21.2 15 L11.6 21.1 Z" fill="#ffffff" />
              </svg>
            }
            @case ('resolved') {
              <!-- Disc with a white check. -->
              <svg viewBox="0 0 30 30" width="30" height="30" fill="currentColor">
                <circle cx="15" cy="15" r="12.5" />
                <path d="M8.6 15.4 L12.8 19.6 L21.4 11" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            }
            @default {
              <!-- Disc with a white x. -->
              <svg viewBox="0 0 30 30" width="30" height="30" fill="currentColor">
                <circle cx="15" cy="15" r="12.5" />
                <path d="M11.2 11.2 L18.8 18.8 M18.8 11.2 L11.2 18.8" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
              </svg>
            }
          }
        </span>

        <span class="label">{{ item.label }}</span>

        <!-- Sparkline, top-right.

             The opacities are tuned against the reference's
             measured pixels. The reference's Open-card curve peaks
             at #C3C9FD on a white card; solving the alpha for the
             accent #6366F1 gives 0.385 on the red channel and
             0.353 on the green, so the stroke sits at roughly 0.40
             effective alpha. Because the gradient fill sits BEHIND
             the stroke, the two alphas compound on the stroke's own
             pixels — 1 - (1 - 0.34)(1 - 0.10) = 0.406 — so each is
             set below the target and they compound up to it. -->
        @if (item.series?.length) {
          <div class="spark">
            <atom-sparkline
              [points]="item.series ?? []"
              [color]="sparkColor(item.accent)"
              [gradientId]="'stat-strip-spark-' + item.accent"
              [smooth]="true"
              [fillOpacity]="0.1"
              [strokeOpacity]="0.34"
            />
          </div>
        }

        <span class="value">{{ format(item.value) }}</span>

        <!-- Progress bar, bottom-right. -->
        <div class="bar" aria-hidden="true">
          <span class="bar-fill" [style.width.%]="percentOf(item)"></span>
        </div>
      </article>
    }
  `,
  styles: [`
    :host {
      display: grid;
      /* Card widths measured against the reference strip
         (ref-full.png, strip band y=183..270). The cards' TRUE
         extents, taken at the widest scan row (y=196, where the
         rounded corners are at their widest):
           Total 305 | Open 249 | In Progress 240 | Resolved 259 | Closed 299
         The cards are NOT equal width — the Total card is widest
         (it carries the label, the number, the delta pill AND the
         caption). Expressed as fractions of the 1352px the five
         cards share:
           Total 22.56fr | Open 18.42fr | InProgress 17.75fr |
           Resolved 19.16fr | Closed 22.12fr */
      grid-template-columns:
        22.56fr 18.42fr 17.75fr 19.16fr 22.12fr;
      /* The reference's four gaps measure 33px in total — 8.25
         each, so 8px is the nearest whole pixel. */
      gap: 8px;
      align-items: stretch;
    }
    @media (max-width: 1180px) {
      :host {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 760px) {
      :host {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* ── Card anatomy ─────────────────────────────────────────────
       A three-column, two-row grid:

         ┌────┬───────────┬──────────┐
         │    │  label    │ sparkline│  row 1
         │tile├───────────┼──────────┤
         │    │  value    │ progress │  row 2
         └────┴───────────┴──────────┘

       The Total card replaces the sparkline/progress column with a
       single aside holding the delta pill (top) and the caption
       (bottom).

       The reference's geometry, measured off the screenshot (offsets
       from the Open card's left edge, card = 249px wide, card top
       at y=183):
         tile       18..70   (52px, y card+18..70)
         label      82..114  (ink y card+25..36, 12px cap height)
         value      82..110  (ink y card+47..66, 20px digit height)
         sparkline 176..230  (54px)
         bar        124..230  (106px, fill 130..176)

       Note that the sparkline sits in the RIGHT HALF of the bar's
       span — both share the same right edge (offset 230, i.e. 19px
       from the card's right border). The sparkline is a small
       glyph in the corner, not a wide chart.

       The sparkline and bar are RIGHT-ANCHORED to the card's content
       box rather than living in a grid column, because in the
       reference the bar's left edge (124) sits under the value
       column (82..110). A grid track would either squeeze the
       value or overflow the card. */
    .card {
      position: relative;
      display: grid;
      /* The middle column holds the label and the number. It is a
         fixed 74px — wide enough for "In Progress", which the
         reference renders at 66px — so the right-hand visuals never
         have to share space with the text. */
      grid-template-columns: 52px 74px;
      /* The reference's card is 88px tall:
           label  glyphs at card+24..34  (14px face, 11px caps)
           value  glyphs at card+47..65  (26px face, 19px digits)
           tile   card+18..70
           bar    card+59..67

         The label and the value are absolutely positioned so their
         baselines land on the reference's exactly — a grid row
         cannot, because a 26px face needs a 29px line box that
         overflows whatever row it sits in. */
      grid-template-rows: 1fr;
      align-items: center;
      /* The card's padding and the column gap are a FALLBACK for
         the un-positioned case: the tile, the label and the value
         are all absolutely positioned, so the padding only decides
         where an un-positioned child would land. The reference's
         own left padding is 18px (its tile starts at card+18). */
      padding: 14px 16px 14px 14px;
      column-gap: 15px;
      /* 88px — the reference's card height. */
      height: 88px;
      box-sizing: border-box;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 12px;
      box-shadow: var(--shadow-sm);
    }
    /* The Total card replaces the sparkline/progress column with a
       single aside holding the delta pill (top) and the caption
       (bottom). Everything is absolutely positioned, so the card's
       grid tracks are only a fallback for the un-positioned case. */
    .card.total {
      grid-template-columns: 52px 74px;
      /* The Total card's label is bounded PROPORTIONALLY, so it can
         never run under the aside. The reference's Total card
         (305px wide) carries:
           label ink   91..170
           caption ink 204..288   (the aside's right column)

         The caption is right-anchored 14px inside the card and
         measures ~84px, so the aside's left edge sits at
         'w - 98' = 207, and the reference leaves 37px of clear
         space between the label's ink and the caption.

         So the label's right bound is 'w - 98 - 37' = 'w - 135'.
         On the reference's own 305px card that lands the bound at
         170, which is exactly where the reference's label ink
         ends. On a narrower card the bound moves left with it, so
         the label shrinks (and ellipsises) rather than sliding
         under the caption.

         The earlier fixed 84px reserve was wrong for the same
         reason the fixed 106px bar was: it only lined up on a card
         exactly the reference's width. */
      --label-right-inset: 135px;
    }

    /* ── Icon tiles ──────────────────────────────────────────────
       A very pale tint of the accent colour with the accent colour
       itself used for the glyph inside. The total uses the brand
       lavender tint.

       52px, measured against the reference (the tinted square's
       fill spans card+19..67 in the Open card, with the
       anti-aliased corner at card+18). */
    .tile {
      /* Absolutely positioned so the tile spans card+18..70, the
         reference's exact box. The offsets are from the card's
         PADDING box, so the 1px border shifts them by 1.

         The reference's tile was re-measured: its first tinted
         pixel sits at card+18 and its fill runs card+19..67, both
         vertically card+18..69. An earlier pass read card+14,
         which put the tile 4px too far into the corner. */
      position: absolute;
      left: 17px;
      top: 17px;
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: var(--tile-bg, var(--color-surface-muted));
      color: var(--accent-color, var(--color-primary));
    }
    .tile-total {
      background: var(--stat-tile-total, #F0EAFE);
      color: var(--stat-accent-total, #7433FE);
    }

    .label {
      /* Absolutely positioned so the label's cap top lands on the
         reference's card+24. The 14px face has a 17.5px line box
         whose caps sit 4px below its top, so the box starts at
         card+20. (Offsets are from the card's border box, so the
         1px border shifts them by 1.) */
      position: absolute;
      left: 81px;
      top: 20px;
      margin: 0;
      /* 14px — the reference's "Total Tickets" cap height measures
         11px (rows card+24..34), which a 13px face cannot reach. */
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-soft);
      /* NEGATIVE tracking. The reference's "Total Tickets" ink spans
         80px; Inter 600 at 14px with normal tracking spans 86px.
         -0.5px per character over 12 characters closes the 6px gap
         exactly — and the reference's own cap height (11px) matches
         Inter 600 at 14px, so the difference is tracking, not size. */
      letter-spacing: -0.5px;
      /* "In Progress" is the longest label in the row. Keep it on
         one line — a wrapped label pushes the card taller than its
         siblings and breaks the row's baseline rhythm. */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      /* The label needs a RIGHT bound for the ellipsis to engage:
         with only a "left" the box grows to fit the text and a long
         label spills over the card's edge instead of being clipped.

         The bound is NOT the card's right padding edge. The
         right-hand visuals (the Total card's delta pill + caption,
         the status cards' sparkline) live in that same corner, and
         a label bounded only by the card's edge runs UNDER them:
         "Total Tickets" collided with "vs last month" by 18px, and
         "In Progress" collided with its sparkline by 22px.

         Instead the bound stops short of the visual's left edge.
         The reference reserves that column:
           Total  (305)  label ink  90..170  aside  227..288
           Open   (249)  label ink  82..113  spark  176..231
           InProg (240)  label ink  83..149  spark  173..221
           Resolv (259)  label ink  84..137  spark  187..242
           Closed (299)  label ink  96..137  spark  223..282

         The bound is PROPORTIONAL to the card, because the
         reference's own clearances are proportional clearances.
         Measured off ref-full.png, the reference's right-hand
         visual always starts a fixed distance right of the card's
         text column:
           Open   (249)  bar starts 131   value ink ends 109
           InProg (240)  bar starts 131   value ink ends 111
           Resolv (259)  bar starts 134   value ink ends 112
           Closed (299)  bar starts 149   value ink ends 123

         i.e. the bar's left edge is 'value_left + 48' in every card
         (47, 48, 49, 53 measured) — a fixed offset, NOT a fixed
         width. A fixed WIDTH (the 106px the reference's Open card
         happens to carry) is what breaks on a narrower card: the
         Admin page's strip is 1152px rather than the reference's
         1352px, so its cards are 199-253px instead of 240-305px,
         and a right-anchored 106px bar lands at card+87 — right on
         top of the value's column.

         So the label's bound is expressed as an INSET from the
         card's right edge, and each card kind sets its own:
           .card.status  --label-right-inset: 87px   (the spark)
           .card.total   --label-right-inset: 135px  (the aside)

         The status card's 87px is the reference's 91px (the spark
         box's left edge minus its 24px of clearance) LESS 4px:
         CSS adds letter-spacing AFTER the final glyph, so a
         label's ink is 4px narrower than its box's scrollWidth.
         Without those 4px, "In Progress" was clipped by a single
         pixel on the reference's own 240px card.

         Both are derived from the reference's own measurements, and
         because the label's LEFT is also a constant (81px), the
         label's width falls out as 'card - 173' on the status
         cards and 'card - 217' on the Total card. On the
         reference's own 240px In Progress card that is 67px,
         exactly the 66px of ink the reference renders; on a
         narrower card it shrinks and the label ellipsises rather
         than sliding under the sparkline.

         The 'right' offset below is 'inset - 1px' because the
         containing block for an absolutely positioned child is
         the card's PADDING box, whose right edge sits 1px inside
         the card's border box. Writing it as calc(100% - inset)
         instead would resolve against that padding box and put
         the bound 91px too far left. */
      right: calc(var(--label-right-inset, 13px) - 1px);
      line-height: 1.25;
      /* The sparkline is absolutely positioned, so the text needs
         to sit above it in the paint order. */
      z-index: 1;
    }
    .value {
      /* Absolutely positioned so the digits' tops land on the
         reference's card+47. The 26px face has a 28.6px line box
         whose digits sit 5px below its top, so the box starts at
         card+42. */
      position: absolute;
      left: 81px;
      top: 42px;
      margin: 0;
      /* 26px, NOT 30px. The reference's digits were measured
         individually on every card:

           "156" -> 9, 14, 14    "42" -> 15, 13
           "28"  -> 14, 14       "62" -> 15, 13
           "24"  -> 14, 15

         Inter 700 reproduces all ten of those widths at 26px (and
         at no other size) — at 30px the digits come out 17-18px
         wide, 3px too fat. The reference's "156" ink box is 41x19;
         Inter 700 at 26px with -0.5px tracking measures 41x19
         exactly. */
      font-size: 26px;
      font-weight: 700;
      color: var(--color-text-primary);
      letter-spacing: -0.5px;
      line-height: 1.1;
      /* Bounded on the right for the same reason as the label: a
         four-digit total would otherwise run under the progress
         bar.

         The bound is a FIXED column, not the card's right edge. The
         reference's value is a column of its own, not text that
         grows to the right:
           Open   (249)  value ink  82..110   bar starts 131
           InProg (240)  value ink  83..112   bar starts 131
           Resolv (259)  value ink  84..113   bar starts 136
           Closed (299)  value ink  96..125   bar starts 150

         In every card the value's ink ends 19-25px before the bar's
         track begins. Bounding the value to the card's right edge
         instead let it run under the bar — the Open card's "46"
         (ink 82..115) overlapped a track starting at 86.

         So the value is bounded at card+125, the widest the
         reference's own value column ever reaches (the Closed
         card's three digits). A number too wide for that column
         ellipsises rather than colliding. */
      right: auto;
      width: 44px;
      /* A fixed column can be too narrow for a long number, so the
         value needs the same clipping treatment as the label. */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Total card: delta pill + caption, stacked right ──────── */
    .aside {
      /* Absolutely positioned: the reference stacks the delta pill at
         card+20..45 and the caption at card+54..63, both right-
         aligned to the card's content box. */
      position: absolute;
      right: 13px;
      top: 20px;
      bottom: 22px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: space-between;
      gap: 4px;
      min-width: 0;
    }
    .delta {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      /* 1px of vertical padding: a 15px face has a 22.5px line box
         and the reference's pill is 25px tall, so the padding adds
         only 2.5px. */
      padding: 1px 11px;
      border-radius: 999px;
      /* 15px — the reference's "12%" measures 10px tall. */
      font-size: 15px;
      font-weight: 700;
      line-height: 1.5;
      white-space: nowrap;
    }
    .delta.is-up {
      background: #E1F9EE;
      color: #09C05B;
    }
    .delta.is-down {
      background: #FEE2E2;
      color: #D92D20;
    }
    .caption {
      /* 15px, matching the reference's "vs last month" — it spans
         81px, which a smaller size cannot reach. */
      font-size: 15px;
      font-weight: 400;
      color: #A7ACCC;
      white-space: nowrap;
    }

    /* ── Status card: sparkline (top-right) + bar (bottom-right) ─
       The sparkline occupies the card's top-right corner and the
       progress bar sits below it, both RIGHT-ANCHORED to the card's
       content box and sharing the SAME right edge.

       Measured against the reference (Open card, offsets from the
       card's left edge, card = 248px wide):
         sparkline  176..230  (54px wide, rel y 19..43 = 24px tall)
         bar        124..230  (106px wide, rel y 59..67 = 8px tall)

       Both are absolutely positioned because the bar's left edge
       (124) sits alongside the value column (81..109) in the
       reference — a grid track would either squeeze the value into
       an ellipsis or push the curve past the card's border.

       The overflow clip matters: the sparkline atom draws with a
       visible overflow so a rounded stroke at the peak is not
       clipped mid-pixel. Without a clip here that stroke escapes
       the card and pokes through the top edge. */
    .spark {
      position: absolute;
      top: 16px;
      /* 13px from the card's padding edge — the reference's
         sparkline ends at card+230, which is 13px inside the 244px
         card's content box. */
      right: 13px;
      /* 54px, measured against the reference (the sparkline wash
         runs x=573..627 inside the Open card, i.e. offset
         176..230). It is much NARROWER than the bar — the reference
         draws a small trend glyph in the corner, not a wide chart.

         The min() clamp keeps the glyph inside the card when the
         strip collapses to two columns on a narrow phone: a fixed
         54px box right-anchored to a card narrower than 67px would
         otherwise spill out of the card's left edge.

         The SECOND clamp is the collision fix. The LABEL needs the
         room first. On the Admin page the cards are ~17% narrower
         than the reference's, so a 54px sparkline right-anchored
         at 13px starts at card+131 on a 199px In Progress card,
         while "In Progress" ends at card+153. The two overlapped
         by 22px.

         So the sparkline yields: it may not start before the
         visual anchor at card+129 (the same one the bar uses),
         which caps its width at 100% - 13 - 128 (the 128 is the
         anchor measured from the card's PADDING box, whose edge
         is 1px inside the border box). On the reference's own
         cards that leaves 107-157px, far more than the 54px it
         wants, so the reference's sparkline is untouched. Only on
         a card too narrow for both does it shrink, and the LABEL
         keeps its space. */
      width: min(54px, calc(100% - 141px));
      /* 26px, matching the reference's 24px curve band plus a
         pixel of headroom for the stroke's round cap. */
      height: 26px;
      overflow: hidden;
      pointer-events: none;
    }
    .spark atom-sparkline {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .bar {
      position: absolute;
      /* The bar's LEFT edge is anchored, not its width.
         Measured off ref-full.png, the reference bar starts a
         fixed distance right of the card value column:
           Open   (249)  bar 131..231   value ink  83..109
           InProg (240)  bar 131..222   value ink  84..111
           Resolv (259)  bar 134..242   value ink  85..112
           Closed (299)  bar 149..280   value ink  96..123

         'bar_left - value_left' is 48, 47, 49, 53 — a fixed ~48px
         offset in every card. So the bar left edge is card+81
         (the value column left) + 48 = card+129, and its RIGHT
         edge is anchored 18px inside the card border.

         Anchoring the left edge (rather than giving the bar a
         fixed 106px width) is what lets the bar survive a
         narrower card. The Admin page strip is 1152px wide
         rather than the reference 1352px, so its cards are
         199-253px instead of 240-305px; a right-anchored 106px
         bar then starts at card+87 and lands ON TOP of the value
         column (82..113) — the digits were drawn through the track.

         With the left edge anchored, the bar width falls out of
         the space between the anchor and the right inset, so a
         narrow card gets a proportionally shorter bar and never a
         collision. On the reference own cards this reproduces
         the measured widths (101, 92, 109, 132) — the 106 the
         reference Open card carries, to within a pixel.

         The 1px adjustments on both offsets are because the
         containing block for an absolutely positioned child is
         the card's PADDING box, whose edges sit 1px inside the
         card's border box. */
      left: 128px;
      /* 18px from the card border — the reference bar ends at
         card+231 on a 249px card, card+222 on a 240px one,
         card+242 on a 259px one and card+280 on a 299px one. */
      right: 17px;
      /* 20px, so the bar top edge lands at rel y 59 and its
         bottom at rel y 67 — measured against the reference (the
         bar fill row is y=61..65 and the track soft edges
         extend one row either side). */
      bottom: 20px;
      height: 8px;
      border-radius: 999px;
      /* The track is a very pale wash of the accent family, so each
         bar reads as "this status' slice of the total" rather than
         a generic grey. The reference's is #EEF1FD. */
      background: var(--track-bg, #EFF2FE);
      overflow: hidden;
    }
    .bar-fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--accent-color, var(--color-primary));
      transition: width var(--duration-fast, 150ms) var(--ease-out);
    }

    /* ── Accent families ─────────────────────────────────────────
       One custom property per card; the tile tint, the glyph, the
       sparkline and the bar fill all read from it so they stay in
       the same family. The tile tints and disc colours are sampled
       from the reference screenshot. */
    .status[data-accent='open'] {
      --accent-color: var(--stat-accent-open);
      --tile-bg: var(--stat-tile-open);
      --track-bg: #EFF2FE;
    }
    .status[data-accent='inProgress'] {
      --accent-color: var(--stat-accent-in-progress);
      --tile-bg: var(--stat-tile-in-progress);
      --track-bg: #FEF7EC;
    }
    .status[data-accent='resolved'] {
      --accent-color: var(--stat-accent-resolved);
      --tile-bg: var(--stat-tile-resolved);
      --track-bg: #E7F9F0;
    }
    .status[data-accent='closed'] {
      --accent-color: var(--stat-accent-closed);
      --tile-bg: var(--stat-tile-closed);
      --track-bg: #EEF1F7;
    }

    /* The status cards bound the label so it can never run under
       the sparkline, and they do it PROPORTIONALLY.

       The sparkline is 54px wide, right-anchored at 13px, so its
       left edge is at 'w - 67'. The reference's own clearance
       between the label's ink and the sparkline:
         Open   (249)  label ink ends 113   spark box starts 182
         InProg (240)  label ink ends 149   spark box starts 173  <- tightest
         Resolv (259)  label ink ends 137   spark box starts 192
         Closed (299)  label ink ends 135   spark box starts 232

       In Progress is the tightest at 24px of clear space, so the
       label's right bound is the sparkline's left edge minus 24:
       'w - 67 - 24' = 'w - 91'. On the reference's own 240px In
       Progress card that leaves the label 67px (81..148), which is
       exactly the 67px of ink the reference renders. On the 249px
       Open card it leaves 70px for a 32px label, and on the 299px
       Closed card 126px for a 41px label.

       The bound is 'w - 91', expressed as a fixed inset from the
       card's right edge. The earlier fixed 78px reserve only lined
       up on a card exactly the reference's width; on the Admin
       page's narrower cards it left the label running 22px under
       the sparkline.

       The label is given 4px MORE than the bare 'w - 91' bound,
       because CSS adds letter-spacing AFTER the final glyph: the
       "In Progress" advance width measures 71px where the ink is
       only 67px, so a box sized to the ink alone still trips the
       ellipsis. The 4px covers that trailing space, and the extra
       room is inside the reference's own 24px clearance. */
    .card.status {
      --label-right-inset: 87px;
    }
  `],
})
export class StatStripComponent {
  /** The total ticket count. Drives the summary card and every
   * status bar's fill fraction. */
  readonly total = input.required<number>();

  /** The four status buckets, in display order. */
  readonly statusItems = input.required<StatStripItem[]>();

  /** Label on the summary card. */
  readonly totalLabel = input<string>('Total Tickets');

  /**
   * Period-over-period change. `null` hides the delta pill.
   * Positive paints it green, negative red.
   */
  readonly delta = input<number | null>(null);

  /** Pre-formatted delta copy, e.g. `"+12%"`. */
  readonly deltaLabel = input<string>('');

  /** Caption under the delta, e.g. `"vs last month"`. */
  readonly caption = input<string>('');

  /** Thousands-separated value. */
  protected format(n: number): string {
    return n.toLocaleString('en-US');
  }

  /**
   * The status bar's fill percentage — this status's share of the
   * total. Clamped to 0..100 and guarded against a zero total.
   */
  protected percentOf(item: StatStripItem): number {
    const total = item.total ?? this.total();
    if (!total || total <= 0) return 0;
    const pct = (item.value / total) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /**
   * The accent colour a status family paints with. Read from the
   * same tokens the CSS uses, so the tile glyph and the bar fill
   * always match.
   */
  protected accentColor(accent: StatStripAccent): string {
    return ACCENT_COLORS[accent] ?? ACCENT_COLORS['primary'];
  }

  /**
   * The colour a family's SPARKLINE is drawn in. Usually the
   * accent, but the amber family uses the shared periwinkle — the
   * reference draws its In Progress curve blue-grey, not amber.
   */
  protected sparkColor(accent: StatStripAccent): string {
    return SPARK_COLORS[accent] ?? SPARK_COLORS['primary'];
  }
}
