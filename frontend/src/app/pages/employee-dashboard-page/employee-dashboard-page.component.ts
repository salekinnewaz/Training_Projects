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
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin-bottom: 24px;
    }
    .dashboard-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .dashboard-header atom-button {
      width: auto;
      min-width: 160px;
    }
    .error-message {
      margin: 0;
      padding: 16px;
      border: 1px solid var(--color-error);
      background: var(--color-surface);
      color: var(--color-error);
      font-size: 14px;
      border-radius: 6px;
    }
    .ticket-list {
      list-style: none;
      margin: 0;
      padding: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
    }
    .ticket-list > * {
      display: block;
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