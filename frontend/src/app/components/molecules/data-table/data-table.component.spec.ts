/**
 * data-table — molecule spec (HD-019).
 *
 * Pins the table's three behavioral contracts:
 *   - Header check → select / deselect every visible row.
 *   - Per-row check → emit a new selection set with that row's
 *     id added or removed (other selections preserved).
 *   - Row click → emit `rowClick` (and never fire when the click
 *     lands on the row's select-cell, so the checkbox can act
 *     without triggering navigation).
 *
 * Cell rendering is delegated to a `<ng-template>` input; the
 * component's only job here is to call it. A render-only spot
 * check (one cell, one row, expected text) is sufficient.
 */

import {
  Component,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  DataTableComponent,
  type DataTableColumn,
} from './data-table.component';

interface Row { __id: string; name: string; }

@Component({
  standalone: true,
  imports: [DataTableComponent],
  template: `
    <data-table
      [columns]="columns"
      [rows]="rows"
      [selectable]="true"
      [selectedIds]="selected"
      [cellTemplate]="cellTpl"
      (selectionChange)="onSelectionChange($event)"
      (rowClick)="onRowClick($event)"
    />
    <ng-template #cellTpl let-row let-col="col">
      <span [class]="'cell-' + col">{{ row.name }}</span>
    </ng-template>
  `,
})
class HarnessComponent {
  readonly columns: DataTableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
  ];
  readonly rows: Row[] = [
    { __id: 'r1', name: 'Alice' },
    { __id: 'r2', name: 'Bob' },
    { __id: 'r3', name: 'Carol' },
  ];
  selected: ReadonlySet<string> = new Set<string>();
  selectionUpdate: ReadonlySet<string> | null = null;
  clicked: Row | null = null;

  @ViewChild('cellTpl') cellTpl!: TemplateRef<unknown>;

  onSelectionChange(next: ReadonlySet<string>): void {
    this.selected = next;
    this.selectionUpdate = next;
  }
  onRowClick(row: Row): void {
    this.clicked = row;
  }
}

describe('DataTableComponent', () => {
  let harness: HarnessComponent;
  let fixture: ComponentFixture<HarnessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HarnessComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HarnessComponent);
    fixture.detectChanges();
    harness = fixture.componentInstance;
  });

  it('renders the header check in the indeterminate state when some rows are selected', () => {
    harness.selected = new Set(['r1']);
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement)
      .querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    expect(input.indeterminate).toBeTrue();
  });

  it('selects every row when the header check is clicked', () => {
    const header = (fixture.nativeElement as HTMLElement)
      .querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    header.checked = true;
    header.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(Array.from(harness.selectionUpdate ?? new Set()).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('emits a new selection set when a row checkbox toggles', () => {
    const rowCheck = (fixture.nativeElement as HTMLElement)
      .querySelector('tbody input[type="checkbox"]') as HTMLInputElement;
    rowCheck.checked = true;
    rowCheck.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(harness.selectionUpdate?.has('r1')).toBeTrue();
  });

  it('emits rowClick when the row body is clicked', () => {
    const tr = (fixture.nativeElement as HTMLElement).querySelector('tbody tr') as HTMLElement;
    tr.click();
    expect(harness.clicked?.__id).toBe('r1');
  });

  it('does NOT emit rowClick when the click lands on the select cell', () => {
    const selectTd = (fixture.nativeElement as HTMLElement)
      .querySelector('tbody tr td.col-select') as HTMLElement;
    selectTd.click();
    expect(harness.clicked).toBeNull();
  });

  it('renders the cell template with the row as context', () => {
    const cell = (fixture.nativeElement as HTMLElement).querySelector('.cell-name');
    expect(cell?.textContent?.trim()).toBe('Alice');
  });
});