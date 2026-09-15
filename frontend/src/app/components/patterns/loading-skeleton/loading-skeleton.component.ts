/**
 * loading-skeleton — pattern (HD-007).
 *
 * Placeholder structure rendered while the dashboard's initial
 * fetch is in flight. Mirrors the canonical "with tickets" layout
 * (heading placeholder, button placeholder, N row placeholders)
 * so the layout doesn't pop when data arrives.
 *
 * Row placeholders are 64px tall (matches the real ticket-row
 * height) with bars inside for the number / title / badges /
 * timestamp regions. The pulse animation gives a subtle "alive"
 * cue without a spinner — per the UX spec, "no spinner overlay".
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'loading-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="skeleton" aria-busy="true" aria-label="Loading your tickets">
      <div class="head-row">
        <div class="bar bar-heading"></div>
        <div class="bar bar-button"></div>
      </div>
      <ul class="rows">
        @for (_ of rowArray(); track $index) {
          <li class="row" aria-hidden="true">
            <div class="bar bar-number"></div>
            <div class="bar bar-title"></div>
            <div class="bar bar-badge"></div>
            <div class="bar bar-badge short"></div>
            <div class="bar bar-timestamp"></div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .skeleton {
      width: 100%;
      box-sizing: border-box;
    }
    .head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .bar {
      background: var(--color-surface-muted);
      border-radius: 4px;
      animation: skel-pulse 1200ms ease-in-out infinite;
    }
    .bar-heading {
      width: 160px;
      height: 28px;
    }
    .bar-button {
      width: 160px;
      height: var(--button-md-height);
      border-radius: var(--button-radius);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
    }
    .row {
      display: grid;
      grid-template-columns: 80px 1fr auto auto 100px;
      align-items: center;
      gap: 16px;
      padding: 0 16px;
      height: 64px;
      border-bottom: 1px solid var(--color-border);
    }
    .row:last-child {
      border-bottom: none;
    }
    .bar-number {
      width: 56px;
      height: 14px;
    }
    .bar-title {
      width: 100%;
      max-width: 360px;
      height: 14px;
    }
    .bar-badge {
      width: 64px;
      height: 22px;
      border-radius: 11px;
    }
    .bar-badge.short {
      width: 48px;
    }
    .bar-timestamp {
      width: 80px;
      height: 12px;
      justify-self: end;
    }
    @keyframes skel-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
  `],
})
export class LoadingSkeletonComponent {
  /** Number of row placeholders to render. Default 5 per UX spec. */
  readonly rows = input<number>(5);

  /**
   * Build a fixed-length array of `rows()` for @for iteration in
   * OnPush templates (Angular's @for needs an iterable, not a
   * numeric count).
   */
  rowArray(): unknown[] {
    const n = Math.floor(this.rows());
    if (!Number.isFinite(n) || n < 0) return [];
    return new Array(n);
  }
}