/**
 * button — atom (HD-005).
 *
 * Reusable button with three visual variants (primary / secondary /
 * danger) and a loading state. OnPush.
 *
 * The button is the workhorse CTA across the app: login submit,
 * "New ticket" on the dashboard, "Save" on the users form, dialog
 * confirmations, etc.
 *
 * Loading renders an inline spinner to the left of the projected
 * label and sets `aria-busy="true"` so assistive tech announces
 * the in-flight state. Disabled applies both the `disabled`
 * attribute (which blocks click events at the DOM level) and a
 * 50% opacity + no-pointer-events visual treatment.
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'atom-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [class]="variant()"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: [`
    :host {
      display: contents;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      height: var(--button-height);
      padding: 0 20px;
      border-radius: var(--button-radius);
      border: 1px solid transparent;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      transition: background-color 120ms ease, border-color 120ms ease;
    }
    button:disabled {
      opacity: 0.5;
      pointer-events: none;
      cursor: not-allowed;
    }
    .primary {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }
    .primary:hover:not(:disabled) {
      background: #000000;
      border-color: #000000;
    }
    .secondary {
      background: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-label);
    }
    .secondary:hover:not(:disabled) {
      background: var(--color-surface-subtle);
    }
    .danger {
      background: var(--color-error);
      border-color: var(--color-error);
      color: #ffffff;
    }
    .danger:hover:not(:disabled) {
      filter: brightness(0.92);
    }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-top-color: transparent;
      animation: btn-spin 700ms linear infinite;
    }
    @keyframes btn-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly loading = input<boolean>(false);
}
