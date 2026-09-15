import { Component } from '@angular/core';

/**
 * Users tab placeholder (Admin-only).
 * Source spec: design-process/D-UX-Design/users-tab.md
 * Real implementation: HD-014.
 *
 * Reached from /admin → Users tab in HD-013, but the standalone route
 * remains so deep links work.
 */
@Component({
  selector: 'app-users-tab-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Users</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-014.
          <br />Route: <code>/users</code> (Admin only)
        </p>
      </div>
    </section>
  `,
})
export class UsersTabPageComponent {}
