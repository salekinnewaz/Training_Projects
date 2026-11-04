/**
 * donut-chart — atom (WDS-2026 Admin Workspace).
 *
 * A pure-SVG donut with a centred label. Used by the "Users
 * Overview" widget (active / inactive split) and the "Priority
 * Distribution" widget (per-priority split).
 *
 * Anatomy:
 *
 *      ╭───────────╮
 *     │   ╭─────╮   │
 *     │  ╱       ╲  │
 *     │ │   156   │  │   ← the hole carries the centre label
 *     │  ╲       ╱  │      ("156" over "Tickets")
 *     │   ╰─────╯   │
 *      ╰───────────╯
 *
 * The ring is drawn with SVG `stroke-dasharray` on a circle: each
 * slice's dash length is its share of the circumference and the
 * dash offset is the running sum of the preceding slices. That
 * avoids needing arc path maths, and it renders crisply at any
 * size because the stroke width is in user units.
 *
 * A slice of 0% is skipped entirely (a zero-length dash would
 * still paint a round cap dot). When every slice is zero the
 * ring renders a single muted track circle so the widget does not
 * show an empty hole.
 *
 * The centre label is projected through `<ng-content>` so the
 * parent can put its own text + sub-label in the hole without
 * this atom knowing anything about the data.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export interface DonutSlice {
  /** Stable key — used for the SVG gradient ids and trackBy. */
  readonly key: string;
  /** Slice weight. Values are normalised, so any positive unit works. */
  readonly value: number;
  /** The colour this slice paints with. */
  readonly color: string;
}

@Component({
  selector: 'atom-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="donut"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      [attr.width]="size()"
      [attr.height]="size()"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <!-- The track: the full ring in a muted colour, so a
           partially-filled donut still reads as a ring. -->
      <circle
        class="track"
        [attr.cx]="center()"
        [attr.cy]="center()"
        [attr.r]="radius()"
        [attr.stroke-width]="strokeWidth()"
        fill="none"
      />

      @for (slice of segments(); track slice.key) {
        <circle
          class="segment"
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          [attr.stroke]="slice.color"
          [attr.stroke-width]="strokeWidth()"
          [attr.stroke-dasharray]="slice.dashArray"
          [attr.stroke-dashoffset]="slice.dashOffset"
          fill="none"
        />
      }
    </svg>
    <div class="hole">
      <ng-content />
    </div>
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: fit-content;
    }
    .donut {
      display: block;
      transform: rotate(-90deg);
    }
    .track {
      stroke: var(--donut-track, #E8EDF5);
    }
    .segment {
      /* Round caps would overlap on adjacent slices; butt caps
         keep the boundaries crisp. */
      stroke-linecap: butt;
      transition: stroke-dasharray var(--duration-fast) var(--ease-out);
    }
    .hole {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      text-align: center;
    }
  `],
})
export class DonutChartComponent {
  /** The slices to draw. Normalised internally. */
  readonly slices = input.required<DonutSlice[]>();

  /** The SVG canvas size in px. */
  readonly size = input<number>(132);

  /** The ring's stroke width in px. */
  readonly stroke = input<number>(20);

  /** Accessible label for the chart. */
  readonly ariaLabel = input<string>('Distribution chart');

  readonly center = computed(() => this.size() / 2);

  readonly radius = computed(() => (this.size() - this.stroke()) / 2);

  readonly strokeWidth = computed(() => this.stroke());

  /**
   * The circumference of the ring. The dash lengths are expressed
   * as fractions of this, so `dasharray` reads as "this slice
   * covers this much of the ring".
   */
  private readonly circumference = computed(
    () => 2 * Math.PI * this.radius(),
  );

  /**
   * The drawn slices. Each carries its dash length (a fraction of
   * the circumference) and its offset — the negative running sum
   * of the preceding slices, which walks the ring clockwise from
   * the top (the SVG is rotated -90° so the first slice starts
   * at 12 o'clock).
   *
   * A tiny 1px GAP is subtracted from each slice so adjacent
   * slices are visually separated — the reference's donut shows
   * white seams between the segments.
   */
  readonly segments = computed(() => {
    const slices = this.slices();
    const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) return [];

    const circumference = this.circumference();
    const gap = slices.length > 1 ? 1.5 : 0;
    let consumed = 0;

    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const length = (s.value / total) * circumference;
        const dash = Math.max(0, length - gap);
        const segment = {
          key: s.key,
          color: s.color,
          dashArray: `${dash} ${circumference - dash}`,
          dashOffset: -consumed,
        };
        consumed += length;
        return segment;
      });
  });
}
