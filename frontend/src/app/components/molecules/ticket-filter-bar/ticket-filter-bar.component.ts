/**
 * ticket-filter-bar — molecule (WDS-2026 shared ticket table).
 *
 * The filter row that sits above the shared ticket table. It is
 * **the same component for every role** — User, Support Agent and
 * Admin all render this exact bar, which is what makes the three
 * dashboards read as one family.
 *
 * Layout, left to right, matching the reference:
 *
 *   [ Search tickets by ID, title, or keyword… ▾ ]
 *   [All customers▾] [All applications▾] [All priorities▾] [All assignees▾]
 *   [⇅ Newest first▾]  [ More filters ]
 *
 * Design notes:
 *   - The selects are **native `<select>`** elements wrapped in a
 *     styled label. The native control keeps keyboard behaviour,
 *     screen-reader semantics and the OS picker for free; the
 *     wrapper paints the visible label so the control reads as the
 *     reference's pill-shaped dropdown rather than the browser's
 *     default chrome.
 *   - The sort control carries a small sort glyph on its left, as
 *     the reference does, and is visually distinct (icon + label)
 *     from the four filter pills.
 *   - "More filters" is a purple primary button with a funnel
 *     glyph. It is the affordance for the filters that do NOT fit
 *     the row (status, date range, …); it emits `moreFilters`
 *     and the page decides what that means. It does not open a
 *     panel of its own — keeping the drawer logic in the page
 *     means the three role pages can each show a different set.
 *
 * The search box is debounced 200ms — the same cadence
 * `header-chrome` and `tickets-filter-bar` use — so typing
 * doesn't spam the filter pipeline. The un-debounced value stays
 * in a local signal so the input stays responsive while the
 * emitted filter lags.
 *
 * Filter state lives in the parent. Every change is emitted
 * upward via a single `filtersChange` output carrying the full
 * next state, so the page owns one `filters` signal and one
 * `applyFilters` path rather than six separate handlers.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import type { TicketPriority, TicketStatus } from '../../../models/enums';

/** The five filter dimensions the shared table exposes. */
export interface SharedTicketFilterState {
  search: string;
  customer: string;
  application: string;
  priority: TicketPriority | 'all';
  assignee: string;
  sort: SharedTicketSort;
  /** Status lives behind "More filters" — it is a full-width
   * filter on a phone and a dropdown on a desktop. */
  status: TicketStatus | 'all';
}

export type SharedTicketSort = 'newest' | 'oldest' | 'priority' | 'status';

const SEARCH_DEBOUNCE_MS = 200;

const DEFAULT_FILTERS: SharedTicketFilterState = {
  search: '',
  customer: 'all',
  application: 'all',
  priority: 'all',
  assignee: 'all',
  sort: 'newest',
  status: 'all',
};

