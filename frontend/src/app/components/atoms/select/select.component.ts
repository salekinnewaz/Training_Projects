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
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  input,
  viewChild,
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
    <div class="select-wrap" [class.select-wrap--compact]="compact()">
      <select
        #selectEl
        [id]="id()"
        [disabled]="disabled()"
        [attr.aria-describedby]="ariaDescribedBy() ?? null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-required]="required() ? 'true' : null"
        (change)="onChange($event)"
      >
        @if (placeholderOption(); as pp) {
          <option
            [value]="pp.value"
            [selected]="value() === pp.value"
          >{{ pp.label }}</option>
        }
        @for (opt of options(); track opt.value) {
          <option
            [value]="opt.value"
            [selected]="value() === opt.value"
          >{{ opt.label }}</option>
        }
      </select>
      @if (compact() && displayLabel(); as label) {
        <!-- The visual closed-state label. The real <select> sits
             underneath (transparent text) so clicking this label
             still opens the native dropdown. -->
        <span class="select-wrap__overlay" aria-hidden="true">{{ label }}</span>
      }
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
      padding: 0 38px 0 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--field-radius);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      outline: none;
      box-shadow: var(--shadow-xs);
      box-sizing: border-box;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      cursor: pointer;
    }
    select:disabled {
      background: var(--color-page-bg);
      color: var(--color-disabled);
      cursor: not-allowed;
      box-shadow: none;
    }
    select[aria-invalid="true"] {
      border-color: var(--color-error);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
    }
    select:focus-visible {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-ring);
    }
    select:hover:not(:disabled):not([aria-invalid="true"]) {
      border-color: var(--color-border-strong);
    }
    .select-wrap--compact select {
      width: 116px;
      padding: 0 30px 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-tint);
      border-color: var(--color-primary-ring);
    }
    /* When an explicit closed-state label is supplied, the native
       option text is made transparent and the overlay paints the
       label instead. The control stays fully interactive — only its
       TEXT is repainted. */
    .select-wrap--compact:has(.select-wrap__overlay) select {
      color: transparent;
    }
    .select-wrap__overlay {
      position: absolute;
      top: 50%;
      left: 12px;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--color-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 40px);
    }
    .select-wrap--compact select:hover:not(:disabled) {
      border-color: var(--color-primary);
    }
    .select-wrap--compact .caret {
      right: 10px;
    }
    .caret {
      position: absolute;
      top: 50%;
      right: 14px;
      transform: translateY(-50%);
      color: var(--color-label);
      pointer-events: none;
    }
    select:disabled + .caret {
      color: var(--color-disabled);
    }
  `],
})
export class SelectComponent implements AfterViewChecked {
  readonly id = input.required<string>();
  readonly value = input<string>('');
  /**
   * Compact mode — renders a narrow, fixed-width trigger.
   *
   * Used where the select is a CONTROL sitting beside a separate
   * read-out of the same value (e.g. the role badge in the Admin
   * Users table). The badge carries the role name; the select
   * carries only the affordance, so the column never repeats
   * itself and the label never has to be truncated.
   */
  readonly compact = input<boolean>(false);
  /**
   * Overrides the CLOSED-state label shown on the trigger.
   *
   * The native `<select>` renders its selected option's text when
   * closed — there is no way to style a different "closed" text
   * without replacing the control. This input therefore swaps in
   * a VISUAL overlay for the closed state while the real
   * `<select>` stays underneath, transparent, and fully
   * interactive (keyboard + screen-reader semantics intact).
   *
   * Only meaningful alongside `compact`; ignored otherwise.
   */
  readonly displayLabel = input<string | null>(null);
  /**
   * The option list. Optional (defaults to empty) rather than
   * required, so a consumer can bind the value BEFORE the options
   * arrive — e.g. an assignee dropdown whose `ownerId` is known
   * from the ticket but whose agent list is still loading. With a
   * required input, Angular throws NG0950 on the first render
   * before the options ever get a chance to land.
   */
  readonly options = input<SelectOption[]>([]);
  readonly placeholderOption = input<SelectPlaceholderOption | null>(null);
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly ariaDescribedBy = input<string | undefined>(undefined);

  @Output() readonly valueChange = new EventEmitter<string>();

  readonly selectEl = viewChild<ElementRef<HTMLSelectElement>>('selectEl');

  /**
   * WHY THIS EXISTS — the native-`<select>` selection gotcha
   * ─────────────────────────────────────────────────────────
   * A `<select>` displays the option whose `value` matches the
   * select's own `value` PROPERTY — but only if that option has
   * been marked as `selected`. Setting the select's `value`
   * property does NOT mark an option as selected; it just sets
   * an attribute-like property that the browser ignores when
   * deciding what to display.
   *
   * That is why the old implementation (a plain `[value]="value()"`
   * on the `<select>`) silently rendered the FIRST option for
   * every row: Angular set `select.value = 'Admin'`, but no
   * `<option>` was `selected`, so the browser fell back to
   * `selectedIndex === 0` — "User".
   *
   * The template now sets `[selected]` on each `<option>` (the
   * declarative fix), and this method imperatively re-asserts
   * `select.value` afterwards. The imperative pass is the
   * belt-and-braces half: it guarantees the displayed value
   * matches the bound value even when the options list is
   * re-rendered in the same tick as the value change (e.g. an
   * assignee dropdown whose options arrive from the API after
   * the ticket's `ownerId` is already bound).
   */
  /**
   * Re-assert the selected option after every view update.
   *
   * WHY `ngAfterViewChecked` AND NOT AN EFFECT
   * ─────────────────────────────────────────
   * A reactive effect runs BEFORE Angular flushes the DOM, so it
   * would read the PREVIOUS `<option>` list. That breaks the
   * "value is bound before the options arrive" ordering (e.g. an
   * assignee dropdown whose `ownerId` is known but whose agent
   * list is still loading): the effect runs with zero options,
   * finds no match, and — because the effect's dependencies
   * didn't change again — never re-runs.
   *
   * `ngAfterViewChecked` runs AFTER the DOM is written, so the
   * `<option>` elements are guaranteed to be current. The write
   * is guarded by a comparison, so it only touches the DOM when
   * the displayed value actually disagrees with the bound value
   * — i.e. it does not fight the user's own selection and does
   * not cause a change-detection loop.
   */
  ngAfterViewChecked(): void {
    const el = this.selectEl()?.nativeElement;
    if (!el) return;
    const wanted = this.value();
    if (el.value !== wanted) {
      el.value = wanted;
    }
  }

  onChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.valueChange.emit(target.value);
  }
}