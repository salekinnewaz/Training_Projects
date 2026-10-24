/**
 * EmployeeDashboardPageComponent — HD-007 / HD-020 / WDS-2026.
 *
 * The My Tickets page a User lands on after Login. It shows the
 * caller's OWN tickets and nothing else.
 *
 * Layout (per the WDS-2026 reference, shared by all three roles):
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ My Tickets                          [Create Ticket]  │
 *   │ ─────────────────────────────────────────────────── │
 *   │  [stat strip — five cards, the caller's own numbers]  │
 *   │ ─────────────────────────────────────────────────── │
 *   │ [ Search… ] [All customers▾] [All applications▾]      │
 *   │ [All priorities▾] [All assignees▾] [⇅ Newest▾] [More]│
 *   │ ─────────────────────────────────────────────────── │
 *   │  ☐ ▣ HD-101  Title…              ⬤ Open  ⬤ High …  │
 *   │  ─────────────────────────────────────────────────── │
 *   │  Showing 1–10 of 156 tickets   [10/page] ‹ 1 2 3 ›  │
 *   └──────────────────────────────────────────────────────┘
 *
 * The table, the filter bar and the pagination are the SAME
 * components the Agent's and the Admin's dashboards use — see
 * `components/molecules/ticket-table` and
 * `components/molecules/ticket-filter-bar`. That is what makes
 * the three role surfaces read as one family rather than three
 * unrelated designs.
 *
 * What is genuinely different for the User role is the DATA
 * SCOPE, and that lives on the server: `GET /api/tickets/mine`
 * and `GET /api/tickets/stats/mine` both filter to the caller's
 * own ticket IDs **in SQL**. The client never sees another user's
 * tickets, so the client cannot leak them.
 *
 * Render states (mutually exclusive — `@switch`):
 *
 *   loading → the stat strip's skeleton + the table's skeleton
 *   error   → inline message + Retry
 *   empty   → "No tickets yet" empty state
 *   ready   → the stat strip + filter bar + table
 *
 * The stat strip is **optional** — if the stats call fails it is
 * omitted and the table below still renders. The table is
 * **not** optional: without it there is no page.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { TicketService, type TicketStats } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import {
  applicationOptionsOf,
  assigneeOptionsOf,
  customerOptionsOf,
  filterTickets,
  pageCountFor,
  pageSlice,
  sortTickets,
} from '../../services/ticket-table-query';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { EmptyStateComponent } from '../../components/molecules/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/patterns/loading-skeleton/loading-skeleton.component';
import { StatStripComponent, type StatStripItem } from '../../components/molecules/stat-strip/stat-strip.component';
import {
  TicketTableComponent,
  type TicketTableRow,
} from '../../components/molecules/ticket-table/ticket-table.component';
import {
  TicketFilterBarComponent,
  type SharedTicketFilterState,
} from '../../components/molecules/ticket-filter-bar/ticket-filter-bar.component';
import type { Ticket } from '../../models/ticket';

type RenderState = 'loading' | 'error' | 'empty' | 'ready';

const GENERIC_LOAD_ERROR = "Couldn't load your tickets. Refresh to try again.";
const SESSION_EXPIRED_ERROR = 'Your session expired. Please sign in again.';

const DEFAULT_FILTERS: SharedTicketFilterState = {
  search: '',
  customer: 'all',
  application: 'all',
  priority: 'all',
  assignee: 'all',
  sort: 'newest',
  status: 'all',
};

@Component({
  selector: 'app-employee-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    AppChromeComponent,
    ButtonComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatStripComponent,
    TicketTableComponent,
    TicketFilterBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="dashboard-page">
        <header class="dashboard-header">
          <h1>My Tickets</h1>
          <atom-button
            variant="primary"
            size="md"
            (pressed)="goToCreate()"
          >Create Ticket</atom-button>
        </header>

        <!-- ── Stat strip (HD-020 / HD-021) ────────────────────
             Five cards summarising ELI'S OWN tickets: a wider
             tinted Total card with a period-over-period delta,
             then four status cards each with a progress bar.
             Scoped server-side via GET /api/tickets/stats/mine —
             the numbers are the caller's own, never team-wide.
             Optional: if the stats call fails the strip is simply
             omitted and the table below still renders.
             NOTE: this comment deliberately avoids backticks --
             a backtick inside this inline template literal
             terminates the TS template string and the compiler
             then chokes on the remainder as TypeScript. -->
        @if (stats(); as s) {
          <div class="stat-strip" data-testid="stat-strip">
            <stat-strip
              [total]="s.counts.total"
              [statusItems]="statusItems()"
              totalLabel="Total Tickets"
              [delta]="deltaPercent()"
              [deltaLabel]="deltaLabel()"
              caption="vs last month"
            />
          </div>
        }

        @switch (renderState()) {
          @case ('loading') {
            <loading-skeleton [rows]="5" />
          }
          @case ('error') {
            <p class="error-message" role="alert">{{ errorMessage() }}</p>
          }
          @case ('empty') {
            <empty-state
              headline="No tickets yet"
              caption="When you file a request it'll appear here."
              actionLabel="Create Ticket"
              actionHref="/tickets/new"
              (action)="goToCreate()"
            />
          }
          @case ('ready') {
            <!-- ── Filter bar + table (shared with Agent/Admin) ── -->
            <ticket-filter-bar
              [filters]="filters()"
              [customerOptions]="customerOptions()"
              [applicationOptions]="applicationOptions()"
              [assigneeOptions]="assigneeOptions()"
              (filtersChange)="applyFilters($event)"
              (moreFilters)="onMoreFilters()"
            />

            <ticket-table
              [rows]="pageRows()"
              [page]="page()"
              [pageCount]="pageCount()"
              [totalItems]="filtered().length"
              [pageSize]="pageSize()"
              [selectedIds]="selected()"
              (pageChange)="page.set($event)"
              (pageSizeChange)="onPageSizeChange($event)"
              (selectionChange)="selected.set($event)"
              (rowClick)="openTicket($event)"
              emptyMessage="No tickets match your filters"
            />
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
      /* The WDS-2026 reference's stat strip needs a wider content
         column than the app's old 1280px default: at that width the
         five cards are squeezed to ~227px each and the "In Progress"
         label collides with its sparkline.

         The token is now raised GLOBALLY (--content-column-width:
         1408px in styles.css), because all three roles render the
         same <stat-strip> molecule and the Agent's ticket list and
         the Admin dashboard need the reference's geometry too.
         Previously only this page overrode it, which left the other
         two strips 17% narrower than the reference's. */
    }
    .dashboard-page {
      width: 100%;
      animation: fadeInUp var(--duration-slow) var(--ease-out) both;
      display: grid;
      /* A zero-minimum column and not the implicit auto: an auto column
         is sized to its items' min-content width, and the shared
         ticket table carries a 1040px min-width (it scrolls
         horizontally on narrow screens). That would widen the whole
         page and drag the stat strip sideways with it. The zero
         minimum keeps every row at the page's width; the table's own
         wrapper does the scrolling. */
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      /* The h1 is nowrap and the button carries a 160px floor, so the
         row's min-content width is ~180 + 160 + 24 = 364px. On a
         320px phone that overflowed the page by 19px. Cutting each
         item's automatic minimum lets the row shrink; the media
         query below then stacks them so neither has to. */
      min-width: 0;
    }
    .dashboard-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      min-width: 0;
    }
    /* atom-button declares its host as "display: contents" so its
       inner button's width:100% fills whatever flex slot the host
       lands in. The header uses space-between with two children, so
       the trailing slot gets the full remaining width and the
       button stretches across the page. These ::ng-deep selectors
       opt this one host out of contents so the button sizes to its
       own label. Higher specificity keeps this from leaking to any
       other atom-button on the page. */
    .dashboard-header ::ng-deep atom-button {
      display: inline-flex;
      flex-shrink: 0;
    }
    .dashboard-header ::ng-deep atom-button > button {
      width: auto;
      min-width: 160px;
    }
    /* On a phone the title and the CTA do not fit side by side.
       Stack them: the title on top, the button full-width beneath.
       The button's own 160px floor then has room to sit inside the
       page's content box. */
    @media (max-width: 480px) {
      .dashboard-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .dashboard-header ::ng-deep atom-button > button {
        width: 100%;
      }
    }
    .error-message {
      margin: 0;
      padding: 16px 18px;
      border: 1px solid #FECACA;
      background: #FEF2F2;
      color: var(--color-error);
      font-size: 14px;
      border-radius: 12px;
      font-weight: 500;
    }
    /* ── Stat strip (HD-020 / HD-021) ─────────────────────────
       The stat-strip molecule owns its own grid; this wrapper just
       gives it breathing room under the page header.
       NOTE: this comment deliberately avoids backticks -- a
       backtick inside this inline styles template literal
       terminates the TS template string and the compiler then
       chokes on the remainder as TypeScript. */
    .stat-strip {
      margin-bottom: 4px;
    }
  `],
})
export class EmployeeDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private redirectTimer?: ReturnType<typeof setTimeout>;

  readonly tickets = signal<TicketTableRow[]>([]);
  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);

  /**
   * The caller's own ticket counters (HD-020). `null` until the
   * stats call resolves, and stays `null` if it fails — the strip
   * is supplementary, so a failure there must not blank the table.
   */
  readonly stats = signal<TicketStats | null>(null);

  /** The shared filter state — the same shape the filter bar emits. */
  readonly filters = signal<SharedTicketFilterState>(DEFAULT_FILTERS);

  /** The current page (1-based) and the rows-per-page. */
  readonly page = signal(1);
  readonly pageSize = signal(10);

  /** The rows the user has ticked. */
  readonly selected = signal<ReadonlySet<string | number>>(new Set());

  /**
   * The four status buckets in display order, each carrying the
   * total so the bar can compute its own fill fraction.
   *
   * `total` is omitted (so the component falls back to the strip's
   * own total) — the counts always sum to it, so the four bars
   * together fill the row.
   *
   * `series` carries the last 14 days of daily-created counts for
   * the sparkline in each card's top-right corner. The API returns
   * a 60-day window (two 30-day halves, so the delta can compare
   * months); the sparkline only wants the recent fortnight.
   */
  readonly statusItems = computed<StatStripItem[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const series = (s.dailyCreated ?? []).slice(-14);
    return [
      { label: 'Open', value: s.counts.open, accent: 'open', series },
      { label: 'In Progress', value: s.counts.inProgress, accent: 'inProgress', series },
      { label: 'Resolved', value: s.counts.resolved, accent: 'resolved', series },
      { label: 'Closed', value: s.counts.closed, accent: 'closed', series },
    ];
  });

  /**
   * Period-over-period change as a percentage of the previous
   * 30-day window. `null` when there is no previous period to
   * compare against (nothing was created in the earlier window),
   * which hides the delta pill rather than showing a misleading
   * "+100%".
   */
  readonly deltaPercent = computed<number | null>(() => {
    const s = this.stats();
    if (!s) return null;
    const previous = s.previousPeriod;
    if (previous === undefined || previous <= 0) return null;

    // The series is a 60-day window, oldest-first. The most recent
    // 30 days are the second half; the backend already summed the
    // first half into `previousPeriod`.
    const recent = s.dailyCreated.slice(-30).reduce((sum, n) => sum + n, 0);
    const pct = ((recent - previous) / previous) * 100;
    return Math.round(pct);
  });

  /**
   * Pre-formatted delta copy, e.g. `"12%"` / `"−8%"`.
   *
   * The reference's pill shows a bare "12%" — the arrow beside it
   * already carries the direction, so a "+" would be redundant.
   * A negative keeps its minus sign because the down-arrow alone
   * would read as a direction rather than a change.
   */
  readonly deltaLabel = computed<string>(() => {
    const pct = this.deltaPercent();
    if (pct === null) return '';
    return pct < 0 ? `−${Math.abs(pct)}%` : `${pct}%`;
  });

  // ── shared table wiring ────────────────────────────────────

  /** The rows after filter + sort, before pagination. */
  protected readonly filtered = computed<TicketTableRow[]>(() => {
    const f = this.filters();
    return sortTickets(filterTickets(this.tickets(), f), f.sort);
  });

  protected readonly pageCount = computed(() =>
    pageCountFor(this.filtered().length, this.pageSize()),
  );

  /** The slice of `filtered()` for the current page. */
  protected readonly pageRows = computed<TicketTableRow[]>(() =>
    pageSlice(this.filtered(), this.page(), this.pageSize()),
  );

  /** The dropdown options, derived from the unfiltered ticket set so
   * the user can still pick a value before narrowing it away. */
  protected readonly customerOptions = computed(() =>
    customerOptionsOf(this.tickets()),
  );
  protected readonly applicationOptions = computed(() =>
    applicationOptionsOf(this.tickets()),
  );
  protected readonly assigneeOptions = computed(() =>
    assigneeOptionsOf(this.tickets()),
  );

  ngOnInit(): void {
    void this.load();
  }

  goToCreate(): void {
    void this.router.navigateByUrl('/tickets/new');
  }

  /**
   * A row in the shared table opens the ticket. The User role can
   * only reach its OWN tickets (the list is scoped server-side by
   * `GET /api/tickets/mine`), so this is a detail view, never an
   * edit — the kebab's status actions are not exposed here.
   */
  openTicket(row: TicketTableRow): void {
    void this.router.navigate(['/tickets', row.id]);
  }

  applyFilters(next: SharedTicketFilterState): void {
    this.filters.set(next);
    // Any filter change invalidates the current page — reset to
    // page 1 so the user isn't dropped on an out-of-range page.
    this.page.set(1);
    this.selected.set(new Set());
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  /**
   * "More filters" is the affordance for the dimensions that do
   * not fit the row (status, date range). The User role's extra
   * dimension is status, so the panel is a small inline toggle
   * strip rather than a full drawer.
   */
  onMoreFilters(): void {
    const f = this.filters();
    this.filters.set({ ...f, status: f.status === 'all' ? 'Open' : 'all' });
    this.page.set(1);
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);

    // The stat strip and the ticket list are independent reads, so
    // they settle independently. `Promise.allSettled` means a
    // stats-endpoint failure degrades the strip to "no strip"
    // while the list still renders — and vice-versa.
    const [listResult, statsResult] = await Promise.allSettled([
      this.ticketService.listMine(),
      this.ticketService.statsMine(),
    ]);

    this.stats.set(
      statsResult.status === 'fulfilled' ? statsResult.value : null,
    );

    if (listResult.status === 'rejected') {
      // Session-expired → bounce to /login; per spec, "session
      // expired" is a sub-case of the server-error state. We log
      // the user out silently (auth service already nulled the
      // user$ subject on 401) and send them back through the
      // guard. Other failures show the inline retry message.
      const err = listResult.reason;
      if (err instanceof ApiError && err.status === 401) {
        this.errorMessage.set(SESSION_EXPIRED_ERROR);
        this.renderState.set('error');
        // Defer the redirect a tick so the message paints first.
        this.redirectTimer = setTimeout(() => {
          void this.router.navigate(['/login'], {
            queryParams: { return_to: '/dashboard' },
          });
        }, 0);
        this.destroyRef.onDestroy(() => clearTimeout(this.redirectTimer));
        return;
      }
      this.errorMessage.set(GENERIC_LOAD_ERROR);
      this.renderState.set('error');
      return;
    }

    const list = listResult.value;
    this.tickets.set(list.map((t) => ({ ...t, __id: String(t.id) })));
    this.renderState.set(list.length === 0 ? 'empty' : 'ready');
  }
}
