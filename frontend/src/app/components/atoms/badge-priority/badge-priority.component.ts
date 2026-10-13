/**
 * badge-priority — atom (HD-007).
 *
 * Pill that communicates how urgent a ticket is. Display-only —
 * no interactive states. Variant class picks the (background,
 * text) pair from the three `--priority-*` CSS tokens seeded in
 * styles.css by HD-001 / HD-004.
 *
 * Variants:
 *   Low    → --priority-low-bg / --priority-low-text    ▲ glyph (up)
 *   Medium → --priority-medium-bg / --priority-medium-text   ■ glyph (square)
 *   High   → --priority-high-bg / --priority-high-text  ▼ glyph (down)
 *
 * Like badge-status, the literal label is rendered as text AND a
 * leading icon glyph so the pill is legible without color
 * (WCAG 1.4.1 — color is never the sole signal). The
 * triangle-up / square / triangle-down set matches the wireframes
 * (e.g. _bmad-output/.../mockups/02-user-dashboard.html line 259,
 * 267, 275) and DESIGN.md §"Priority Pill" ("Always paired with
 * an arrow/glyph and the text label").
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketPriority } from '../../../models/enums';

type PriorityVariant = 'low' | 'medium' | 'high';

@Component({
  selector: 'badge-priority',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="variantClass()">
      @switch (priority()) {
        @case ('High') {
          <svg class="priority-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <path d="M4 1.25 L6.75 5.25 L1.25 5.25 Z" fill="currentColor" />
          </svg>
        }
        @case ('Medium') {
          <svg class="priority-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <rect x="1.5" y="1.5" width="5" height="5" fill="currentColor" />
          </svg>
        }
        @case ('Low') {
          <svg class="priority-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
            <path d="M4 6.75 L1.25 2.75 L6.75 2.75 Z" fill="currentColor" />
          </svg>
        }
      }
      <span class="priority-label">{{ label() }}</span>
    </span>
  `,
  styles: [`
    .badge {
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
    }
    .priority-glyph {
      flex-shrink: 0;
      display: block;
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
