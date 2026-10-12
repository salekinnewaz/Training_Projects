import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Register placeholder — wireframe-gap fix.
 *
 * The login page now exposes a "Register" link (per UX wireframe
 * audit). Self-registration is out of MVP scope (per
 * `_bmad-output/planning-artifacts/ux/ux-HelpDesk-Lite-2026-09-06/EXPERIENCE.md`
 * Sitemap — `/register` is listed but the flow is not yet built).
 *
 * This page keeps the route addressable so the login link resolves
 * to a friendly notice instead of a 404. Matches the existing
 * `forgot-password-page` placeholder pattern. When registration
 * ships, the route's loadComponent will be replaced with the real
 * form; the selector + class name pattern here is preserved for
 * the same reason.
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Register</h1>
        <p class="placeholder-subtitle">
          Self-registration is not available yet.
          <br />Accounts are provisioned by your administrator.
        </p>
        <p class="placeholder-subtitle" style="margin-top: 16px;">
          <a routerLink="/login">Back to sign in</a>
        </p>
      </div>
    </section>
  `,
})
export class RegisterPageComponent {}