const PRIORITY_OPTIONS: { value: TicketPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const STATUS_OPTIONS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

const SORT_OPTIONS: { value: SharedTicketSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];

@Component({
  selector: 'ticket-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" data-testid="ticket-filter-bar">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M11 11 L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </span>
        <input
          type="search"
          class="search-input"
          placeholder="Search tickets by ID, title, or keyword..."
          [value]="searchValue()"
          (input)="onSearchInput($event)"
          aria-label="Search tickets by ID, title, or keyword"
          data-testid="ticket-filter-search"
        />
      </div>

      <div class="selects">
        <label class="pill">
          <span class="pill-label">{{ customerLabel() }}</span>
          <select
            [value]="filters().customer"
            (change)="onSelect('customer', $event)"
            aria-label="Filter by customer"
            data-testid="ticket-filter-customer"
          >
            <option value="all">All customers</option>
            @for (opt of customerOptions(); track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>

        <label class="pill">
          <span class="pill-label">{{ applicationLabel() }}</span>
          <select
            [value]="filters().application"
            (change)="onSelect('application', $event)"
            aria-label="Filter by application"
            data-testid="ticket-filter-application"
          >
            <option value="all">All applications</option>
            @for (opt of applicationOptions(); track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>

        <label class="pill">
          <span class="pill-label">{{ priorityLabel() }}</span>
          <select
            [value]="filters().priority"
            (change)="onSelect('priority', $event)"
            aria-label="Filter by priority"
            data-testid="ticket-filter-priority"
          >
            @for (opt of priorityOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>

        <label class="pill">
          <span class="pill-label">{{ assigneeLabel() }}</span>
          <select
            [value]="filters().assignee"
            (change)="onSelect('assignee', $event)"
            aria-label="Filter by assignee"
            data-testid="ticket-filter-assignee"
          >
            <option value="all">All assignees</option>
            @for (opt of assigneeOptions(); track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>

        <label class="pill is-sort">
          <svg class="sort-glyph" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" focusable="false">
            <path d="M3 4 H11 M3 7 H9 M3 10 H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
            <path d="M11.5 2 L13 4 L10 4 z" fill="currentColor" />
            <path d="M11.5 12 L13 10 L10 10 z" fill="currentColor" />
          </svg>
          <span class="pill-label">{{ sortLabel() }}</span>
          <select
            [value]="filters().sort"
            (change)="onSelect('sort', $event)"
            aria-label="Sort order"
            data-testid="ticket-filter-sort"
          >
            @for (opt of sortOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>

        <button
          type="button"
          class="more-btn"
          (click)="moreFilters.emit()"
          data-testid="ticket-filter-more"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
            <path d="M2 3 H14 L9.2 8.6 V13 L6.8 11.6 V8.6 Z" fill="currentColor" />
          </svg>
          More filters
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1 1 320px;
      min-width: 240px;
      max-width: 440px;
      height: 40px;
      padding: 0 14px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      color: var(--color-text-secondary);
      transition:
        border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
    }
    .search-box:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-ring);
    }
    .search-icon {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .search-input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      background: transparent;
      padding: 0;
      font-family: inherit;
      font-size: 13px;
      color: var(--color-text-primary);
      outline: none;
    }
    .search-input::placeholder {
      color: var(--color-muted);
    }
    .selects {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-left: auto;
    }
    .pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 32px 0 14px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
    }
    .pill:hover {
      border-color: var(--color-border-strong);
    }
    .pill:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-ring);
    }
    .pill-label {
      position: relative;
      z-index: 1;
      pointer-events: none;
      white-space: nowrap;
      font-weight: 500;
    }
    /* The caret is painted by the wrapper so the native select can
       stay transparent; it points down-right, as the reference does. */
    .pill::after {
      content: '';
      position: absolute;
      right: 12px;
      top: 50%;
      width: 7px;
      height: 7px;
      border-right: 1.5px solid var(--color-text-secondary);
      border-bottom: 1.5px solid var(--color-text-secondary);
      transform: translateY(-70%) rotate(45deg);
      pointer-events: none;
    }
    .pill select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
      font: inherit;
      color: transparent;
      cursor: pointer;
      padding: 0 32px 0 14px;
      z-index: 2;
    }
    .pill select option {
      color: var(--color-text-primary);
    }
    .is-sort {
      padding-left: 36px;
    }
    .is-sort select {
      padding-left: 36px;
    }
    .sort-glyph {
      position: absolute;
      left: 13px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-secondary);
      pointer-events: none;
    }
    .more-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 40px;
      padding: 0 14px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: var(--gradient-brand);
      color: #ffffff;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--shadow-button);
      transition:
        box-shadow var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }
    .more-btn:hover {
      box-shadow: var(--shadow-button-hover);
      transform: translateY(-1px);
    }
    .more-btn:active {
      transform: translateY(0);
    }
    .more-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    @media (max-width: 900px) {
      .search-box {
        max-width: none;
        flex-basis: 100%;
      }
      .selects {
        margin-left: 0;
      }
    }
  `],
})
export class TicketFilterBarComponent {
  /** The parent-owned filter state. */
  readonly filters = input.required<SharedTicketFilterState>();

  /** The distinct customers present in the current ticket set. */
  readonly customerOptions = input<{ value: string; label: string }[]>([]);

  /** The distinct applications present in the current ticket set. */
  readonly applicationOptions = input<{ value: string; label: string }[]>([]);

  /** The distinct assignees present in the current ticket set. */
  readonly assigneeOptions = input<{ value: string; label: string }[]>([]);

  /** Emits the full next filter state on any change. */
  readonly filtersChange = output<SharedTicketFilterState>();

  /** Emitted when the user presses "More filters". */
  readonly moreFilters = output<void>();

  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;

  /** Debounced-value holder so the input stays responsive while
   * the emitted filter lags 200ms behind. */
  protected readonly searchValue = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Keep the local `searchValue` in sync with the parent's
    // `filters().search` so deep-links (e.g. `/tickets?q=vpn`)
    // seed the input on mount. We only sync when the values
    // actually diverge so user keystrokes never fight a re-render.
    //
    // `allowSignalWrites: true` because we ARE writing the
    // `searchValue` signal from inside this effect. Without it
    // Angular's NG0600 guard throws.
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

  // ── label mirrors ───────────────────────────────────────────
  // The native select is transparent so the wrapper's own label
  // shows through. Each label mirrors the select's current value
  // into a human phrase — "All X" when unfiltered, the option's
  // own label when filtered.

  protected readonly customerLabel = computed(() =>
    this.mirror(this.filters().customer, this.customerOptions(), 'All customers'),
  );

  protected readonly applicationLabel = computed(() =>
    this.mirror(this.filters().application, this.applicationOptions(), 'All applications'),
  );

  protected readonly priorityLabel = computed(() => {
    const value = this.filters().priority;
    const match = PRIORITY_OPTIONS.find((o) => o.value === value);
    return match ? match.label : 'All priorities';
  });

  protected readonly assigneeLabel = computed(() =>
    this.mirror(this.filters().assignee, this.assigneeOptions(), 'All assignees'),
  );

  protected readonly sortLabel = computed(() => {
    const match = SORT_OPTIONS.find((o) => o.value === this.filters().sort);
    return match ? match.label : 'Newest first';
  });

  private mirror(
    value: string,
    options: { value: string; label: string }[],
    fallback: string,
  ): string {
    if (value === 'all' || value === '') return fallback;
    const match = options.find((o) => o.value === value);
    return match ? match.label : value;
  }

  // ── events ──────────────────────────────────────────────────

  onSelect(key: keyof SharedTicketFilterState, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ ...this.filters(), [key]: value } as SharedTicketFilterState);
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
}

export { DEFAULT_FILTERS as DEFAULT_SHARED_TICKET_FILTERS };
