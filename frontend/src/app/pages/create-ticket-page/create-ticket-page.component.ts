import { Component } from '@angular/core';

/**
 * Create Ticket page placeholder.
 * Source spec: design-process/D-UX-Design/create-ticket.md
 * Real implementation: HD-008.
 */
@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>New ticket</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-008.
          <br />Route: <code>/tickets/new</code>
        </p>
      </div>
    </section>
  `,
})
export class CreateTicketPageComponent {}
