/**
 * sparkline — atom (HD-019).
 *
 * A tiny inline-SVG trend line for the Tickets stat cards. No
 * axes, no labels, no gridlines — just a stroked polyline with a
 * soft gradient fill beneath it, sized to sit in the bottom-right
 * of a stat card.
 *
 * Design notes:
 *   - The viewBox is fixed (0 0 100 32) and the SVG scales to the
 *     host width via `preserveAspectRatio="none"`, so the caller
 *     controls the rendered size and the polyline coordinates stay
 *     resolution-independent.
 *   - `vector-effect="non-scaling-stroke"` keeps the 2px stroke
 *     crisp regardless of how much the SVG is stretched.
 *   - Input is a plain `number[]`; normalization (min/max, the
 *     flatline case, the empty case) happens in a `computed` so a
 *     caller can hand over a raw daily-count series without
 *     pre-processing it.
 *   - `smooth` switches the rendering from straight polyline
 *     segments to a soft cubic Bézier curve. The WDS-2026 reference
 *     draws its stat-card sparklines as curves; the agent Tickets
 *     page keeps the straight-segment look, so the flag is opt-in.
 *
 * Edge cases handled:
 *   - **Empty array** → renders nothing (no `<polyline>`) so the
 *     stat card degrades to icon + number rather than a stray
 *     dot at the origin.
 *   - **Single point** → rendered as a flat centered line at
 *     mid-height; without this the min===max branch would divide
 *     by zero.
 *   - **All-equal values** (e.g. seven days of zero) → the
 *     "no variance" branch draws a straight line through the
 *     vertical middle instead of collapsing every point onto the
 *     bottom edge.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

interface Point {
  x: number;
  y: number;
}

const VIEW_W = 100;
const VIEW_H = 32;
/** Inset from the top/bottom edges so the stroke isn't clipped. */
const PAD_Y = 3;

