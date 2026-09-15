import { Component } from '@angular/core';

/**
 * Submission Confirmation page placeholder.
 * Source spec: design-process/D-UX-Design/submission-confirmation.md
 * Real implementation: HD-009.
 */
@Component({
  selector: 'app-submission-confirmation-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Ticket created</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-009.
          <br />Route: <code>/tickets/:id/created</code>
        </p>
      </div>
    </section>
  `,
})
export class SubmissionConfirmationPageComponent {}
