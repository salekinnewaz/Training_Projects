/**
 * pagination — molecule (HD-019).
 *
 * Numbered page buttons with ellipsis gaps, prev/next chevrons,
 * and a "Showing X–Y of Z" summary. Used in the Tickets table
 * footer.
 *
 * Page-window algorithm (the standard one):
 *   - Always show page 1 and the last page.
 *   - Show a sliding window of ±1 around the current page.
 *   - Insert an ellipsis wherever there's a gap of ≥2 pages.
 *   - When the window would collide with the first/last page
 *     (e.g. current=2, total=5), extend the window rather than
 *     emitting a one-page gap that would render as "1 … 2 3 4 5"
 *     with an ellipsis covering nothing.
 *
 * All derived state is a `computed`, so the button list recomputes
 * exactly once per page/pageCount change rather than on every
 * change-detection pass.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

type PageSlot =
  | { kind: 'page'; page: number }
  | { kind: 'ellipsis'; key: string };

@Component({
  selector: 'pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pageCount() > 1) {
      <nav class="pager" aria-label="Pagination">
        <button
          type="button"
          class="pager-arrow"
          [disabled]="page() <= 1"
          (click)="go(page() - 1)"
          aria-label="Previous page"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        @for (slot of slots(); track trackKey(slot)) {
          @if (slot.kind === 'ellipsis') {
            <span class="pager-gap" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              class="pager-num"
              [class.is-current]="slot.page === page()"
              [attr.aria-current]="slot.page === page() ? 'page' : null"
              [attr.aria-label]="'Page ' + slot.page"
              (click)="go(slot.page)"
            >
              {{ slot.page }}
            </button>
          }
        }

        <button
          type="button"
          class="pager-arrow"
          [disabled]="page() >= pageCount()"
          (click)="go(page() + 1)"
          aria-label="Next page"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false" aria-hidden="true">
            <path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </nav>
    }
    <p class="pager-summary" data-testid="pagination-summary">{{ summary() }}</p>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .pager {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pager-num,
    .pager-arrow {
      display: grid;
      place-items: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-soft);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out);
    }
    .pager-num:hover:not(.is-current),
    .pager-arrow:hover:not(:disabled) {
      background: var(--color-page-bg);
      color: var(--color-text-primary);
    }
    .pager-num.is-current {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
      font-weight: 600;
      box-shadow: var(--shadow-button);
    }
    .pager-arrow:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .pager-num:focus-visible,
    .pager-arrow:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .pager-gap {
      display: grid;
      place-items: center;
      min-width: 24px;
      height: 32px;
      color: var(--color-muted);
      font-size: 13px;
      user-select: none;
    }
    .pager-summary {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-soft);
      white-space: nowrap;
    }
  `],
})
export class PaginationComponent {
  /** 1-based current page. */
  readonly page = input.required<number>();

  /** Total number of pages. `1` hides the number row but keeps
   * the "Showing…" summary. */
  readonly pageCount = input.required<number>();

  /** Total rows across all pages — drives the summary copy. */
  readonly totalItems = input.required<number>();

  /** Rows per page — drives the summary copy. */
  readonly pageSize = input.required<number>();

  readonly pageChange = output<number>();

  /**
   * The visible page-window. First and last pages are always
   * present; the middle slides with the current page; gaps of ≥2
   * collapse to an ellipsis.
   */
  protected readonly slots = computed<PageSlot[]>(() => {
    const current = this.page();
    const total = this.pageCount();
    if (total <= 1) return total === 1 ? [{ kind: 'page', page: 1 }] : [];

    // Window of ±1 around current, clamped to [1, total].
    const from = Math.max(1, current - 1);
    const to = Math.min(total, current + 1);

    const out: PageSlot[] = [];

    // Leading region: page 1, plus an ellipsis when the window
    // starts at 3 or later (i.e. pages 2..from-1 are hidden).
    if (from > 1) {
      out.push({ kind: 'page', page: 1 });
      if (from > 2) out.push({ kind: 'ellipsis', key: 'lead' });
    }

    for (let p = from; p <= to; p++) {
      out.push({ kind: 'page', page: p });
    }

    // Trailing region: last page, plus an ellipsis when the
    // window ends at total-2 or earlier.
    if (to < total) {
      if (to < total - 1) out.push({ kind: 'ellipsis', key: 'trail' });
      out.push({ kind: 'page', page: total });
    }

    return out;
  });

  /**
   * "Showing 1–10 of 42" copy. On an empty result set the summary
   * reads "No results" rather than "Showing 0–0 of 0", which is
   * what a user actually wants to know.
   */
  protected readonly summary = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 'No results';
    const size = Math.max(1, this.pageSize());
    const start = (this.page() - 1) * size + 1;
    const end = Math.min(total, this.page() * size);
    return `Showing ${start}–${end} of ${total}`;
  });

  protected trackKey(slot: PageSlot): string {
    return slot.kind === 'page' ? `p${slot.page}` : `e${slot.key}`;
  }

  /** Clamp the target into [1, pageCount] before emitting, so a
   * disabled-button race can never push the page out of range. */
  protected go(target: number): void {
    const total = this.pageCount();
    if (target < 1 || target > total) return;
    if (target === this.page()) return;
    this.pageChange.emit(target);
  }
}