/**
 * select — atom (HD-008).
 *
 * Bare `<select>` primitive for single-option selection from a known
 * set. Mirrors the API surface of `<atom-input>` (HD-005) + the
 * option list. Native `<select>` is used (per UX doc) for screen
 * reader compatibility — styling overrides the default OS
 * appearance but the keyboard / native semantics stay intact.
 *
 * API:
 *   id (req), value, options: {value,label}[] (req),
 *   placeholderOption: {value: '', label: string} | null (default
 *     null — present in UX only for Category, where the first entry
 *     reads "Select category…"),
 *   disabled, invalid, required, ariaDescribedBy — same shape as
 *   <atom-input>. Output: valueChange with the selected string.
 *
 * Custom caret: an absolutely-positioned SVG polyline right-aligned
 * inside the field, painted over the native caret (the native caret
 * varies by OS and is hard to control). The select element still
 * handles keyboard navigation — only its visual caret is overridden.
 *
 * OnPush. Two-way bound via `value` input + `valueChange` output.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectPlaceholderOption {
  value: '';
  label: string;
}

@Component({
  selector: 'atom-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="select-wrap">
      <select
        [id]="id()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-describedby]="ariaDescribedBy() ?? null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-required]="required() ? 'true' : null"
        (change)="onChange($event)"
      >
        @if (placeholderOption(); as pp) {
          <option [value]="pp.value">{{ pp.label }}</option>
        }
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
      <svg
        class="caret"
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0 2 L4 6 L8 2 Z" />
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .select-wrap {
      position: relative;
      display: block;
    }
    select {
      width: 100%;
      height: var(--field-height);
      padding: 0 32px 0 12px;
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
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      cursor: pointer;
    }
    select:disabled {
      background: var(--color-surface-subtle);
      color: var(--color-disabled);
      cursor: not-allowed;
    }
    select[aria-invalid="true"] {
      border-color: var(--color-error);
    }
    select:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 0;
      border-color: var(--focus-ring-color);
    }
    .caret {
      position: absolute;
      top: 50%;
      right: 12px;
      transform: translateY(-50%);
      color: var(--color-label);
      pointer-events: none;
    }
    select:disabled + .caret {
      color: var(--color-disabled);
    }
  `],
})
export class SelectComponent {
  readonly id = input.required<string>();
  readonly value = input<string>('');
  readonly options = input.required<SelectOption[]>();
  readonly placeholderOption = input<SelectPlaceholderOption | null>(null);
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly ariaDescribedBy = input<string | undefined>(undefined);

  @Output() readonly valueChange = new EventEmitter<string>();

  onChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.valueChange.emit(target.value);
  }
}