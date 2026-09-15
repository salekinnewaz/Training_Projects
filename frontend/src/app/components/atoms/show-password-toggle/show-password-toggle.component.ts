/**
 * show-password-toggle — atom (HD-005).
 *
 * Pressed-state button with two inline SVGs (eye-open / eye-closed)
 * toggled by the `pressed` input. Carries `aria-pressed` mirroring
 * the pressed state and a dynamic `aria-label` so SR users hear
 * "Show password" / "Hide password".
 *
 * The host (login page) wires the click handler to flip the
 * password input's `type` attribute between `password` and `text`.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

@Component({
  selector: 'atom-show-password-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="toggle"
      [attr.aria-pressed]="pressed()"
      [attr.aria-label]="pressed() ? 'Hide password' : 'Show password'"
      [disabled]="disabled()"
      (click)="onClick($event)"
    >
      @if (pressed()) {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      }
    </button>
  `,
  styles: [`
    :host {
      display: contents;
    }
    .toggle {
      all: unset;
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: var(--field-radius);
      cursor: pointer;
      color: var(--color-muted);
      box-sizing: border-box;
    }
    .toggle:hover {
      color: var(--color-label);
      background: var(--color-surface-subtle);
    }
    .toggle:disabled {
      color: var(--color-disabled);
      cursor: not-allowed;
      pointer-events: none;
    }
    .toggle:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 1px;
    }
    svg {
      display: block;
    }
  `],
})
export class ShowPasswordToggleComponent {
  readonly pressed = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  @Output() readonly toggle = new EventEmitter<void>();

  onClick(event: MouseEvent): void {
    event.preventDefault();
    this.toggle.emit();
  }
}
