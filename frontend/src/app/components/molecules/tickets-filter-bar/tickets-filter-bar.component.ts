/**
 * tickets-filter-bar — molecule (HD-019).
 *
 * The filter row between the stat strip and the Tickets table:
 * a debounced search input, four dropdown filters (Status,
 * Priority, Assignee, Customer), a sort control, and a
 * "More filters" affordance.
 *
 * Filter state lives in the parent (the page) — this component is
 * a controlled view over it. Every change is emitted upward via
 * a single `change` output carrying the full next state, so the
 * page owns one `filters` signal and one `applyFilters` path
 * rather than six separate handlers.
 *
 * Dropdown behavior:
 *   - Each filter button shows the active label when narrowed
 *     ("Open") or the "All X" placeholder when not ("All statuses").
 *   - Selecting the "All" option clears that filter.
 *   - Clicking outside the host closes any open panel. We use a
 *     `@HostListener('document:click')` and compare against the
 *     host element, matching `header-chrome`'s pattern.
 *
 * The search box is debounced 200ms — the same cadence
 * `header-chrome` uses — so typing doesn't spam the filter
 * pipeline. The un-debounced value stays in a local signal so
 * the input stays responsive while the filter signal lags.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { TicketPriority, TicketStatus } from '../../../models/enums';
import { CaretDownComponent } from '../../atoms/caret-down/caret-down.component';
import { ButtonComponent } from '../../atoms/button/button.component';

export type FilterKey = 'status' | 'priority' | 'assignee' | 'customer';
export type SortKey = 'newest' | 'oldest' | 'priority' | 'status';

export interface TicketFilterState {
  search: string;
  status: TicketStatus | 'all';
  priority: TicketPriority | 'all';
  assignee: 'all' | 'unassigned' | 'me';
  customer: 'all' | 'mine';
  sort: SortKey;
}

type OpenPanel = FilterKey | 'sort' | null;

const SEARCH_DEBOUNCE_MS = 200;

const STATUS_OPTIONS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: TicketPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const ASSIGNEE_OPTIONS: { value: TicketFilterState['assignee']; label: string }[] = [
  { value: 'all', label: 'All assignees' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
];

const CUSTOMER_OPTIONS: { value: TicketFilterState['customer']; label: string }[] = [
  { value: 'all', label: 'All customers' },
  { value: 'mine', label: 'Requested by me' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];

@Component({
  selector: 'tickets-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CaretDownComponent],
  template: `
    <div class="filters" data-testid="tickets-filter-bar">
      <div class="filters-search">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M11 11 L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </span>
        <input
          type="search"
          class="search-field"
          placeholder="Search tickets…"
          [value]="searchValue()"
          (input)="onSearchInput($event)"
          aria-label="Search tickets"
          data-testid="filter-search"
        />
      </div>

      <div class="filters-controls">
        @for (f of filterDefs; track f.key) {
          <div class="filter-wrap">
            <button
              type="button"
              class="filter-btn"
              [class.is-active]="isNarrowed(f.key)"
              [attr.aria-expanded]="open() === f.key"
              [attr.aria-label]="f.ariaLabel"
              (click)="togglePanel(f.key)"
              [attr.data-testid]="'filter-' + f.key"
            >
              <span class="filter-label">{{ currentLabel(f.key) }}</span>
              <caret-down />
            </button>
            @if (open() === f.key) {
              <div class="filter-menu" role="menu">
                @for (opt of optionsFor(f.key); track opt.value) {
                  <button
                    type="button"
                    class="filter-option"
                    role="menuitemradio"
                    [attr.aria-checked]="currentValue(f.key) === opt.value"
                    [class.is-selected]="currentValue(f.key) === opt.value"
                    (click)="selectOption(f.key, opt.value)"
                  >
                    <span>{{ opt.label }}</span>
                    @if (currentValue(f.key) === opt.value) {
                      <svg viewBox="0 0 12 12" width="11" height="11" focusable="false" aria-hidden="true">
                        <path d="M2 6.2 L4.8 9 L10 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="filter-wrap">
          <button
            type="button"
            class="filter-btn"
            [attr.aria-expanded]="open() === 'sort'"
            aria-label="Sort tickets"
            (click)="togglePanel('sort')"
            data-testid="filter-sort"
          >
            <span class="filter-label">{{ currentLabel('sort') }}</span>
            <caret-down />
          </button>
          @if (open() === 'sort') {
            <div class="filter-menu" role="menu">
              @for (opt of sortOptions; track opt.value) {
                <button
                  type="button"
                  class="filter-option"
                  role="menuitemradio"
                  [attr.aria-checked]="filters().sort === opt.value"
                  [class.is-selected]="filters().sort === opt.value"
                  (click)="selectSort(opt.value)"
                >
                  <span>{{ opt.label }}</span>
                  @if (filters().sort === opt.value) {
                    <svg viewBox="0 0 12 12" width="11" height="11" focusable="false" aria-hidden="true">
                      <path d="M2 6.2 L4.8 9 L10 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  }
                </button>
              }
            </div>
          }
        </div>

        @if (hasActiveFilter()) {
          <button type="button" class="clear-btn" (click)="clearAll()" data-testid="filter-clear">
            Clear filters
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .filters {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .filters-search {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 260px;
      height: 40px;
      padding: 0 14px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      color: var(--color-text-soft);
      transition:
        border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
      flex: 1 1 260px;
      max-width: 340px;
    }
    .filters-search:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-ring);
    }
    .search-icon {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .search-field {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      background: transparent;
      font-family: inherit;
      font-size: 14px;
      color: var(--color-text-primary);
      outline: none;
    }
    .search-field::placeholder {
      color: var(--color-muted);
    }
    .filters-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .filter-wrap {
      position: relative;
    }
    .filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 40px;
      padding: 0 12px;
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      background: var(--color-surface);
      color: var(--color-text-soft);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    .filter-btn:hover {
      background: var(--color-page-bg);
      color: var(--color-text-primary);
    }
    .filter-btn.is-active {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: var(--color-primary-soft, #eef2ff);
    }
    .filter-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .filter-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 180px;
      padding: 6px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 12px;
      box-shadow: var(--shadow-dropdown);
      z-index: var(--z-dropdown, 100);
    }
    .filter-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      white-space: nowrap;
    }
    .filter-option:hover {
      background: var(--color-primary-soft, #eef2ff);
      color: var(--color-primary);
    }
    .filter-option.is-selected {
      color: var(--color-primary);
      font-weight: 600;
    }
    .clear-btn {
      height: 40px;
      padding: 0 12px;
      border: 0;
      background: transparent;
      color: var(--color-primary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 8px;
    }
    .clear-btn:hover {
      background: var(--color-primary-soft, #eef2ff);
    }
  `],
})
export class TicketsFilterBarComponent {
  /** The parent-owned filter state. */
  readonly filters = input.required<TicketFilterState>();

  /** Emits the full next filter state on any change. */
  readonly filtersChange = output<TicketFilterState>();

  protected readonly filterDefs: {
    key: FilterKey;
    placeholder: string;
    ariaLabel: string;
  }[] = [
    { key: 'status', placeholder: 'All statuses', ariaLabel: 'Filter by status' },
    { key: 'priority', placeholder: 'All priorities', ariaLabel: 'Filter by priority' },
    { key: 'assignee', placeholder: 'All assignees', ariaLabel: 'Filter by assignee' },
    { key: 'customer', placeholder: 'All customers', ariaLabel: 'Filter by customer' },
  ];

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly assigneeOptions = ASSIGNEE_OPTIONS;
  protected readonly customerOptions = CUSTOMER_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly open = signal<OpenPanel>(null);

  /** Debounced-value holder so the input stays responsive while
   * the emitted filter lags 200ms behind. */
  protected readonly searchValue = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  protected readonly hasActiveFilter = computed(() => {
    const f = this.filters();
    return (
      f.search !== '' ||
      f.status !== 'all' ||
      f.priority !== 'all' ||
      f.assignee !== 'all' ||
      f.customer !== 'all'
    );
  });

  constructor() {
    // No constructor work — the local `searchValue` signal
    // intentionally stays in sync with the parent's `filters().search`
    // so deep-links (e.g. `/tickets?q=vpn`) seed the input on
    // mount. We only sync when the values actually diverge so
    // user keystrokes (handled by `onSearchInput`) never fight
    // a re-render.
    //
    // `allowSignalWrites: true` because we ARE writing the
    // `searchValue` signal from inside this effect — that's the
    // whole point of the sync. Without it Angular's NG0600
    // guard throws. The `if` guard keeps us from looping on
    // our own writes.
    effect(
      () => {
        const fromParent = this.filters().search;
        if (fromParent !== this.searchValue()) {
          this.searchValue.set(fromParent);
        }
      },
      { allowSignalWrites: true },
    );
  }

  optionsFor(
    key: FilterKey,
  ): { value: string; label: string }[] {
    switch (key) {
      case 'status': return STATUS_OPTIONS as { value: string; label: string }[];
      case 'priority': return PRIORITY_OPTIONS as { value: string; label: string }[];
      case 'assignee': return ASSIGNEE_OPTIONS as { value: string; label: string }[];
      case 'customer': return CUSTOMER_OPTIONS as { value: string; label: string }[];
      default: return [];
    }
  }

  currentValue(key: FilterKey | 'sort'): string {
    const f = this.filters();
    return f[key];
  }

  currentLabel(key: FilterKey | 'sort'): string {
    const f = this.filters();
    const value = f[key];
    const opts =
      key === 'status' ? STATUS_OPTIONS
      : key === 'priority' ? PRIORITY_OPTIONS
      : key === 'assignee' ? ASSIGNEE_OPTIONS
      : key === 'customer' ? CUSTOMER_OPTIONS
      : SORT_OPTIONS;
    const match = opts.find((o) => o.value === value);
    return match ? match.label : value;
  }

  isNarrowed(key: FilterKey): boolean {
    return this.filters()[key] !== 'all';
  }

  togglePanel(key: OpenPanel): void {
    this.open.update((cur) => (cur === key ? null : key));
  }

  selectOption(key: FilterKey, value: string): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value } as TicketFilterState);
    this.open.set(null);
  }

  selectSort(value: SortKey): void {
    this.filtersChange.emit({ ...this.filters(), sort: value });
    this.open.set(null);
  }

  clearAll(): void {
    this.searchValue.set('');
    this.filtersChange.emit({
      search: '',
      status: 'all',
      priority: 'all',
      assignee: 'all',
      customer: 'all',
      sort: this.filters().sort,
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue.set(value);

    // Debounce: reset any pending timer so a fast typist gets one
    // emit (on the last keystroke) rather than one per character.
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.filtersChange.emit({ ...this.filters(), search: value.trim() });
    }, SEARCH_DEBOUNCE_MS);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() === null) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.hostEl.nativeElement.contains(target)) {
      this.open.set(null);
    }
  }
}