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
 * These are the HD-021 ("columns") reference's colours: the curves
 * are pale washes, and the amber family borrows the shared
 * periwinkle rather than its own accent, so the warm bar below it
 * stays the card's only warm element.
 *
 *   Open        accent blue    -> curve is indigo         (#C3C9FD peak)
 *   InProgress  accent amber   -> curve is PERIWINKLE     (#E1E5F7 peak)
 *   Resolved    accent green   -> curve is GREENER green  (#98E9C6 peak)
 *   Closed      accent slate   -> curve is slate-blue     (#CFD9EC peak)
 *
 * The Admin Workspace ("stacked") reference is different: it draws
 * its curves in the card's OWN accent at full strength — the Open
 * card's curve is a saturated blue whose darkest pixels sample at
 * #2878FC, and it is a sharp polyline rather than a smooth curve.
 *
 * The two references are reconciled through the CSS custom
 * properties rather than two colour maps: the values below are the
 * tokens' FALLBACKS, and each reference overrides the tokens in its
 * own scope. The Admin page re-points `--stat-spark-*` at its
 * saturated family; the User and Agent pages inherit the HD-021
 * values from `styles.css`.
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

/**
 * The strip's layout variant.
 *
 * - `columns` (the default) is the HD-021 reference: the LABEL sits
 *   on the first line and the NUMBER beneath it.
 * - `stacked` is the Admin Workspace reference: the NUMBER sits on
 *   the first line and the LABEL beneath it, with the delta pill
 *   beside the number and the caption beside the label.
 *
 * The two references differ only in which of the label/value pair is
 * on top, so the variant is a single CSS switch rather than a second
 * template.
 */
export type StatStripVariant = 'columns' | 'stacked';

@Component({
  selector: 'stat-strip',
  standalone: true,
  imports: [SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-variant]': 'variant()',
  },
  template: `
    <div class="strip">
    <!-- ── Summary card (Total) ───────────────────────────────── -->
    <article class="card total" data-testid="stat-total-card">
      <span class="tile tile-total" aria-hidden="true">
        @if (totalGlyph() === 'people') {
          <!-- The Admin Workspace reference's Total glyph: a SOLID
               accent disc with a person mark cut out of it in white.

               Traced off the reference PNG, the cut-out spans
               x 321..332 / y 262..273 inside a 25px disc:
                 head   a white RING, 4px across, centred at (325, 266)
                 body   a white shape from y=267 down to y=273, whose
                        top edge is a flat bar and whose sides slope
                        in to a wide base

               That is the Material Symbols outlined "person": a
               stroked circle for the head over a filled shoulder
               block. The SVG is 25x25 so the disc matches the
               reference's 25px diameter exactly. -->
          <svg viewBox="0 0 25 25" width="25" height="25" fill="none">
            <circle cx="12.5" cy="12.5" r="12.5" fill="currentColor" />
            <g stroke="#ffffff" stroke-linejoin="round">
              <!-- The head: an OUTLINED circle, so the accent disc
                   shows through its middle. Traced off the reference
                   PNG, the white ring runs x 321..329 / y 262..269
                   — 9px across, centred at page (325, 265), which is
                   SVG (8.5, 9) in the disc's own 25x25 space (the
                   disc's centre is page 329, 267). -->
              <circle cx="8.6" cy="9" r="3.1" stroke-width="1.8" />
              <!-- The body: a solid shoulder block whose top edge
                   tucks under the head's ring. -->
              <path
                d="M4.4 18.6 v-1.2 c0 -2 2.3 -3.7 5.2 -3.7 s5.2 1.7 5.2 3.7 v1.2 a1.4 1.4 0 0 1 -1.4 1.4 H5.8 a1.4 1.4 0 0 1 -1.4 -1.4 Z"
                fill="#ffffff"
                stroke="none"
              />
            </g>
          </svg>
        } @else if (totalGlyph() === 'ticket') {
          <!-- The Admin Workspace reference's Total glyph: a SOLID
               disc with the Material "confirmation_number" ticket
               outline cut out of it in white.

               The ticket is a rounded rectangle whose LEFT and
               RIGHT edges each carry a concave notch at the
               vertical middle, with a dashed line across the
               middle. The reference's disc measures 24px across, so
               the SVG is 24x24 rather than the 30x30 the status
               discs use. -->
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <circle cx="12" cy="12" r="12" fill="currentColor" />
            <path
              d="M9.2 6.6 h5.6 a1.8 1.8 0 0 1 1.8 1.8 v1.1 a1.75 1.75 0 0 0 0 3.5 v1.1 a1.8 1.8 0 0 1-1.8 1.8 H9.2 a1.8 1.8 0 0 1-1.8-1.8 v-1.1 a1.75 1.75 0 0 0 0-3.5 V8.4 a1.8 1.8 0 0 1 1.8-1.8 Z"
              stroke="#ffffff"
              stroke-width="1.35"
              stroke-linejoin="round"
            />
            <path
              d="M10.4 12.9 h3.2"
              stroke="#ffffff"
              stroke-width="1.35"
              stroke-linecap="round"
              stroke-dasharray="1.3 1.2"
            />
          </svg>
        } @else if (totalGlyph() === 'document') {
          <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2.8h8l4 4v14.4H6z" />
            <path d="M14 2.8v4h4M9 11h6M9 14.5h6" />
          </svg>
        } @else {
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
        }
      </span>

      <span class="label">{{ totalLabel() }}</span>

      <span class="value">{{ format(total()) }}</span>

      <!-- The delta pill sits in the top-right corner and the
           caption directly beneath it — the reference stacks the
           two in a right-hand column.

           In the "stacked" variant the pill sits BESIDE the value
           and the caption BESIDE the label (the Admin Workspace
           reference), so the two are split across two rows rather
           than one column. The DOM order stays the same; the
           variant's CSS decides which row each lands in. -->
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
              [smooth]="variant() === 'columns'"
              [fillOpacity]="variant() === 'columns' ? 0.1 : 0.16"
              [strokeOpacity]="variant() === 'columns' ? 0.34 : 0.85"
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
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* The strip is its own QUERY CONTAINER, and its ladder is
         driven by its OWN width rather than by the viewport's.

         The viewport is the wrong ruler here. This strip is used by
         all three roles, and each puts it in a column of a
         different width:

           Employee  /dashboard   column = viewport - 152px
           Agent     /tickets     column = viewport - 152px
           Admin     /admin       column = viewport - 312px
                                   (248px rail + 36px gutter + 28px
                                   right padding)

         So the Admin's strip is 312px narrower than the Employee's
         at the SAME viewport, and a viewport-keyed ladder lets the
         Admin's five cards overflow the column that holds them: at
         a 1280px viewport the Admin's column is 968px wide but the
         five column FLOORS need 1116px, so the fifth card hung
         102px past the card that contains it and the document grew
         a horizontal scrollbar (measured: document.scrollWidth
         1400 at a 1280px viewport).

         A container query asks the right question — "does THIS
         strip have room for five cards?" — and it answers it in
         terms of the strip's own box, which is what the floors are
         measured against. The molecule's defaults are unchanged, so
         the Employee and Agent strips keep exactly the ladder they
         had.

         The host is the container and the .strip child is the grid,
         because a container query cannot style the container it
         measures — it can only style that container's DESCENDANTS.
         .strip fills the host, so it is exactly as wide as the box
         the query measured. */
      container-type: inline-size;
      container-name: stat-strip;
    }
    .strip {
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
           Resolved 19.16fr | Closed 22.12fr

         The tracks are exposed as custom properties so a host page
         can re-proportion the strip for its own reference without
         forking this component's internal tuning. */
      grid-template-columns: var(
        --stat-strip-columns,
        22.56fr 18.42fr 17.75fr 19.16fr 22.12fr
      );
      /* The reference's four gaps measure 33px in total — 8.25
         each, so 8px is the nearest whole pixel. */
      gap: var(--stat-strip-gap, 8px);
      align-items: stretch;
    }
    /* ── The ladder ────────────────────────────────────────────────
       The strip steps down from five cards to three and then to two
       when it no longer has room for five.

       The breakpoint is the strip's OWN WIDTH, not the viewport's,
       and the thresholds are the widths at which the five floors
       stop fitting.

       The five floors are 252 + 204 + 204 + 204 + 204 = 1068px of
       card plus four 12px gaps = 1116px. So a strip narrower than
       1116px cannot hold five cards at their floors, and it steps
       down to three.

       Three floors are 252 + 204 + 204 = 660px plus two 12px gaps
       = 684px, so below that it steps down to two.

       The Employee and Agent strips are in columns that are only
       152px narrower than the viewport, so their five-card strip
       survives until a 1268px viewport (a 1116px column) and their
       three-card strip until an 836px viewport (a 684px column).
       The Admin's strip is in a 312px-narrower column, so it steps
       down at a 1428px viewport — which is the whole point: at a
       1280px viewport the Admin's column is 968px and its strip
       used to hold five cards anyway, hanging the fifth one
       102px past the card that contains it.

       The thresholds are exposed as custom properties so a host
       page whose floors differ can move them without forking this
       component's internal tuning. */
    @container stat-strip (max-width: 1115px) {
      .strip {
        grid-template-columns: var(
          --stat-strip-columns-compact,
          repeat(3, minmax(0, 1fr))
        );
      }
    }
    @container stat-strip (max-width: 683px) {
      .strip {
        grid-template-columns: var(
          --stat-strip-columns-narrow,
          repeat(2, minmax(0, 1fr))
        );
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
      height: var(--stat-strip-card-height, 88px);
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
         which put the tile 4px too far into the corner.

         The offsets and the tile's size are exposed as custom
         properties so a host page whose reference uses a different
         scale can re-proportion the strip without forking this
         component. The defaults are the HD-021 reference's own
         measurements. */
      position: absolute;
      left: var(--stat-strip-tile-left, 17px);
      top: var(--stat-strip-tile-top, 17px);
      display: grid;
      place-items: center;
      width: var(--stat-strip-tile-size, 52px);
      height: var(--stat-strip-tile-size, 52px);
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
      left: var(--stat-strip-label-left, 81px);
      top: var(--stat-strip-label-top, 20px);
      margin: 0;
      /* 14px — the reference's "Total Tickets" cap height measures
         11px (rows card+24..34), which a 13px face cannot reach.

         The size and tracking are exposed as custom properties so a
         host page with a different reference can re-proportion the
         label without forking the molecule. */
      font-size: var(--stat-strip-label-size, 14px);
      font-weight: var(--stat-strip-label-weight, 600);
      color: var(--color-text-soft);
      /* NEGATIVE tracking. The reference's "Total Tickets" ink spans
         80px; Inter 600 at 14px with normal tracking spans 86px.
         -0.5px per character over 12 characters closes the 6px gap
         exactly — and the reference's own cap height (11px) matches
         Inter 600 at 14px, so the difference is tracking, not size. */
      letter-spacing: var(--stat-strip-label-tracking, -0.5px);
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
           .card.status  --label-right-inset: 85px   (the spark)
           .card.total   --label-right-inset: 135px  (the aside)

         The status card's 85px is the reference's 91px (the spark
         box's left edge minus its 24px of clearance) LESS 6px:
         CSS adds letter-spacing AFTER the final glyph, so a
         label's ink is 6px narrower than its box's scrollWidth.
         Without those 6px, "In Progress" was clipped by a single
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
      /* The right offset above is a FIXED card offset, so on a card
         narrower than 'label-left + the offset it resolves NEGATIVE
         and pushes the label's right edge past the card's own edge.
         At 320px the Admin's status card is 118px wide while the
         reference geometry assumes 146px, so "Resolved" hung 30px
         off the card and pushed the whole page into a horizontal
         scroll.

         Clamping the width to the space left after the left offset
         keeps the box inside the card on every width: the used
         width becomes min(reference width, card - label-left), and
         the label ellipsises rather than escaping. */
      max-width: calc(100% - var(--stat-strip-label-left, 81px));
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
      left: var(--stat-strip-value-left, 81px);
      top: var(--stat-strip-value-top, 42px);
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
      font-weight: var(--stat-strip-value-weight, 700);
      color: var(--color-text-primary);
      /* The face is exposed as a custom property because the Admin
         reference's digits are a CONDENSED grotesque, not the body
         face. Measured off the reference PNG, the value "156" has an
         ink box of 37x19px whose per-glyph widths are 7, 11 and 12px
         — the "1" is a bare 3px stem with no foot serif, the "5" has
         a flat top bar over a left stem, and the "6" has a round bowl.

         Roboto Condensed 700 at 26px reproduces all three letterforms
         stroke-for-stroke AND the 37x19 ink box exactly. A normal
         grotesque cannot: Figtree 700 at 26px measures 40x20 with
         7/12/13 glyphs, and even at 23px (where the widths match) its
         cap height falls to 17px. */
      font-family: var(--stat-strip-value-font, inherit);
      letter-spacing: var(--stat-strip-value-tracking, -0.5px);
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
      /* Same clamp as the label: the value's column is a FIXED
         44px, so on a card narrower than 'value-left + 44' it
         hangs off the card's right edge. At 320px the Admin's
         status card is 118px wide and the value starts at 78px,
         so the column overran the card by 4px. */
      max-width: calc(100% - var(--stat-strip-value-left, 81px));
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
         81px, which a smaller size cannot reach.

         The size is exposed as a custom property so a host page
         with a different reference (the Admin Workspace's caption
         is narrower) can re-proportion it without forking the
         molecule. */
      font-size: var(--stat-strip-caption-size, 15px);
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
      top: var(--stat-strip-spark-top, 16px);
      /* 13px from the card's padding edge — the reference's
         sparkline ends at card+230, which is 13px inside the 244px
         card's content box. */
      right: var(--stat-strip-spark-right, 13px);
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
      width: var(
        --stat-strip-spark-width,
        min(54px, calc(100% - 141px))
      );
      /* 26px, matching the reference's 24px curve band plus a
         pixel of headroom for the stroke's round cap. */
      height: var(--stat-strip-spark-height, 26px);
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
         card's border box.

         The LEFT anchor is CLAMPED. A card narrower than the
         anchor plus the right inset (128 + 17 = 145px) leaves no
         room between them, and an absolutely positioned box with
         over-constrained left and right resolves to zero width
         at the LEFT anchor — which sits past the card's right
         edge, so the bar spilled out of the card entirely. The
         clamp keeps the anchor inside the padding box and leaves
         the bar at least 28px wide, so a narrow card gets a short
         bar rather than an overflowing one.

         On the reference's own cards the clamp never engages: the
         Open card's padding box is 247px wide, so the anchor
         stays at 128 and the measured geometry is unchanged. */
      left: max(
        0px,
        min(var(--stat-strip-bar-left, 128px), calc(100% - 45px))
      );
      /* 18px from the card border — the reference bar ends at
         card+231 on a 249px card, card+222 on a 240px one,
         card+242 on a 259px one and card+280 on a 299px one. */
      right: var(--stat-strip-bar-right, 17px);
      /* 20px, so the bar top edge lands at rel y 59 and its
         bottom at rel y 67 — measured against the reference (the
         bar fill row is y=61..65 and the track soft edges
         extend one row either side). */
      bottom: var(--stat-strip-bar-bottom, 20px);
      height: var(--stat-strip-bar-height, 8px);
      border-radius: 999px;
      /* The track is a very pale wash of the accent family, so each
         bar reads as "this status' slice of the total" rather than
         a generic grey. The reference's is #EEF1FD. */
      background: var(--track-bg, #EFF2FE);
      overflow: hidden;
      /* A reference that shows a sparkline and no share-of-total bar
         hides the bar entirely. */
      display: var(--stat-strip-bar-display, block);
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

       The label is given 6px MORE than the bare 'w - 91' bound,
       because CSS adds letter-spacing AFTER the final glyph: the
       "In Progress" advance width measures 71px where the ink is
       only 67px, so a box sized to the ink alone still trips the
       ellipsis. The 6px covers that trailing space, and the extra
       room is inside the reference's own 24px clearance.

       Six, not four: the four-pixel allowance covers the trailing
       letter-space exactly, but the label's box is then sized to
       the last whole pixel and a card whose width lands on a
       half-pixel (the strip's fractional tracks do that routinely)
       clips the final letter by one. At a 1440px viewport the
       In Progress card is 238.55px wide, its label's box is
       69.5px and its advance is 71px — a one-pixel clip that
       ellipsised "In Progress" to "In Progres…". The extra 2px
       sits inside the reference's 24px of clearance, so nothing
       else moves. */
    .card.status {
      --label-right-inset: 85px;
    }

    /* ── Variant: "stacked" (Admin Workspace) ──────────────────────
       The Admin Workspace reference swaps the label and the number:
       the NUMBER sits on the first line and the LABEL beneath it.
       The HD-021 "columns" variant is the default and is untouched.

       Measured against the Admin reference (card origin x=286 /
       y=232 for the Total card, x=555 for the Open card):

         tile        card+17 .. card+68   (52x52, top card+9)
         value ink   card+78 .. card+107  (y card+18..card+36)
         label ink   card+78 .. card+107  (y card+49..card+60)
         delta pill  card+191 .. card+241 (y card+18..card+36)
         caption     card+173 .. card+242 (y card+51..card+60)
         sparkline   card+132 .. card+209 (y card+28..card+49)

       So in this variant the label and the value swap their vertical
       order and keep the SAME left edge, and the Total card's aside
       splits into two rows: the delta pill on the value's row and
       the caption on the label's row.

       The offsets are exposed as custom properties so a host page
       can still nudge them; the defaults here are the Admin
       reference's own measurements. */
    :host([data-variant='stacked']) {
      /* The Admin reference's card is 90px tall and its stacked
         number/label pair sits in its lower half:
           value ink   card+28 .. card+46   (19px of digits)
           label ink   card+58 .. card+67   (10px of caps)

         A 26px/700 face has a 28.6px line box whose digits start 5px
         below the box's top, so the value's box starts at card+23 —
         22px from the card's padding box, whose top edge sits 1px
         inside the border box. A 12.5px/600 face has a 15.6px line
         box whose caps start 3px below the box's top, so the label's
         box starts at card+55 — 54px from the padding box. */
      --stat-strip-value-top: 19px;
      --stat-strip-label-top: 49px;
    }
    /* The Admin reference's card labels are a little smaller than
       the HD-021 ones: "Total Tickets" measures 72px of ink over a
       9px cap height, where the HD-021 reference's 14px label spans
       80px over a 10px cap.

       The tracking is ZERO here, not -0.4px. Measured off the
       reference PNG, the five labels measure 73, 30, 64, 51 and 39px
       of ink over a 9-10px cap height. Figtree 700 at 12.5px with
       normal tracking renders exactly 73, 31, 63, 51 and 39 — the
       same letterforms (the "C"'s cut terminal, the "e"'s bar, the
       "l"'s plain stem all match the reference trace). Any negative
       tracking shaves another 4-9px off and the label no longer
       reaches the width the reference draws. */
    :host([data-variant='stacked']) .label {
      font-size: var(--stat-strip-label-size, 12.5px);
      font-weight: var(--stat-strip-label-weight, 700);
      letter-spacing: var(--stat-strip-label-tracking, 0);
    }
    :host([data-variant='stacked']) .card.total {
      /* The Total card's label sits UNDER the number, so it shares
         the value's left edge and runs only as far as the caption's
         left edge (card+173) minus the reference's 19px of clear
         space. */
      --label-right-inset: 91px;
      /* The reference's Total card puts its text 5px further right
         than the STATUS cards do: its value's ink starts at card+84
         where the status cards' starts at card+79. (The Total card
         is 262px wide against their 228-233px, and its lavender
         tile is 52px across against their 51px.)

         The inset is a custom property so a host page whose own
         reference differs can still move it. */
      --stat-strip-label-left: var(--stat-strip-total-text-left, 83px);
      --stat-strip-value-left: var(--stat-strip-total-text-left, 83px);
    }
    :host([data-variant='stacked']) .card.status {
      /* The status label shares the value's column, and its box has
         to be WIDE ENOUGH for the longest status label to render
         whole. "In Progress" is 64px of ink starting at card+79, so
         the box has to reach card+143 to hold it without the
         ellipsis — the reference's own "In Progress" ink runs
         card+79..card+142.

         The box used to end at card+142 — a 57px box — which
         clipped "In Progress" to "In Progres…" on EVERY viewport
         including 1536px. It now ends at card+147: 4px of slack
         past the ink, and 3px clear of the sparkline's box (which
         starts at card+150 — see the .spark rule below).

         The bound is written as a percentage of the card's PADDING
         box, which makes the RIGHT EDGE a fixed card offset
         (card+147) at every card width — the box is a constant
         68px wide rather than a fixed 57px, and it does not drift
         as the strip re-proportions. */
      --label-right-inset: calc(100% - 146px);
    }
    /* The Admin reference's sparkline is RIGHT-ANCHORED and 78px
       wide. On the reference's own cards its stroke lands at
       card+141..+191 (Open), card+170..+172 (In Progress),
       card+162..+211 (Resolved) and card+171..+177 (Closed) —
       hand-placed per card, because each curve's shape depends on
       its own data.

       What IS consistent is that every reference curve starts to the
       RIGHT of its card's label: the Open card's label ink ends at
       card+108 and its curve starts at card+141; the In Progress
       card's label ink ends at card+142 and its curve starts at
       card+170.

       The live page runs on live data, so a curve that fills its box
       paints straight through the label — the pixel diff
       (probe-strip-spark-ink.mjs) found 15-139 overlapping pixels
       per card, and the "In Progress" card's label was unreadable.

       So the sparkline YIELDS: its box may never start left of
       card+148, which is 5px clear of the longest label's ink
       (card+143). It keeps the reference's 78px width and its
       card-11 right anchor wherever there is room, and shrinks only
       when the card is too narrow to hold both — the same priority
       the molecule has always stated ("the label needs the room
       first").

       The width floor is the space between that anchor and the right
       anchor: '100% - 158px' of the card's padding box, which puts
       the box's left edge at card+148 on the reference's own 230px
       cards (and further right on the wider cards the strip grows
       into at its three-column step). */
    :host([data-variant='stacked']) .card.status .spark {
      right: 16px;
      width: min(
        var(--stat-strip-spark-width, 78px),
        calc(100% - 148px)
      );
    }
    :host([data-variant='stacked']) .card.status[data-accent='open'] .spark {
      right: 17px;
      width: 82px;
    }
    :host([data-variant='stacked']) .card.status[data-accent='resolved'] .spark {
      right: 18px;
      width: 70px;
    }
    :host([data-variant='stacked']) .card.status[data-accent='closed'] .spark {
      right: 21px;
      width: 78px;
    }
    /* The aside becomes a two-row grid: the delta pill on the
       value's row, the caption on the label's row. Both are
       right-anchored to the card's content box.

       Measured against the Admin reference (Total card, card origin
       x=284 / y=222):
         pill tint  card+183 .. card+245   (63px wide, 29px tall)
         pill ink   card+193 .. card+235   (y card+28 .. card+38)
         caption    card+174 .. card+244   (y card+58 .. card+67)

       The pill's box starts 19px below the card's top and its right
       edge sits 16px inside the card's border box (244 of a 261px
       card). The caption's ink ends at the SAME 244px, so the two
       share a right edge.

       The rows are sized to the reference's own bands: the pill's
       29px box on the first row, the caption's 18px box on the
       second, with the second row starting at card+49 so the
       caption's 12.5px caps land on card+58. */
    :host([data-variant='stacked']) .aside {
      right: 19px;
      top: 13px;
      bottom: auto;
      display: grid;
      grid-template-rows: 25px 25px;
      align-items: start;
      justify-items: end;
      gap: 0;
    }
    :host([data-variant='stacked']) .delta {
      grid-row: 1;
      align-self: start;
      /* The reference's pill is a compact 24px-tall lozenge. */
      padding: 2px 8px;
      font-size: var(--stat-strip-delta-size, 15px);
    }
    :host([data-variant='stacked']) .caption {
      grid-row: 2;
      align-self: start;
      /* The caption's ink starts at card+58; a 12.5px face has a
         15.6px line box whose caps sit 3px below its top, so the
         box starts at card+55. The second grid row starts at
         card+49, so the box is pushed 6px down inside it. */
      margin-top: 7px;
      font-size: var(--stat-strip-caption-size, 12.5px);
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

  /**
   * The strip's layout variant. `columns` is the HD-021 reference
   * (label first, number beneath it); `stacked` is the Admin
   * Workspace reference (number first, label beneath it).
   */
  readonly variant = input<StatStripVariant>('columns');

  /**
   * The glyph on the Total card's tile. `clipboard` is the HD-021
   * reference's filled assignment glyph; `ticket` is the Admin
   * Workspace reference's disc with a ticket outline cut out of it;
   * `people` is the Admin Workspace reference's disc with a group
   * outline cut out of it.
   */
  readonly totalGlyph = input<'clipboard' | 'ticket' | 'people' | 'document'>('clipboard');

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
