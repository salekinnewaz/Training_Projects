/**
 * UsersPageShellComponent — HD-014.
 *
 * The shell for the standalone `/users` route. It supplies the
 * app chrome and the page heading, then projects the users list.
 *
 * WHY A SHELL
 * ───────────
 * `UsersTabPageComponent` is mounted in two places:
 *
 *   1. Here — the standalone `/users` route.
 *   2. Inside `AdminDashboardPageComponent` — the Users tab.
 *
 * When the list component rendered its own `<app-chrome>` and
 * its own `<h1>`, mounting it under the Admin dashboard produced
 * two header strips, two "Users" headings, and a duplicated
 * "Tickets | Users" nav (the chrome's nav PLUS the dashboard's
 * own tab switcher).
 *
 * So the list component is now content-only, and each host
 * owns the chrome + heading. This shell is the host for the
 * standalone route.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { UsersTabPageComponent } from './users-tab-page.component';

@Component({
  selector: 'app-users-page-shell',
  standalone: true,
  imports: [AppChromeComponent, UsersTabPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="users-shell">
        <header class="users-shell__header">
          <div class="users-shell__title-group">
            <h1 class="users-shell__title">Users</h1>
            <p class="users-shell__subtitle">
              Manage who has access to HelpDesk Lite and what role they hold.
            </p>
          </div>
        </header>

        <app-users-tab-page />
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1 1 auto;
    }
    /* Chrome + heading geometry live in styles.css (.users-shell*) —
       same pattern as every other page component. */
  `],
})
export class UsersPageShellComponent {}
