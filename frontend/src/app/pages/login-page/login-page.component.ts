/**
 * LoginPageComponent — HD-005 + D4.
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
 * D4 added the `rate_limited` switch case in `applyApiError`:
 * when the backend's `loginRateLimiter` returns 429
 * `rate_limited` (after 10 wrong-password attempts in 15
 * minutes), the password field renders "Too many attempts.
 * Please wait a moment." — same field + same focus-restoration
 * shape as the `invalid_credentials` and `account_inactive`
 * cases. See
 * `_bmad-output/implementation-artifacts/spec-d4-rate-limited.md`.
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
import { ActivatedRoute, Router } from '@angular/router';

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
const RATE_LIMITED = 'Too many attempts. Please wait a moment.';
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
    <section class="login-page" id="main-content">
      <aside class="login-hero" aria-hidden="true">
        <div class="hero-bg"></div>
        <div class="hero-orb hero-orb-1"></div>
        <div class="hero-orb hero-orb-2"></div>
        <div class="hero-orb hero-orb-3"></div>

        <div class="hero-content">
          <div class="hero-brand">
            <span class="hero-brand-mark">HL</span>
            <span class="hero-brand-text">HelpDesk Lite</span>
          </div>

          <h1 class="hero-headline">
            One queue.<br />
            <span class="hero-headline-accent">Zero chaos.</span>
          </h1>
          <p class="hero-subhead">
            Triage, assign, and resolve support requests in one calm,
            focused workspace — built for teams of 5 to 20.
          </p>

          <ul class="hero-features">
            <li>
              <span class="hero-feature-icon">
                <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                  <path d="M4 10l3 3 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Trello-style board for agents
            </li>
            <li>
              <span class="hero-feature-icon">
                <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                  <path d="M4 10l3 3 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Full ticket history &amp; comments
            </li>
            <li>
              <span class="hero-feature-icon">
                <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                  <path d="M4 10l3 3 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Reopen with one click
            </li>
          </ul>
        </div>
      </aside>

      <main class="login-form-pane">
        <article class="login-card">
          <header class="brand">
            <span class="brand-mark" aria-hidden="true">HL</span>
            <span class="brand-wordmark">HelpDesk Lite</span>
          </header>

          <h1 class="login-title">Welcome back</h1>
          <p class="login-subtitle">Sign in to continue to your dashboard.</p>

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

            <div class="helper-row">
              <label class="remember-label">
                <input
                  type="checkbox"
                  id="remember-me"
                  data-testid="remember-me"
                  [checked]="rememberMe()"
                  (change)="onRememberMeChange($event)"
                  [disabled]="submitting()"
                />
                <span>Remember me</span>
              </label>
              <a class="forgot-link" href="/forgot-password" data-testid="forgot-password-link">Forgot password?</a>
            </div>

            <atom-button
              type="submit"
              variant="primary"
              [disabled]="!form.controls.email.value || !form.controls.password.value"
              [loading]="submitting()"
            >
              {{ submitting() ? 'Signing in…' : 'Sign in' }}
            </atom-button>

            <div class="register-row">
              <span class="register-copy">Don&apos;t have an account?</span>
              <a
                class="register-link"
                href="/register"
                data-testid="register-link"
              >Register</a>
            </div>
          </form>
        </article>
      </main>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .login-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      background: var(--color-page-bg);
      overflow: hidden;
    }

    /* ── Hero panel (left, gradient) ──────────────────────────── */
    .login-hero {
      position: relative;
      background: var(--gradient-hero);
      color: var(--color-text-inverse);
      overflow: hidden;
      display: flex;
      align-items: center;
      padding: 64px 56px;
      isolation: isolate;
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
      opacity: 0.5;
      z-index: -2;
    }
    .hero-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.5;
      z-index: -1;
      animation: float 8s ease-in-out infinite;
    }
    .hero-orb-1 {
      width: 360px;
      height: 360px;
      background: #EC4899;
      top: -120px;
      left: -100px;
      animation-delay: 0s;
    }
    .hero-orb-2 {
      width: 420px;
      height: 420px;
      background: #06B6D4;
      bottom: -160px;
      right: -120px;
      animation-delay: 2s;
    }
    .hero-orb-3 {
      width: 240px;
      height: 240px;
      background: #FBBF24;
      top: 50%;
      left: 60%;
      animation-delay: 4s;
    }
    .hero-content {
      max-width: 520px;
      animation: fadeInUp 700ms var(--ease-out) both;
    }
    .hero-brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px 8px 8px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.20);
      border-radius: 999px;
      backdrop-filter: blur(12px);
      margin-bottom: 32px;
      font-weight: 600;
      font-size: 14px;
    }
    .hero-brand-mark {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      background: var(--color-surface);
      color: var(--color-primary);
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }
    .hero-headline {
      font-size: 56px;
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--color-text-inverse);
      margin: 0 0 20px;
    }
    .hero-headline-accent {
      background: linear-gradient(135deg, #FBBF24 0%, #F472B6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-subhead {
      font-size: 17px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.85);
      margin: 0 0 36px;
      font-weight: 400;
    }
    .hero-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .hero-features li {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 500;
    }
    .hero-feature-icon {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.18);
      border-radius: 50%;
      color: var(--color-text-inverse);
      flex-shrink: 0;
    }

    /* ── Form pane (right) ───────────────────────────────────── */
    .login-form-pane {
      display: grid;
      place-items: center;
      padding: 32px;
      background: var(--color-surface);
      animation: fadeIn 600ms var(--ease-out) both;
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      background: transparent;
      padding: 0;
      box-shadow: none;
      box-sizing: border-box;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 40px;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      background: var(--gradient-brand);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      box-shadow: var(--shadow-button);
    }
    .brand-wordmark {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .login-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      text-align: left;
      margin: 0 0 6px;
      letter-spacing: -0.02em;
    }
    .login-subtitle {
      font-size: 15px;
      color: var(--color-label);
      margin: 0 0 32px;
    }
    .fields {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-bottom: 24px;
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
      margin-top: 4px;
    }
    .helper-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0 0 20px;
      font-size: 14px;
    }
    .remember-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--color-label);
      cursor: pointer;
      user-select: none;
      font-weight: 500;
    }
    .remember-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
      accent-color: var(--color-primary);
      border-radius: 4px;
    }
    .forgot-link {
      color: var(--color-primary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color var(--duration-fast) var(--ease-out);
    }
    .forgot-link:hover {
      color: var(--color-primary-deep);
      text-decoration: underline;
    }
    .register-row {
      margin-top: 24px;
      text-align: center;
      font-size: 14px;
      color: var(--color-muted);
    }
    .register-link {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
      margin-left: 4px;
    }
    .register-link:hover {
      color: var(--color-primary-deep);
      text-decoration: underline;
    }
    .register-copy {
      color: var(--color-muted);
    }

    /* ── Responsive: stack hero above form on tablet/mobile ─────── */
    @media (max-width: 960px) {
      .login-page {
        grid-template-columns: 1fr;
      }
      .login-hero {
        padding: 40px 28px;
        min-height: 240px;
      }
      .hero-headline {
        font-size: 36px;
      }
      .hero-subhead {
        font-size: 15px;
        margin-bottom: 20px;
      }
      .hero-features {
        display: none;
      }
      .login-form-pane {
        padding: 32px 24px;
      }
    }
    @media (max-width: 520px) {
      .login-hero {
        padding: 28px 20px;
      }
      .hero-brand {
        margin-bottom: 20px;
      }
      .hero-headline {
        font-size: 28px;
      }
      .login-form-pane {
        padding: 28px 20px;
      }
    }
  `],
})
export class LoginPageComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Validated deep-link target. Null when absent, malformed, or unsafe. */
  private returnTo: string | null = null;

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
  /**
   * Local-only "remember me" toggle. Per the MVP wireframe note,
   * this is a UI affordance only — the actual cookie persistence
   * behavior is unchanged (the JWT cookie is httpOnly and rides
   * the same way regardless of this checkbox). We keep the state
   * here so the checkbox renders deterministically through OnPush
   * change detection.
   */
  readonly rememberMe = signal(false);

  @ViewChild('emailInput', { static: false })
  private readonly emailInput?: ElementRef<HTMLElement>;

  @ViewChild('passwordInput', { static: false })
  private readonly passwordInput?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    // Read & validate the optional ?return_to= deep-link target
    // (added by authGuard). Must start with `/` and not contain `//`
    // or `\\` — that combination rejects absolute URLs ("https://evil"),
    // protocol-relative URLs ("//evil"), backslash-bypass attempts
    // ("/\evil" — WHATWG URL parser normalizes `\` to `/`),
    // and bare paths ("foo"). A bare `/` is also treated as null
    // so a successful login doesn't bounce through the `''` redirect.
    const raw = this.route.snapshot.queryParamMap.get('return_to') ?? '';
    const isSafeSpaPath =
      raw.startsWith('/') &&
      raw !== '/' &&
      !raw.includes('//') &&
      !raw.includes('\\');
    if (isSafeSpaPath) {
      this.returnTo = raw;
    } else if (raw) {
      // Open-redirect attempt or malformed value. Fall back to the
      // role-correct home — logged in dev only, no UI noise so the
      // user isn't tipped off about the protection in place.
      // eslint-disable-next-line no-console
      console.warn('[hd-006] rejected unsafe return_to:', raw);
      this.returnTo = null;
    }

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

  onRememberMeChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.rememberMe.set(target?.checked ?? false);
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
      await this.router.navigateByUrl(this.returnTo ?? this.auth.roleHomePath());
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
        case 'rate_limited':
          mapped = RATE_LIMITED;
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
