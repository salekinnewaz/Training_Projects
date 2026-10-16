/**
 * badge-category — atom (HD-redesign).
 *
 * Pill that names a ticket's category (IT / HR / Finance /
 * General). Display-only — no interactive states. Variant
 * class picks a subtle tinted background (per category) from
 * the `--category-*` CSS tokens seeded in styles.css.
 *
 * The category name is rendered as text so screen readers and
 * color-blind users always get the label (WCAG 1.4.1). The pill
 * is also paired with a small folder / tag glyph so the visual
 * hierarchy reads: priority pill (urgent) → category pill
 * (domain).
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketCategory } from '../../../models/enums';

type CategoryVariant = 'it' | 'hr' | 'finance' | 'general';

@Component({
  selector: 'badge-category',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="variantClass()">
      <svg class="category-glyph" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" focusable="false">
        <path d="M1 2 L3.25 2 L4 3 L7 3 L7 6.25 a0.5 0.5 0 0 1 -0.5 0.5 L1.5 6.75 a0.5 0.5 0 0 1 -0.5 -0.5 z" fill="currentColor" />
      </svg>
      <span class="category-label">{{ label() }}</span>
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-height: 22px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      line-height: 22px;
      white-space: nowrap;
      box-sizing: border-box;
      letter-spacing: 0.005em;
    }
    .category-glyph {
      flex-shrink: 0;
      display: block;
    }
    .it {
      background: #EEF2FF;
      color: #4F46E5;
    }
    .hr {
      background: #FDF2F8;
      color: #BE185D;
    }
    .finance {
      background: #ECFDF5;
      color: #047857;
    }
    .general {
      background: #F1F5F9;
      color: #475569;
    }
  `],
})
export class BadgeCategoryComponent {
  readonly category = input.required<TicketCategory>();

  readonly variant = computed<CategoryVariant>(() => {
    switch (this.category()) {
      case 'IT':
        return 'it';
      case 'HR':
        return 'hr';
      case 'Finance':
        return 'finance';
      case 'General':
        return 'general';
    }
  });

  readonly variantClass = computed(() => this.variant());

  readonly label = computed(() => this.category());
}
