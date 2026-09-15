/**
 * badge-priority — atom (HD-007).
 *
 * Pill that communicates how urgent a ticket is. Display-only —
 * no interactive states. Variant class picks the (background,
 * text) pair from the three `--priority-*` CSS tokens seeded in
 * styles.css by HD-001 / HD-004.
 *
 * Variants:
 *   Low    → --priority-low-bg / --priority-low-text
 *   Medium → --priority-medium-bg / --priority-medium-text
 *   High   → --priority-high-bg / --priority-high-text
 *
 * Like badge-status, the literal label is rendered as text so the
 * pill is legible without color (WCAG 1.4.1).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketPriority } from '../../../models/enums';

type PriorityVariant = 'low' | 'medium' | 'high';

@Component({
  selector: 'badge-priority',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="variantClass()">{{ label() }}</span>`,
  styles: [`
    .badge {
      display: inline-block;
      min-height: 20px;
      padding: 0 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      line-height: 20px;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .low {
      background: var(--priority-low-bg);
      color: var(--priority-low-text);
    }
    .medium {
      background: var(--priority-medium-bg);
      color: var(--priority-medium-text);
    }
    .high {
      background: var(--priority-high-bg);
      color: var(--priority-high-text);
    }
  `],
})
export class BadgePriorityComponent {
  readonly priority = input.required<TicketPriority>();

  readonly variant = computed<PriorityVariant>(() => {
    switch (this.priority()) {
      case 'Low':
        return 'low';
      case 'Medium':
        return 'medium';
      case 'High':
        return 'high';
    }
  });

  readonly variantClass = computed(() => this.variant());

  readonly label = computed(() => this.priority());
}