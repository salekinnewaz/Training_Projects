import { Component } from '@angular/core';

/**
 * Employee Dashboard (My Tickets) placeholder.
 * Source spec: design-process/D-UX-Design/employee-dashboard.md
 * Real implementation: HD-007.
 */
@Component({
  selector: 'app-employee-dashboard-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>My Tickets</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-007.
          <br />Route: <code>/dashboard</code>
        </p>
      </div>
    </section>
  `,
})
export class EmployeeDashboardPageComponent {}
