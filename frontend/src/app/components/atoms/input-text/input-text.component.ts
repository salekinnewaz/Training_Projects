/**
 * input-text — atom (HD-005).
 *
 * Bare `<input>` primitive. The label, error message, and any
 * suffix widgets (e.g. the password show/hide toggle) are the
 * responsibility of the consuming `form-field` molecule.
 *
 * OnPush. value is two-way bound via `value` input + `valueChange`
 * output so the host can wire it to FormControl with
 * `[value]="control.value"` + `(valueChange)="..."`.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

@Component({
  selector: 'atom-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      [id]="id()"
      [type]="type()"
      [value]="value()"
      [placeholder]="placeholder() ?? ''"
      [attr.autocomplete]="autocomplete() ?? null"
      [attr.aria-describedby]="ariaDescribedBy() ?? null"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-required]="required() ? 'true' : null"
      [disabled]="disabled()"
      (input)="onInput($event)"
    />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    input {
      width: 100%;
      height: var(--field-height);
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--field-radius);
      background: var(--color-surface);
      color: var(--color-primary);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease;
      box-sizing: border-box;
    }
    input::placeholder {
      color: var(--color-muted);
    }
    input:disabled {
      background: var(--color-surface-subtle);
      color: var(--color-disabled);
      cursor: not-allowed;
    }
    input[aria-invalid="true"] {
      border-color: var(--color-error);
    }
    input:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 0;
      border-color: var(--focus-ring-color);
    }
  `],
})
export class InputTextComponent {
  readonly id = input.required<string>();
  readonly type = input<'email' | 'password' | 'text'>('text');
  readonly value = input<string>('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly autocomplete = input<string | undefined>(undefined);
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly ariaDescribedBy = input<string | undefined>(undefined);

  @Output() readonly valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.valueChange.emit(target.value);
  }
}
