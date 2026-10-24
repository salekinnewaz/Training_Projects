/**
 * ticket-table — molecule (WDS-2026 shared ticket table).
 *
 * THE table. User, Support Agent and Admin all render this exact
 * component, so the three dashboards read as one family rather
 * than three different-looking surfaces.
 *
 * Columns, left to right, exactly as the reference lays them out:
 *
 *   ☐ │ ▣ │ HD-101 │ Title                │ Status │ Priority │ Customer │ Assignee │ Updated │ ⋯
 *      │    │        │ second line (muted) │        │          │          │          │         │
 *
 *   - a select-all checkbox column (optional; the User role shows
 *     per-row checkboxes but not the header one — see `selectable`),
 *   - a colour-coded category glyph (`ticket-category-icon`),
 *   - the ticket number in mono (`HD-101`),
 *   - the title in semibold with a muted description line beneath,
 *   - a status pill, a priority pill,
 *   - the customer's name,
 *   - the assignee's avatar + name, or "Unassigned",
 *   - a relative timestamp ("4d ago"),
 *   - a per-row kebab menu.
 *
 * The footer carries the reference's pagination bar:
 * `Showing 1–10 of 156 tickets` on the left, the numbered page
 * buttons on the right, plus a "10 / page" size picker.
 *
 * This component owns **presentation and pagination arithmetic
 * only**. It does not fetch, and it does not filter — the parent
 * hands it the rows for the current page and the total row count.
 * Filtering lives one level up so all three role pages can share
 * it without the table knowing whose tickets it is looking at.
 *
 * The table is a real `<table>`: `thead`/`tbody`/`th`/`td` with
 * `scope="col"`, so screen readers announce the column headers
 * and the row count. The zebra striping, the hover state and the
 * select-all tri-state are all handled here.
 *
 * Note: the styles live in an inline `styles: [...]` template
 * literal, so a BACKTICK anywhere in the CSS terminates the TS
 * template string and the compiler then chokes on the remainder
 * as TypeScript. The symptom is deceptive: the dev server prints
 * the compile error but keeps serving the PREVIOUS bundle, so the
 * change looks like it simply did not take. Use double quotes
 * inside the CSS comments.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { BadgePriorityComponent } from '../../atoms/badge-priority/badge-priority.component';
import { BadgeStatusComponent } from '../../atoms/badge-status/badge-status.component';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import { CheckboxComponent } from '../../atoms/checkbox/checkbox.component';
import { TicketCategoryIconComponent } from '../../atoms/ticket-category-icon/ticket-category-icon.component';
import { PaginationComponent } from '../pagination/pagination.component';
import type { Ticket } from '../../../models/ticket';

/** A ticket plus the row identity the table tracks and selects by. */
export interface TicketTableRow extends Ticket {
  readonly __id: string;
}

/** Row sizes offered by the "N / page" picker. */
export const TICKET_TABLE_PAGE_SIZES = [10, 25, 50] as const;

