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

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { AdminSidebarComponent } from '../../components/molecules/admin-sidebar/admin-sidebar.component';
import type { AdminSidebarBadge } from '../../components/molecules/admin-sidebar/admin-sidebar.component';
import { TicketService } from '../../services/ticket.service';
import { UsersTabPageComponent } from './users-tab-page.component';

@Component({
  selector: 'app-users-page-shell',
  standalone: true,
  imports: [AppChromeComponent, AdminSidebarComponent, UsersTabPageComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome [wide]="true">
      <div class="users-workspace">
        <admin-sidebar class="users-rail" [badge]="sidebarBadge()" />
        <main class="users-main">
          <section class="users-shell">
            <nav class="users-breadcrumb" aria-label="Breadcrumb">
              <a routerLink="/admin">Home</a><span aria-hidden="true">›</span><span aria-current="page">Users</span>
            </nav>
            <header class="users-shell__header">
              <div class="users-shell__title-group">
                <h1 class="users-shell__title">
                  Users
                  <span class="users-title-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false"><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19zM16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V19h-4"/></svg>
                  </span>
                </h1>
                <p class="users-shell__subtitle">
                  Manage who has access to HelpDesk Lite and what role they hold. Invite new users, assign roles, and control access.
                </p>
              </div>
              <button class="users-invite" type="button" disabled title="Invitations are not available yet">
                <span aria-hidden="true">＋</span> Invite User
              </button>
            </header>

            <app-users-tab-page (usersCountChanged)="onUsersCount($event)" />
          </section>
        </main>
      </div>
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
export class UsersPageShellComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  readonly sidebarBadge = signal<AdminSidebarBadge>({});

  ngOnInit(): void {
    void this.loadTicketCount();
  }

  onUsersCount(count: number): void {
    this.sidebarBadge.update((badge) => ({ ...badge, users: count }));
  }

  private async loadTicketCount(): Promise<void> {
    try {
      const bundle = await this.ticketService.workspace();
      this.sidebarBadge.update((badge) => ({
        ...badge,
        tickets: bundle.summary.totalTickets,
      }));
    } catch {
      // The Users roster remains available if the optional sidebar
      // ticket counter cannot be loaded.
    }
  }
}
