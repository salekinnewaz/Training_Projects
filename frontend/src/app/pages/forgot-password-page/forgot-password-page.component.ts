import { Component } from '@angular/core';

/**
 * Forgot password placeholder.
 *
 * Out of MVP for HD-001 — the password reset flow itself is a
 * separate page spec deferred past MVP scope. The placeholder
 * keeps the route addressable so the Login page's "Forgot password?"
 * link resolves without a 404 during demo.
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Reset password</h1>
        <p class="placeholder-subtitle">
          Coming soon — password reset flow is out of MVP scope.
          <br />Route: <code>/forgot-password</code>
        </p>
      </div>
    </section>
  `,
})
export class ForgotPasswordPageComponent {}
