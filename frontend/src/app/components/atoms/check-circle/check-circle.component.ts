/**
 * check-circle — atom (HD-009).
 *
 * Static success-check glyph used on the Submission Confirmation
 * page. A single 64×64 SVG with a filled circle background and a
 * stroked check polyline inside. Tokens:
 *
 *   --status-resolved-bg → circle fill (#d3f9d8)
 *   --color-success      → circle stroke + check stroke (#2b8a3e)
 *
 * No animation in MVP — the design spec's "Open Questions" section
 * notes the static glyph is sufficient; animation can be added in
 * v1.x if feedback calls for it.
 *
 * `size` defaults to 64 (the Submission Confirmation use case) and
 * also accepts 24 / 32 for any future dense-list placements. The
 * SVG's `viewBox` stays at "0 0 64 64" so the polyline coordinates
 * (designed for a 64-unit canvas) always render proportionally.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CheckCircleSize = 24 | 32 | 64;

@Component({
  selector: 'check-circle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="32"
        cy="32"
        r="32"
        fill="var(--status-resolved-bg)"
        stroke="var(--color-success)"
        stroke-width="2"
      />
      <polyline
        points="20,33 28,41 44,25"
        fill="none"
        stroke="var(--color-success)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
      line-height: 0;
    }
  `],
})
export class CheckCircleComponent {
  /** Pixel width / height of the SVG. Default 64 (page-level). */
  readonly size = input<CheckCircleSize>(64);
}