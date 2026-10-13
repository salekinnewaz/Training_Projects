/**
 * EmployeeDashboardPageComponent — HD-007.
 *
 * The My Tickets page Eli lands on after Login. Lists the
 * JWT'd user's tickets, newest-first, with one click target
 * per row. The page wraps itself in `<app-chrome>` (HD-006
 * deferred wiring `app-chrome` as a parent-route layout
 * because doing it without per-page opt-in would force every
 * placeholder to revisit its selector).
 *
 * Render states (mutually exclusive — `@switch`):
 *
 *   loading → <loading-skeleton [rows]="5">
 *   error   → inline message + heading + Create Ticket CTA
 *   empty   → <empty-state> with the centered "No tickets yet"
 *   list    → N × <ticket-row>
 *
 * `ngOnInit` fetches via `TicketService.listMine()`. Per the spec,
 * this is a "cold navigation = full fetch; warm cache from a
 * tab switch = re-use" — every visit currently re-fetches (MVP).
 *
 * Keyboard: the page relies on `<app-chrome>` for the skip-link
 * + `<main id="main-content" tabindex="-1">` target. The first
 * interactive inside the header CTA; tab order then visits each
 * ticket-row.
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

import { TicketService } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { EmptyStateComponent } from '../../components/molecules/empty-state/empty-state.component';
import { TicketRowComponent } from '../../components/molecules/ticket-row/ticket-row.component';
import { LoadingSkeletonComponent } from '../../components/patterns/loading-skeleton/loading-skeleton.component';
import type { Ticket } from '../../models/ticket';

type RenderState = 'loading' | 'error' | 'empty' | 'list';

type TicketStatusCount = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

const STAT_CARDS: { status: TicketStatusCount; label: string }[] = [
  { status: 'Open', label: 'Open' },
  { status: 'In Progress', label: 'In Progress' },
  { status: 'Resolved', label: 'Resolved' },
  { status: 'Closed', label: 'Closed' },
];

const GENERIC_LOAD_ERROR = "Couldn't load your tickets. Refresh to try again.";
const SESSION_EXPIRED_ERROR = 'Your session expired. Please sign in again.';

@Component({
  selector: 'app-employee-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    AppChromeComponent,
    ButtonComponent,
    EmptyStateComponent,
    TicketRowComponent,
    LoadingSkeletonComponent,
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
          @case ('list') {
            <div
              class="stat-strip"
              data-testid="stat-strip"
              aria-label="Ticket status summary"
            >
              @for (card of statCards; track card.status) {
                <div
                  class="stat-card"
                  [attr.data-status]="card.status"
                  [attr.data-testid]="'stat-card-' + card.status"
                >
                  <span class="stat-label">{{ card.label }}</span>
                  <span class="stat-count">{{ statusCounts()[card.status] }}</span>
                </div>
              }
            </div>
            <ul class="ticket-list">
              @for (t of tickets(); track t.id) {
                <ticket-row
                  [ticket]="t"
                  [relativeTime]="formatRelative(t.updatedAt)"
                />
              }
            </ul>
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .dashboard-page {
      width: 100%;
      animation: fadeInUp var(--duration-slow) var(--ease-out) both;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin-bottom: 28px;
    }
    .dashboard-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .dashboard-header atom-button {
      width: auto;
      min-width: 160px;
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
    .ticket-list {
      list-style: none;
      margin: 0;
      padding: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .ticket-list > * {
      display: block;
    }
    .stat-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (max-width: 720px) {
      .stat-strip {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .stat-card {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: var(--shadow-card);
      overflow: hidden;
      transition: transform var(--duration-base) var(--ease-out),
        box-shadow var(--duration-base) var(--ease-out);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--stat-accent, var(--color-primary));
      opacity: 0.9;
    }
    .stat-card[data-status="Open"] {
      --stat-accent: var(--status-open-dot);
      background: linear-gradient(180deg, var(--status-open-bg) 0%, var(--color-surface) 60%);
    }
    .stat-card[data-status="In Progress"] {
      --stat-accent: var(--status-in-progress-dot);
      background: linear-gradient(180deg, var(--status-in-progress-bg) 0%, var(--color-surface) 60%);
    }
    .stat-card[data-status="Resolved"] {
      --stat-accent: var(--status-resolved-dot);
      background: linear-gradient(180deg, var(--status-resolved-bg) 0%, var(--color-surface) 60%);
    }
    .stat-card[data-status="Closed"] {
      --stat-accent: var(--status-closed-dot);
      background: linear-gradient(180deg, var(--status-closed-bg) 0%, var(--color-surface) 60%);
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-hover);
    }
    .stat-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-label);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .stat-count {
      font-size: 32px;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
  `],
})
export class EmployeeDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private redirectTimer?: ReturnType<typeof setTimeout>;

  readonly tickets = signal<Ticket[]>([]);
  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);

  /** Per-status counts for the stat strip. */
  readonly statusCounts = computed<Record<TicketStatusCount, number>>(() => {
    const counts: Record<TicketStatusCount, number> = {
      Open: 0,
      'In Progress': 0,
      Resolved: 0,
      Closed: 0,
    };
    for (const t of this.tickets()) {
      if (t.status in counts) {
        counts[t.status as TicketStatusCount] += 1;
      }
    }
    return counts;
  });

  /** Ordered list of stat cards (Open · In Progress · Resolved · Closed). */
  readonly statCards = STAT_CARDS;

  ngOnInit(): void {
    void this.load();
  }

  goToCreate(): void {
    void this.router.navigateByUrl('/tickets/new');
  }

  /**
   * Format an ISO timestamp into a coarse "X ago" string so the row
   * doesn't need a date-formatting dependency. Intentionally light
   * — full date formatting lives on the Ticket Detail page (HD-010).
   */
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

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const list = await this.ticketService.listMine();
      this.tickets.set(list);
      this.renderState.set(list.length === 0 ? 'empty' : 'list');
    } catch (err) {
      // Session-expired → bounce to /login; per spec, "session
      // expired" is a sub-case of the server-error state. We log
      // the user out silently (auth service already nulled the
      // user$ subject on 401) and send them back through the
      // guard. Other failures show the inline retry message.
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
    }
  }
}