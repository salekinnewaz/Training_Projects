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
import { Router, RouterLink } from '@angular/router';

import { TicketService, type AdminDashboardSummary } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { BadgeStatusComponent } from '../../components/atoms/badge-status/badge-status.component';
import type { Ticket } from '../../models/ticket';
import type { TicketStatus } from '../../models/enums';

type RenderState = 'loading' | 'error' | 'success';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="admin-page">
        <header class="admin-header">
          <h1>Dashboard</h1>
          <nav class="tabs" aria-label="Admin views">
            <a
              class="tab"
              [class.active]="activeTab() === 'dashboard'"
              routerLink="/admin"
              [fragment]="'dashboard'"
              ariaCurrentWhenActive="page"
            >Dashboard</a>
            <a
              class="tab"
              [class.active]="activeTab() === 'users'"
              routerLink="/users"
              [fragment]="'users'"
              ariaCurrentWhenActive="page"
            >Users</a>
          </nav>
        </header>

        @switch (renderState()) {
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
            <div class="error-card" role="alert">
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
                  <header class="card-top">
                    <span class="pill-zone">
                      <badge-status [status]="bucket.status" />
                    </span>
                    <span
                      class="count"
                      [class.muted-count]="bucket.key === 'Closed'"
                    >{{ bucket.rows.length }}</span>
                  </header>
                  <ul class="card-body">
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
                    <footer class="card-footer">
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
    :host {
      display: block;
    }
    .admin-page {
      width: 100%;
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin-bottom: 24px;
    }
    .admin-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .tabs {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      background: var(--color-surface-subtle);
      border: 1px solid var(--color-border);
      border-radius: 8px;
    }
    .tab {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-label);
      text-decoration: none;
      transition: background-color 120ms ease, color 120ms ease;
    }
    .tab:hover {
      color: var(--color-primary);
      text-decoration: none;
    }
    .tab.active {
      background: var(--color-surface);
      color: var(--color-primary);
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    .tab:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }
    .error-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-error);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .error-message {
      margin: 0;
      color: var(--color-error);
      font-size: 14px;
    }
    .empty-marker {
      padding: 16px 12px;
      color: var(--color-muted);
      font-size: 13px;
      text-align: center;
    }
    /* Card-specific geometry: the 4-column row + card chrome + per-
       row layout are kept in styles.css (mirrors the HD-011 / HD-012
       pattern of pushing the heaviest rules to global so the page
       component's inline style budget holds under 2kB). */
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .count {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .count.muted-count {
      color: var(--color-muted);
    }
    .card-body {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .card-footer {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--color-muted);
      border-top: 1px solid var(--color-border);
    }
  `],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
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

  ngOnInit(): void {
    this.syncTabFromUrl();
    // The Users tab is a placeholder for HD-014 — route to /users
    // so the tab affordance is real without rendering duplicate
    // content. HD-014 will absorb the Users content into /admin
    // and turn this into a true in-page switch.
    if (this.activeTab() === 'users') {
      void this.router.navigateByUrl('/users');
      return;
    }
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
