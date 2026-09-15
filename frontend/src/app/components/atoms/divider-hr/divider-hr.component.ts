/**
 * divider-hr — atom (HD-004).
 *
 * 1px horizontal rule in --color-border. Used inside the dropdown
 * to separate the profile header zone from the action zone.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'divider-hr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<hr class="hr" />`,
  styles: [`
    .hr {
      border: 0;
      border-top: 1px solid var(--color-border);
      margin: 0;
    }
  `],
})
export class DividerHrComponent {}
