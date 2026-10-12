/**
 * NotFoundPageComponent — D110.
 *
 * Standalone 404 page. Renders when the wildcard `**` route fires
 * (e.g. user mistypes a URL or follows a stale link). Two CTAs:
 *
 *   - Primary: "Go to your dashboard" → `auth.roleHomePath()`
 *     (or `/login` when the cookie is gone — auth.roleHomePath()
 *     returns '/login' in that case per the auth spec).
 *   - Secondary link: shown only when authenticated, navigates
 *     back via history (`Location.back()`) for a less jarring
 *     recovery from a deep-link typo.
 *
 * No `<app-chrome>` wrap — same pattern as the 403 page. The 404
 * page is a destination, not a step in the IA, so the chrome
 * (which assumes an authenticated session) would be misleading
 * on a cold load.
 *
 * Source of truth: EXPERIENCE.md line 195 "404/403: dedicated
 * page with back-to-dashboard action".
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ButtonComponent } from '../../components/atoms/button/button.component';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <section class="not-found-page">
      <article class="not-found-card">
        <p class="error-code" aria-label="HTTP status">404</p>

        <h1>We couldn't find that page</h1>
        <p class="supporting">
          The link may be broken, or the page may have been moved.
        </p>

        <div class="actions">
          <atom-button variant="primary" (click)="goToDashboard()">
            Go to your dashboard
          </atom-button>

          @if (canGoBack()) {
            <button
              type="button"
              class="back-link"
              data-testid="go-back"
              (click)="goBack()"
            >Go back</button>
          }
        </div>
      </article>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .not-found-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--color-page-bg);
      padding: 24px;
      box-sizing: border-box;
    }
    .not-found-card {
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
    .error-code {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      color: var(--color-muted);
      background: var(--color-surface-subtle);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 0 16px;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-text);
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
    .back-link {
      background: transparent;
      border: none;
      color: var(--color-primary);
      font-size: 14px;
      cursor: pointer;
      padding: 8px 16px;
      font-family: inherit;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    .back-link:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
      border-radius: 4px;
    }
  `],
})
export class NotFoundPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * Show the "Go back" link only when there is something to go back
   * to. A cold load (page opened directly, no in-app history) has
   * history.length === 1, and the back arrow would just reload the
   * 404. Hide the affordance in that case.
   */
  readonly canGoBack = computed<boolean>(() => {
    return typeof history !== 'undefined' && history.length > 1;
  });

  goToDashboard(): void {
    void this.router.navigateByUrl(this.auth.roleHomePath());
  }

  goBack(): void {
    this.location.back();
  }
}