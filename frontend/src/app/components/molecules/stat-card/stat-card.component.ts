/**
 * stat-card — molecule (HD-019).
 *
 * One of the five stat-strip tiles above the Tickets table.
 *
 * **STATUS: superseded and currently unused.** The WDS-2026
 * redesign made `<stat-strip>` the app's single stat band — the
 * User's dashboard, the Support Agent's Tickets page and the Admin
 * dashboard all render that molecule. This component was the
 * Agent page's own band before that change; no page imports it any
 * more. It is kept as a generic, self-contained summary tile (and
 * its spec still passes), but the reference-accurate surface is
 * `<stat-strip>`.
 *
 * Layout (top-down, left-to-right):
 *
 *   ┌───────────────────────────────────────┐
 *   │  [icon tile]  Label                   │
 *   │              ┌──────────────┐         │
 *   │              │  big value   │         │
 *   │              │   (24px)     │         │
 *   │              └──────────────┘         │
 *   │                          ▲            │
 *   │   delta pill            sparkline     │
 *   └───────────────────────────────────────┘
 *
 * The big number is the primary signal; the icon tile + label
 * establish what the number means; the delta pill tells the user
 * whether the number is moving in a good direction; the sparkline
 * gives a quick recent-history read so the user can spot a
 * plateau or a spike without leaving the page.
 *
 * Styling decisions:
 *   - All colors are tokens from `:root` — no hard-coded hex
 *     values here. The `accent` input picks which brand variant
 *     lights the icon tile + the sparkline + the delta pill.
 *   - The sparkline has a fixed pixel height (44px) so the cards
 *     in a row align even when their series lengths differ.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SparklineComponent } from '../../atoms/sparkline/sparkline.component';

export type StatCardAccent =
  | 'primary'
  | 'open'
  | 'inProgress'
  | 'resolved'
  | 'closed'
  | 'muted';

@Component({
  selector: 'stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SparklineComponent],
  template: `
    <article class="stat" [attr.data-accent]="accent()">
      <header class="stat-head">
        <span class="stat-tile" aria-hidden="true">
          <ng-content select="[cardIcon]"></ng-content>
        </span>
        <span class="stat-label">{{ label() }}</span>
      </header>
      <div class="stat-value">{{ formattedValue() }}</div>
      <footer class="stat-foot">
        @if (delta() !== null) {
          <span class="stat-delta" [class.is-up]="(delta() ?? 0) > 0" [class.is-down]="(delta() ?? 0) < 0">
            <svg viewBox="0 0 12 12" width="10" height="10" focusable="false" aria-hidden="true">
              @if ((delta() ?? 0) >= 0) {
                <path d="M6 2 L10 8 L2 8 Z" fill="currentColor" />
              } @else {
                <path d="M6 10 L10 4 L2 4 Z" fill="currentColor" />
              }
            </svg>
            <span>{{ deltaLabel() }}</span>
          </span>
        }
        <atom-sparkline
          class="stat-spark"
          [points]="series()"
          [color]="accentColor()"
          [gradientId]="gradientId()"
        />
      </footer>
    </article>
  `,
  styles: [`
    :host {
      display: block;
    }
    .stat {
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 14px;
      padding: 18px 20px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 16px;
      box-shadow: var(--shadow-card);
      min-height: 136px;
    }
    .stat-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat-tile {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--color-page-bg);
      color: var(--accent-color, var(--color-primary));
      flex-shrink: 0;
    }
    .stat-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-soft);
      letter-spacing: 0.01em;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .stat-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 28px;
    }
    .stat-delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: var(--color-page-bg);
      color: var(--color-text-soft);
    }
    .stat-delta.is-up {
      background: var(--gradient-success);
      color: var(--color-success, #047857);
    }
    .stat-delta.is-down {
      background: var(--gradient-danger);
      color: var(--color-error);
    }
    .stat-spark {
      flex: 1 1 auto;
      height: 36px;
      max-width: 120px;
    }

    /* ── accent palette — kept here (not in the global sheet) so the
       card is self-contained and the icon tile / sparkline share
       the same family without leaking tint into siblings. */
    :host([data-accent='primary']) .stat {
      --accent-color: var(--color-primary);
    }
    :host([data-accent='open']) .stat {
      --accent-color: var(--status-open-dot, #d97706);
    }
    :host([data-accent='inProgress']) .stat {
      --accent-color: var(--status-in-progress-dot, #4f46e5);
    }
    :host([data-accent='resolved']) .stat {
      --accent-color: var(--status-resolved-dot, #059669);
    }
    :host([data-accent='closed']) .stat {
      --accent-color: var(--status-closed-dot, #6b7280);
    }
    :host([data-accent='muted']) .stat {
      --accent-color: var(--color-muted);
    }

    /* The accent-tile background uses the accent color at 12%
       opacity so the tile reads as "tinted" rather than solid.
       Inline alpha is the only way to do this without a per-accent
       token family. */
    .stat-tile {
      background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    }
  `],
})
export class StatCardComponent {
  /** Short label rendered at the top-left of the tile. */
  readonly label = input.required<string>();

  /** Big number shown in the middle. */
  readonly value = input.required<number>();

  /**
   * Optional change to render in the delta pill. `null` hides the
   * pill; a positive number paints it up-green, negative paints
   * it down-red.
   */
  readonly delta = input<number | null>(null);

  /** Pre-formatted delta copy (e.g. `"+12%"`, `"−3 tickets"`).
   * The caller is responsible for the formatting so the pill
   * doesn't have to know the absolute-value rule. */
  readonly deltaLabel = input<string>('');

  /** 14-element data series for the sparkline. */
  readonly series = input<number[]>([]);

  /** Picks which color family lights the icon + sparkline. */
  readonly accent = input<StatCardAccent>('primary');

  /**
   * Gradient id passed to the sparkline. Caller-provided so
   * multiple stat cards on a page don't fight over the same
   * `<defs>` element.
   */
  readonly gradientId = input<string>('sparkline-default');

  protected readonly accentColor = computed(() => {
    switch (this.accent()) {
      case 'open': return 'var(--status-open-dot, #d97706)';
      case 'inProgress': return 'var(--status-in-progress-dot, #4f46e5)';
      case 'resolved': return 'var(--status-resolved-dot, #059669)';
      case 'closed': return 'var(--status-closed-dot, #6b7280)';
      case 'muted': return 'var(--color-muted)';
      case 'primary':
      default: return 'var(--color-primary)';
    }
  });

  /** Inline `value` formatter; commas for thousands so 1234 reads
   * as "1,234" instead of "1234". */
  protected readonly formattedValue = computed(() =>
    this.value().toLocaleString('en-US'),
  );
}