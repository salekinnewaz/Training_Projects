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
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 48px 32px;
      box-sizing: border-box;
      text-align: center;
      box-shadow: var(--shadow-card-hover);
    }
    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .caption {
      margin: 8px 0 0;
      font-size: 14px;
      color: var(--color-label);
    }
    atom-button {
      display: block;
      width: 240px;
      max-width: 100%;
      margin: 32px auto 0;
    }
    .supporting {
      margin-top: 16px;
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