/**
 * ProfilePageComponent — D114.
 *
 * Standalone "Profile / Account" page. Available to any
 * authenticated role (per EXPERIENCE.md "Profile / Account
 * (any authenticated role)").
 *
 * Renders the current user's account info pulled from
 * `AuthService.userSnapshot()`. If the snapshot is null (rare
 * cold load), calls `auth.refreshUser()` once on mount to
 * populate it.
 *
 * Layout: a centered card with two stacked sections:
 *
 *   1. Account card: display name, email, role badge, last-
 *      active-at. Top-line name is rendered large (24px,
 *      --color-text) with a chrome-avatar next to it.
 *   2. Account actions card: two CTAs
 *      - "Change password" → /profile/password (HD-018)
 *      - "Sign out" → auth.logout() (clears cookie + user$,
 *        then navigates to /login)
 *
 * No role-conditional rendering: profile is shared across roles.
 * The role badge is informational only.
 *
 * The page wraps itself in `<app-chrome>` so the user has the
 * top-bar nav context. The `Profile` menu (right side of the
 * chrome) would link here in a future HD-006 follow-up; for
 * now the page is deep-linkable via /profile.
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { AuthService } from '../../services/auth.service';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { ChromeAvatarComponent } from '../../components/atoms/chrome-avatar/chrome-avatar.component';
import { BadgeRoleComponent } from '../../components/atoms/badge-role/badge-role.component';
import { LinkComponent } from '../../components/atoms/link/link.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppChromeComponent,
    ButtonComponent,
    ChromeAvatarComponent,
    BadgeRoleComponent,
    LinkComponent,
  ],
  template: `
    <app-chrome>
      <section class="profile-page" id="main-content">
        <div class="page-grid">
          @if (user(); as u) {
            <article class="card account-card">
              <header class="account-head">
                <chrome-avatar [displayName]="u.displayName" [size]="56" />
                <div class="account-name">
                  <h1 class="display-name">{{ u.displayName }}</h1>
                  <p class="email">{{ u.email }}</p>
                </div>
              </header>

              <dl class="account-meta">
                <div class="meta-row">
                  <dt>Role</dt>
                  <dd>
                    <badge-role [role]="u.role" />
                  </dd>
                </div>
                <div class="meta-row">
                  <dt>Status</dt>
                  <dd>
                    @if (u.isActive) {
                      <span class="status-pill status-active">Active</span>
                    } @else {
                      <span class="status-pill status-inactive">Inactive</span>
                    }
                  </dd>
                </div>
                <div class="meta-row">
                  <dt>Last active</dt>
                  <dd>{{ lastActiveLabel() }}</dd>
                </div>
                <div class="meta-row">
                  <dt>Member since</dt>
                  <dd>{{ memberSinceLabel() }}</dd>
                </div>
              </dl>
            </article>

            <article class="card actions-card">
              <h2 class="card-title">Account actions</h2>

              <div class="action-list">
                <div class="action-row">
                  <div>
                    <p class="action-name">Change password</p>
                    <p class="action-helper">
                      Update the password you use to sign in.
                    </p>
                  </div>
                  <atom-link href="/profile/password" data-testid="change-password-link">
                    Change password
                  </atom-link>
                </div>

                <div class="action-row">
                  <div>
                    <p class="action-name">Sign out</p>
                    <p class="action-helper">
                      Sign out of this device. You'll need to sign in again to view your tickets.
                    </p>
                  </div>
                  <atom-button
                    variant="secondary"
                    data-testid="sign-out-btn"
                    (pressed)="onSignOut()"
                  >Sign out</atom-button>
                </div>
              </div>
            </article>
          } @else {
            <article class="card loading-card">
              <p class="loading">Loading your account…</p>
            </article>
          }
        </div>
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .profile-page {
      min-height: 100%;
      background: var(--color-page-bg);
      padding: 32px 24px;
      box-sizing: border-box;
    }
    .page-grid {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      box-shadow: var(--shadow-card);
      padding: 32px;
      box-sizing: border-box;
    }
    .account-head {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--color-border);
    }
    .account-name {
      min-width: 0;
    }
    .display-name {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-text);
    }
    .email {
      margin: 0;
      color: var(--color-muted);
      font-size: 14px;
    }
    .account-meta {
      margin: 24px 0 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .meta-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: center;
      gap: 16px;
    }
    .meta-row dt {
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 500;
    }
    .meta-row dd {
      margin: 0;
      color: var(--color-text);
      font-size: 14px;
    }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-active {
      background: rgba(43, 138, 62, 0.1);
      color: var(--color-success);
    }
    .status-inactive {
      background: rgba(220, 38, 38, 0.08);
      color: var(--color-error);
    }
    .card-title {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text);
    }
    .action-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      padding: 16px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .action-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .action-name {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
    }
    .action-helper {
      margin: 0;
      font-size: 13px;
      color: var(--color-muted);
    }
    .loading {
      margin: 0;
      color: var(--color-muted);
      font-size: 14px;
      text-align: center;
    }
  `],
})
export class ProfilePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = signal(this.auth.userSnapshot());
  readonly lastActiveLabel = computed<string>(() => this.formatLastActive(this.user()?.lastActiveAt));
  readonly memberSinceLabel = computed<string>(() => this.formatDate(this.user()?.createdAt));

  async ngOnInit(): Promise<void> {
    // Cold-load case: navigate directly to /profile and the chrome
    // hasn't populated the snapshot yet. The `user$` Observable
    // stays null until refreshUser() resolves.
    if (this.user() === null) {
      try {
        await this.auth.refreshUser();
        this.user.set(this.auth.userSnapshot());
      } catch {
        // If the refresh fails (cookie gone), the chrome's
        // authGuard will redirect to /login on the next navigation.
        // The page itself just shows the loading state until then.
      }
    }
  }

  async onSignOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private formatLastActive(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return this.relativeTime(date);
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Unknown';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Lightweight "X minutes ago" / "X days ago" formatter. Mirrors
   * the pattern used elsewhere in the app (see ticket-row's
   * relativeTime input). No date-fns dep needed.
   */
  private relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  }
}