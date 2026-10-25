/**
 * AdminDashboardPageComponent — HD-013 + WDS-2026 redesign.
 *
 * The /admin page. Two tabs (Tickets / Users). The Tickets tab
 * renders the SHARED ticket table — the same `<ticket-filter-bar>`
 * and `<ticket-table>` the User's Employee Dashboard and the
 * Agent's Tickets list render. The Users tab is a placeholder
 * rendered by <app-users-tab-page> when active.
 *
 * Layout (per the WDS-2026 reference):
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Tickets                       [Tickets] [Users]      │
 *   │ Monitor and manage all support tickets...            │
 *   │ ─────────────────────────────────────────────────── │
 *   │ [ Search… ] [All customers▾] [All applications▾]      │
 *   │ [All priorities▾] [All assignees▾] [⇅ Newest▾] [More] │
 *   │ ─────────────────────────────────────────────────── │
 *   │  ☐ ▣ HD-101  Title…              ⬤ Open  ⬤ High …  │
 *   │ ─────────────────────────────────────────────────── │
 *   │  Showing 1–10 of 156 tickets   [10/page] ‹ 1 2 3 ›  │
 *   └──────────────────────────────────────────────────────┘
 *
 * The Admin's scope is team-wide — every ticket in the system —
 * so it uses `TicketService.listAll()` rather than the User's
 * `/tickets/mine`.
 *
 * Render states (mutually exclusive @switch):
 *   loading → heading + tab switcher + filter bar skeleton
 *   error   → inline error + Retry button
 *   success → the filter bar + the shared table
 *
 * URL hash: `#tickets` (default) / `#users`. The fragment
 * subscription keeps the activeTab signal in sync with the URL
 * hash.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TicketService } from '../../services/ticket.service';
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
import { UsersTabPageComponent } from '../users-tab-page/users-tab-page.component';
import type { TicketStatus } from '../../models/enums';
import type { TicketStats } from '../../services/ticket.service';

type RenderState = 'loading' | 'error' | 'success' | 'users-placeholder';
type TabKey = 'tickets' | 'users';

const GENERIC_LOAD_ERROR = "Couldn't load the queue. Refresh to try again.";

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
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    AppChromeComponent,
    ButtonComponent,
    StatStripComponent,
    TicketTableComponent,
    TicketFilterBarComponent,
    UsersTabPageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="admin-page">
        <header class="admin-header">
          <div class="heading-block">
            <h1>{{ headingText() }}</h1>
            @if (activeTab() === 'tickets') {
              <p class="page-subtitle">Monitor and manage all support tickets across different stages.</p>
            } @else {
              <p class="page-subtitle">Manage who has access to HelpDesk Lite and what role they hold.</p>
            }
          </div>
          <nav class="tabs" role="tablist" aria-label="Admin views">
            <a
              class="tab"
              role="tab"
              id="admin-tab-tickets"
              [class.active]="activeTab() === 'tickets'"
              routerLink="/admin"
              [fragment]="'tickets'"
              [attr.aria-selected]="activeTab() === 'tickets'"
              [attr.tabindex]="activeTab() === 'tickets' ? 0 : -1"
              (click)="onTabClick('tickets')"
              (keydown)="onTabKeydown($event, 'tickets')"
            >Tickets</a>
            <a
              class="tab"
              role="tab"
              id="admin-tab-users"
              [class.active]="activeTab() === 'users'"
              routerLink="/admin"
              [fragment]="'users'"
              [attr.aria-selected]="activeTab() === 'users'"
              [attr.tabindex]="activeTab() === 'users' ? 0 : -1"
              (click)="onTabClick('users')"
              (keydown)="onTabKeydown($event, 'users')"
            >Users</a>
          </nav>
        </header>

        @switch (effectiveRenderState()) {
          @case ('users-placeholder') {
            <!-- HD-014: the Users tab on /admin renders the same
                 UsersTabPageComponent that /users mounts. The URL
                 hash stays on /admin#users (per the design doc's
                 "in-page tab" contract); the user can still reach
                 the standalone /users route by typing it in the
                 URL bar. -->
            <app-users-tab-page />
          }
          @case ('loading') {
            <div class="table-skeleton" data-testid="admin-table-skeleton" aria-busy="true">
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <div class="skeleton-row"></div>
              }
            </div>
          }
          @case ('error') {
            <div class="admin-error-card" role="alert">
              <p class="error-message">{{ errorMessage() }}</p>
              <atom-button variant="primary" size="md" (pressed)="onRefresh()">
                Retry
              </atom-button>
            </div>
          }
          @case ('success') {
            <!-- ── Stat strip (shared with User/Agent) ───────────
                 The SAME <stat-strip> molecule the User's dashboard
                 and the Agent's ticket list render — Total Tickets
                 (with the period-over-period delta) plus one card
                 per status bucket, each carrying a sparkline and a
                 progress bar.

                 The counts are TEAM-WIDE (GET /api/tickets/stats),
                 which is the Admin's scope — the same endpoint the
                 Agent page uses. The User's strip is scoped to
                 their own tickets (GET /api/tickets/stats/mine).

                 The strip is OPTIONAL: if the stats call fails the
                 strip is omitted and the table below still
                 renders, because the table is the real content. -->
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

            <!-- ── Filter bar (shared with User/Agent) ──────── -->
            <ticket-filter-bar
              [filters]="filters()"
              [customerOptions]="customerOptions()"
              [applicationOptions]="applicationOptions()"
              [assigneeOptions]="assigneeOptions()"
              (filtersChange)="applyFilters($event)"
              (moreFilters)="onMoreFilters()"
            />

            <!-- ── Table (shared with User/Agent) ───────────── -->
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
      </section>
    </app-chrome>
  `,
  styles: [`
    /* All admin-page rules (header / tab switcher / card chrome /
       row geometry / skeleton) are owned by styles.css so this
       component's inline style budget stays under 2kB. Mirrors
       the HD-011 / HD-012 pattern. */
    :host {
      display: block;
      flex: 1 1 auto;
    }
    .admin-page {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      gap: 20px;
      /* NO horizontal padding of its own. The chrome's .page-content
         already supplies the column's 32px gutters, and the WDS-2026
         reference's stat strip is 1352px wide — 1408 (the content
         column) - 64 (the gutters) - 8 (the strip's own gaps
         included in its width) leaves the strip at its reference
         width only if this page does not add a SECOND 32px layer.

         With its own padding the strip came out 1280px and its
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
      width: 100%;
      margin: 0 auto;
    }
    /* The shared ticket table carries a 1040px min-width and scrolls
       horizontally on narrow screens. A flex item's automatic minimum
       size is its min-content width, so without this the table would
       stretch the page instead of scrolling inside its own wrapper. */
    .admin-page > * {
      min-width: 0;
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
    /* The stat strip molecule owns its own grid; this wrapper just
       gives it breathing room under the page header. */
    .stat-strip {
      margin-bottom: 4px;
    }
  `],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly routerRef = inject(Router);

  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly activeTab = signal<TabKey>('tickets');

  /**
   * The team-wide ticket summary behind the stat strip. Populated
   * from GET /api/tickets/stats — the Admin's scope is every ticket
   * in the system, so this is the same endpoint the Agent page
   * reads (the User's strip is scoped to their own tickets via
   * /stats/mine).
   *
   * `null` when the stats call failed or the tab is not Tickets —
   * the strip is optional, the table below is the real content.
   */
  readonly stats = signal<TicketStats | null>(null);

  /**
   * The four status buckets in display order, each carrying the
   * last 14 days of daily-created counts for its sparkline.
   *
   * The API returns a 60-day window (two 30-day halves, so the
   * delta can compare months); the sparkline only wants the recent
   * fortnight.
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
   * compare against, which hides the delta pill rather than
   * showing a misleading "+100%".
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
   * Pre-formatted delta copy, e.g. "12%" / "−8%". A bare number:
   * the arrow beside it already carries the direction.
   */
  readonly deltaLabel = computed<string>(() => {
    const pct = this.deltaPercent();
    if (pct === null) return '';
    return pct < 0 ? `−${Math.abs(pct)}%` : `${pct}%`;
  });

  // ── shared table wiring ────────────────────────────────────
  readonly rows = signal<TicketTableRow[]>([]);
  readonly filters = signal<SharedTicketFilterState>(DEFAULT_FILTERS);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly selected = signal<ReadonlySet<string | number>>(new Set());

  readonly filtered = computed<TicketTableRow[]>(() => {
    const f = this.filters();
    return sortTickets(filterTickets(this.rows(), f), f.sort);
  });

  readonly pageCount = computed(() =>
    pageCountFor(this.filtered().length, this.pageSize()),
  );

  readonly pageRows = computed<TicketTableRow[]>(() =>
    pageSlice(this.filtered(), this.page(), this.pageSize()),
  );

  readonly customerOptions = computed(() => customerOptionsOf(this.rows()));
  readonly applicationOptions = computed(() => applicationOptionsOf(this.rows()));
  readonly assigneeOptions = computed(() => assigneeOptionsOf(this.rows()));

  /**
   * Heading reflects the active tab. Tickets when the table is
   * active; Users when the Users tab is active.
   */
  readonly headingText = computed(() =>
    this.activeTab() === 'users' ? 'Users' : 'Tickets',
  );

  /**
   * The render state the template switches on. When the active tab
   * is `users`, we short-circuit to the users-placeholder branch
   * regardless of the underlying load state.
   */
  readonly effectiveRenderState = computed<RenderState>(() => {
    if (this.activeTab() === 'users') return 'users-placeholder';
    return this.renderState();
  });

  ngOnInit(): void {
    this.syncTabFromUrl();
    // Subscribe to fragment changes so the activeTab signal stays
    // in sync with the URL hash when the user clicks a tab link
    // (routerLink + [fragment] only mutates the URL; without this
    // subscription the activeTab signal would never update and the
    // wrong tab content would render).
    this.route.fragment.subscribe((fragment) => {
      const fromObservable = (fragment ?? '').toLowerCase() === 'users' ? 'users' : 'tickets';
      const fromUrl = (typeof window !== 'undefined' ? window.location.hash : '')
        .replace(/^#/, '')
        .toLowerCase() === 'users' ? 'users' : 'tickets';
      const next = fromObservable === 'users' || fromUrl === 'users' ? 'users' : 'tickets';
      if (next !== this.activeTab()) {
        this.activeTab.set(next);
      }
    });
    void this.load();
  }

  /**
   * Refetch on window focus so the page reflects any status
   * changes that happened in another tab.
   */
  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.renderState() === 'success') {
      void this.load();
    }
  }

  onRefresh(): void {
    void this.load();
  }

  applyFilters(next: SharedTicketFilterState): void {
    this.filters.set(next);
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
    void this.routerNavigate(row.id);
  }

  private routerNavigate(id: number): Promise<boolean> {
    // The Admin page is a route of its own, so the ticket detail
    // is reached via the router rather than a relative href.
    return this.routerRef.navigate(['/tickets', id]);
  }

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

  /**
   * Click handler for the tab links. routerLink + [fragment]
   * mutates the URL hash but the fragment subscription is
   * async; we update the activeTab signal synchronously so the
   * page flips immediately and there's no flicker of stale
   * content.
   */
  onTabClick(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  /**
   * Tab-list arrow-key navigation per a11y convention. ←/→ moves
   * focus between tabs; Enter activates via the default link
   * behavior.
   */
  onTabKeydown(event: KeyboardEvent, current: TabKey): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: TabKey = current === 'tickets' ? 'users' : 'tickets';
    this.activeTab.set(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${next}`);
    }
    queueMicrotask(() => {
      const id =
        next === 'tickets' ? 'admin-tab-tickets' : 'admin-tab-users';
      const el = document.getElementById(id);
      el?.focus();
    });
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);

    // The stat strip and the ticket table are independent reads, so
    // they settle independently. `Promise.allSettled` means a
    // stats-endpoint failure degrades the strip to "no strip"
    // while the table still renders — and vice-versa.
    const [rowsResult, statsResult] = await Promise.allSettled([
      this.ticketService.listAll(),
      this.ticketService.stats(),
    ]);

    this.stats.set(
      statsResult.status === 'fulfilled' ? statsResult.value : null,
    );

    if (rowsResult.status === 'rejected') {
      const err = rowsResult.reason;
      if (err instanceof ApiError && err.status === 401) {
        return;
      }
      this.errorMessage.set(GENERIC_LOAD_ERROR);
      this.renderState.set('error');
      return;
    }

    const data = rowsResult.value;
    this.rows.set(data.map((t) => ({ ...t, __id: String(t.id) })));
    this.renderState.set('success');
  }

  private syncTabFromUrl(): void {
    const hash = (typeof window !== 'undefined' ? window.location.hash : '')
      .replace(/^#/, '')
      .toLowerCase();
    this.activeTab.set(hash === 'users' ? 'users' : 'tickets');
  }
}
