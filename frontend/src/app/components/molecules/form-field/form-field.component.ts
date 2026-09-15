/**
 * form-field — molecule (HD-005).
 *
 * Three-part wrapper:
 *   1. Label (always rendered; visually-hidden when hideLabel)
 *   2. Projected content (the `<atom-input>` and any suffix widget
 *      like the password show/hide toggle)
 *   3. Error message — only when `error` is truthy
 *
 * The label uses `[htmlFor]="id"`; the projected `<atom-input>`
 * binds `id="..."` to the same id so clicking the label focuses
 * the input. The error element exposes `id="<id>-error"` so the
 * input can wire `aria-describedby` to it.
 *
 * Spacing between label and field is a local 8px literal — the
 * `--space-modal-pad` token (24px) is too generous for a vertical
 * label-stack rhythm. Promoted to `--space-form-label-gap` if a
 * second form demands it.
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  selector: 'form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hideLabel()) {
      <label [attr.for]="id()">
        {{ label() }}@if (required()) {<span class="req" aria-hidden="true"> *</span>}
      </label>
    }
    <div class="control">
      <ng-content />
    </div>
    @if (error(); as e) {
      <p class="form-field-error" [id]="id() + '-error'" role="alert">{{ e }}</p>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-label);
      margin-bottom: 8px;
    }
    .req {
      color: var(--color-error);
      margin-left: 2px;
    }
    .control {
      position: relative;
      display: block;
    }
    .form-field-error {
      margin: 6px 0 0;
      color: var(--color-error);
      font-size: 13px;
      line-height: 1.4;
    }
  `],
})
export class FormFieldComponent {
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input<boolean>(false);
  readonly hideLabel = input<boolean>(false);
  readonly error = input<string | null>(null);
}
