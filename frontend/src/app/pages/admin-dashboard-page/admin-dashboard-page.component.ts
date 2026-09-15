import { Component } from '@angular/core';

/**
 * Admin Dashboard placeholder (two tabs: Dashboard / Users).
 * Source spec: design-process/D-UX-Design/admin-dashboard.md
 * Real implementation: HD-013 (Dashboard tab) + HD-014 (Users tab).
 *
 * Admin-only page. Direct-arrival from non-Admin returns 403 (HD-006).
 */
@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Admin</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-013 (Dashboard tab)
          and HD-014 (Users tab).
          <br />Route: <code>/admin</code> (Admin only)
        </p>
      </div>
    </section>
  `,
})
export class AdminDashboardPageComponent {}
