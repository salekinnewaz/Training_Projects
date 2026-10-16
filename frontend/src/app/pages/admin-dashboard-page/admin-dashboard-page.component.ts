/**
 * AdminDashboardPageComponent — HD-013 + WDS-2026 redesign.
 *
 * The /admin page. Two tabs (Tickets / Users). The Tickets tab
 * is the main Kanban-style dashboard; the Users tab is a
 * placeholder rendered by <app-users-tab-page> when active.
 *
 * Layout (per the WDS-2026 admin mockup):
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Tickets                       [Tickets] [Users]      │
 *   │ Monitor and manage all support tickets...            │
 *   │ ─────────────────────────────────────────────────── │
 *   │ [Search] [Customers▾] [Apps▾] [Priorities▾] [Assignees▾] [Newest▾] │
 *   │ [ Open (n) ] [ In Progress (n) ] [ Resolved (n) ] [ Closed (n) ] │
 *   │  rows...       rows...             rows...            rows...       │
 *   │  "Showing N of M · View all →"                       │
 *   └──────────────────────────────────────────────────────┘
 *
 * Card body rows show: ticket icon · ticket number (mono) · title
 * (1-line clamp) · priority pill · category pill · relative
 * timestamp (right). Click navigates to /tickets/:id for Open /
 * In Progress / Resolved; Closed rows are muted and do not
 * navigate. Card footer "Showing N of M · View all →" renders
 * only when total > rows.length.
 *
 * The filter strip is presentational — the selects are
 * controlled by signals but the underlying data is not refetched
 * yet (HD-redesign follow-up). The selects still render the
 * available values so the page is visually complete per the
 * design spec.
 *
 * Render states (mutually exclusive @switch):
 *   loading → heading + tab switcher + filter strip + 4 card skeletons
 *   error   → inline error above the cards + Retry button
 *   success → 4 cards rendered
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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TicketService, type AdminDashboardSummary } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { BadgePriorityComponent } from '../../components/atoms/badge-priority/badge-priority.component';
import { BadgeCategoryComponent } from '../../components/atoms/badge-category/badge-category.component';
import { UsersTabPageComponent } from '../users-tab-page/users-tab-page.component';
import type { Ticket } from '../../models/ticket';
import type { TicketStatus } from '../../models/enums';

type RenderState = 'loading' | 'error' | 'success' | 'users-placeholder';
type TabKey = 'tickets' | 'users';

const GENERIC_LOAD_ERROR = "Couldn't load the queue. Refresh to try again.";

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AppChromeComponent,
    ButtonComponent,
    BadgePriorityComponent,
    BadgeCategoryComponent,
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
            <div class="filter-strip" aria-hidden="true">
              <div class="filter-strip-search skel-bar"></div>
              <div class="filter-strip-selects">
                @for (s of skeletonSelectArray(); track $index) {
                  <div class="skel-bar skel-pill"></div>
                }
              </div>
            </div>
            <div class="card-row" aria-busy="true" aria-label="Loading dashboard">
              @for (skel of skeletonArray(); track $index) {
                <div class="card-skel" aria-hidden="true">
                  <div class="skel-header">
                    <div class="skel-icon"></div>
                    <div class="skel-label bar"></div>
                    <div class="skel-count"></div>
                  </div>
                  <div class="skel-rows">
                    @for (i of [0,1,2,3,4]; track i) {
                      <div class="skel-row">
                        <div class="skel-icon bar"></div>
                        <div class="skel-lines">
                          <div class="bar bar-narrow"></div>
                          <div class="bar"></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
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
            <div class="filter-strip" data-testid="admin-filter-strip">
              <div class="filter-strip-search">
                <span class="search-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
                    <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
                    <path d="M11 11 L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  class="filter-search-input"
                  placeholder="Search tickets by ID, title, or keyword..."
                  [value]="searchValue()"
                  (input)="onSearchInput($event)"
                  aria-label="Search tickets"
                />
              </div>
              <div class="filter-strip-selects">
                <label class="filter-select">
                  <span class="filter-select-label">{{ filterLabels().customer }}</span>
                  <select [(ngModel)]="filterCustomer" (ngModelChange)="onFilterChange('customer', $event)" aria-label="Filter by customer">
                    <option value="">All customers</option>
                  </select>
                </label>
                <label class="filter-select">
                  <span class="filter-select-label">{{ filterLabels().application }}</span>
                  <select [(ngModel)]="filterApplication" (ngModelChange)="onFilterChange('application', $event)" aria-label="Filter by application">
                    <option value="">All applications</option>
                  </select>
                </label>
                <label class="filter-select">
                  <span class="filter-select-label">{{ filterLabels().priority }}</span>
                  <select [(ngModel)]="filterPriority" (ngModelChange)="onFilterChange('priority', $event)" aria-label="Filter by priority">
                    <option value="">All priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
                <label class="filter-select">
                  <span class="filter-select-label">{{ filterLabels().assignee }}</span>
                  <select [(ngModel)]="filterAssignee" (ngModelChange)="onFilterChange('assignee', $event)" aria-label="Filter by assignee">
                    <option value="">All assignees</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </label>
                <label class="filter-select filter-sort">
                  <svg class="sort-icon" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
                    <path d="M3 4 H11 M3 7 H9 M3 10 H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
                    <path d="M11.5 2 L13 4 L10 4 z" fill="currentColor" />
                    <path d="M11.5 12 L13 10 L10 10 z" fill="currentColor" />
                  </svg>
                  <span class="filter-select-label">{{ filterLabels().sort }}</span>
                  <select [(ngModel)]="filterSort" (ngModelChange)="onFilterChange('sort', $event)" aria-label="Sort order">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>
            </div>
            <div class="card-row" data-testid="admin-card-row">
              @for (bucket of buckets(); track bucket.key) {
                <article
                  class="card"
                  [class.muted]="bucket.key === 'Closed'"
                  [class]="'card tint-' + bucket.tintKey"
                  [attr.data-status]="bucket.key"
                  [attr.data-testid]="'kanban-column-' + bucket.tintKey"
                >
                  <header class="card-top">
                    <div class="kanban-column-header">
                      <div class="leading">
                        <span class="icon-chip" aria-hidden="true">
                          <ng-container [ngSwitch]="bucket.key">
                            <svg *ngSwitchCase="'Open'" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 4 H12 V11 a1 1 0 0 1 -1 1 H3 a1 1 0 0 1 -1 -1 V4 z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                              <path d="M5 2 H9 V5 H5 z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                            </svg>
                            <svg *ngSwitchCase="'In Progress'" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 1.5 L11.5 7 L3 12.5 Z" fill="currentColor"/>
                            </svg>
                            <svg *ngSwitchCase="'Resolved'" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 7.5 L5.5 11 L12 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            </svg>
                            <svg *ngSwitchCase="'Closed'" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                            </svg>
                          </ng-container>
                        </span>
                        <span class="column-label">{{ bucket.key }}</span>
                      </div>
                      <span
                        class="count-badge"
                        [class.muted-count]="bucket.key === 'Closed'"
                        [attr.data-testid]="'column-count-' + bucket.tintKey"
                      >{{ bucket.total }}</span>
                    </div>
                  </header>
                  <ul class="admin-card-body">
                    @if (bucket.rows.length === 0) {
                      <li class="empty-marker">Nothing here.</li>
                    } @else {
                      @for (t of bucket.rows; track t.id) {
                        @if (bucket.key === 'Closed') {
                          <li
                            class="admin-card-row ticket-card-row is-muted tint-closed"
                            [attr.data-ticket-id]="t.id"
                            [attr.aria-label]="ariaLabel(t)"
                          >
                            <span class="row-icon" aria-hidden="true">
                              <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 1.5 H8 L11 4.5 V12 a0.5 0.5 0 0 1 -0.5 0.5 H3 a0.5 0.5 0 0 1 -0.5 -0.5 V2 a0.5 0.5 0 0 1 0.5 -0.5 z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
                                <path d="M8 1.5 V4.5 H11" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
                              </svg>
                            </span>
                            <div class="row-content">
                              <div class="row-line-1">
                                <span class="number">{{ t.number }}</span>
                                <time
                                  class="timestamp"
                                  [attr.datetime]="t.createdAt"
                                >{{ formatRelative(t.createdAt) }}</time>
                              </div>
                              <div class="row-line-2">
                                <span class="title" [title]="t.title">{{ t.title }}</span>
                              </div>
                              <div class="row-line-3">
                                <badge-priority [priority]="t.priority" />
                                @if (t.category) {
                                  <badge-category [category]="t.category" />
                                }
                              </div>
                            </div>
                          </li>
                        } @else {
                          <li>
                            <a
                              class="admin-card-row ticket-card-row"
                              [class]="'admin-card-row ticket-card-row tint-' + bucket.tintKey"
                              [routerLink]="linkHref(t.id)"
                              [attr.aria-label]="ariaLabel(t)"
                              [attr.data-ticket-id]="t.id"
                            >
                              <span class="row-icon" aria-hidden="true">
                                <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 1.5 H8 L11 4.5 V12 a0.5 0.5 0 0 1 -0.5 0.5 H3 a0.5 0.5 0 0 1 -0.5 -0.5 V2 a0.5 0.5 0 0 1 0.5 -0.5 z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
                                  <path d="M8 1.5 V4.5 H11" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
                                </svg>
                              </span>
                              <div class="row-content">
                                <div class="row-line-1">
                                  <span class="number">{{ t.number }}</span>
                                  <time
                                    class="timestamp"
                                    [attr.datetime]="t.createdAt"
                                  >{{ formatRelative(t.createdAt) }}</time>
                                </div>
                                <div class="row-line-2">
                                  <span class="title" [title]="t.title">{{ t.title }}</span>
                                </div>
                                <div class="row-line-3">
                                  <badge-priority [priority]="t.priority" />
                                  @if (t.category) {
                                    <badge-category [category]="t.category" />
                                  }
                                </div>
                              </div>
                            </a>
                          </li>
                        }
                      }
                    }
                  </ul>
                  @if (bucket.total > bucket.rows.length) {
                    <footer class="admin-card-footer">
                      <span>Showing {{ bucket.rows.length }} of {{ bucket.total }}</span>
                      <a
                        class="view-all"
                        [routerLink]="viewAllHref(bucket.key)"
                        (click)="onViewAllClick()"
                      >View all →</a>
                    </footer>
                  }
                </article>
              }
            </div>
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    /* All admin-page rules (header / tab switcher / card chrome /
       row geometry / skeleton) are owned by styles.css so this
       component's inline style budget stays under 2kB. Mirrors the
       HD-011 / HD-012 pattern. */
    :host {
      display: block;
      flex: 1 1 auto;
    }
    .admin-page {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
    }
  `],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly summary = signal<AdminDashboardSummary | null>(null);
  readonly activeTab = signal<TabKey>('tickets');

  // Filter strip — presentational state. The values are held in
  // signal-backed two-way bindings via [(ngModel)] + a small setter
  // hook so future server-side filter work can subscribe.
  readonly searchValue = signal('');
  filterCustomer = '';
  filterApplication = '';
  filterPriority = '';
  filterAssignee = '';
  filterSort: 'newest' | 'oldest' = 'newest';

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchValue.set(target.value);
  }

  /**
   * Mirror each select's current value back to a friendly label so
   * the visible text inside `.filter-select-label` matches what the
   * native <select> holds. The select itself is transparent (so
   * the wrapper keeps its custom chrome) — without this mirror the
   * user would see only the caret. Per-select label maps: "" →
   * "All X", numeric/unknown keys fall through verbatim. The sort
   * select uses "newest" / "oldest" → human-readable phrase.
   */
  readonly filterLabels = computed<{
    customer: string;
    application: string;
    priority: string;
    assignee: string;
    sort: string;
  }>(() => ({
    customer: this.filterCustomer ? this.filterCustomer : 'All customers',
    application: this.filterApplication ? this.filterApplication : 'All applications',
    priority: this.filterPriority ? this.filterPriority : 'All priorities',
    assignee:
      this.filterAssignee === 'unassigned'
        ? 'Unassigned'
        : this.filterAssignee
          ? this.filterAssignee
          : 'All assignees',
    sort:
      this.filterSort === 'oldest'
        ? 'Oldest first'
        : 'Newest first',
  }));

  /**
   * Hook for future server-side filter wiring. For now the values
   * are kept in component state and rendered into the friendly
   * label computed; downstream work (HD-redesign-filters) will
   * pipe these into the request and refetch.
   */
  onFilterChange(_key: string, _value: string): void {
    /* intentionally empty — handled by the filterLabels computed */
  }

  /**
   * Pre-shaped array of buckets the template iterates. Each entry
   * bundles the (status, key, rows, total) quartet so the @for
   * track-by works on a stable string. Recomputed when the
   * `summary()` signal changes.
   */
  readonly buckets = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { key: 'Open',        tintKey: 'open',        status: 'Open' as TicketStatus,        rows: s.open.rows,        total: s.open.total },
      { key: 'In Progress', tintKey: 'inprogress',  status: 'In Progress' as TicketStatus, rows: s.inProgress.rows,  total: s.inProgress.total },
      { key: 'Resolved',    tintKey: 'resolved',    status: 'Resolved' as TicketStatus,    rows: s.resolved.rows,    total: s.resolved.total },
      { key: 'Closed',      tintKey: 'closed',      status: 'Closed' as TicketStatus,      rows: s.closed.rows,      total: s.closed.total },
    ];
  });

  /**
   * Heading reflects the active tab. Tickets when the kanban is
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
    // subscription the activeTab signal would never update and
    // the wrong tab content would render).
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

  formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }

  linkHref(id: number): string {
    return `/tickets/${id}`;
  }

  /**
   * "View all" deep link for a column. Routes to /queue with the
   * status filter set so the agent Kanban (which admin shares)
   * scrolls/loads that bucket.
   */
  viewAllHref(statusKey: string): string {
    const param = encodeURIComponent(statusKey);
    return `/queue?status=${param}`;
  }

  onViewAllClick(): void {
    // intentionally empty — routerLink handles navigation.
  }

  ariaLabel(t: Ticket): string {
    return `Ticket ${t.number}, ${t.title}`;
  }

  /**
   * Build a 4-element placeholder array for the loading skeleton
   * (4 cards). Mirrors `loading-skeleton.rowArray()` pattern.
   */
  skeletonArray(): unknown[] {
    return new Array(4);
  }

  /**
   * Build a 5-element placeholder array for the filter-strip
   * select skeletons. The skeleton strips render 5 pill-shaped
   * bars to mirror the 5 real selects on the success state.
   */
  skeletonSelectArray(): unknown[] {
    return new Array(5);
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const data = await this.ticketService.adminDashboard();
      this.summary.set(data);
      this.renderState.set('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return;
      }
      this.errorMessage.set(GENERIC_LOAD_ERROR);
      this.renderState.set('error');
    }
  }

  private syncTabFromUrl(): void {
    const hash = (typeof window !== 'undefined' ? window.location.hash : '')
      .replace(/^#/, '')
      .toLowerCase();
    this.activeTab.set(hash === 'users' ? 'users' : 'tickets');
  }
}
