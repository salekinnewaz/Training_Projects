/**
 * ticket-category-icon — atom (WDS-2026 shared ticket table).
 *
 * The square, colour-coded glyph that leads every row of the
 * shared ticket table. The reference layout shows a distinct
 * **shape** per category as well as a distinct colour, so the
 * column is readable without relying on hue alone (WCAG 1.4.1):
 *
 *   IT       → blue   · a laptop / monitor shape
 *   HR       → red    · a person shape
 *   Finance  → purple · a document / receipt shape
 *   General  → slate  · a folder shape
 *
 * The glyph is a solid silhouette inside a 28×28 tinted rounded
 * square — the same "tinted tile + solid glyph" pattern the
 * stat-strip uses, so the two read as one family.
 *
 * A ticket with no category falls back to the General shape in
 * neutral slate: an uncategorised ticket is still a ticket, and
 * the column never renders an empty hole in the row.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TicketCategory } from '../../../models/enums';

type IconVariant = 'it' | 'hr' | 'finance' | 'general';

@Component({
  selector: 'ticket-category-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="cat-tile" [class]="variantClass()" aria-hidden="true" focusable="false">
      @switch (variant()) {
        @case ('it') {
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <rect x="2" y="3" width="12" height="8" rx="1.5" fill="currentColor" />
            <path d="M6 13.5 H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        }
        @case ('hr') {
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <circle cx="8" cy="5" r="2.6" fill="currentColor" />
            <path d="M3 13.2 C3 10.6 5.2 9 8 9 C10.8 9 13 10.6 13 13.2 Z" fill="currentColor" />
          </svg>
        }
        @case ('finance') {
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <path
              d="M4 1.8 H9.6 L12.4 4.6 V13.2 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V2.8 a1 1 0 0 1 1 -1 Z"
              fill="currentColor"
            />
            <path d="M5.6 8 H10.4" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity="0.85" />
          </svg>
        }
        @default {
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <path d="M1.8 3.4 H6 L7.4 5 H14.2 V12.4 a1 1 0 0 1 -1 1 H2.8 a1 1 0 0 1 -1 -1 Z" fill="currentColor" />
          </svg>
        }
      }
    </span>
  `,
  styles: [`
    .cat-tile {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .it {
      background: #EAF2FE;
      color: #0674FE;
    }
    .hr {
      background: #FEE2E2;
      color: #D92D20;
    }
    .finance {
      background: #F0EAFE;
      color: #7433FE;
    }
    .general {
      background: #EBEEF6;
      color: #5D749D;
    }
  `],
})
export class TicketCategoryIconComponent {
  /** The ticket's category. `null` renders the General glyph. */
  readonly category = input.required<TicketCategory | null>();

  protected readonly variant = computed<IconVariant>(() => {
    switch (this.category()) {
      case 'IT':
        return 'it';
      case 'HR':
        return 'hr';
      case 'Finance':
        return 'finance';
      case 'General':
      case null:
      default:
        return 'general';
    }
  });

  protected readonly variantClass = computed(() => this.variant());
}
