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
 * and color-blind users always get the label (WCAG 1.4.1). The
 * pill is also paired with a leading icon glyph per DESIGN.md
 * §"Status Pill" — color is never the sole signal.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketStatus } from '../../../models/enums';

type StatusVariant = 'open' | 'in-progress' | 'resolved' | 'closed';

@Component({
  selector: 'badge-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="status-dot" [class]="variantClass()">
      @switch (status()) {
        @case ('Open') {
          <svg class="status-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <circle cx="4" cy="4" r="3" fill="currentColor" />
          </svg>
        }
        @case ('In Progress') {
          <svg class="status-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <path d="M2 1.5 L6.5 4 L2 6.5 Z" fill="currentColor" />
          </svg>
        }
        @case ('Resolved') {
          <svg class="status-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <path d="M1.5 4.25 L3.25 6 L6.5 2.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
        @case ('Closed') {
          <svg class="status-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <path d="M2 2 L6 6 M6 2 L2 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        }
      }
      <span class="status-label">{{ label() }}</span>
    </span>
  `,
  styles: [`
    .status-dot {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      line-height: 24px;
      white-space: nowrap;
      box-sizing: border-box;
      letter-spacing: 0.01em;
      transition: transform var(--duration-fast) var(--ease-out);
    }
    .status-glyph {
      flex-shrink: 0;
      display: block;
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
