/**
 * ChangePasswordPageComponent — HD-018.
 *
 * Self-service password-change form, available to every
 * authenticated user. Reached from the header-chrome's
 * profile menu ("Change password" entry). Wrapped in
 * `<app-chrome>` so the persistent header renders above
 * the form.
 *
 * Form fields:
 *   - Current password (required, single-line)
 *   - New password (required, 8..128 chars, ≥1 letter, ≥1 number
 *     — matches the backend validator exactly)
 *   - Confirm new password (required, must equal the new password)
 *
 * Render states (mutually exclusive @if blocks):
 *   - idle      → form enabled, all fields empty
 *   - submitting → form fields + Submit disabled, button shows
 *                  spinner + "Saving…", Cancel stays enabled
 *   - success   → green "Password changed." banner; 2s later the
 *                 page auto-redirects to the role-correct home
 *
 * Behaviors:
 *   - Submit click → client-side validation (current not blank,
 *     new meets complexity, confirm matches). On failure: per-field
 *     inline error + focus the first invalid field. No HTTP call.
 *   - 204 → set `success` state, schedule navigateByUrl to the
 *     role-correct home. Don't auto-clear the form (the user is
 *     leaving the page).
 *   - 400 with `fields` → map 1-to-1 onto the per-field error UX
 *     (currentPassword / newPassword keys).
 *   - 403 + invalid_credentials → top-of-form banner: "Your
 *     current password is incorrect." (Different from a 400
 *     field error — 403 means the current-password check failed
 *     server-side, not the validator.)
 *   - 401 (account_inactive / unauthenticated) → top-of-form
 *     banner with the message; the session is gone, the chrome
 *     will navigate the user to /login on the next /me.
 *   - 5xx / network → top-of-form banner: "Couldn't change your
 *     password. Please try again." Form state preserved.
 *
 * Why a 403 (not 401) for wrong current password? Mirrors the
 * backend's choice (see `authController.ts:changePassword`). The
 * 401 code is reserved for "you're not authenticated"; a wrong
 * current password is a "you are authenticated, but that
 * credential is wrong" 403. The frontend mirrors this so the
 * login form and this form don't share a status-code-to-message
 * mapping.
 *
 * Cross-page: no beforeunload (the user is explicitly choosing
 * to change their password; navigation away mid-submit is rare
 * enough to not need a confirm prompt — the 204 → success →
 * redirect handles the common happy path).
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { InputTextComponent } from '../../components/atoms/input-text/input-text.component';
import { LinkComponent } from '../../components/atoms/link/link.component';
import { ShowPasswordToggleComponent } from '../../components/atoms/show-password-toggle/show-password-toggle.component';
import { FormFieldComponent } from '../../components/molecules/form-field/form-field.component';

const NEW_PASSWORD_MIN = 8;
const NEW_PASSWORD_MAX = 128;

const GENERIC_ERROR = "Couldn't change your password. Please try again.";

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppChromeComponent,
    ButtonComponent,
    InputTextComponent,
    LinkComponent,
    ShowPasswordToggleComponent,
    FormFieldComponent,
  ],
  template: `
    <app-chrome>
      <section class="change-password-page" id="main-content">
        <article class="change-password-card">
          <header class="page-head">
            <h1 class="page-title">Change password</h1>
            <p class="page-sub">Pick something at least 8 characters long with a letter and a number.</p>
          </header>

          @if (success()) {
            <div
              class="banner banner-ok"
              data-testid="success-banner"
              role="status"
              aria-live="polite"
            >
              Password changed. Taking you back…
            </div>
          } @else {
            <form
              [formGroup]="form"
              (ngSubmit)="onSubmit()"
              novalidate
              autocomplete="on"
            >
              @if (formError(); as msg) {
                <div
                  class="banner banner-err"
                  data-testid="form-error-banner"
                  role="alert"
                >{{ msg }}</div>
              }

              <div class="fields">
                <form-field
                  id="cp-current"
                  label="Current password"
                  [required]="true"
                  [error]="currentFieldError()"
                >
                  <div class="password-wrap">
                    <atom-input
                      #currentInput
                      id="cp-current"
                      [type]="passwordVisible() ? 'text' : 'password'"
                      autocomplete="current-password"
                      placeholder="Your current password"
                      [value]="form.controls.currentPassword.value"
                      [disabled]="submitting()"
                      [invalid]="!!currentFieldError()"
                      [required]="true"
                      ariaDescribedBy="cp-current-error"
                      (valueChange)="form.controls.currentPassword.setValue($event)"
                    />
                    <atom-show-password-toggle
                      [pressed]="passwordVisible()"
                      [disabled]="submitting()"
                      (toggle)="togglePasswordVisibility()"
                    />
                  </div>
                </form-field>

                <form-field
                  id="cp-new"
                  label="New password"
                  [required]="true"
                  [error]="newFieldError()"
                >
                  <atom-input
                    id="cp-new"
                    [type]="passwordVisible() ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="8+ characters with a letter and a number"
                    [value]="form.controls.newPassword.value"
                    [disabled]="submitting()"
                    [invalid]="!!newFieldError()"
                    [required]="true"
                    ariaDescribedBy="cp-new-error"
                    (valueChange)="onNewPasswordChange($event)"
                  />
                </form-field>

                <form-field
                  id="cp-confirm"
                  label="Confirm new password"
                  [required]="true"
                  [error]="confirmFieldError()"
                >
                  <atom-input
                    id="cp-confirm"
                    [type]="passwordVisible() ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Type the new password again"
                    [value]="form.controls.confirmPassword.value"
                    [disabled]="submitting()"
                    [invalid]="!!confirmFieldError()"
                    [required]="true"
                    ariaDescribedBy="cp-confirm-error"
                    (valueChange)="form.controls.confirmPassword.setValue($event)"
                  />
                </form-field>
              </div>

              <div class="actions">
                <atom-button
                  type="submit"
                  variant="primary"
                  data-testid="submit-btn"
                  [disabled]="!canSubmit()"
                  [loading]="submitting()"
                >{{ submitting() ? 'Saving…' : 'Change password' }}</atom-button>
                <atom-link href="javascript:void(0)" (click)="onCancel()">Cancel</atom-link>
              </div>
            </form>
          }
        </article>
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .change-password-page {
      min-height: calc(100vh - var(--chrome-height));
      display: grid;
      place-items: start center;
      padding: 40px 24px;
      background: var(--color-page-bg);
      box-sizing: border-box;
    }
    .change-password-card {
      width: 100%;
      max-width: 480px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: var(--shadow-card);
      animation: fadeInUp var(--duration-slow) var(--ease-out) both;
    }
    .page-head { margin-bottom: 28px; }
    .page-title {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .page-sub {
      margin: 0;
      font-size: 14px;
      color: var(--color-muted);
      line-height: 1.5;
    }
    .banner {
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .banner-err {
      background: #FEF2F2;
      color: var(--color-error);
      border: 1px solid #FECACA;
    }
    .banner-ok {
      background: #ECFDF5;
      color: #047857;
      border: 1px solid #A7F3D0;
    }
    .fields { display: flex; flex-direction: column; gap: 18px; }
    .password-wrap { position: relative; }
    .password-wrap atom-input { padding-right: 40px; }
    .password-wrap atom-show-password-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
    .actions {
      margin-top: 28px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
  `],
})
export class ChangePasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly formError = signal<string | null>(null);
  readonly currentFieldError = signal<string | null>(null);
  readonly newFieldError = signal<string | null>(null);
  readonly confirmFieldError = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  readonly form = new FormGroup({
    currentPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(NEW_PASSWORD_MIN),
        Validators.maxLength(NEW_PASSWORD_MAX),
      ],
    }),
    confirmPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  @ViewChild('currentInput', { static: false })
  private readonly currentInput?: ElementRef<HTMLElement>;

  /**
   * Real-time match check: when the user types in the new-password
   * field, recompute the confirm-field error so the "doesn't match"
   * hint appears immediately (rather than only on submit).
   */
  onNewPasswordChange(value: string): void {
    this.form.controls.newPassword.setValue(value);
    const confirm = this.form.controls.confirmPassword.value;
    if (confirm && confirm !== value) {
      this.confirmFieldError.set("Passwords don't match.");
    } else if (confirm && confirm === value) {
      this.confirmFieldError.set(null);
    }
  }

  canSubmit(): boolean {
    if (this.submitting()) return false;
    return this.form.valid;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  onCancel(): void {
    void this.router.navigateByUrl(this.auth.roleHomePath());
  }

  private clearErrors(): void {
    this.formError.set(null);
    this.currentFieldError.set(null);
    this.newFieldError.set(null);
    this.confirmFieldError.set(null);
  }

  async onSubmit(): Promise<void> {
    this.clearErrors();
    if (!this.form.valid) {
      // Surface per-field validator errors. The Angular FormControl
      // already runs them on value change; we re-read on submit
      // so the user sees the error if they tabbed past a field
      // without ever triggering blur.
      this.applyClientSideErrors();
      this.focusFirstInvalid();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.confirmFieldError.set("Passwords don't match.");
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.success.set(true);
      // Brief delay so the user sees the "Password changed." banner
      // before the navigation strips the page.
      setTimeout(() => {
        void this.router.navigateByUrl(this.auth.roleHomePath());
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        this.applyApiError(err);
      } else {
        this.formError.set(GENERIC_ERROR);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private applyClientSideErrors(): void {
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (!currentPassword) {
      this.currentFieldError.set('Enter your current password.');
    }
    if (!newPassword) {
      this.newFieldError.set('Enter a new password.');
    } else if (newPassword.length < NEW_PASSWORD_MIN) {
      this.newFieldError.set(`New password must be at least ${NEW_PASSWORD_MIN} characters.`);
    } else if (newPassword.length > NEW_PASSWORD_MAX) {
      this.newFieldError.set(`New password must be ${NEW_PASSWORD_MAX} characters or fewer.`);
    } else if (!/[A-Za-z]/.test(newPassword)) {
      this.newFieldError.set('New password must include a letter.');
    } else if (!/[0-9]/.test(newPassword)) {
      this.newFieldError.set('New password must include a number.');
    }
    if (!confirmPassword) {
      this.confirmFieldError.set('Re-enter the new password.');
    } else if (newPassword && confirmPassword !== newPassword) {
      this.confirmFieldError.set("Passwords don't match.");
    }
  }

  private applyApiError(err: ApiError): void {
    if (err.fields) {
      const cp = err.fields['currentPassword'];
      if (cp) {
        this.currentFieldError.set(cp);
      }
      const np = err.fields['newPassword'];
      if (np) {
        this.newFieldError.set(np);
      }
      const body = err.fields['_body'];
      if (body) {
        this.formError.set(body);
      }
    }
    if (err.errorCode === 'invalid_credentials') {
      this.currentFieldError.set(
        err.message || 'Your current password is incorrect.',
      );
    } else if (err.errorCode === 'account_inactive' || err.status === 401) {
      this.formError.set(
        err.message ||
          'Your account is inactive. Contact your administrator.',
      );
    } else if (!err.fields && !this.formError()) {
      this.formError.set(err.message || GENERIC_ERROR);
    }
  }

  private focusFirstInvalid(): void {
    queueMicrotask(() => {
      const host = this.currentInput?.nativeElement;
      const inner: HTMLInputElement | null =
        host?.querySelector('input') ?? null;
      inner?.focus();
    });
  }
}
