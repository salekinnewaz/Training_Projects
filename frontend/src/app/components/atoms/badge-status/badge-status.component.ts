/**
 * badge-status — atom (HD-007).
 *
 * Pill that names a ticket's current status. Display-only — no
 * interactive states. Variant class picks the (background, text)
 * pair from the four `--status-*` CSS tokens seeded in styles.css
 * by HD-001 / HD-004.
 *
 * Variants:
 *   Open        → --status-open-bg / --status-open-text
 *   In Progress → --status-in-progress-bg / --status-in-progress-text
 *   Resolved    → --status-resolved-bg / --status-resolved-text
 *   Closed      → --status-closed-bg / --status-closed-text
 *
 * The status literal is also rendered as text so screen readers
 * and color-blind users always get the label (WCAG 1.4.1).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketStatus } from '../../../models/enums';

type StatusVariant = 'open' | 'in-progress' | 'resolved' | 'closed';

@Component({
  selector: 'badge-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="variantClass()">{{ label() }}</span>`,
  styles: [`
    .badge {
      display: inline-block;
      min-height: 22px;
      padding: 0 10px;
      border-radius: 11px;
      font-size: 11px;
      font-weight: 600;
      line-height: 22px;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .open {
      background: var(--status-open-bg);
      color: var(--status-open-text);
    }
    .in-progress {
      background: var(--status-in-progress-bg);
      color: var(--status-in-progress-text);
    }
    .resolved {
      background: var(--status-resolved-bg);
      color: var(--status-resolved-text);
    }
    .closed {
      background: var(--status-closed-bg);
      color: var(--status-closed-text);
    }
  `],
})
export class BadgeStatusComponent {
  readonly status = input.required<TicketStatus>();

  readonly variant = computed<StatusVariant>(() => {
    switch (this.status()) {
      case 'Open':
        return 'open';
      case 'In Progress':
        return 'in-progress';
      case 'Resolved':
        return 'resolved';
      case 'Closed':
        return 'closed';
    }
  });

  readonly variantClass = computed(() => this.variant());

  readonly label = computed(() => this.status());
}