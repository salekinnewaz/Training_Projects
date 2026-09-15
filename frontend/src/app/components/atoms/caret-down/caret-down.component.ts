/**
 * caret-down — atom (HD-004).
 *
 * Inline SVG chevron used by the profile trigger. Inherits the
 * surrounding text color via `fill="currentColor"`. Marked
 * aria-hidden because the trigger button carries the label.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'caret-down',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="caret"
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 2 L4 6 L8 2 Z" />
    </svg>
  `,
  styles: [`
    .caret {
      display: inline-block;
      flex-shrink: 0;
    }
  `],
})
export class CaretDownComponent {}
