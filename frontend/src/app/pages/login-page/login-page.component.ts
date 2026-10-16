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
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <path d="M4 14a2 2 0 0 1 2-2h1v8H6a2 2 0 0 1-2-2z" fill="currentColor" />
              <path d="M20 14a2 2 0 0 0-2-2h-1v8h1a2 2 0 0 0 2-2z" fill="currentColor" />
            </svg>
          </span>
          <span class="brand-wordmark">Helpdesk Lite</span>
        </header>

        <div class="marketing-scene">
          <div class="marketing-content">
            <h1 class="hero">
              Support<br />made<br />
              <span class="hero-accent">simple.</span>
            </h1>
            <p class="hero-sub">
              Create tickets, track your requests, and get help from the
              right people — all in one place.
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
          Decorative illustration: a "person at a laptop on a bean
          bag, with a potted plant and floating chat bubbles". The
          composition fills the lower half of the marketing pane.
          Hand-rolled SVG to keep the bundle slim and crisp on any
          DPR.
        -->
        <div class="marketing-illustration" aria-hidden="true">
          <svg viewBox="0 0 720 540" xmlns="http://www.w3.org/2000/svg"
               width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
            <defs>
              <linearGradient id="beanBag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#5B7CF5" />
                <stop offset="100%" stop-color="#3B5BDB" />
              </linearGradient>
              <linearGradient id="beanBagDark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3B5BDB" />
                <stop offset="100%" stop-color="#2E4AB8" />
              </linearGradient>
              <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4A6BF0" />
                <stop offset="100%" stop-color="#3859D6" />
              </linearGradient>
              <linearGradient id="plantPot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#E2E8F0" />
                <stop offset="100%" stop-color="#CBD5E1" />
              </linearGradient>
              <linearGradient id="laptop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#94A3B8" />
                <stop offset="100%" stop-color="#64748B" />
              </linearGradient>
            </defs>

            <!-- large soft circular halo behind the person -->
            <circle cx="380" cy="380" r="280" fill="#EEF4FF" opacity="0.7" />

            <!-- potted plant on the left -->
            <g transform="translate(40 320)">
              <path d="M30 130 L120 130 L108 200 L42 200 Z" fill="url(#plantPot)" />
              <ellipse cx="75" cy="130" rx="45" ry="8" fill="#F1F5F9" />
              <ellipse cx="75" cy="130" rx="42" ry="6" fill="#94A3B8" />
              <path d="M75 130 Q30 50 18 -10 Q40 30 60 60 Q40 60 30 80 Q55 90 75 130 Z"
                    fill="#10B981" />
              <path d="M75 130 Q75 40 88 -10 Q90 50 80 100 Q100 100 120 110 Q90 130 75 130 Z"
                    fill="#059669" />
              <path d="M75 130 Q120 60 145 30 Q130 80 105 120 Q130 110 150 110 Q110 130 75 130 Z"
                    fill="#10B981" />
              <path d="M75 130 Q40 70 18 40 Q40 90 65 130 Z" fill="#34D399" />
            </g>

            <!-- bean bag (large, sweeping shape under them) -->
            <ellipse cx="450" cy="490" rx="320" ry="60" fill="url(#beanBagDark)" opacity="0.4" />
            <ellipse cx="450" cy="470" rx="290" ry="80" fill="url(#beanBag)" />
            <ellipse cx="450" cy="450" rx="270" ry="60" fill="#5B7CF5" opacity="0.7" />
            <ellipse cx="380" cy="440" rx="180" ry="22" fill="#A5B4FC" opacity="0.4" />

            <!-- person sitting on the bean bag -->
            <g transform="translate(310 200)">
              <path d="M0 240 Q-10 260 30 290 L80 290 L80 200 Z" fill="#1E293B" />
              <path d="M70 200 Q120 230 200 270 Q220 280 210 290 L90 290 Q70 270 70 240 Z" fill="#0F172A" />
              <ellipse cx="215" cy="288" rx="22" ry="8" fill="#F8FAFC" />
              <ellipse cx="218" cy="286" rx="14" ry="4" fill="#E2E8F0" />
              <path d="M30 100 Q20 90 30 75 L120 75 Q160 80 170 110 L180 200 Q140 210 30 200 Z"
                    fill="url(#shirt)" />
              <path d="M70 75 Q90 88 120 75 L130 95 Q90 105 60 95 Z"
                    fill="#3859D6" opacity="0.5" />
              <path d="M30 100 Q-10 130 5 180 Q15 200 50 195 Q60 160 50 130 Z"
                    fill="url(#shirt)" />
              <path d="M170 110 Q200 140 195 180 Q190 200 155 200 Q145 160 155 130 Z"
                    fill="#3859D6" />
              <rect x="80" y="55" width="40" height="25" rx="6" fill="#F4D7B5" />
              <circle cx="100" cy="35" r="32" fill="#F4D7B5" />
              <path d="M70 32 Q70 0 100 0 Q135 0 135 35 Q132 22 122 18
                       Q108 14 92 18 Q78 22 70 32 Z" fill="#1F2937" />
              <ellipse cx="70" cy="36" rx="3" ry="5" fill="#E5C4A0" />
              <circle cx="92" cy="38" r="2" fill="#1F2937" />
              <path d="M88 48 Q92 52 100 50" stroke="#9A6B4A" stroke-width="1.5"
                    fill="none" stroke-linecap="round" />
              <!-- laptop on lap -->
              <g transform="translate(40 145)">
                <rect x="0" y="0" width="120" height="70" rx="4" fill="url(#laptop)" />
                <rect x="4" y="4" width="112" height="62" rx="2" fill="#CBD5E1" />
                <rect x="-6" y="68" width="132" height="6" rx="2" fill="#64748B" />
                <rect x="-6" y="68" width="132" height="2" fill="#94A3B8" />
              </g>
            </g>

            <!-- floating chat bubble (blue) -->
            <g transform="translate(490 220)">
              <rect x="0" y="0" width="120" height="78" rx="16" fill="#5B7CF5" />
              <path d="M14 78 L20 92 L34 78 Z" fill="#5B7CF5" />
              <rect x="18" y="22" width="84" height="6" rx="3" fill="#fff" opacity="0.95" />
              <rect x="18" y="38" width="60" height="6" rx="3" fill="#fff" opacity="0.7" />
              <rect x="18" y="54" width="72" height="6" rx="3" fill="#fff" opacity="0.5" />
            </g>

            <!-- browser window card (center top) -->
            <g transform="translate(420 100)">
              <rect x="0" y="0" width="110" height="78" rx="10" fill="#FFFFFF" />
              <rect x="0" y="0" width="110" height="20" rx="10" fill="#F1F5F9" />
              <circle cx="10" cy="10" r="3" fill="#EF4444" />
              <circle cx="20" cy="10" r="3" fill="#F59E0B" />
              <circle cx="30" cy="10" r="3" fill="#10B981" />
              <rect x="8" y="32" width="94" height="6" rx="3" fill="#E2E8F0" />
              <rect x="8" y="44" width="68" height="6" rx="3" fill="#E2E8F0" />
              <rect x="8" y="56" width="78" height="6" rx="3" fill="#E2E8F0" />
              <rect x="8" y="68" width="40" height="6" rx="3" fill="#5B7CF5" opacity="0.7" />
            </g>

            <!-- green check (success) -->
            <g transform="translate(560 160)">
              <circle cx="30" cy="30" r="28" fill="#A7F3D0" />
              <path d="M16 30 L26 40 L44 22" stroke="#047857" stroke-width="5"
                    fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g>

            <!-- document/file card (purple) -->
            <g transform="translate(580 320)">
              <rect x="0" y="0" width="68" height="84" rx="8" fill="#C4B5FD" />
              <path d="M0 0 L48 0 L68 20 L68 84 L0 84 Z" fill="#C4B5FD" />
              <path d="M48 0 L48 20 L68 20 Z" fill="#A78BFA" />
              <rect x="10" y="32" width="48" height="5" rx="2" fill="#5B21B6" opacity="0.7" />
              <rect x="10" y="44" width="32" height="5" rx="2" fill="#5B21B6" opacity="0.5" />
              <rect x="10" y="56" width="40" height="5" rx="2" fill="#5B21B6" opacity="0.5" />
            </g>

            <!-- dashed orbit connecting the floating elements -->
            <path d="M340 150 Q420 80 540 130 Q620 180 600 280 Q580 380 580 380"
                  stroke="#A5B4FC" stroke-width="2" stroke-dasharray="2 8"
                  fill="none" stroke-linecap="round" opacity="0.6" />
          </svg>
        </div>
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
                <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                <path d="M4 14a2 2 0 0 1 2-2h1v8H6a2 2 0 0 1-2-2z" fill="currentColor" />
                <path d="M20 14a2 2 0 0 0-2-2h-1v8h1a2 2 0 0 0 2-2z" fill="currentColor" />
              </svg>
            </span>
            <span class="brand-wordmark">Helpdesk Lite</span>
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
                  <span class="input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <atom-show-password-toggle
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
                Remember me
              </label>

              <atom-link href="/forgot-password">Forgot password?</atom-link>
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
          </form>
        </article>
      </main>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(at 95% 8%, rgba(160, 202, 253, 0.55) 0px, transparent 45%),
        radial-gradient(at 92% 50%, rgba(37, 99, 235, 0.10) 0px, transparent 50%),
        linear-gradient(180deg, #FBFCFE 0%, #F4F8FE 100%);
    }

    .login-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      align-items: stretch;
    }

    .marketing-pane {
      position: relative;
      padding: 48px 56px 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 100vh;
    }
    .marketing-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 3;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      background: var(--gradient-brand);
      color: #ffffff;
      border-radius: 10px;
      box-shadow: var(--shadow-button);
    }
    .brand-wordmark {
      font-size: 20px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.01em;
    }

    /*
     * marketing-scene: a relative-positioned wrapper that lets the
     * illustration sit absolutely in the lower-right, overlapping
     * the feature list, like the reference image. The content
     * (hero + sub + feature list) lives in the upper-left and is
     * raised above the illustration with z-index.
     */
    .marketing-scene {
      position: relative;
      flex: 1;
      min-height: 0;
      margin-top: 40px;
    }
    .marketing-content {
      position: relative;
      z-index: 2;
      max-width: 460px;
    }
    .hero {
      font-size: 64px;
      line-height: 1.05;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -0.035em;
      margin: 0;
    }
    .hero-accent {
      color: #1A73FD;
    }
    .hero-sub {
      margin: 18px 0 0;
      font-size: 18px;
      line-height: 1.55;
      color: var(--color-text-soft);
      max-width: 380px;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 36px 0 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 380px;
    }
    .feature-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .feature-icon {
      width: 40px;
      height: 40px;
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
      min-width: 0;
    }
    .feature-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text);
      letter-spacing: -0.005em;
      line-height: 1.3;
    }
    .feature-sub {
      font-size: 14px;
      line-height: 1.4;
      color: var(--color-text-soft);
    }

    .marketing-illustration {
      position: absolute;
      right: -120px;
      bottom: -40px;
      width: 80%;
      max-width: 640px;
      pointer-events: none;
      z-index: 1;
      opacity: 0.95;
    }

    .signin-pane {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 56px;
    }
    .signin-card {
      width: 100%;
      max-width: 540px;
      background: var(--color-surface);
      border: 1px solid #E8EEF8;
      border-radius: 16px;
      box-shadow:
        0 24px 48px -24px rgba(26, 115, 253, 0.18),
        0 8px 24px -8px rgba(15, 23, 42, 0.06);
      padding: 44px 48px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .card-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
      margin: 0;
      line-height: 1.2;
    }
    .card-subtitle {
      margin: 6px 0 0;
      font-size: 15px;
      line-height: 1.5;
      color: var(--color-text-soft);
    }

    .signin-form {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .input-wrap {
      position: relative;
    }
    .input-wrap .input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-muted);
      display: grid;
      place-items: center;
      pointer-events: none;
      z-index: 1;
    }
    .input-wrap atom-input {
      padding-left: 40px;
    }
    .input-wrap atom-show-password-toggle::ng-deep .toggle {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1;
    }

    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .remember {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: var(--color-text-soft);
      cursor: pointer;
      user-select: none;
      line-height: 1;
    }
    .remember input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--color-primary);
      cursor: pointer;
    }
    .remember input[type="checkbox"]:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    form > atom-button {
      display: block;
      width: 100%;
    }
    /* Override the atom-button's solid primary fill with the blue
       gradient from the reference image. */
    form > atom-button::ng-deep button {
      background: linear-gradient(90deg, #1A73FD 0%, #4F46E5 100%) !important;
    }
    form > atom-button::ng-deep button:hover:not(:disabled) {
      background: linear-gradient(90deg, #1565E0 0%, #4338CA 100%) !important;
    }
    .signin-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    /* ── Responsive ──────────────────────────────────────────── */

    @media (max-width: 1180px) {
      .login-page {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .marketing-pane {
        padding: 40px 40px 0;
      }
      .marketing-content {
        max-width: none;
      }
      .hero {
        font-size: 52px;
      }
      .hero-sub {
        font-size: 16px;
      }
      .marketing-illustration {
        right: -60px;
        width: 75%;
        max-width: 480px;
      }
      .signin-pane {
        padding: 40px 32px;
      }
    }

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
        padding: 28px 24px;
        gap: 20px;
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
    // Validate the optional ?return_to= deep-link target (set by
    // authGuard). Rejects absolute/protocol-relative URLs, backslash
    // bypasses, and bare `/` so a successful login doesn't bounce
    // through the empty redirect.
    const raw = this.route.snapshot.queryParamMap.get('return_to') ?? '';
    const isSafeSpaPath =
      raw.startsWith('/') &&
      raw !== '/' &&
      !raw.includes('//') &&
      !raw.includes('\\');
    if (isSafeSpaPath) {
      this.returnTo = raw;
    } else if (raw) {
      // eslint-disable-next-line no-console
      console.warn('[hd-006] rejected unsafe return_to:', raw);
      this.returnTo = null;
    }

    // Auto-focus email on page load — queueMicrotask waits for the
    // host to paint so the inner <input> querySelector resolves.
    queueMicrotask(() => this.focusField(this.emailInput));
  }

  private focusField(ref: ElementRef<HTMLElement> | undefined): void {
    const host = ref?.nativeElement;
    const inner: HTMLInputElement | null = host?.querySelector('input') ?? null;
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
          this.focusField(this.emailInput);
        } else {
          this.focusField(this.passwordInput);
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
            if (target === 'email') this.focusField(this.emailInput);
            else this.focusField(this.passwordInput);
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
      queueMicrotask(() => this.focusField(this.emailInput));
    } else {
      queueMicrotask(() => this.focusField(this.passwordInput));
    }
  }
}
