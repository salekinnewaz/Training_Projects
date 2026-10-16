/**
 * LoginPageComponent — HD-005 + D4.
 *
 * Public, unauthenticated sign-in page. Renders a two-column
 * marketing shell + sign-in card. On successful login the user
 * is redirected to their role-correct dashboard via
 * `AuthService.roleHomePath()`.
 *
 * The form never calls /me on its own — that would force a
 * guaranteed 401 round-trip on every visit. The route guard
 * (HD-006) owns the "already authenticated → bounce to
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
      <!-- Left column: brand + hero + feature list + illustration -->
      <aside class="marketing-pane">
        <header class="marketing-brand">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 14a9 9 0 0 1 18 0v3a2 2 0 0 1-2 2h-1v-7h3" />
              <path d="M3 14v3a2 2 0 0 0 2 2h1v-7H3" />
            </svg>
          </span>
          <span class="brand-wordmark">HelpDesk Lite</span>
        </header>

        <div class="marketing-content">
          <h1 class="hero">
            Support<br />
            made <span class="hero-accent">simple.</span>
          </h1>
          <p class="hero-sub">
            Create tickets, track your requests, and get<br />
            help from the right people — all in one place.
          </p>

          <ul class="feature-list">
            <li class="feature-row">
              <span class="feature-icon feature-icon--bolt" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              <span class="feature-text">
                <span class="feature-title">Quick ticket submission</span>
                <span class="feature-sub">Get help in just a few clicks</span>
              </span>
            </li>
            <li class="feature-row">
              <span class="feature-icon feature-icon--chat" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7
                           8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8
                           8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48
                           8.48 0 0 1 8 8v.5z" />
                </svg>
              </span>
              <span class="feature-text">
                <span class="feature-title">Track your requests</span>
                <span class="feature-sub">Stay updated in real time</span>
              </span>
            </li>
            <li class="feature-row">
              <span class="feature-icon feature-icon--book" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </span>
              <span class="feature-text">
                <span class="feature-title">Find answers easily</span>
                <span class="feature-sub">Explore our knowledge base</span>
              </span>
            </li>
          </ul>
        </div>

        <!--
          Decorative illustration: an inline SVG that captures the
          "person on a bean bag with floating chat bubbles" idea
          from the wireframe. We don't ship a raster asset to keep
          the bundle slim and the look crisp on any DPR.
        -->
        <div class="marketing-illustration" aria-hidden="true">
          <svg viewBox="0 0 460 320" xmlns="http://www.w3.org/2000/svg"
               width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="bgWave" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#EEF2FF" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#F5F3FF" stop-opacity="0.9" />
              </linearGradient>
              <linearGradient id="beanBag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#6366F1" />
                <stop offset="100%" stop-color="#4F46E5" />
              </linearGradient>
              <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#7C8DFA" />
                <stop offset="100%" stop-color="#6366F1" />
              </linearGradient>
            </defs>

            <!-- soft background blob -->
            <ellipse cx="230" cy="180" rx="210" ry="120" fill="url(#bgWave)" />

            <!-- plant on the left -->
            <g transform="translate(36 188)">
              <ellipse cx="20" cy="92" rx="22" ry="6" fill="#E2E8F0" />
              <path d="M0 90 Q4 60 20 50 Q36 60 40 90 Z" fill="#E5E7EB" />
              <path d="M10 60 Q-2 30 6 4 Q24 18 18 56 Z" fill="#34D399" />
              <path d="M28 60 Q40 30 32 4 Q14 18 22 56 Z" fill="#10B981" />
              <path d="M19 60 Q19 30 19 8" stroke="#065F46" stroke-width="1.5"
                    fill="none" stroke-linecap="round" />
            </g>

            <!-- bean bag / cushion -->
            <ellipse cx="260" cy="240" rx="150" ry="44" fill="url(#beanBag)" />
            <ellipse cx="260" cy="232" rx="150" ry="40" fill="#6366F1" />
            <ellipse cx="260" cy="226" rx="135" ry="32" fill="#7C8DFA"
                     opacity="0.55" />

            <!-- person -->
            <g transform="translate(180 92)">
              <!-- head -->
              <circle cx="40" cy="34" r="26" fill="#F4D7B5" />
              <!-- hair -->
              <path d="M14 32 Q14 6 40 6 Q66 6 66 32 Q66 22 56 20
                       Q44 14 32 18 Q22 22 14 32 Z" fill="#1F2937" />
              <!-- shirt / torso -->
              <path d="M-6 70 Q-6 60 18 56 L62 56 Q86 60 86 70
                       L82 138 L-2 138 Z" fill="url(#shirt)" />
              <!-- arms -->
              <path d="M-6 70 Q-14 96 -2 124 L18 122 L18 78 Z"
                    fill="#7C8DFA" />
              <path d="M86 70 Q94 96 82 124 L62 122 L62 78 Z"
                    fill="#7C8DFA" />
              <!-- pants -->
              <path d="M0 138 L34 138 L34 210 L8 210 Z" fill="#1F2937" />
              <path d="M34 138 L68 138 L74 210 L34 210 Z" fill="#111827" />
              <!-- shoes -->
              <ellipse cx="20" cy="214" rx="18" ry="6" fill="#F8FAFC" />
              <ellipse cx="60" cy="214" rx="18" ry="6" fill="#F8FAFC" />
              <!-- laptop on lap -->
              <rect x="14" y="116" width="56" height="36" rx="3"
                    fill="#E2E8F0" />
              <rect x="14" y="116" width="56" height="6" rx="2"
                    fill="#CBD5E1" />
              <rect x="22" y="124" width="40" height="22" rx="1"
                    fill="#F8FAFC" />
            </g>

            <!-- chat bubbles -->
            <g transform="translate(286 28)">
              <rect x="0" y="0" width="62" height="42" rx="10" fill="#6366F1" />
              <path d="M10 42 L14 50 L18 42 Z" fill="#6366F1" />
              <rect x="10" y="14" width="42" height="3" rx="1.5" fill="#fff" opacity="0.95" />
              <rect x="10" y="22" width="32" height="3" rx="1.5" fill="#fff" opacity="0.7" />
            </g>
            <g transform="translate(360 92)">
              <circle cx="20" cy="20" r="20" fill="#A7F3D0" />
              <path d="M12 20 l5 5 l11 -10" stroke="#047857" stroke-width="3"
                    fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <g transform="translate(338 152)">
              <rect x="0" y="0" width="44" height="50" rx="6" fill="#C4B5FD" />
              <rect x="6" y="6" width="32" height="3" rx="1.5" fill="#5B21B6" opacity="0.8" />
              <rect x="6" y="14" width="22" height="3" rx="1.5" fill="#5B21B6" opacity="0.6" />
              <rect x="6" y="22" width="28" height="3" rx="1.5" fill="#5B21B6" opacity="0.6" />
            </g>

            <!-- dashed orbit -->
            <path d="M120 60 Q260 -10 410 80" stroke="#A5B4FC"
                  stroke-width="2" stroke-dasharray="2 6" fill="none"
                  stroke-linecap="round" />
          </svg>
        </div>
      </aside>

      <!-- Right column: sign-in card -->
      <main class="signin-pane">
        <article class="signin-card">
          <header class="card-brand">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 14a9 9 0 0 1 18 0v3a2 2 0 0 1-2 2h-1v-7h3" />
                <path d="M3 14v3a2 2 0 0 0 2 2h1v-7H3" />
              </svg>
            </span>
            <span class="brand-wordmark">HelpDesk Lite</span>
          </header>

          <h2 class="card-title">Welcome back</h2>
          <p class="card-subtitle">Sign in to your account to continue</p>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            novalidate
            autocomplete="on"
            class="signin-form"
          >
            <div class="fields">
              <form-field
                id="login-email"
                label="Email"
                [required]="true"
                [error]="emailFieldError()"
              >
                <div class="input-wrap">
                  <atom-input
                    #emailInput
                    id="login-email"
                    type="email"
                    autocomplete="email"
                    placeholder="eli@company.com"
                    [value]="form.controls.email.value"
                    [disabled]="submitting()"
                    [invalid]="!!emailFieldError()"
                    [required]="true"
                    ariaDescribedBy="login-email-error"
                    (valueChange)="form.controls.email.setValue($event)"
                  />
                  <span class="input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4
                               c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                </div>
              </form-field>

              <form-field
                id="login-password"
                label="Password"
                [required]="true"
                [error]="passwordFieldError()"
              >
                <div class="input-wrap">
                  <atom-input
                    #passwordInput
                    id="login-password"
                    [type]="passwordVisible() ? 'text' : 'password'"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    [value]="form.controls.password.value"
                    [disabled]="submitting()"
                    [invalid]="!!passwordFieldError()"
                    [required]="true"
                    ariaDescribedBy="login-password-error"
                    (valueChange)="form.controls.password.setValue($event)"
                  />
                  <span class="input-icon input-icon--left" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <atom-show-password-toggle
                    class="password-toggle"
                    [pressed]="passwordVisible()"
                    [disabled]="submitting()"
                    (toggle)="togglePasswordVisibility()"
                  />
                </div>
              </form-field>
            </div>

            <div class="form-row">
              <label class="remember" for="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  [checked]="rememberMe()"
                  [disabled]="submitting()"
                  (change)="onRememberMeChange($event)"
                />
                <span class="remember-check" aria-hidden="true">
                  @if (rememberMe()) {
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                         stroke="currentColor" stroke-width="3"
                         stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  }
                </span>
                <span class="remember-label">Remember me</span>
              </label>

              <a
                class="forgot-link"
                href="/forgot-password"
                data-testid="forgot-password-link"
              >Forgot password?</a>
            </div>

            <atom-button
              type="submit"
              variant="primary"
              size="lg"
              [disabled]="!form.controls.email.value || !form.controls.password.value"
              [loading]="submitting()"
            >
              <span class="signin-cta">
                <span>{{ submitting() ? 'Signing in…' : 'Sign in' }}</span>
                @if (!submitting()) {
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                       stroke="currentColor" stroke-width="2.2"
                       stroke-linecap="round" stroke-linejoin="round"
                       aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                }
              </span>
            </atom-button>

            <div class="divider" role="separator" aria-label="Or continue with">
              <span class="divider-line"></span>
              <span class="divider-text">or continue with</span>
              <span class="divider-line"></span>
            </div>

            <button
              type="button"
              class="sso-btn"
              data-testid="sso-button"
              [disabled]="submitting()"
            >
              <span class="sso-tile" aria-hidden="true">
                <span class="sso-tile__quad sso-tile__quad--red"></span>
                <span class="sso-tile__quad sso-tile__quad--green"></span>
                <span class="sso-tile__quad sso-tile__quad--blue"></span>
                <span class="sso-tile__quad sso-tile__quad--yellow"></span>
              </span>
              <span class="sso-label">Sign in with SSO</span>
            </button>
          </form>
        </article>
      </main>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-page-bg);
    }

    .login-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      background: var(--color-page-bg);
    }

    .marketing-pane {
      position: relative;
      padding: 56px 72px 32px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .marketing-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 2;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      background: var(--gradient-brand);
      color: #ffffff;
      border-radius: 10px;
      box-shadow: var(--shadow-button);
    }
    .brand-wordmark {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.01em;
    }

    .marketing-content {
      margin-top: 64px;
      z-index: 2;
    }
    .hero {
      font-size: 56px;
      line-height: 1.05;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.025em;
      margin: 0;
    }
    .hero-accent {
      color: var(--color-primary);
    }
    .hero-sub {
      margin: 24px 0 0;
      font-size: 16px;
      line-height: 1.6;
      color: var(--color-text-soft);
      max-width: 440px;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 40px 0 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .feature-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .feature-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .feature-icon--bolt {
      background: #DBEAFE;
      color: #2563EB;
    }
    .feature-icon--chat {
      background: #EDE9FE;
      color: #7C3AED;
    }
    .feature-icon--book {
      background: #D1FAE5;
      color: #059669;
    }
    .feature-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .feature-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text);
    }
    .feature-sub {
      font-size: 13px;
      color: var(--color-text-soft);
    }

    .marketing-illustration {
      margin-top: auto;
      width: 100%;
      max-width: 540px;
      align-self: center;
      pointer-events: none;
    }

    .signin-pane {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 56px 32px;
    }
    .signin-card {
      width: 100%;
      max-width: 460px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(15, 23, 42, 0.08),
                  0 4px 12px rgba(15, 23, 42, 0.04);
      padding: 40px 40px 36px;
    }
    .card-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .card-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
      margin: 0;
    }
    .card-subtitle {
      margin: 8px 0 0;
      font-size: 15px;
      color: var(--color-text-soft);
    }

    .signin-form {
      margin-top: 28px;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .input-wrap {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-muted);
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .input-wrap atom-input {
      padding-left: 40px;
    }
    .password-toggle {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
    }

    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 14px;
    }
    .remember {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--color-text-soft);
      cursor: pointer;
      user-select: none;
    }
    .remember input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .remember-check {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 1.5px solid var(--color-border-strong);
      background: var(--color-surface);
      display: grid;
      place-items: center;
      color: #ffffff;
      transition: background var(--duration-fast, 150ms) var(--ease-out, ease),
                  border-color var(--duration-fast, 150ms) var(--ease-out, ease);
    }
    .remember input[type="checkbox"]:checked + .remember-check {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }
    .remember input[type="checkbox"]:focus-visible + .remember-check {
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .remember input[type="checkbox"]:disabled + .remember-check {
      opacity: 0.5;
    }
    .forgot-link {
      color: var(--color-primary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color var(--duration-fast, 150ms) var(--ease-out, ease);
    }
    .forgot-link:hover {
      color: var(--color-primary-deep);
      text-decoration: underline;
    }

    form > atom-button {
      display: block;
      width: 100%;
      margin-top: 20px;
    }
    .signin-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0 16px;
    }
    .divider-line {
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }
    .divider-text {
      font-size: 13px;
      color: var(--color-muted);
      white-space: nowrap;
    }

    .sso-btn {
      width: 100%;
      height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--button-radius);
      color: var(--color-text);
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: var(--shadow-xs);
      transition: background var(--duration-fast, 150ms) var(--ease-out, ease),
                  border-color var(--duration-fast, 150ms) var(--ease-out, ease);
    }
    .sso-btn:hover:not(:disabled) {
      background: var(--color-page-bg);
      border-color: var(--color-border-strong);
    }
    .sso-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .sso-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px var(--color-primary-ring);
      border-color: var(--color-primary);
    }
    .sso-tile {
      width: 18px;
      height: 18px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 1.5px;
      flex-shrink: 0;
    }
    .sso-tile__quad {
      width: 100%;
      height: 100%;
    }
    .sso-tile__quad--red { background: #F25022; }
    .sso-tile__quad--green { background: #7FBA00; }
    .sso-tile__quad--blue { background: #00A4EF; }
    .sso-tile__quad--yellow { background: #FFB900; }

    @media (max-width: 960px) {
      .login-page {
        grid-template-columns: 1fr;
      }
      .marketing-pane {
        display: none;
      }
      .signin-pane {
        padding: 40px 20px;
      }
    }
    @media (max-width: 520px) {
      .signin-card {
        padding: 32px 24px 28px;
        border-radius: 16px;
      }
      .card-title {
        font-size: 24px;
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

  /**
   * Remember-me checkbox handler. The state is local UI only —
   * persistence (cookie vs. local storage) is owned by the
   * backend and is intentionally out of scope here. Mirrors
   * the cast pattern used by `atom-input.onInput` to keep the
   * template free of `$any()`.
   */
  onRememberMeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.rememberMe.set(target.checked);
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
