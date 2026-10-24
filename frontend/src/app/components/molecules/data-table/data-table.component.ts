/**
 * data-table — molecule (HD-019).
 *
 * A generic, typed table shell for the Tickets list. It's
 * deliberately *not* a `<table>` wrapper that hides the markup —
 * it owns the semantic `<table>` structure (thead/tbody/tr/th/td)
 * plus the select-all checkbox column, and delegates each cell's
 * *content* to the caller via content projection into named
 * slots. That keeps the table's accessibility semantics intact
 * (screen readers announce column headers, row counts) while
 * letting the Tickets page render whatever it needs per column.
 *
 * Projection contract: for each row, the caller projects one
 * `<ng-container [row]>`-scoped element per column, matching
 * `columns[i].slot`. E.g.
 *
 *   <data-table [columns]="cols" [rows]="pageRows()" (rowClick)="open($event)">
 *     <ng-container headerId>…</ng-container>
 *     <ng-container [cellId]="t.id">…</ng-container>
 *     …
 *   </data-table>
 *
 * Angular doesn't support parameterized ng-content projection by
 * name, so instead of a template-per-cell API this component
 * renders the row cells via a `<ng-template>` the caller fills,
 * passing the column key. That's the `cellTemplate` input.
 *
 * Why not just write the table markup inline in the page? Two
 * reasons: (a) the Tickets page already has ~200 lines of page
 * chrome (stat strip, filters, empty/error states), and (b) the
 * header/body row interaction — select-all tri-state, the
 * zebra striping, the sticky header — is generic and worth
 * having in one place.
 */

import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CheckboxComponent } from '../../atoms/checkbox/checkbox.component';

export interface DataTableColumn {
  /** Stable key used to look up the cell template. */
  key: string;
  /** Visible header label. */
  label: string;
  /** Tailwind-free width hint; any CSS width value. */
  width?: string;
  /** Right-align numeric cells. */
  align?: 'start' | 'end';
  /** Hide below the given breakpoint width. */
  hideBelow?: number;
}

@Component({
  selector: 'data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, NgTemplateOutlet],
  template: `
    <div class="table-wrap">
      <table class="table" data-testid="data-table">
        <thead>
          <tr>
            @if (selectable()) {
              <th class="col-select" scope="col">
                <atom-checkbox
                  [checked]="allSelected()"
                  [indeterminate]="someSelected()"
                  [disabled]="rows().length === 0"
                  ariaLabel="Select all rows"
                  (checkedChange)="toggleAll($event)"
                />
              </th>
            }
            @for (col of columns(); track col.key) {
              <th
                scope="col"
                [class.is-end]="col.align === 'end'"
                [style.width]="col.width ?? null"
                [attr.data-col]="col.key"
              >{{ col.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.__id) {
            <tr
              class="row"
              [class.is-selected]="isSelected(row.__id)"
              (click)="rowClick.emit(row)"
            >
              @if (selectable()) {
                <td class="col-select" (click)="$event.stopPropagation()">
                  <atom-checkbox
                    [checked]="isSelected(row.__id)"
                    [ariaLabel]="'Select row ' + row.__id"
                    (checkedChange)="toggleRow(row.__id, $event)"
                  />
                </td>
              }
              @for (col of columns(); track col.key) {
                <td
                  class="cell"
                  [class.is-end]="col.align === 'end'"
                  [attr.data-col]="col.key"
                >
                  @if (cellTemplate(); as tpl) {
                    <ng-container
                      [ngTemplateOutlet]="tpl"
                      [ngTemplateOutletContext]="{ $implicit: row, col: col.key }"
                    />
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-muted);
      border-bottom: 1px solid var(--color-card-border);
      background: var(--color-surface-subtle, #f8fafc);
      white-space: nowrap;
    }
    th.is-end,
    td.is-end {
      text-align: right;
    }
    td {
      padding: 14px 16px;
      color: var(--color-text-soft);
      border-bottom: 1px solid var(--color-border-subtle, #f1f5f9);
      vertical-align: middle;
    }
    .row {
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    .row:hover {
      background: var(--color-page-bg);
    }
    .row.is-selected {
      background: var(--color-primary-soft, #eef2ff);
    }
    .col-select {
      width: 44px;
      padding-left: 20px;
      padding-right: 0;
    }
  `],
})
export class DataTableComponent<Row extends { __id: string | number }> {
  readonly columns = input.required<DataTableColumn[]>();
  readonly rows = input.required<Row[]>();

  /** Renders the select-all / per-row checkbox column. */
  readonly selectable = input<boolean>(false);

  /** Ids of currently-selected rows. */
  readonly selectedIds = input<ReadonlySet<string | number>>(new Set());

  /** Renders one cell per (row, column) pair. Receives
   * `{ $implicit: row, col: columnKey }` as context. */
  readonly cellTemplate = input<TemplateRef<unknown> | null | undefined>(null);

  readonly selectionChange = output<ReadonlySet<string | number>>();
  readonly rowClick = output<Row>();

  protected readonly allSelected = computed(
    () =>
      this.rows().length > 0 &&
      this.rows().every((r) => this.selectedIds().has(r.__id)),
  );
  protected readonly someSelected = computed(
    () =>
      !this.allSelected() &&
      this.rows().some((r) => this.selectedIds().has(r.__id)),
  );

  isSelected(id: string | number): boolean {
    return this.selectedIds().has(id);
  }

  toggleRow(id: string | number, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectionChange.emit(next);
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.selectionChange.emit(new Set(this.rows().map((r) => r.__id)));
    } else {
      this.selectionChange.emit(new Set());
    }
  }
}