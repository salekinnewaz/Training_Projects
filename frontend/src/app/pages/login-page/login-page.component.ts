/**
 * LoginPageComponent — HD-005.
 *
 * Public, unauthenticated sign-in page. Renders a centered card
 * with a reactive email/password form. On successful login the
 * user is redirected to their role-correct dashboard via
 * `AuthService.roleHomePath()` — no intermediate "you're signed in"
 * page.
 *
 * The form never calls /me on its own — that would force a
 * guaranteed 401 round-trip on every visit. The route guard
 * (HD-006) will own the "already authenticated → bounce to
 * dashboard" behaviour.
 *
 * Selector + class name are preserved from the HD-001 placeholder
 * so the lazy route in app.routes.ts keeps working.
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { InputTextComponent } from '../../components/atoms/input-text/input-text.component';
import { LinkComponent } from '../../components/atoms/link/link.component';
import { ShowPasswordToggleComponent } from '../../components/atoms/show-password-toggle/show-password-toggle.component';
import { FormFieldComponent } from '../../components/molecules/form-field/form-field.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailRegexValidator(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value ?? '').toString().trim();
  if (raw === '') return null; // emptiness is handled by Validators.required
  return EMAIL_RE.test(raw) ? null : { emailFormat: true };
}

/**
 * Rejects whitespace-only values. `Validators.required` lets "   "
 * through because the string is non-empty; backend then 400s with
 * an opaque validation_error. Catch it client-side instead.
 */
function nonBlankValidator(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value ?? '').toString();
  if (raw.length === 0) return null; // emptiness is required's job
  return raw.trim().length > 0 ? null : { blank: true };
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

