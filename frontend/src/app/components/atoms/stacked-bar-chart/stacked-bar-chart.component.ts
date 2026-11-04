/**
 * stacked-bar-chart — atom (WDS-2026 Admin Workspace).
 *
 * The "Ticket Trends" chart: one stacked bar per day, each bar
 * split into its per-status segments, with a y-axis grid, axis
 * labels, and a legend.
 *
 *      40 ┤         ▓
 *      30 ┤    ▓    ▓
 *      20 ┤ ▓  ▓    ▓
 *      10 ┤ ▓  ▓ ▓  ▓
 *       0 └────────────
 *          Oct10 Oct11 …
 *
 * Pure SVG so the bars scale with the card and need no charting
 * dependency. The plot area is inset on the left to leave room
 * for the y-axis labels and on the bottom for the date labels.
 *
 * The y-axis maximum is rounded UP to the next multiple of the
 * tick step (10 by default), so the top gridline always sits at a
 * round number — matching the reference, whose top label is "40".
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export interface StackedSegment {
  /** Stable key — used for the legend and trackBy. */
  readonly key: string;
  /** The segment's value for this bar. */
  readonly value: number;
  /** The colour this segment paints with. */
  readonly color: string;
  /**
   * The colour at the segment's TOP edge. When set, the segment is
   * painted with a vertical gradient from `color` (at the bottom) to
   * this colour (at the top) — the reference's "In Progress" band
   * reads as a pink→amber sweep rather than a flat fill.
   */
  readonly colorTop?: string;
}

export interface StackedBar {
  /** Stable key — the bar's label on the x-axis. */
  readonly key: string;
  /** The bar's segments, bottom-first. */
  readonly segments: StackedSegment[];
}

export interface ChartLegendEntry {
  readonly key: string;
  readonly label: string;
  readonly color: string;
}

