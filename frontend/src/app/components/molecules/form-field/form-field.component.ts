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
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-soft);
      margin-bottom: 8px;
      letter-spacing: -0.005em;
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
      margin: 8px 0 0;
      color: var(--color-error);
      font-size: 13px;
      line-height: 1.4;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .form-field-error::before {
      content: '';
      display: inline-block;
      width: 14px;
      height: 14px;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23EF4444'><path d='M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z'/></svg>");
      background-size: contain;
      background-repeat: no-repeat;
      flex-shrink: 0;
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