const WRONG_CREDS = 'Email or password is incorrect. Try again.';
const INACTIVE_ACCOUNT = 'Your account is inactive. Contact your administrator.';
const EMAIL_FORMAT_CLIENT = 'Enter a valid email address.';
const PASSWORD_REQUIRED = 'Enter your password.';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    InputTextComponent,
    LinkComponent,
    ShowPasswordToggleComponent,
    FormFieldComponent,
  ],
  template: `
    <section class="login-page">
      <article class="login-card">
        <header class="brand">
          <span class="brand-mark" aria-hidden="true">HL</span>
          <span class="brand-wordmark">HelpDesk Lite</span>
        </header>

        <h1 class="visually-hidden">Sign in</h1>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          novalidate
          autocomplete="on"
        >
          <div class="fields">
            <form-field
              id="login-email"
              label="Email"
              [required]="true"
              [error]="emailFieldError()"
            >
              <atom-input
                #emailInput
                id="login-email"
                type="email"
                autocomplete="email"
                placeholder="you@company.com"
                [value]="form.controls.email.value"
                [disabled]="submitting()"
                [invalid]="!!emailFieldError()"
                [required]="true"
                ariaDescribedBy="login-email-error"
                (valueChange)="form.controls.email.setValue($event)"
              />
            </form-field>

            <form-field
              id="login-password"
              label="Password"
              [required]="true"
              [error]="passwordFieldError()"
            >
              <div class="password-wrap">
                <atom-input
                  #passwordInput
                  id="login-password"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="Your password"
                  [value]="form.controls.password.value"
                  [disabled]="submitting()"
                  [invalid]="!!passwordFieldError()"
                  [required]="true"
                  ariaDescribedBy="login-password-error"
                  (valueChange)="form.controls.password.setValue($event)"
                />
                <atom-show-password-toggle
                  [pressed]="passwordVisible()"
                  [disabled]="submitting()"
                  (toggle)="togglePasswordVisibility()"
                />
              </div>
            </form-field>
          </div>

          <atom-button
            type="submit"
            variant="primary"
            [disabled]="!form.controls.email.value || !form.controls.password.value"
            [loading]="submitting()"
          >
            {{ submitting() ? 'Logging in…' : 'Log in' }}
          </atom-button>

          <div class="forgot-row">
            <atom-link href="/forgot-password">Forgot password?</atom-link>
          </div>
        </form>
      </article>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .login-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--color-page-bg);
      padding: 24px;
      box-sizing: border-box;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 48px 40px;
      box-shadow: var(--shadow-dropdown);
      box-sizing: border-box;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      background: var(--color-primary);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .brand-wordmark {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .fields {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 32px;
    }
    .password-wrap {
      position: relative;
    }
    .password-wrap atom-input {
      /* leave room for the toggle so the typed text never slides
         under the icon */
      padding-right: 40px;
    }
    .password-wrap atom-show-password-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
    form > atom-button {
      display: block;
      width: 100%;
    }
    .forgot-row {
      margin-top: 16px;
      text-align: center;
    }
  `],
})
export class LoginPageComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, emailRegexValidator],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
  });

  readonly submitting = signal(false);
  readonly emailFieldError = signal<string | null>(null);
  readonly passwordFieldError = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  @ViewChild('emailInput', { static: false })
  private readonly emailInput?: ElementRef<HTMLElement>;

  @ViewChild('passwordInput', { static: false })
  private readonly passwordInput?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    // Auto-focus the email input on page load (UX spec).
    // ViewChild is unresolved at construction time, but resolves
    // after the first CD cycle — wrap in queueMicrotask so the
    // host element is fully painted.
    queueMicrotask(() => this.focusEmailInput());
  }

  private focusEmailInput(): void {
    const host = this.emailInput?.nativeElement;
    const inner: HTMLInputElement | null =
      host?.querySelector('input') ?? null;
    inner?.focus();
  }

  private focusPasswordInput(): void {
    const host = this.passwordInput?.nativeElement;
    const inner: HTMLInputElement | null =
      host?.querySelector('input') ?? null;
    inner?.focus();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  async onSubmit(): Promise<void> {
    // Clear previous errors so re-submitting fresh doesn't show stale UI.
    this.emailFieldError.set(null);
    this.passwordFieldError.set(null);

    this.form.controls.email.markAsTouched();
    this.form.controls.password.markAsTouched();

    if (this.form.invalid) {
      const emailInvalid =
        this.form.controls.email.invalid ||
        (this.form.controls.email.value ?? '').trim() === '';
      const passwordInvalid =
        this.form.controls.password.invalid ||
        (this.form.controls.password.value ?? '').trim() === '';

      if (emailInvalid) {
        this.emailFieldError.set(EMAIL_FORMAT_CLIENT);
      }
      if (passwordInvalid) {
        this.passwordFieldError.set(PASSWORD_REQUIRED);
      }

      // Re-focus the most relevant invalid field (UX spec):
      // email when email is invalid, otherwise password.
      queueMicrotask(() => {
        if (emailInvalid) {
          this.focusEmailInput();
        } else {
          this.focusPasswordInput();
        }
      });
      return;
    }

    const email = this.form.controls.email.value.trim();
    const password = this.form.controls.password.value;

    this.submitting.set(true);
    try {
      await this.auth.login(email, password);
      await this.router.navigateByUrl(this.auth.roleHomePath());
    } catch (err) {
      this.applyApiError(err);
    } finally {
      this.submitting.set(false);
    }
  }

  private applyApiError(err: unknown): void {
    let mapped: string | null = null;
    let target: 'password' | 'email' = 'password';

    if (err instanceof ApiError) {
      switch (err.errorCode) {
        case 'invalid_credentials':
          mapped = WRONG_CREDS;
          target = 'password';
          break;
        case 'account_inactive':
          mapped = INACTIVE_ACCOUNT;
          target = 'password';
          break;
        case 'validation_error': {
          // backend's field-level messages land in `err.fields`
          const fields = err.fields ?? {};
          const emailMsg = fields['email'];
          const passwordMsg = fields['password'];
          if (emailMsg) {
            this.emailFieldError.set(emailMsg);
            target = 'email';
          }
          if (passwordMsg) {
            this.passwordFieldError.set(passwordMsg);
            // No explicit "general" target — fields are surface-level.
          }
          if (!emailMsg && !passwordMsg) {
            this.passwordFieldError.set(GENERIC_ERROR);
          }
          queueMicrotask(() => {
            if (target === 'email') this.focusEmailInput();
            else this.focusPasswordInput();
          });
          return;
        }
        case 'network_error':
        case 'internal_server_error':
        case 'unknown_error':
          mapped = GENERIC_ERROR;
          target = 'password';
          break;
        default:
          // forbidden / not_found / not_implemented / unauthenticated /
          // invalid_token — defensive; shouldn't happen on /login.
          mapped = GENERIC_ERROR;
          target = 'password';
          break;
      }
    } else {
      mapped = GENERIC_ERROR;
      target = 'password';
    }

    if (target === 'password') {
      this.passwordFieldError.set(mapped);
    } else {
      this.emailFieldError.set(mapped);
    }

    // Restore focus to the most relevant field (UX spec: on 401
    // "email gains focus").
    if (err instanceof ApiError && err.errorCode === 'invalid_credentials') {
      queueMicrotask(() => this.focusEmailInput());
    } else {
      queueMicrotask(() => this.focusPasswordInput());
    }
  }
}