@Component({
  selector: 'atom-stacked-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="chart"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <defs>
        <!-- One vertical gradient per coloured segment. The gradient
             runs from the segment's own colour at its bottom edge to
             colorTop at its top edge, so a segment can sweep from
             one hue to another the way the reference's "In Progress"
             band does. -->
        @for (grad of gradients(); track grad.id) {
          <linearGradient
            [attr.id]="grad.id"
            x1="0"
            y1="1"
            x2="0"
            y2="0"
          >
            <stop offset="0%" [attr.stop-color]="grad.from" />
            <stop offset="100%" [attr.stop-color]="grad.to" />
          </linearGradient>
        }
      </defs>

      <!-- The y-axis line. The reference draws a pale vertical rule
           at the plot's left edge, running from the top gridline
           down to the baseline. -->
      <line
        class="axis-line"
        [attr.x1]="plotLeft()"
        [attr.x2]="plotLeft()"
        [attr.y1]="plotTop()"
        [attr.y2]="plotBottom()"
      />

      <!-- Horizontal gridlines + their y-axis labels. -->
      @for (tick of ticks(); track tick.value) {
        <line
          class="gridline"
          [attr.x1]="plotLeft()"
          [attr.x2]="plotRight()"
          [attr.y1]="tick.y"
          [attr.y2]="tick.y"
        />
        <text class="axis-label" [attr.x]="plotLeft() - 8" [attr.y]="tick.y + 4">
          {{ tick.value }}
        </text>
      }

      <!-- The bars. Each bar is a stack of rounded-top segments
           drawn from the baseline upward. -->
      @for (bar of renderedBars(); track bar.key) {
        @for (seg of bar.segments; track seg.key) {
          <rect
            class="segment"
            [attr.x]="seg.x"
            [attr.y]="seg.y"
            [attr.width]="seg.w"
            [attr.height]="seg.h"
            [attr.fill]="seg.fill"
            rx="2"
          />
        }
        <text class="axis-label x-label" [attr.x]="bar.centerX" [attr.y]="height() - 6">
          {{ bar.key }}
        </text>
      }
    </svg>
  `,
  styles: [`
    .chart {
      display: block;
      width: 100%;
      /* The SVG's intrinsic aspect ratio comes from its viewBox, so
         its height follows its width. Pinning it to 100% of the
         parent would letterbox the chart inside a taller row and
         push the baseline away from the x-axis labels. */
      height: auto;
      overflow: visible;
    }
    .gridline {
      stroke: var(--chart-grid, #EDF1F7);
      stroke-width: 1;
    }
    /* The reference draws a pale vertical rule down the plot's left
       edge — the y-axis itself — from the top gridline to the
       baseline. */
    .axis-line {
      stroke: var(--chart-grid, #EDF1F7);
      stroke-width: 1;
    }
    .axis-label {
      fill: var(--chart-axis-text, #94A3B8);
      font-size: 12px;
      font-weight: 500;
      text-anchor: end;
      font-family: var(--font-sans);
    }
    .x-label {
      text-anchor: middle;
    }
    .segment {
      transition: opacity var(--duration-fast) var(--ease-out);
    }
  `],
})
export class StackedBarChartComponent {
  /** The bars to draw, oldest-first. */
  readonly bars = input.required<StackedBar[]>();


  /** The SVG canvas width in px. */
  readonly width = input<number>(430);

  /** The SVG canvas height in px. */
  readonly height = input<number>(190);

  /** The y-axis tick step. */
  readonly tickStep = input<number>(10);

  /** The number of y-axis gridlines (including zero). */
  readonly tickCount = input<number>(5);

  /** Inset from the left edge for the y-axis labels. */
  readonly axisGutter = input<number>(30);

  /** Inset from the bottom edge for the x-axis labels. */
  readonly bottomGutter = input<number>(26);

  /**
   * Inset from the right edge for the plot area. The default of 4
   * leaves a hair of breathing room; the reference's plot stops
   * 9px short of the canvas's right edge.
   */
  readonly plotRightInset = input<number>(4);

  /** Inset from the top edge. */
  readonly topGutter = input<number>(10);

  /** The fraction of its slot a bar fills. */
  readonly barFill = input<number>(0.56);

  /** Accessible label for the chart. */
  readonly ariaLabel = input<string>('Ticket trends');

  readonly plotLeft = computed(() => this.axisGutter());
  readonly plotRight = computed(() => this.width() - this.plotRightInset());
  readonly plotTop = computed(() => this.topGutter());
  readonly plotBottom = computed(() => this.height() - this.bottomGutter());

  /** The plot area's height. */
  private readonly plotHeight = computed(
    () => this.plotBottom() - this.plotTop(),
  );

  /** The highest single-bar total — the raw scale ceiling. */
  private readonly maxTotal = computed(() => {
    const totals = this.bars().map((b) =>
      b.segments.reduce((sum, s) => sum + Math.max(0, s.value), 0),
    );
    return totals.length ? Math.max(...totals) : 0;
  });

  /**
   * The y-axis ceiling: the max total rounded UP to the next
   * multiple of the tick step. A chart whose tallest bar exactly
   * reaches the top gridline would touch the card's edge, so the
   * reference always shows headroom.
   *
   * The ceiling is never BELOW one tick step: a chart whose tallest
   * bar is 2 tickets still needs a "10 / 0" axis, not "2 / -8".
   */
  readonly axisMax = computed(() => {
    const max = this.maxTotal();
    const step = this.tickStep();
    if (max <= 0) return step * this.tickCount();
    return Math.max(step, Math.ceil(max / step) * step);
  });

  /**
   * The gridline positions and their labels.
   *
   * The ticks always run from the axis maximum DOWN to zero — the
   * reference's y-axis reads 40, 30, 20, 10, 0 — so the number of
   * intervals is exactly `axisMax / tickStep`.
   *
   * `tickCount` is the FALLBACK for an empty chart: with no data the
   * axis maximum is `tickStep * tickCount`, so the axis still reads
   * 40, 30, 20, 10, 0. It is never a fixed row count — forcing five
   * rows regardless of the data made a chart whose axis maximum was
   * 10 read "10, 0, -10, -20, -30".
   */
  readonly ticks = computed(() => {
    const step = this.tickStep();
    const max = this.axisMax();
    const top = this.plotTop();
    const height = this.plotHeight();
    const intervals = Math.max(1, Math.round(max / step));
    const count = intervals + 1;
    const out: Array<{ value: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      const value = max - i * step;
      const y = top + (height * i) / (count - 1);
      out.push({ value, y });
    }
    return out;
  });

  /**
   * The gradient definitions, one per distinct (from, to) colour
   * pair the bars use. A segment that declares a `colorTop` is
   * painted with `url(#<id>)`; a flat segment keeps its plain fill.
   */
  readonly gradients = computed(() => {
    const seen = new Map<string, { id: string; from: string; to: string }>();
    for (const bar of this.bars()) {
      for (const s of bar.segments) {
        if (!s.colorTop || s.colorTop === s.color) continue;
        const key = `${s.color}|${s.colorTop}`;
        if (seen.has(key)) continue;
        const id = `sbc-grad-${seen.size}`;
        seen.set(key, { id, from: s.color, to: s.colorTop });
      }
    }
    return [...seen.values()];
  });

  /** The gradient id for a segment, or null when it paints flat. */
  private gradientId(color: string, colorTop?: string): string | null {
    if (!colorTop || colorTop === color) return null;
    const key = `${color}|${colorTop}`;
    return this.gradients().find((g) => `${g.from}|${g.to}` === key)?.id ?? null;
  }

  /**
   * The drawn bars. Each segment is resolved to concrete SVG
   * geometry: the bar's slot is divided evenly across the bars,
   * the segments stack from the baseline up, and a segment of
   * height zero is skipped so the stack has no invisible slivers.
   */
  readonly renderedBars = computed(() => {
    const bars = this.bars();
    const count = bars.length;
    if (!count) return [];

    const plotWidth = this.plotRight() - this.plotLeft();
    const slot = plotWidth / count;
    // The bar fills a fraction of its slot, centred — matching the
    // reference's bars, which are narrower than their slots with
    // visible gutters.
    const barWidth = slot * this.barFill();
    const baseline = this.plotBottom();
    const height = this.plotHeight();
    const max = this.axisMax() || 1;

    return bars.map((bar, index) => {
      // Each bar sits in ITS OWN slot: the slot index shifts the bar
      // along the plot area, and the leftover space centres it
      // within that slot. (Without the index every bar was drawn at
      // the same x and the chart showed a single column.)
      const barLeft =
        this.plotLeft() + slot * index + (slot - barWidth) / 2;
      let cursor = baseline;
      const segments = bar.segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const h: number = (s.value / max) * height;
          const y: number = cursor - h;
          cursor = y;
          const gid = this.gradientId(s.color, s.colorTop);
          return {
            key: s.key,
            color: s.color,
            fill: gid ? `url(#${gid})` : s.color,
            x: barLeft,
            y,
            w: barWidth,
            h: Math.max(1, h),
          };
        });

      return {
        key: bar.key,
        centerX: barLeft + barWidth / 2,
        segments,
        index,
      };
    });
  });
}