@Component({
  selector: 'ticket-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgePriorityComponent,
    BadgeStatusComponent,
    ChromeAvatarComponent,
    CheckboxComponent,
    TicketCategoryIconComponent,
    PaginationComponent,
  ],
  template: `
    <div class="card">
      <div class="table-wrap">
        <table class="table" data-testid="ticket-table">
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
              <th class="col-icon" scope="col"><span class="sr-only">Category</span></th>
              <th class="col-number" scope="col">ID</th>
              <th class="col-title" scope="col">Title</th>
              <th class="col-status" scope="col">Status</th>
              <th class="col-priority" scope="col">Priority</th>
              <th class="col-customer" scope="col">Customer</th>
              <th class="col-assignee" scope="col">Assignee</th>
              <th class="col-updated" scope="col">Updated</th>
              <th class="col-actions" scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.__id) {
              <tr
                class="row"
                [class.is-selected]="isSelected(row.__id)"
                [attr.data-ticket-id]="row.id"
                (click)="rowClick.emit(row)"
              >
                @if (selectable()) {
                  <td class="col-select" (click)="$event.stopPropagation()">
                    <atom-checkbox
                      [checked]="isSelected(row.__id)"
                      [ariaLabel]="'Select row ' + row.number"
                      (checkedChange)="toggleRow(row.__id, $event)"
                    />
                  </td>
                }
                <td class="col-icon">
                  <ticket-category-icon [category]="row.category" />
                </td>
                <td class="col-number">
                  <span class="number">{{ row.number }}</span>
                </td>
                <td class="col-title">
                  <span class="title" [title]="row.title">{{ row.title }}</span>
                  @if (row.description) {
                    <span class="desc" [title]="row.description">{{ row.description }}</span>
                  }
                </td>
                <td class="col-status">
                  <badge-status [status]="row.status" />
                </td>
                <td class="col-priority">
                  <badge-priority [priority]="row.priority" />
                </td>
                <td class="col-customer">
                  <span class="person">
                    <chrome-avatar [displayName]="customerName(row)" [size]="24" />
                    <span class="person-name">{{ customerName(row) }}</span>
                  </span>
                </td>
                <td class="col-assignee">
                  @if (row.owner; as owner) {
                    <span class="person">
                      <chrome-avatar [displayName]="owner.displayName" [size]="24" />
                      <span class="person-name">{{ owner.displayName }}</span>
                    </span>
                  } @else {
                    <span class="person-empty">Unassigned</span>
                  }
                </td>
                <td class="col-updated">
                  <span class="muted">{{ relative(row.updatedAt) }}</span>
                </td>
                <td class="col-actions" (click)="$event.stopPropagation()">
                  <div class="kebab-wrap">
                    <button
                      type="button"
                      class="kebab"
                      [attr.aria-label]="'Actions for ' + row.number"
                      (click)="toggleKebab($event, row.id)"
                    >
                      <svg viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true">
                        <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
                        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                        <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
                      </svg>
                    </button>
                    @if (kebabFor() === row.id) {
                      <div class="kebab-menu" role="menu">
                        <button type="button" role="menuitem" (click)="openTicket(row)">Open ticket</button>
                        @if (row.status !== 'Closed' && row.status !== 'Resolved') {
                          <button type="button" role="menuitem" (click)="resolveTicket.emit(row)">Mark resolved</button>
                        }
                        <button type="button" role="menuitem" (click)="closeTicket.emit(row)">Mark closed</button>
                      </div>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr class="empty-row">
                <td [attr.colspan]="columnCount()">
                  <span class="empty-text">{{ emptyMessage() }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <footer class="foot" data-testid="ticket-table-foot">
        <span class="summary" data-testid="ticket-table-summary">{{ summary() }}</span>

        <div class="foot-right">
          <label class="size">
            <span class="size-label">Rows</span>
            <select
              class="size-select"
              [value]="pageSize()"
              (change)="onPageSizeChange($event)"
              aria-label="Rows per page"
              data-testid="ticket-table-page-size"
            >
              @for (size of pageSizes; track size) {
                <option [value]="size">{{ size }} / page</option>
              }
            </select>
          </label>

          <pagination
            [page]="page()"
            [pageCount]="pageCount()"
            [totalItems]="totalItems()"
            [pageSize]="pageSize()"
            (pageChange)="pageChange.emit($event)"
          />
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* The table's min-width (below) must NOT propagate up to the
         page's grid/flex column. As a grid item the host's automatic
         minimum size is its min-content size, which is the table's
         1040px — that would stretch the whole page and drag the
         stat strip sideways with it. A zero min-width cuts the
         automatic minimum size, so the host stays at the page's
         width and only .table-wrap scrolls. */
      min-width: 0;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-card);
      /* The card is a block inside the host, but as a grid item in
         the page it would still contribute its min-content width.
         Cut it the same way the host is cut. */
      min-width: 0;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      /* The scroll container's own automatic minimum size is 0, but
         say so explicitly so the chain host → card → wrap → table
         all stay at the page's width. */
      min-width: 0;
      /* The .sr-only cells inside the table are absolutely
         positioned. Without a positioned ancestor in the scroll
         container they resolve against the INITIAL containing
         block — the viewport — so the visually-hidden "Actions"
         label at the far right of the 1040px table stretched the
         whole PAGE sideways (documentElement.scrollWidth 1037 at a
         420px viewport). Making the wrapper the containing block
         keeps the label inside the scroller, where it is clipped. */
      position: relative;
    }
    .table {
      width: 100%;
      /* The reference keeps its column widths intact and lets the
         wrapper scroll horizontally on narrow screens. Without a floor
         the fixed layout squeezes the title column to zero. */
      min-width: 1040px;
      border-collapse: collapse;
      font-size: 14px;
      table-layout: fixed;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-muted);
      border-bottom: 1px solid var(--color-card-border);
      background: var(--color-surface-subtle, #f8fafc);
      white-space: nowrap;
    }
    td {
      padding: 12px 16px;
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

    /* Column widths. The title takes the slack; everything else
       is sized to its content so the row reads as a set of tight
       groups rather than evenly-spaced columns. */
    .col-select {
      width: 44px;
      padding-left: 20px;
      padding-right: 0;
    }
    .col-icon {
      width: 52px;
      padding-left: 0;
      padding-right: 8px;
    }
    .col-number {
      width: 84px;
    }
    .col-title {
      width: auto;
    }
    .col-status {
      width: 120px;
    }
    .col-priority {
      width: 104px;
    }
    .col-customer {
      width: 156px;
    }
    .col-assignee {
      width: 156px;
    }
    .col-updated {
      width: 96px;
    }
    .col-actions {
      width: 52px;
      padding-right: 16px;
    }

    .number {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      font-weight: 600;
      color: var(--color-primary);
      white-space: nowrap;
    }
    .title {
      display: block;
      font-weight: 600;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .desc {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: var(--color-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .person {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .person-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .person-empty {
      color: var(--color-muted);
    }
    .muted {
      color: var(--color-muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .kebab-wrap {
      position: relative;
    }
    .kebab {
      all: unset;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--color-muted);
    }
    .kebab:hover {
      background: var(--color-page-bg);
      color: var(--color-text-primary);
    }
    .kebab:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .kebab-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 160px;
      padding: 6px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      box-shadow: var(--shadow-dropdown);
      z-index: var(--z-dropdown, 100);
    }
    .kebab-menu button {
      display: block;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-soft);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
    }
    .kebab-menu button:hover {
      background: var(--color-primary-soft, #eef2ff);
      color: var(--color-primary);
    }

    .empty-row td {
      padding: 40px 16px;
      text-align: center;
    }
    .empty-text {
      color: var(--color-muted);
      font-size: 14px;
    }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border-top: 1px solid var(--color-card-border);
      flex-wrap: wrap;
    }
    .summary {
      font-size: 13px;
      color: var(--color-text-soft);
      white-space: nowrap;
    }
    .foot-right {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .size {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .size-label {
      font-size: 13px;
      color: var(--color-text-soft);
    }
    .size-select {
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--color-card-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text-soft);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    @media (max-width: 1100px) {
      .col-customer,
      .col-assignee {
        width: 130px;
      }
    }
  `],
})
export class TicketTableComponent {
  private readonly router = inject(Router);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /** The rows for the CURRENT page. The parent does the slicing. */
  readonly rows = input.required<TicketTableRow[]>();

