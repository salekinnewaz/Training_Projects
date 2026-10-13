/**
 * AdminDashboardPageComponent — HD-013.
 *
 * The /admin page. Two tabs (Dashboard / Users). HD-013 ships
 * the Dashboard tab (this story); HD-014 absorbs the Users
 * content into the same page. Until then, the Users tab is a
 * tab affordance only — clicking it routes to /users (the
 * existing standalone page) so the tab is real.
 *
 * Layout (per design-process/D-UX-Design/admin-dashboard.md):
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Dashboard                       [Dashboard] [Users] │
 *   │ ─────────────────────────────────────────────────── │
 *   │ [ Open (n) ] [ In Progress (n) ] [ Resolved (n) ] [ Closed (n) ] │
 *   │  rows...       rows...             rows...            rows...       │
 *   │  "Showing 14   "Showing 14 of 50" (muted)            (muted footer)│
 *   └──────────────────────────────────────────────────────┘
 *
 * Card body rows show: ticket number (mono) · title (1-line clamp) ·
 * relative timestamp (right). Click navigates to /tickets/:id (HD-010)
 * for Open / In Progress / Resolved; Closed rows are muted and do not
 * navigate. Card footer "Showing N of M" renders only when total > 14.
 *
 * Render states (mutually exclusive @switch):
 *   loading → heading + tab switcher (Dashboard active) + 4 card skeletons
 *   error   → inline error above the cards + Retry button (tab switcher stays)
 *   success → 4 cards rendered
 *
 * URL hash: `#dashboard` (default) / `#users`. Direct arrival at
 * /admin#users routes to /users in ngOnInit (so HD-014 can replace
 * this with a true in-page tab without changing the URL contract).
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
import { RouterLink } from '@angular/router';

import { TicketService, type AdminDashboardSummary } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { BadgeStatusComponent } from '../../components/atoms/badge-status/badge-status.component';
import { UsersTabPageComponent } from '../users-tab-page/users-tab-page.component';
import type { Ticket } from '../../models/ticket';
import type { TicketStatus } from '../../models/enums';

type RenderState = 'loading' | 'error' | 'success' | 'users-placeholder';
type TabKey = 'dashboard' | 'users';

const GENERIC_LOAD_ERROR = "Couldn't load the queue. Refresh to try again.";

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    AppChromeComponent,
    ButtonComponent,
    BadgeStatusComponent,
    UsersTabPageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="admin-page">
        <header class="admin-header">
          <h1>{{ headingText() }}</h1>
          <nav class="tabs" role="tablist" aria-label="Admin views">
            <a
              class="tab"
              role="tab"
              id="admin-tab-dashboard"
              [class.active]="activeTab() === 'dashboard'"
              routerLink="/admin"
              [fragment]="'dashboard'"
              [attr.aria-selected]="activeTab() === 'dashboard'"
              [attr.tabindex]="activeTab() === 'dashboard' ? 0 : -1"
              (keydown)="onTabKeydown($event, 'dashboard')"
            >Dashboard</a>
            <a
              class="tab"
              role="tab"
              id="admin-tab-users"
              [class.active]="activeTab() === 'users'"
              routerLink="/admin"
              [fragment]="'users'"
              [attr.aria-selected]="activeTab() === 'users'"
              [attr.tabindex]="activeTab() === 'users' ? 0 : -1"
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
            <div class="card-row" aria-busy="true" aria-label="Loading dashboard">
              @for (_ of skeletonArray(); track $index) {
                <div class="card-skel" aria-hidden="true">
                  <div class="bar bar-top"></div>
                  <div class="bar bar-row"></div>
                  <div class="bar bar-row"></div>
                  <div class="bar bar-row"></div>
                  <div class="bar bar-row short"></div>
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
            <div class="card-row">
              @for (bucket of buckets(); track bucket.key) {
                <article class="card" [class.muted]="bucket.key === 'Closed'">
                  <header class="admin-card-top">
                    <span class="pill-zone">
                      <badge-status [status]="bucket.status" />
                    </span>
                    <span
                      class="count"
                      [class.muted-count]="bucket.key === 'Closed'"
                    >{{ bucket.total }}</span>
                  </header>
                  <ul class="admin-card-body">
                    @if (bucket.rows.length === 0) {
                      <li class="empty-marker">Nothing here.</li>
                    } @else {
                      @for (t of bucket.rows; track t.id) {
                        @if (bucket.key === 'Closed') {
                          <li
                            class="admin-card-row is-muted"
                            [attr.data-ticket-id]="t.id"
                            [attr.aria-label]="ariaLabel(t)"
                          >
                            <span class="number">{{ t.number }}</span>
                            <span class="title">{{ t.title }}</span>
                            <time
                              class="timestamp"
                              [attr.datetime]="t.createdAt"
                            >{{ formatRelative(t.createdAt) }}</time>
                          </li>
                        } @else {
                          <li>
                            <a
                              class="admin-card-row"
                              [routerLink]="linkHref(t.id)"
                              [attr.aria-label]="ariaLabel(t)"
                            >
                              <span class="number">{{ t.number }}</span>
                              <span class="title">{{ t.title }}</span>
                              <time
                                class="timestamp"
                                [attr.datetime]="t.createdAt"
                              >{{ formatRelative(t.createdAt) }}</time>
                            </a>
                          </li>
                        }
                      }
                    }
                  </ul>
                  @if (bucket.total > bucket.rows.length) {
                    <footer class="admin-card-footer">
                      Showing {{ bucket.rows.length }} of {{ bucket.total }}
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
    }
  `],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly summary = signal<AdminDashboardSummary | null>(null);
  readonly activeTab = signal<TabKey>('dashboard');

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
      { key: 'Open', status: 'Open' as TicketStatus, rows: s.open.rows, total: s.open.total },
      { key: 'In Progress', status: 'In Progress' as TicketStatus, rows: s.inProgress.rows, total: s.inProgress.total },
      { key: 'Resolved', status: 'Resolved' as TicketStatus, rows: s.resolved.rows, total: s.resolved.total },
      { key: 'Closed', status: 'Closed' as TicketStatus, rows: s.closed.rows, total: s.closed.total },
    ];
  });

  /**
   * Heading reflects the active tab per design §2 ("heading text
   * reflects the active tab. Dashboard when Dashboard active;
   * Users when Users active."). Hardcoded string on each branch
   * so the page title can also read this via a future document.title
   * binding.
   */
  readonly headingText = computed(() =>
    this.activeTab() === 'users' ? 'Users' : 'Dashboard',
  );

  /**
   * The render state the template switches on. When the active tab
   * is `users`, we short-circuit to the users-placeholder branch
   * regardless of the underlying load state (the dashboard data
   * is not relevant to the users tab). HD-014 will split this
   * into a separate signal.
   */
  readonly effectiveRenderState = computed<RenderState>(() => {
    if (this.activeTab() === 'users') return 'users-placeholder';
    return this.renderState();
  });

  ngOnInit(): void {
    this.syncTabFromUrl();
    // Per design §4, the Users tab content is a placeholder for
    // HD-014 (which will absorb the Users content into this page).
    // The URL hash stays on /admin#users so the page contract
    // matches the design doc; until HD-014, the body renders an
    // "HD-014 will land here" placeholder.
    void this.load();
  }

  /**
   * Refetch on window focus (per spec "no realtime updates; refetch
   * on window-focus OR explicit Refresh"). The user can be away
   * from the tab reviewing tickets in HD-010; coming back should
   * reflect any status changes the agent made in another tab.
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
   * Tab-list arrow-key navigation per design §4 ("←/→ arrow keys
   * move focus between tabs, Enter activates"). The current
   * implementation uses <a> tabs (so Enter/Space activate via the
   * default link behavior), but the arrow-key pattern is on top so
   * keyboard users don't fall out of the tab group at the right edge.
   */
  onTabKeydown(event: KeyboardEvent, current: TabKey): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: TabKey = current === 'dashboard' ? 'users' : 'dashboard';
    // Update the URL hash (so the URL stays in sync with the active
    // tab) and move focus to the newly-active tab. We do this
    // manually rather than via routerLink so the page doesn't
    // re-fire ngOnInit (which would refetch the dashboard).
    this.activeTab.set(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${next}`);
    }
    queueMicrotask(() => {
      const id =
        next === 'dashboard' ? 'admin-tab-dashboard' : 'admin-tab-users';
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

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const data = await this.ticketService.adminDashboard();
      this.summary.set(data);
      this.renderState.set('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Auth interceptor will redirect to /login; leave the page
        // in its loading skeleton state since the user is about to
        // bounce anyway. Avoid flashing an error message right
        // before the redirect.
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
    this.activeTab.set(hash === 'users' ? 'users' : 'dashboard');
  }
}
