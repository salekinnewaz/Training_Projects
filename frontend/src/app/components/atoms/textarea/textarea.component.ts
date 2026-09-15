/**
 * textarea — atom (HD-008).
 *
 * Bare `<textarea>` primitive for multi-line input. Mirrors the API
 * surface of `<atom-input>` (HD-005): id / value / placeholder /
 * disabled / invalid / required / ariaDescribedBy / valueChange so
 * the consuming `form-field` molecule can host either control
 * through the same `ng-content` slot.
 *
 * Defaults:
 *   rows = 5        (Create Ticket's Description field; UX doc allows
 *                    5..10 — rows controls the visible line count,
 *                    CSS resize:vertical grows past it on user drag)
 *   min-height 124px (the spec's hard floor; not a token — promote
 *                    to --field-textarea-min-height if a second
 *                    consumer emerges)
 *
 * Resize behavior: `resize: vertical` lets users grow the field past
 * 10 rows on drag; nothing else is draggable so the layout stays
 * predictable. Inline newline characters in `value` round-trip
 * through the native textarea untouched (UX doc says line breaks
 * must be preserved).
 *
 * OnPush. value is two-way bound via `value` input + `valueChange`
 * output, matching the atom-input contract.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

@Component({
  selector: 'atom-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <textarea
      [id]="id()"
      [value]="value()"
      [placeholder]="placeholder() ?? ''"
      [rows]="rows()"
      [attr.aria-describedby]="ariaDescribedBy() ?? null"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-required]="required() ? 'true' : null"
      [disabled]="disabled()"
      (input)="onInput($event)"
    ></textarea>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    textarea {
      width: 100%;
      min-height: 124px;
      padding: 12px;
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
      resize: vertical;
    }
    textarea::placeholder {
      color: var(--color-muted);
    }
    textarea:disabled {
      background: var(--color-surface-subtle);
      color: var(--color-disabled);
      cursor: not-allowed;
      resize: none;
    }
    textarea[aria-invalid="true"] {
      border-color: var(--color-error);
    }
    textarea:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 0;
      border-color: var(--focus-ring-color);
    }
  `],
})
export class TextareaComponent {
  readonly id = input.required<string>();
  readonly value = input<string>('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly ariaDescribedBy = input<string | undefined>(undefined);
  readonly rows = input<number>(5);

  @Output() readonly valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.valueChange.emit(target.value);
  }
}