@Component({
  selector: 'atom-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg
        class="spark"
        [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color()" [attr.stop-opacity]="fillOpacity()" />
            <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId() + ')'" />
        @if (smooth() && smoothPath(); as d) {
          <path
            class="spark-line"
            [attr.d]="d"
            [attr.stroke]="color()"
            [attr.stroke-opacity]="strokeOpacity()"
            vector-effect="non-scaling-stroke"
          />
        } @else {
          <polyline
            class="spark-line"
            [attr.points]="g.line"
            [attr.stroke]="color()"
            [attr.stroke-opacity]="strokeOpacity()"
            vector-effect="non-scaling-stroke"
          />
        }
      </svg>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 24px;
    }
    .spark {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .spark-line {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `],
})
export class SparklineComponent {
  /**
   * The series to plot. Raw values — no normalization expected.
   * A 14-element daily-created series is the intended use, but
   * any length ≥ 1 works.
   */
  readonly points = input.required<number[]>();

  /** Stroke + gradient color. Defaults to the brand primary. */
  readonly color = input<string>('var(--color-primary)');

  /**
   * Gradient id. Must be unique per rendered instance or two
   * sparklines on the same page will share (and fight over) the
   * first one that registers the `<defs>` id. The Tickets page
   * passes an explicit id derived from the stat-card label.
   */
  readonly gradientId = input<string>('sparkline-gradient');

  /**
   * Draw the series as a smooth cubic Bézier curve instead of
   * straight polyline segments. The WDS-2026 reference's stat-card
   * sparklines are curves; the agent Tickets page keeps the
   * straight-segment look.
   */
  readonly smooth = input<boolean>(false);

  /**
   * Opacity of the gradient fill beneath the line. The reference's
   * stat-card sparklines wash out very faintly, so the strip passes
   * a low value; the default suits the agent page's fuller fill.
   */
  readonly fillOpacity = input<number>(0.22);

  /**
   * Opacity of the stroke itself. The WDS-2026 reference draws its
   * stat-card sparklines as a pale periwinkle wash (about 30% of
   * the accent) rather than a solid line, so the trend reads as a
   * hint. The agent page's sparklines stay at full strength.
   */
  readonly strokeOpacity = input<number>(1);

  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;

  /**
   * The filled area path. Follows the smooth curve when `smooth`
   * is on, so the gradient fill and the stroke never disagree.
   */
  protected readonly areaPath = computed<string>(() => {
    const g = this.geometry();
    if (!g) return '';
    const d = this.smooth() ? this.smoothPath() : null;
    if (!d) return g.area;
    // Close the curve down to the bottom edge to make the fill.
    const raw = this.points();
    const n = raw.length;
    const lastX = ((n - 1) / (n - 1)) * VIEW_W;
    return `${d} L ${round(lastX)},${VIEW_H} L 0,${VIEW_H} Z`;
  });

  /**
   * Smooth the polyline into a cubic Bézier curve.
   *
   * The WDS-2026 reference draws its stat-card sparklines as soft
   * S-curves rather than straight segments — the curve reads as a
   * trend, not as a bar chart. The straight-segment path stays the
   * default so the agent Tickets page's cards are unaffected.
   *
   * Uses the standard "control point at the midpoint, tension pulled
   * back toward the anchor" scheme: each segment's handles are
   * offset by a fraction of the neighbouring span, so a series with
   * widely-spaced values still curves without overshooting.
   */
  protected readonly smoothPath = computed<string | null>(() => {
    const raw = this.points();
    if (raw.length < 3) return null;

    const g = this.geometry();
    if (!g) return null;

    // Re-derive the point list from the same normalization the
    // polyline uses, so the curve and the fill always agree.
    const n = raw.length;
    const min = Math.min(...raw);
    const max = Math.max(...raw);
    const span = max - min;

    const xs = Array.from({ length: n }, (_, i) => (i / (n - 1)) * VIEW_W);
    const ys =
      span === 0
        ? new Array<number>(n).fill(VIEW_H / 2)
        : raw.map((v) => PAD_Y + (VIEW_H - PAD_Y * 2) * (1 - (v - min) / span));

    const pts = xs.map((x, i) => ({ x, y: ys[i] }));

    // Start at the first point, then a cubic Bézier per segment.
    const tension = 0.22;
    let d = `M ${round(pts[0].x)},${round(pts[0].y)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      // The previous point (or the current one at the start) sets
      // the incoming handle's direction.
      const prev = pts[i - 1] ?? p0;
      const next = pts[i + 2] ?? p1;

      const c1x = p0.x + (p1.x - prev.x) * tension;
      const c1y = p0.y + (p1.y - prev.y) * tension;
      const c2x = p1.x - (next.x - p0.x) * tension;
      const c2y = p1.y - (next.y - p0.y) * tension;

      // Clamp the handles inside the padded band. The handle length
      // is derived from the neighbouring points, so a steep step
      // (e.g. 29 -> 3) can otherwise push a control point past the
      // viewBox edge — the curve would visibly overshoot the card.
      d +=
        ` C ${round(c1x)},${round(clampY(c1y))}` +
        ` ${round(c2x)},${round(clampY(c2y))}` +
        ` ${round(p1.x)},${round(p1.y)}`;
    }

    return d;
  });

  /**
   * Normalized SVG geometry. Returns null when the series is
   * empty (nothing to draw) so the template can skip the `<svg>`
   * entirely.
   */
  protected readonly geometry = computed<{ line: string; area: string } | null>(
    () => {
      const raw = this.points();
      if (raw.length === 0) return null;

      const n = raw.length;
      const min = Math.min(...raw);
      const max = Math.max(...raw);
      const span = max - min;

      // x positions are evenly spaced across the full viewBox
      // width. With a single point, park it at the left edge so
      // the flatline below reads as "one reading".
      const xs: number[] =
        n === 1 ? [0] : Array.from({ length: n }, (_, i) => (i / (n - 1)) * VIEW_W);

      let ys: number[];
      if (span === 0) {
        // No variance (e.g. every day zero) — draw through the
        // middle instead of pinning every point to the floor.
        const mid = VIEW_H / 2;
        ys = new Array<number>(n).fill(mid);
      } else {
        // Invert: larger value → smaller y (SVG y grows downward).
        // Pad top and bottom so the stroke isn't clipped by the
        // viewBox edge.
        const usable = VIEW_H - PAD_Y * 2;
        ys = raw.map((v) => PAD_Y + usable * (1 - (v - min) / span));
      }

      const pts: Point[] = xs.map((x, i) => ({ x, y: ys[i] }));
      const line = pts.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');

      // Close the polyline down to the bottom edge to make the
      // gradient fill area. Baseline is VIEW_H (the very bottom)
      // so the fade completes right at the card edge.
      const first = pts[0];
      const last = pts[pts.length - 1];
      const area = `M ${round(first.x)},${VIEW_H} L ${line.replace(/ /g, ' L ')} L ${round(last.x)},${VIEW_H} Z`;

      return { line, area };
    },
  );
}

/** Two decimals is plenty at this scale and keeps the DOM small. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Clamp a Bézier control point's y into the padded band so the
 * curve can never be drawn outside the viewBox.
 */
function clampY(y: number): number {
  return Math.max(PAD_Y, Math.min(VIEW_H - PAD_Y, y));
}