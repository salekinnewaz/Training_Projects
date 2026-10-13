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
  ElementRef,
  EventEmitter,
  Output,
  input,
  viewChild,
} from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'md' | 'lg';

@Component({
  selector: 'atom-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #innerBtn
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
      position: relative;
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
      box-sizing: border-box;
      letter-spacing: -0.005em;
      white-space: nowrap;
      user-select: none;
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
      background: var(--gradient-brand);
      border-color: transparent;
      color: #ffffff;
      box-shadow: var(--shadow-button);
    }
    .primary:hover:not(:disabled) {
      box-shadow: var(--shadow-button-hover);
      transform: translateY(-1px);
    }
    .primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--shadow-xs);
    }
    .secondary {
      background: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-text);
      box-shadow: var(--shadow-xs);
    }
    .secondary:hover:not(:disabled) {
      background: var(--color-page-bg);
      border-color: var(--color-border-strong);
    }
    .danger {
      background: var(--gradient-danger);
      border-color: transparent;
      color: #ffffff;
      box-shadow: 0 1px 2px rgba(239, 68, 68, 0.20), 0 2px 6px rgba(239, 68, 68, 0.12);
    }
    .danger:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.30), 0 2px 4px rgba(239, 68, 68, 0.10);
      transform: translateY(-1px);
    }
    .danger:active:not(:disabled) {
      transform: translateY(0);
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

  /**
   * Inner `<button>` ref. D7 added this so consumers (initially
   * `<dialog-modal>`) can drive `focus()` from outside the atom
   * — the spec-level UX rule "initial focus lands on the confirm
   * button" needs the native `HTMLButtonElement.focus()` call,
   * and the atom owns the inner element. Idempotent: no-op
   * before the view is rendered or after the button is removed.
   */
  private readonly innerBtnRef = viewChild<ElementRef<HTMLButtonElement>>('innerBtn');

  onClick(event: MouseEvent): void {
    this.pressed.emit(event);
  }

  /**
   * Move keyboard focus to the inner button. No-op if the atom
   * isn't yet rendered or the button is disabled (a focused
   * disabled element would re-broadcast the disabled cursor to
   * assistive tech). Mirrors the auto-focus pattern
   * `dialog-modal` used pre-D7 via `#confirmBtn.nativeElement.focus()`.
   */
  focus(): void {
    const el = this.innerBtnRef()?.nativeElement;
    if (el && !el.disabled) {
      el.focus();
    }
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
