/**
 * empty-state — molecule (HD-007).
 *
 * Centered card rendered in place of a list when there's nothing
 * to show. Carries the headline + caption in a stacked vertical
 * rhythm, then the CTA button.
 *
 * Used by the Employee Dashboard when `listMine()` returns an
 * empty array. The card is 480px wide (matches design spec) and
 * vertically positioned in the upper third of the available list
 * area so it's visible without scrolling.
 *
 * The CTA renders as `<atom-button (pressed)>` so the host page
 * navigates via the router without wrapping the button in an
 * `<a>` (which would be invalid HTML).
 *
 * This molecule is purely presentational: it emits `action` when
 * the CTA is pressed and the HOST page is responsible for handling
 * navigation (e.g. `(action)="goToCreate()"`). Hosts must listen
 * to `(action)` — the molecule does not perform routing itself.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'empty-state',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty-state" role="region" aria-labelledby="empty-headline">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64" focusable="false">
          <defs>
            <linearGradient id="empty-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#6366F1" stop-opacity="0.18" />
              <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.10" />
            </linearGradient>
          </defs>
          <rect x="6" y="14" width="52" height="40" rx="8" fill="url(#empty-grad)" />
          <rect x="6" y="14" width="52" height="40" rx="8" stroke="#C7D2FE" stroke-width="1.5" fill="none" />
          <rect x="14" y="24" width="22" height="3" rx="1.5" fill="#A5B4FC" />
          <rect x="14" y="32" width="32" height="3" rx="1.5" fill="#C7D2FE" />
          <rect x="14" y="40" width="18" height="3" rx="1.5" fill="#C7D2FE" />
          <circle cx="48" cy="46" r="10" fill="#4F46E5" />
          <path d="M48 42v8M44 46h8" stroke="#fff" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <h2 id="empty-headline">{{ headline() }}</h2>
      <p class="caption">{{ caption() }}</p>
      <atom-button
        variant="primary"
        size="lg"
        (pressed)="onCtaPress()"
      >{{ actionLabel() }}</atom-button>
      <div class="supporting">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      margin-top: 32px;
    }
    .empty-state {
      width: 480px;
      max-width: 100%;
      margin: 0 auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 16px;
      padding: 56px 40px 48px;
      box-sizing: border-box;
      text-align: center;
      box-shadow: var(--shadow-card);
    }
    .empty-icon {
      display: inline-flex;
      margin-bottom: 24px;
      animation: float 6s ease-in-out infinite;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .caption {
      margin: 10px 0 0;
      font-size: 15px;
      color: var(--color-label);
      line-height: 1.5;
    }
    atom-button {
      display: block;
      width: 240px;
      max-width: 100%;
      margin: 28px auto 0;
    }
    .supporting {
      margin-top: 18px;
      font-size: 13px;
      color: var(--color-muted);
    }
  `],
})
export class EmptyStateComponent {
  readonly headline = input.required<string>();
  readonly caption = input.required<string>();
  readonly actionLabel = input.required<string>();
  // Kept for API/documentation purposes; navigation is the host's job.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  readonly actionHref = input.required<string>();

  /**
   * Emits when the user clicks the CTA. The HOST page must listen
   * to this event and perform navigation (e.g. `(action)="goToCreate()"`).
   * The molecule is purely presentational — it does not call the
   * router itself.
   */
  @Output() readonly action = new EventEmitter<void>();

  onCtaPress(): void {
    this.action.emit();
  }
}