  /** The 1-based current page. */
  readonly page = input.required<number>();

  /** The total number of pages across the whole (filtered) set. */
  readonly pageCount = input.required<number>();

  /** The total row count across the whole (filtered) set. */
  readonly totalItems = input.required<number>();

  /** Rows per page. */
  readonly pageSize = input.required<number>();

  /** Shows the checkbox column. */
  readonly selectable = input<boolean>(true);

  /** The copy under the table when there are no rows at all. */
  readonly emptyMessage = input<string>('No tickets found');

  /** Ids of currently-selected rows. */
  readonly selectedIds = input<ReadonlySet<string | number>>(new Set());

  readonly selectionChange = output<ReadonlySet<string | number>>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly rowClick = output<TicketTableRow>();
  readonly resolveTicket = output<TicketTableRow>();
  readonly closeTicket = output<TicketTableRow>();

  protected readonly pageSizes = TICKET_TABLE_PAGE_SIZES;
  protected readonly kebabFor = signal<number | null>(null);

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

  /** How many cells a full row spans — the checkbox column counts
   * only when it is rendered. */
  protected readonly columnCount = computed(() => (this.selectable() ? 10 : 9));

  /**
   * "Showing 1–10 of 156 tickets". The reference's footer names
   * the noun, so the copy does too — a bare "of 156" reads like a
   * page count.
   */
  protected readonly summary = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 'Showing 0–0 of 0 tickets';
    const size = Math.max(1, this.pageSize());
    const start = (this.page() - 1) * size + 1;
    const end = Math.min(total, this.page() * size);
    return `Showing ${start}–${end} of ${total} tickets`;
  });

  isSelected(id: string | number): boolean {
    return this.selectedIds().has(id);
  }

  /**
   * The submitter's display name. The API always sends the
   * submitter, but the table renders for three different roles
   * and a partially-populated row should degrade to a dash
   * rather than throw mid-render.
   */
  customerName(row: TicketTableRow): string {
    return row.submitter?.displayName ?? '—';
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

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.pageSizeChange.emit(value);
  }

  toggleKebab(event: Event, ticketId: number): void {
    event.stopPropagation();
    this.kebabFor.update((cur) => (cur === ticketId ? null : ticketId));
  }

  openTicket(row: TicketTableRow): void {
    this.kebabFor.set(null);
    void this.router.navigate(['/tickets', row.id]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.kebabFor() === null) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.hostEl.nativeElement.contains(target)) {
      this.kebabFor.set(null);
    }
  }

  /**
   * "4d ago" / "2h ago" / "just now" relative-time formatter.
   * Deliberately coarse — a ticket list doesn't need second-level
   * precision, and the coarser string is easier to scan.
   */
  relative(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
}
