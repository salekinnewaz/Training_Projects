/**
 * SubmissionConfirmationPageComponent — HD-009.
 *
 * The "5-second trust moment" Eli lands on after submitting a new
 * ticket. Proves the artifact exists and is hers in under five
 * seconds:
 *   - green check (consumes --color-success + --status-resolved-bg)
 *   - monospace ticket number (#HD-<n>)
 *   - Open status chip
 *   - primary "View ticket" CTA
 *   - secondary "← Back to My Tickets" link
 *
 * Render states (mutually exclusive — `@switch`):
 *   loading  → <loading-skeleton>
 *   notFound → centered "Ticket not found" card with Back-to-Dashboard
 *   error    → centered error card with "Couldn't load this ticket…"
 *   success  → the six spec elements wrapped in <app-chrome>
 *
 * Lifecycle:
 *   ngOnInit reads :id from the route, parses it to a number, and
 *   either fires `TicketService.getById(id)` or navigates to
 *   /dashboard if the id is NaN. Click on the ticket number copies
 *   `#HD-<n>` to clipboard via `navigator.clipboard.writeText`;
 *   on success a small "Copied." toast appears above the number
 *   for ~1.5 s. Per spec, clipboard failures are silently no-op.
 *
 * The page wraps itself in `<app-chrome>` (HD-006 deferred wiring
 * the chrome as a parent-route layout, so each post-login page
 * still embeds it per-page).
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
import { ActivatedRoute, Router } from '@angular/router';

import { TicketService } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { BadgeStatusComponent } from '../../components/atoms/badge-status/badge-status.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { CheckCircleComponent } from '../../components/atoms/check-circle/check-circle.component';
import { LoadingSkeletonComponent } from '../../components/patterns/loading-skeleton/loading-skeleton.component';
import type { Ticket } from '../../models/ticket';

type RenderState = 'loading' | 'notFound' | 'error' | 'success';

const TOAST_DURATION_MS = 1500;

@Component({
  selector: 'app-submission-confirmation-page',
  standalone: true,
  imports: [
    AppChromeComponent,
    BadgeStatusComponent,
    ButtonComponent,
    CheckCircleComponent,
    LoadingSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="confirmation-page">
        @switch (renderState()) {
          @case ('loading') {
            <loading-skeleton [rows]="3" />
          }
          @case ('notFound') {
            <div class="state-card" role="alert">
              <h1 class="title">Ticket not found</h1>
              <p class="message">
                We couldn't find that ticket. It may have been removed.
              </p>
              <atom-button
                variant="primary"
                size="md"
                (pressed)="goToDashboard()"
              >Back to Dashboard</atom-button>
            </div>
          }
          @case ('error') {
            <div class="state-card" role="alert">
              <h1 class="title">Couldn't load this ticket</h1>
              <p class="message">Please try again.</p>
              <atom-button
                variant="primary"
                size="md"
                (pressed)="goToDashboard()"
              >Back to Dashboard</atom-button>
            </div>
          }
          @case ('success') {
            <div class="success-block">
              <check-circle [size]="64" />

              <h1 class="success-headline">Ticket created</h1>

              <div class="number-block">
                @if (toastVisible()) {
                  <span class="copy-toast" role="status" aria-live="polite">
                    Copied.
                  </span>
                }
                <button
                  type="button"
                  class="ticket-number"
                  (click)="copyNumber()"
                  [attr.aria-label]="'Copy ticket number ' + numberLabel()"
                >#{{ numberLabel() }}</button>
              </div>

              <div class="status-block">
                <p class="micro-label">Initial status</p>
                @if (ticket(); as t) {
                  <badge-status [status]="t.status" />
                }
              </div>

              <div class="cta-block">
                <atom-button
                  variant="primary"
                  size="lg"
                  (pressed)="goToTicket()"
                >View ticket</atom-button>
              </div>

              <button
                type="button"
                class="back-link"
                (click)="goToDashboard()"
              >← Back to My Tickets</button>
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
    .confirmation-page {
      width: 100%;
    }
    .success-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 40px 0 0;
      text-align: center;
    }
    .success-headline {
      font-size: 28px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0;
    }
    .number-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    .copy-toast {
      display: inline-block;
      background: var(--color-primary);
      color: var(--color-surface);
      padding: 4px 10px;
      border-radius: var(--field-radius);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }
    .ticket-number {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 32px;
      font-weight: 600;
      color: var(--color-primary);
      letter-spacing: 0.5px;
    }
    .ticket-number:hover {
      text-decoration: underline;
    }
    .status-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .micro-label {
      margin: 0;
      font-size: 12px;
      color: var(--color-muted);
    }
    .cta-block {
      width: 100%;
      max-width: 320px;
      margin-top: 16px;
    }
    .back-link {
      background: none;
      border: none;
      padding: 0;
      margin: 8px 0 0;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      color: var(--color-muted);
    }
    .back-link:hover {
      text-decoration: underline;
    }
    .state-card {
      max-width: 480px;
      margin: 48px auto;
      padding: 32px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .state-card .title {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0;
    }
    .state-card .message {
      margin: 0;
      font-size: 14px;
      color: var(--color-muted);
    }
    .state-card atom-button {
      width: auto;
      min-width: 200px;
    }
  `],
})
export class SubmissionConfirmationPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** The fetched ticket (null until success). */
  readonly ticket = signal<Ticket | null>(null);

  /** The route's `:id` param, post-parse (NaN branch never stores it). */
  readonly ticketId = signal<number | null>(null);

  /** Current render branch. */
  readonly renderState = signal<RenderState>('loading');

  /** Transient "Copied." toast flag. */
  readonly toastVisible = signal<boolean>(false);

  /** The "#HD-<n>" label — derived from ticket(). */
  readonly numberLabel = computed(() => this.ticket()?.number ?? '');

  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer !== undefined) clearTimeout(this.toastTimer);
    });
    void this.load();
  }

  goToTicket(): void {
    const id = this.ticketId();
    if (id === null) return;
    void this.router.navigate(['/tickets', id]);
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  /**
   * Copy the ticket number to the clipboard and show a brief toast.
   * Per spec: if writeText rejects (browser without
   * `navigator.clipboard`, permissions denied, etc.), silently no-op.
   */
  async copyNumber(): Promise<void> {
    const value = this.numberLabel();
    if (!value) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`#${value}`);
        this.flashToast();
      }
    } catch {
      // Silent no-op per spec ("no error toast — it's a nice-to-have").
    }
  }

  private flashToast(): void {
    this.toastVisible.set(true);
    if (this.toastTimer !== undefined) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible.set(false);
      this.toastTimer = undefined;
    }, TOAST_DURATION_MS);
  }

  private async load(): Promise<void> {
    const raw = this.route.snapshot.paramMap.get('id');
    const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }

    this.ticketId.set(parsed);
    this.renderState.set('loading');

    try {
      const ticket = await this.ticketService.getById(parsed);
      this.ticket.set(ticket);
      this.renderState.set('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.renderState.set('notFound');
        return;
      }
      this.renderState.set('error');
    }
  }
}