/**
 * button — atom (HD-005, HD-007).
 *
 * Reusable button with three visual variants (primary / secondary /
 * danger), a loading state, and two height sizes (`md` = 40px,
 * `lg` = 48px). HD-007 added the `pressed` output (re-emits the
 * host click so callers can navigate without wrapping the button
 * in an `<a>`) and the `size` input (so the empty-state CTA can
 * render slightly taller than the header CTA).
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
 *
 * Size tokens:
 *   `md` (default) → uses `--button-md-height` (40px)
 *   `lg`           → uses `--button-lg-height` (48px)
 *
 * The default `--button-height` token (48px) stays in place so
 * existing callers that don't pass a size still render at the
 * legacy height. Callers needing a specific pixel count should
 * opt into the explicit `size` input.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'md' | 'lg';

@Component({
  selector: 'atom-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [class]="cssClass()"
      (click)="onClick($event)"
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
      height: var(--button-md-height);
      padding: 0 20px;
      border-radius: var(--button-radius);
      border: 1px solid transparent;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      transition: background-color 120ms ease, border-color 120ms ease;
      box-sizing: border-box;
    }
    button:disabled {
      opacity: 0.5;
      pointer-events: none;
      cursor: not-allowed;
    }
    button.lg {
      height: var(--button-lg-height);
    }
    button:not(.md):not(.lg) {
      /* Legacy callers that don't pass a size still inherit the
         historical 48px --button-height token. The explicit md
         class overrides this with --button-md-height (40px). */
      height: var(--button-height);
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
  readonly size = input<ButtonSize>('md');

  /**
   * Re-emits the host click event. HD-007 added this so callers can
   * navigate via `(pressed)="navigate()"` instead of wrapping the
   * atom-button in an `<a routerLink>`, which produced invalid HTML
   * (button-in-anchor) and ambiguous screen-reader announcements.
   */
  @Output() readonly pressed = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    this.pressed.emit(event);
  }

  /**
   * Combined class string so both variant + size apply. The `.md`
   * class is always present so the explicit `height: var(--button-md-height)`
   * rule wins; absent `.lg`, it falls through to the legacy
   * `--button-height` default.
   */
  cssClass(): string {
    return `${this.variant()} ${this.size()}`;
  }
}
