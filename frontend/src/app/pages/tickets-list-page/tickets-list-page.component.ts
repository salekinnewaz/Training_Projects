/**
 * tickets-list-page — page (HD-019 / WDS-2026).
 *
 * The agent/admin landing view: a five-card stat strip, the shared
 * filter bar, and the shared ticket table.
 *
 * Design intent (per the WDS-2026 reference layout):
 *   - The stat strip answers "how is the queue doing?" before the
 *     user has to read a single row. Five numbers — total, and one
 *     per status — each with a 14-day sparkline so a user can see
 *     momentum, not just a snapshot.
 *   - The filter bar sits between the strip and the table so the
 *     user's eye path is stats → narrow → rows.
 *   - The table is the work surface: dense rows, status/priority
 *     pills for at-a-glance scanning, avatar+name cells for
 *     human context, kebab for per-row actions.
 *
 * **The filter bar and the table are shared components** — the
 * exact same `<ticket-filter-bar>` and `<ticket-table>` the User's
 * Employee Dashboard and the Admin's dashboard render. What
 * differs here is the DATA SCOPE (team-wide rather than
 * personal) and the ACTIONS (an Agent may change a ticket's
 * status from the kebab menu; a User may not).
 *
 * Data flow:
 *   - `load()` fires once on init and fans out to
 *     `TicketService.listAll()` (rows) and `TicketService.stats()`
 *     (stat strip) in parallel via `Promise.allSettled` so a
 *     stats-endpoint failure degrades the strip without killing
 *     the table (and vice-versa).
 *   - All filtering, sorting, and pagination is client-side over
 *     the fetched set. HD-015 lifts this to server-side query
 *     params; for the seeded demo dataset (single-digit rows) a
 *     single fetch is the right call.
 *
 * Role gate: the route is `roleGuard(['Support Agent', 'Admin'])`.
 * The page additionally re-checks in `canView` so a
 * programmatic navigation that bypasses the guard renders the
 * forbidden copy rather than a broken table.
 *
 * There is deliberately NO "New ticket" button on this page. Ticket
 * creation is the USER's action — /tickets/new is
 * roleGuard(['User']) — so a CTA here would send every Agent and
 * Admin to /forbidden. The User's Employee Dashboard carries the
 * "Create Ticket" button instead. Per the role-aware action
 * matrix, "Admin = Agent", and an Agent's ticket actions are
 * resolve / close / reassign / reprioritise from the row kebab.
 *
 * The counters here are **team-wide** — this is the agent's view
 * of the whole queue. The User role gets the same layout on the
 * Employee Dashboard (HD-020), scoped server-side to their own
 * tickets via `GET /api/tickets/stats/mine`. Two distinct data
 * scopes; the User never sees these numbers.
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import { TicketService, type TicketStats } from '../../services/ticket.service';
import {
  applicationOptionsOf,
  assigneeOptionsOf,
  customerOptionsOf,
  filterTickets,
  pageCountFor,
  pageSlice,
  sortTickets,
} from '../../services/ticket-table-query';
import type { TicketStatus } from '../../models/enums';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import {
  StatStripComponent,
  type StatStripItem,
} from '../../components/molecules/stat-strip/stat-strip.component';
import {
  TicketTableComponent,
  type TicketTableRow,
} from '../../components/molecules/ticket-table/ticket-table.component';
import {
  TicketFilterBarComponent,
  type SharedTicketFilterState,
} from '../../components/molecules/ticket-filter-bar/ticket-filter-bar.component';

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
  selector: 'app-tickets-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppChromeComponent,
    ButtonComponent,
    StatStripComponent,
    TicketTableComponent,
    TicketFilterBarComponent,
  ],
  template: `
    <app-chrome>
      <section class="page" data-testid="tickets-list-page">
        @if (!canView()) {
          <div class="forbidden" data-testid="tickets-forbidden">
            <h2>Not available for your role</h2>
            <p>The Tickets list is available to Support Agents and Admins.</p>
          </div>
        } @else {
          <!-- ── Stat strip ─────────────────────────────────── -->
          <header class="page-head">
            <div>
              <h1 class="page-title">Tickets</h1>
              <p class="page-sub">
                @if (stats(); as s) {
                  {{ s.counts.total }} total · {{ s.counts.open }} open
                } @else {
                  Loading queue summary…
                }
              </p>
            </div>
            <!-- NO "New ticket" button here. Creating a ticket is the
                 USER's action: /tickets/new is roleGuard(['User']),
                 so an Agent or Admin clicking one would land on
                 /forbidden — a dead-end CTA. The role-aware action
                 matrix says "Admin = Agent", and the Agent's own
                 actions are resolve / close / reassign / reprioritise
                 from the kebab, not creating tickets. The User's
                 Employee Dashboard carries the "Create Ticket" CTA
                 instead, which is where ticket creation belongs. -->
          </header>

          @if (stats(); as s) {
            <!-- ── Stat strip ───────────────────────────────────────
                 The SAME <stat-strip> molecule the User's dashboard
                 and the Admin's dashboard render — Total Tickets
                 (with the period-over-period delta) plus one card
                 per status bucket, each carrying a sparkline and a
                 progress bar.

                 The counts are TEAM-WIDE (GET /api/tickets/stats),
                 which is the Agent's scope of the whole queue. -->
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
          } @else if (!loading()) {
            <!-- stats failed or came back empty — the strip is
                 optional, the table below is the real content. -->
            <div class="stat-strip-skeleton" aria-hidden="true">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="skeleton-tile"></div>
              }
            </div>
          }

          <!-- ── Filter bar (shared with User/Admin) ────────── -->
          <ticket-filter-bar
            [filters]="filters()"
            [customerOptions]="customerOptions()"
            [applicationOptions]="applicationOptions()"
            [assigneeOptions]="assigneeOptions()"
            (filtersChange)="applyFilters($event)"
            (moreFilters)="onMoreFilters()"
          />

          <!-- ── Table (shared with User/Admin) ─────────────── -->
          @switch (renderState()) {
            @case ('loading') {
              <div class="table-skeleton" data-testid="tickets-skeleton">
                @for (i of skeletonRows; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            }
            @case ('error') {
              <div class="error-card" data-testid="tickets-error">
                <h2>Couldn't load tickets</h2>
                <p>{{ errorMessage() }}</p>
                <atom-button variant="secondary" (pressed)="load()">Retry</atom-button>
              </div>
            }
            @default {
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
                (resolveTicket)="resolveTicket($event)"
                (closeTicket)="closeTicket($event)"
                emptyMessage="No tickets match your filters"
              />
            }
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .page {
      display: grid;
      /* A zero-minimum column, not the implicit auto: the shared
         ticket table carries a 1040px min-width (it scrolls
         horizontally on narrow screens), and an auto column is sized
         to its items' min-content width — that would widen the whole
         page instead of letting the table's own wrapper scroll. */
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
      /* NO horizontal padding of its own. The chrome's .page-content
         already supplies the column's 32px gutters, and the
         WDS-2026 reference's stat strip is 1352px wide. With a
         SECOND 32px layer here the strip came out 1280px and its
         cards 17% narrower than the reference's, which squeezed
         "In Progress" under its own sparkline and the numbers
         under their progress bars. The Employee Dashboard — which
         renders the SAME <stat-strip> molecule — has no padding
         here either; this page now matches it. */
      padding: 28px 0 40px;
      /* 1448px — the content column's own width. The reference's
         stat strip spans 1384px (its five cards' 1352px plus four
         8px gaps), and the chrome's .page-content supplies the
         32px gutters, so the column must be 1384 + 64 = 1448px
         for the strip to land on the reference's width. A narrower
         cap here squeezed the cards 17% below the reference's and
         pushed the labels under their sparklines. */
      max-width: 1448px;
      margin: 0 auto;
    }
    .page-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--color-text-primary);
    }
    .page-sub {
      margin: 6px 0 0;
      font-size: 14px;
      color: var(--color-text-soft);
    }

    /* The stat strip molecule owns its own grid (five unequal-width
       cards, collapsing to three then two columns at the reference's
       breakpoints). This wrapper just gives it breathing room under
       the page header. */
    .stat-strip {
      margin-bottom: 4px;
    }

    /* The skeleton stands in for the shared <stat-strip>, so it
       mirrors that molecule's geometry: the same five unequal-width
       tracks, the same 8px gap, and the same 88px card height. */
    .stat-strip-skeleton {
      display: grid;
      grid-template-columns: 22.56fr 18.42fr 17.75fr 19.16fr 22.12fr;
      gap: 8px;
    }
    .skeleton-tile {
      height: 88px;
      border-radius: 12px;
      background: var(--color-surface-subtle, #f8fafc);
      border: 1px solid var(--color-card-border);
    }
    @media (max-width: 1180px) {
      .stat-strip-skeleton {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 760px) {
      .stat-strip-skeleton {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .table-skeleton {
      display: grid;
      gap: 1px;
      background: var(--color-border-subtle, #f1f5f9);
      border: 1px solid var(--color-card-border);
      border-radius: 16px;
      overflow: hidden;
    }
    .skeleton-row {
      height: 52px;
      background: var(--color-surface);
    }

    .error-card,
    .forbidden {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 48px 24px;
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 16px;
    }
    .error-card h2,
    .forbidden h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .error-card p,
    .forbidden p {
      margin: 0;
      font-size: 14px;
      color: var(--color-text-soft);
      max-width: 420px;
    }
    .error-card atom-button {
      margin-top: 8px;
    }
  `],
})
export class TicketsListPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly rows = signal<TicketTableRow[]>([]);
  protected readonly stats = signal<TicketStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filters = signal<SharedTicketFilterState>(DEFAULT_FILTERS);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly selected = signal<ReadonlySet<string | number>>(new Set());

  /**
   * The four status buckets in display order, each carrying the
   * last 14 days of daily-created counts for its sparkline.
   *
   * The API returns a 60-day window (two 30-day halves, so the
   * delta can compare months); the sparkline only wants the recent
   * fortnight.
   */
  protected readonly statusItems = computed<StatStripItem[]>(() => {
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
   * compare against, which hides the delta pill rather than
   * showing a misleading "+100%".
   */
  protected readonly deltaPercent = computed<number | null>(() => {
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
   * Pre-formatted delta copy, e.g. "12%" / "−8%". A bare number:
   * the arrow beside it already carries the direction.
   */
  protected readonly deltaLabel = computed<string>(() => {
    const pct = this.deltaPercent();
    if (pct === null) return '';
    return pct < 0 ? `−${Math.abs(pct)}%` : `${pct}%`;
  });

  /** Mirrors the route's roleGuard so a programmatic nav can't
   * render the table for the User role. */
  protected readonly canView = computed(() => {
    const role = this.authService.userSnapshot()?.role;
    return role === 'Support Agent' || role === 'Admin';
  });

  /**
   * Rows after filter + sort, before pagination. This is the
   * single source of truth for `pageCount` and the "Showing X–Y
   * of Z" summary.
   */
  protected readonly filtered = computed<TicketTableRow[]>(() => {
    const f = this.filters();
    return sortTickets(filterTickets(this.rows(), f), f.sort);
  });

  protected readonly pageCount = computed(() =>
    pageCountFor(this.filtered().length, this.pageSize()),
  );

  /** The slice of `filtered()` for the current page. */
  protected readonly pageRows = computed<TicketTableRow[]>(() =>
    pageSlice(this.filtered(), this.page(), this.pageSize()),
  );

  /** The dropdown options, derived from the unfiltered ticket set. */
  protected readonly customerOptions = computed(() =>
    customerOptionsOf(this.rows()),
  );
  protected readonly applicationOptions = computed(() =>
    applicationOptionsOf(this.rows()),
  );
  protected readonly assigneeOptions = computed(() =>
    assigneeOptionsOf(this.rows()),
  );

  /** Drives the `@switch` render-state machine. */
  protected readonly renderState = computed<'loading' | 'error' | 'ready'>(
    () => {
      if (this.loading()) return 'loading';
      if (this.errorMessage() !== null) return 'error';
      return 'ready';
    },
  );

  ngOnInit(): void {
    // Seed the search box from `?q=` so the chrome's ⌘K submit
    // (which navigates to /tickets?q=…) lands on a pre-filtered
    // list rather than an unfiltered one.
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q !== null && q.trim() !== '') {
      this.filters.set({ ...DEFAULT_FILTERS, search: q.trim() });
    }
    void this.load();
  }

  /**
   * Fetch rows + stats in parallel. `Promise.allSettled` so a
   * failure on one doesn't blank the other — the table is the
   * primary content; the stat strip is supplementary.
   */
  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    const [rowsResult, statsResult] = await Promise.allSettled([
      this.ticketService.listAll(),
      this.ticketService.stats(),
    ]);

    if (rowsResult.status === 'fulfilled') {
      this.rows.set(
        rowsResult.value.map((t) => ({ ...t, __id: String(t.id) })),
      );
    } else {
      this.rows.set([]);
      this.errorMessage.set(this.describeError(rowsResult.reason));
    }

    if (statsResult.status === 'fulfilled') {
      this.stats.set(statsResult.value);
    } else {
      // Stats are optional — the strip degrades to a skeleton
      // rather than blocking the table.
      this.stats.set(null);
    }

    this.loading.set(false);
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

  /** "More filters" toggles the status filter — the one dimension
   * that does not fit the filter row. */
  onMoreFilters(): void {
    const f = this.filters();
    this.filters.set({ ...f, status: f.status === 'all' ? 'Open' : 'all' });
    this.page.set(1);
  }

  openTicket(row: TicketTableRow): void {
    void this.router.navigate(['/tickets', row.id]);
  }

  /**
   * Status mutations from the kebab. Optimistic: patch the local
   * signal, then fire the PATCH. On failure the original value is
   * restored so the table never disagrees with the server.
   */
  resolveTicket(row: TicketTableRow): void {
    this.patchStatus(row, 'Resolved');
  }

  closeTicket(row: TicketTableRow): void {
    this.patchStatus(row, 'Closed');
  }

  private async patchStatus(row: TicketTableRow, status: TicketStatus): Promise<void> {
    const prior = this.rows();
    this.rows.update((list) =>
      list.map((t) => (t.id === row.id ? { ...t, status } : t)),
    );
    try {
      await this.ticketService.patch(row.id, { status });
    } catch {
      this.rows.set(prior);
    }
  }

  // ── helpers ────────────────────────────────────────────────

  private describeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) return 'Your session expired. Sign in again.';
      if (err.status === 403) return "You don't have access to the ticket list.";
      return err.message || 'Something went wrong loading tickets.';
    }
    return 'Something went wrong loading tickets.';
  }
}
