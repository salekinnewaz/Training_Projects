import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Ticket Detail page placeholder.
 * Source spec: design-process/D-UX-Design/ticket-detail.md
 * Real implementation: HD-010 (role-aware action matrix + comments + activity log).
 */
@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Ticket {{ ticketId() ? '#' + ticketId() : '' }}</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-010.
          <br />Route: <code>/tickets/:id</code>
        </p>
      </div>
    </section>
  `,
})
export class TicketDetailPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly ticketId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' }
  );
}
