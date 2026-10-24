/**
 * checkbox — atom (HD-019).
 *
 * A styled native `<input type="checkbox">` with a custom visual
 * treatment. The native input is kept (not a `<div role="checkbox">`)
 * so form semantics, keyboard behavior (Space to toggle), and
 * screen-reader support come for free — we only override the paint.
 *
 * Two usage modes:
 *   - Standalone: `[checked]` + `(checkedChange)` for the table's
 *     per-row select and the header's "select all".
 *   - Indeterminate: `[indeterminate]` paints the dash glyph for
 *     the header checkbox when *some* (but not all) rows are
 *     selected — the state a native `indeterminate` DOM property
 *     models but a CSS-only treatment can't.
 *
 * The indeterminate DOM property is set in an `afterRenderEffect`
 * because it's a property (not an attribute) and Angular's
 * attribute binding won't touch it.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'atom-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="check" [class.is-disabled]="disabled()">
      <input
        #input
        type="checkbox"
        class="check-input"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() || null"
        (change)="onChange($event)"
      />
      <span class="check-box" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="10" height="10" focusable="false">
          @if (indeterminate()) {
            <path d="M2.5 6 H9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          } @else {
            <path d="M2 6.2 L4.8 9 L10 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          }
        </svg>
      </span>
      @if (label(); as text) {
        <span class="check-label">{{ text }}</span>
      }
    </label>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    .check.is-disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    /* The native input stays in the DOM (and focusable) but is
       visually collapsed onto the custom box; opacity 0 rather than
       display:none so keyboard focus and screen readers still see
       a real checkbox. */
    .check-input {
      position: absolute;
      width: 16px;
      height: 16px;
      margin: 0;
      opacity: 0;
      cursor: inherit;
    }
    .check-box {
      display: grid;
      place-items: center;
      width: 16px;
      height: 16px;
      border-radius: 5px;
      border: 1.5px solid var(--color-border-strong, #cbd5e1);
      background: var(--color-surface);
      color: transparent;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
      flex-shrink: 0;
    }
    .check-input:checked + .check-box,
    .check-input:indeterminate + .check-box {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }
    .check-input:focus-visible + .check-box {
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .check-label {
      font-size: 13px;
      color: var(--color-text-soft);
    }
  `],
})
export class CheckboxComponent {
  readonly checked = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Renders the dash glyph instead of the tick. Used by the
   * table header when some-but-not-all rows are selected. */
  readonly indeterminate = input<boolean>(false);

  /** Optional visible label rendered to the right of the box. */
  readonly label = input<string>('');

  /** Accessible name when there's no visible label. */
  readonly ariaLabel = input<string>('');

  readonly checkedChange = output<boolean>();

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  constructor() {
    // `indeterminate` is a DOM property, not an attribute — set it
    // imperatively whenever the signal flips. A plain effect is the
    // right tool here: it writes to the DOM, not to another signal,
    // so NG0600 doesn't apply.
    effect(() => {
      const el = this.input()?.nativeElement;
      if (el) {
        el.indeterminate = this.indeterminate();
      }
    });
  }

  onChange(event: Event): void {
    // Guard on the signal as well as relying on the DOM: a
    // programmatic `dispatchEvent(new Event('change'))` fires even
    // on a disabled input, so the native block isn't sufficient.
    if (this.disabled()) return;
    const target = event.target as HTMLInputElement;
    this.checkedChange.emit(target.checked);
  }
}