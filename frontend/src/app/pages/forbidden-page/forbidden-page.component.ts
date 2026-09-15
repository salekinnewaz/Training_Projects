/**
 * ForbiddenPageComponent — HD-006.
 *
 * Standalone 403 page. Renders when `roleGuard` bounces a user away
 * from a role-restricted route, or when an unauthenticated user
 * deep-links to `/forbidden` (which is itself authGuard'd, so they
 * land on `/login?return_to=%2Fforbidden` instead).
 *
 * The page reads `?denied_from=` from the URL to render a small
 * breadcrumb above the headline, then offers:
 *   - Primary CTA: "Go to your dashboard" → `auth.roleHomePath()`
 *   - Secondary link: "Sign in as a different user" (only when the
 *     snapshot is null — cold bounce case where the cookie is gone
 *     but the user hit a 403 via some other route).
 *
 * No `<app-chrome>` wrapping — per the design note in the spec, the
 * 403 page is a bare page; HD-007+ wires its own chrome inside each
 * page's own story.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { LinkComponent } from '../../components/atoms/link/link.component';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LinkComponent],
  template: `
    <section class="forbidden-page">
      <article class="forbidden-card">
        @if (deniedFrom()) {
          <p class="denied-from" aria-label="Denied from">
            /{{ deniedFrom() }}
          </p>
        }

        <h1>You don't have access to this page</h1>
        <p class="supporting">
          If you think this is a mistake, contact your administrator.
        </p>

        <div class="actions">
          <atom-button variant="primary" (click)="goToDashboard()">
            Go to your dashboard
          </atom-button>

          @if (showSignInLink()) {
            <atom-link href="/login">Sign in as a different user</atom-link>
          }
        </div>
      </article>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .forbidden-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--color-page-bg);
      padding: 24px;
      box-sizing: border-box;
    }
    .forbidden-card {
      width: 100%;
      max-width: 480px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 40px 32px;
      box-shadow: var(--shadow-dropdown);
      box-sizing: border-box;
      text-align: center;
    }
    .denied-from {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-muted);
      background: var(--color-surface-subtle);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 0 16px;
    }
    h1 {
      font-size: 22px;
      color: var(--color-error);
      margin: 0 0 12px;
    }
    .supporting {
      color: var(--color-label);
      margin: 0 0 28px;
      font-size: 14px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .actions atom-button {
      width: 100%;
    }
  `],
})
export class ForbiddenPageComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly deniedFrom = signal<string>('');
  readonly showSignInLink = signal<boolean>(false);

  constructor() {
    const raw = this.route.snapshot.queryParamMap.get('denied_from') ?? '';
    // Strip leading slash for visual cleanliness — "denied_from=/admin"
    // renders as a clean "/admin" breadcrumb (the template prepends a
    // literal `/`). Keep empty when not provided so the breadcrumb
    // doesn't render at all.
    this.deniedFrom.set(
      raw && raw.startsWith('/') ? raw.slice(1) : raw,
    );

    // Show the "sign in as a different user" link only when there's
    // no in-memory user — the cold bounce case. Authenticated-but-
    // wrong-role users have a working cookie; the dashboard CTA is
    // the right next step.
    this.showSignInLink.set(this.auth.userSnapshot() === null);
  }

  goToDashboard(): void {
    void this.router.navigateByUrl(this.auth.roleHomePath());
  }
}
