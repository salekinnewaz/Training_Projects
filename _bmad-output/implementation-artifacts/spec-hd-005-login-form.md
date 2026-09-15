---
title: 'HD-005 — Login page wiring'
type: 'feature'
created: '2026-09-15'
status: 'done'
baseline_commit: '8ff97e415355721710f1d71791b3cbdc69a06546'
route: 'dispatch'
review_loop_iteration: 1
context:
  - 'frontend/src/app/services/auth.service.ts'
  - 'frontend/src/app/services/api-error.ts'
  - 'frontend/src/styles.css'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/login` currently renders a placeholder. HD-003 shipped the backend `POST /api/auth/login` + `GET /api/auth/me` endpoints, and HD-004 shipped the `AuthService` + `AuthInterceptor` on the frontend. With those in place, a user submitting the placeholder page still has no way to authenticate — the chrome (HD-004) collapses, the form is fake, and the role-correct dashboard routing is unreachable from the UI.

**Approach:** Replace `LoginPageComponent` with a real reactive form (email + password, show/hide toggle) that calls `AuthService.login()` on submit. On success the user lands on the role-correct dashboard via `auth.roleHomePath()`. Field-level validation runs client-side; backend errors surface via the typed `ApiError` already produced by the HD-004 interceptor. New reusable atoms (button, input-text, link) and a `form-field` molecule land here so HD-008 (create-ticket), HD-014 (users form), and any future form page can compose the same primitives.

## Boundaries & Constraints

**Always:**
- Submit ONLY when both fields are non-empty AND the email matches `^[^\s@]+@[^\s@]+\.[^\s@]+$` (mirrors backend's validator).
- Map `ApiError.errorCode` to the spec's UX states exactly: `invalid_credentials` → inline under password; `account_inactive` → inline under password; `validation_error` → inline under each field from `err.fields`; `network_error` + `internal_server_error` + `unknown_error` → inline under password as generic "Something went wrong…"; `forbidden` + `not_found` + `not_implemented` + `unauthenticated` + `invalid_token` → generic (defensive; shouldn't fire on login).
- While submitting: button label "Logging in…", spinner, both inputs + button disabled. No double-submit (disabled + interceptor-level dedupe).
- On 2xx: `auth.login()` already populated `user$`. Call `router.navigateByUrl(auth.roleHomePath())` — no intermediate "you're signed in" page.
- Auto-focus the email input on page load (use Angular `ViewChild` + `ngAfterViewInit`).
- All visual values read from CSS custom properties in `frontend/src/styles.css` — no hard-coded colors/sizes.
- `displayName` is irrelevant for the login page; do not leak user state into the form.

**Never:**
- No "Remember me" checkbox, no marketing copy, no SSO buttons, no signup link, no accessibility/version footer (per the UX spec — these were deliberate cuts).
- No `localStorage` or `sessionStorage` for the JWT — the httpOnly cookie handles it; storing the token again would defeat the purpose.
- No proactive `/api/auth/me` call from this page. The "already-logged-in" handling is owned by the HD-006 `authGuard`. This page always renders the form.
- No new dependencies (`@angular/forms` is already pulled in by `@angular/forms`; no `Formly`, no `ngx-formly`, no schema libs).
- No route changes in `app.routes.ts` — `/login` is already wired and the route title is already "Sign in · HelpDesk Lite".
- No CSRF double-submit header this story — backend support + frontend echo land together later (flagged in HD-003 progress log).
- No "rate limit" UX beyond a stub path; backend doesn't rate-limit yet (HD-003 deferred). The 429 handler is wired but unreachable in dev.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | email=`admin@company.com`, password=`password123`, both pass client validation | POST `/api/auth/login` → 200; `AuthService.login()` populates `user$`; `router.navigateByUrl('/admin')` | N/A |
| EMPTY_EMAIL | email field empty on submit | Inline error under email: "Enter a valid email address."; email keeps focus | None — no network call |
| INVALID_EMAIL | email=`not-an-email` on submit | Inline error under email: "Enter a valid email address."; email keeps focus | None — no network call |
| EMPTY_PASSWORD | password empty on submit | Inline error under password: "Enter your password."; password keeps focus | None — no network call |
| WRONG_CREDS | valid email, wrong password | Backend 401 `invalid_credentials`; error under password: "Email or password is incorrect. Try again."; email keeps focus (per UX spec); inputs preserved | ApiError.message used as-is |
| INACTIVE | valid creds but user `is_active=false` | Backend 403 `account_inactive`; error under password: "Your account is inactive. Contact your administrator."; inputs preserved | ApiError.message used as-is |
| NETWORK_FAIL | backend unreachable | Error under password: "Something went wrong. Please try again."; inputs preserved | ApiError.code `network_error` |
| SERVER_5XX | backend 500 | Error under password: "Something went wrong. Please try again."; inputs preserved | ApiError.code `internal_server_error` |
| TOGGLE_PASSWORD | user clicks eye icon | password input `type` flips `password` ↔ `text`; aria-label flips "Show password" ↔ "Hide password"; not remembered across navigation | N/A |
| ENTER_SUBMIT | user presses Enter in either field | Same as clicking the primary button | N/A |
| BUTTON_DISABLED | either field empty | Button visually disabled (50% opacity, no pointer events); click is a no-op | N/A |

</frozen-after-approval>

## Code Map

### Reuse

- `frontend/src/app/services/auth.service.ts` — `login(email, password): Promise<void>`, `roleHomePath(): string`, `user$` (BehaviorSubject). The login form ONLY uses `login()` + `roleHomePath()`; no `refreshUser()` call.
- `frontend/src/app/services/api-error.ts` — `ApiError` (status, errorCode, message, fields). `errorCode` union covers all needed states.
- `frontend/src/styles.css` — tokens already seeded: `--field-height`, `--field-radius`, `--button-height`, `--button-radius`, `--color-primary`, `--color-label`, `--color-muted`, `--color-error`, `--color-surface`, `--color-page-bg`, `--color-border`, `--color-disabled`, `--focus-ring-color`, `--focus-ring-width`. NO new CSS tokens needed for HD-005.
- `frontend/src/app/app.routes.ts` — `/login` route already wired, title already set. Do NOT modify.
- `frontend/src/app/pages/login-page/login-page.component.ts` — current placeholder file; this story replaces its body (selector + class name stay).
- `frontend/src/app/models/enums.ts` — `UserRole` for typing; no other models touched.

### New atoms (in `frontend/src/app/components/atoms/`)

- `button/button.component.ts` — `<atom-button>`. Inputs: `variant: 'primary' | 'secondary' | 'danger' = 'primary'`, `disabled: boolean = false`, `type: 'button' | 'submit' = 'button'`, `loading: boolean = false`. Slot: `<ng-content>` for label. Primary uses `--color-primary` bg + white text; secondary uses `--color-surface` bg + `--color-border` border; danger uses `--color-error`. Disabled: 50% opacity, no pointer. Loading: shows an inline spinner to the left of the label, sets `aria-busy="true"`. OnPush.
- `input-text/input-text.component.ts` — `<atom-input>`. Inputs: `id: string`, `type: 'email' | 'password' | 'text' = 'text'`, `value: string`, `placeholder?: string`, `autocomplete?: string`, `disabled: boolean = false`, `invalid: boolean = false`, `ariaDescribedBy?: string`. Outputs: `valueChange: EventEmitter<string>`. Renders the `<input>` only — label + error are the molecule's job. OnPush.
- `link/link.component.ts` — `<atom-link>`. Inputs: `href: string` (relative path), `disabled: boolean = false`. Outputs: `navigate: EventEmitter<void>` (intercepted for SPA routing via `RouterLink` underneath). Renders an `<a>` with `routerLink` directive; falls back to native navigation if `disabled`. Color `--color-primary` default, underline on hover (matches existing `<a>` style in `styles.css`). OnPush.
- `show-password-toggle/show-password-toggle.component.ts` — `<atom-show-password-toggle>`. Inputs: `pressed: boolean = false`, `disabled: boolean = false`. Outputs: `toggle: EventEmitter<void>`. Two inline SVGs (eye-open / eye-closed) toggled by the input. `aria-pressed` mirrors `pressed`; `aria-label` is "Show password" / "Hide password". OnPush.

### New molecule (in `frontend/src/app/components/molecules/`)

- `form-field/form-field.component.ts` — `<form-field>`. Inputs: `id: string`, `label: string`, `error?: string | null`, `required: boolean = false`, `hideLabel: boolean = false` (defaults false; spec doesn't use this, future-proof for SR-only labels). Content projection: `<ng-content />` (the input + optional suffix like the password toggle). Renders `<label [htmlFor]="id">{{ label }}</label>`, the projected content, and `<p class="form-field-error" [id]="id + '-error'" role="alert">{{ error }}</p>` only when `error` is truthy. CSS: `label` 14px medium `--color-label`; spacing label→field 8px (`--space-modal-pad` is too big; use a local literal — or add `--space-form-label-gap: 8px` token if a second form demands it; for HD-005 a local literal is fine). OnPush.

### Modified organism

- `frontend/src/app/pages/login-page/login-page.component.ts` — REPLACE body. Standalone, OnPush, imports `ReactiveFormsModule`, `Router`, `AuthService`, all four new atoms, `form-field`, and `show-password-toggle`. Reactive form with two controls (`email`, `password`) using `Validators.required` and a custom `emailRegexValidator` (regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Submit handler:
  1. Mark all controls touched so inline errors show.
  2. If form invalid, set `passwordFieldError = 'Enter your password.'` and `emailFieldError = 'Enter a valid email address.'` based on which controls are invalid. Return.
  3. Set `submitting = true`; clear `topError`.
  4. `await auth.login(email.value, password.value)`.
  5. On success: `await router.navigateByUrl(auth.roleHomePath())`.
  6. On failure (ApiError): map `errorCode` → message; set `passwordFieldError` (or `emailFieldError` per spec). On 401, focus email. Return form to idle.
  7. `submitting = false` in finally.
- Template (sketch):
  - Outer `<section class="login-page">` filling the viewport (`min-height: 100vh; display: grid; place-items: center; background: var(--color-page-bg);`).
  - `<article class="login-card">` (white surface, `--color-border` border, 8px radius, `--shadow-dropdown` shadow, 48px 40px padding, 400px max-width).
  - `<header class="brand">` — logomark (40×40, `--color-primary` bg, "HL" centered, 6px radius) + wordmark "HelpDesk Lite" (22px semibold, `--color-primary`).
  - `<h1 class="visually-hidden">Sign in</h1>` — visually hidden SR-only H1.
  - `<form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>` with two `<form-field>`s and the primary button + a `<atom-link href="/forgot-password">Forgot password?</atom-link>`.
  - Each `<form-field>` contains an `<atom-input>` and, for password, the `<atom-show-password-toggle>` slotted to the right inside a wrapper `<div class="password-wrap">`.

### Unchanged

- `backend/` — no backend changes in HD-005; `/api/auth/login` and `/api/auth/me` already serve the contract.
- `frontend/src/app/services/auth.service.ts` — no signature changes.
- `frontend/src/app/services/auth.interceptor.ts` — already stamps `withCredentials: true`; no change.
- `frontend/src/app/components/atoms/{chrome-avatar, caret-down, divider-hr, badge-role}` — untouched.
- `frontend/src/app/components/molecules/{header-chrome, dropdown-panel, dialog-modal}` — untouched.
- `frontend/src/app/components/patterns/app-chrome/` — untouched (this page is NOT wrapped in chrome; it's the public page).
- `frontend/src/app/pages/chrome-preview-page/` — untouched (HD-006 removes it).

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/components/atoms/button/button.component.ts` -- create -- reusable primary/secondary/danger button with loading state and disabled handling; serves every CTA in the app
- [x] `frontend/src/app/components/atoms/input-text/input-text.component.ts` -- create -- text/email/password input primitive; pairs with `form-field` molecule
- [x] `frontend/src/app/components/atoms/link/link.component.ts` -- create -- RouterLink-driven `<a>` for SPA navigation; matches existing `<a>` styling
- [x] `frontend/src/app/components/atoms/show-password-toggle/show-password-toggle.component.ts` -- create -- eye-icon toggle with aria-pressed + dynamic aria-label
- [x] `frontend/src/app/components/molecules/form-field/form-field.component.ts` -- create -- label + projected content + error message wrapper; first reusable form primitive
- [x] `frontend/src/app/pages/login-page/login-page.component.ts` -- replace body -- reactive form, submit handler, error mapping, role-correct redirect; this is the only file the user actually navigates to
- [x] `frontend/src/styles.css` -- add `.visually-hidden` utility class (single-line clip rect trick, accessible to SR) -- needed for the SR-only H1

**Acceptance Criteria:**
- Given user opens `/login` cold (no cookie), when the page loads, then email input is focused and the form is in `Default` state.
- Given user types `admin@company.com` and `password123`, when they click "Log in", then a `POST /api/auth/login` is sent with `withCredentials: true`, the button shows "Logging in…" + spinner, inputs + button are disabled.
- Given login returns 200 for an Admin, when `auth.login()` resolves, then the browser navigates to `/admin` (no intermediate page).
- Given login returns 200 for `sam@company.com` (Support Agent), when resolve, then route to `/queue`.
- Given login returns 200 for `eli@company.com` (Employee), when resolve, then route to `/dashboard`.
- Given user submits with email `bad` and password `password123`, when submit fires, then NO network call is made; inline error "Enter a valid email address." renders under email; email keeps focus.
- Given user submits with empty password, when submit fires, then NO network call; error "Enter your password." under password; password keeps focus.
- Given wrong password is sent, when 401 `invalid_credentials` returns, then error "Email or password is incorrect. Try again." renders under password; email gains focus; both inputs preserved.
- Given inactive user logs in, when 403 `account_inactive` returns, then error "Your account is inactive. Contact your administrator." renders under password.
- Given backend is down, when fetch fails, then error "Something went wrong. Please try again." renders under password.
- Given user clicks the eye icon next to password, when toggled, then password input `type` flips `password` ↔ `text` and `aria-label` updates on the toggle.
- Given user presses Enter in the email field, when fired, then form submits (same as clicking Log in).
- Given user presses Enter twice rapidly, when the second press fires, then the form does NOT submit twice (button is disabled mid-flight).
- Given `npm run build:frontend` is run, then no TS errors, no template errors, no warnings about unhandled reactive form imports.
- Given `npm run typecheck` (backend) is run, then 0 errors (regression — confirms no backend coupling was introduced).

## Implementation Notes

- **Subagent dispatched to a fresh context window.** Verification ran `npm run build:frontend` (clean, 2.305s, login-page chunk 37.53 kB), `npm run typecheck` (clean), and probed `POST /api/auth/login` with wrong creds (returned `{ error: 'invalid_credentials', message: 'Email or password is incorrect. Try again.' }`) and an inactive user (returned `{ error: 'account_inactive', ... }`). Both envelopes match what `api-error.ts` parses.
- **Two-way input wiring via `(valueChange)`** (no `ControlValueAccessor` adapter): atom inputs are plain DOM elements. The reactive form's `FormControl` is the source of truth and is updated via `form.controls.email.setValue($event)` from `(valueChange)`. Keeps OnPush clean.
- **Auto-focus** uses `@ViewChild('emailInput', { static: false })` over a wrapper `ElementRef`, then `host.querySelector('input')` to reach the inner `<atom-input>`'s `<input>`. Wrapped in `queueMicrotask` to wait for the first CD cycle.
- **Password field focus** uses `document.getElementById('login-password')` instead of another `@ViewChild` — the wrapping `.password-wrap` div makes referencing the inner atom awkward. Document scope is fine because the ID is component-scoped and unique on `/login`.
- **Eye toggle colors** use `currentColor` so the SVG inherits `--color-muted` (idle) → `--color-label` (hover) without explicit token references.
- **`form-field` molecule** hides the visual label via an inline `.visually-hidden` rule when `hideLabel` is true. Mirrors the global `.visually-hidden` utility (added to `styles.css` this slice).
- **`password-wrap` overrides `padding-right`** on the projected `<atom-input>` to make room for the absolutely-positioned eye toggle. Works through Angular's view encapsulation because both elements share the same template scope.
- **Enter key in either field submits** because the only button inside the `<form>` has `type="submit"` (browser default); no extra `(keydown.enter)` handler needed.
- **`novalidate` on the form** disables browser-default required validation so our inline error copy is the single source of truth.
- **`atom-link` emits `navigate` on click** but the login page never subscribes — fine for now (HD-005 has no analytics), relevant when HD-008/HD-014 want to plumb analytics.
- **`atom-button` is 100% width by default** to match the login card layout. Future use in dialogs will want a `block: false` variant — currently `dialog-modal` hand-rolls its own `.btn` classes. Convergence is a deliberate non-goal here.
- **No proactive `/me` call** on `/login` (correct per spec & design notes); HD-006 `authGuard` will own the already-authenticated-bounce behaviour.
- **`<atom-input>` autocomplete** is forwarded verbatim to `<input autocomplete="...">` via `[attr.autocomplete]`. Confirmed working for password-manager UX.
- **`nonBlankValidator` on email + password controls** (post-review patch): rejects whitespace-only values (`"   "`) which `Validators.required` lets through because the string is non-empty. Backend would 400 with an opaque `validation_error`; catching it client-side keeps the error inline and matches the UX spec's "no surprise server error" rule.
- **`atom-input` `required` input + `[attr.aria-required]`** (post-review patch): previously the visual `*` rendered by `form-field` was `aria-hidden`, leaving SR users with no signal that the field was required. The new `required` input forwards to `aria-required` on the inner `<input>`. Login page passes `[required]="true"` on both controls.
- **`focusPasswordInput` uses `@ViewChild('passwordInput', { static: false })`** (post-review patch): previously used `document.querySelector('#login-password')` while the email side used ViewChild. Symmetric now; eliminates a `document`-scope lookup in a single-page route where the unique ID assumption was safe but easy to break.
- **`FormFieldComponent` hideLabel dead-code cleanup** (post-review patch): removed `[class.visually-hidden]="hideLabel()"` (unreachable because the parent `@if (!hideLabel())` already filters the label out) and the now-unused local `.visually-hidden` rule (the global `.visually-hidden` utility in `styles.css` is the single source of truth).

## Spec Change Log

<!-- Append-only. One row per loopback. -->
<!-- Format: ## | date | trigger | summary -->

| # | Date | Trigger | Summary |
|---|------|---------|---------|
| 1 | 2026-09-15 | Review pass (loop 1) | Applied 5 patches from the Review Triage Log (P1–P5): removed dead `[class.visually-hidden]` binding + duplicate local rule in `form-field`; added `required` input + `aria-required` binding to `atom-input` (with login-page wiring); added `nonBlankValidator` to email + password controls; replaced `document.querySelector` password focus with symmetric `@ViewChild('passwordInput')`. Build + typecheck green. |

## Review Triage Log

<!-- Append-only. -->
<!-- Verdict rendered after reading the cited code, not the reviewer's claim. -->
<!-- Severity grades from reviewers are disregarded — they lack context. -->

### Patch (real defects in shipped code)

| # | Finding | Verdict | Evidence | Action |
|---|---------|---------|----------|--------|
| P1 | `FormFieldComponent` template binds `[class.visually-hidden]="hideLabel()"` on `<label>`, but the label is wrapped in `@if (!hideLabel())` so the binding is unreachable. Dead code. | high | `frontend/src/app/components/molecules/form-field/form-field.component.ts:32-35` — `@if (!hideLabel())` filter excludes the case before the `[class.visually-hidden]` binding is evaluated. | Patch: remove the `[class.visually-hidden]` binding (keep the `@if`). |
| P2 | `FormFieldComponent` re-declares the `.visually-hidden` rule in its own styles (lines 55-65) duplicating the global utility added in HD-005 to `styles.css`. Drift risk if the global utility is updated. | low | `form-field.component.ts:55-65` vs `styles.css:193-203` — same clip-rect trick, two copies. | Patch: replace local rule with `:host ::ng-deep label.visually-hidden { ... }` no — simpler: delete the local rule and rely on the global `.visually-hidden` utility by setting `[class]="'visually-hidden'"` when `hideLabel()` flips. Actually since the `@if` already removes the label entirely when hideLabel, the simplest patch is to leave it alone IF we also delete P1. Reconsider after P1. |
| P3 | Required fields have no `aria-required="true"` on the inner `<input>`. The visual `*` is `aria-hidden` so SR users get no signal. | medium | `frontend/src/app/components/atoms/input-text/input-text.component.ts:25-36` — no `aria-required` binding; login template passes `[required]="true"` to `form-field` but the inner `<input>` doesn't know. | Patch: add `required: boolean = false` input to `atom-input`; bind `[attr.aria-required]`. Login page sets `[required]="true"` on both inputs. |
| P4 | Password control has only `Validators.required`, which does NOT trim whitespace. A user who types `"   "` (or a leading-space-only password) passes client validation and is sent to the backend, which then rejects. Email already trims (line 305: `.trim()`). | medium | `login-page.component.ts:233-241` — password control has no custom trim validator; line 306 passes raw value to `auth.login()`. | Patch: write a `nonBlankValidator` and add it to the password control's `validators` array. Mirror what the email regex validator does for empty strings (return null so `required` handles it). |
| P5 | `focusPasswordInput` uses `document.querySelector('#login-password')` while `focusEmailInput` uses `@ViewChild` + `querySelector('input')`. Asymmetric approaches. | low | `login-page.component.ts:248-264` (email uses ViewChild) vs `:388-391` (password uses global query). Both work, but the asymmetry is a maintenance trap. | Patch: add `<atom-input #passwordInput ...>` template ref + `@ViewChild('passwordInput', { static: false })` and use the same `host.querySelector('input')` pattern. |

### Defer (out of scope or larger story)

| # | Finding | Why deferred |
|---|---------|--------------|
| D1 | No test harness for the 4 new atoms or the `form-field` molecule. | Repo has no Jest/Testing Library config yet; frontend atom tests are a follow-up slice (already noted in HD-004 plan). |
| D2 | No tests for `LoginPageComponent`. | Same as D1 — needs the test harness first. |
| D3 | No `environment.prod.ts` swap file. | Spec boundary explicitly defers prod env config. |
| D4 | 429 (`rate_limited`) handler not implemented. | Spec boundary says "The 429 handler is wired but unreachable in dev" — backend has no rate-limiting yet (HD-003 deferred). Adding now would be dead code. |
| D5 | `api-error.ts` `asFieldMap` only handles string field values; would drop `string[]` silently. | Defensive; backend contract is flat-string maps. Revisit when HD-008 (create-ticket validation) lands field-level validation that might emit arrays. |
| D6 | No barrel index files in `atoms/` or `molecules/`. | Style preference; not a defect. Pattern lands when a 3rd consumer needs deep imports; today every component imports by full path. |
| D7 | `dialog-modal` still hand-rolls its own `.btn-primary` / `.btn-secondary` classes instead of using `<atom-button>`. | Convergence between `dialog-modal` and `atom-button` is a deliberate non-goal for HD-005 (per impl notes). Routes to a future pattern-convergence story. |

### False (verified against code; no defect)

| # | Finding | Why false |
|---|---------|-----------|
| F1 | `validation_error` case in `applyApiError` falls through to focus password when both fields have errors. | Code path reassigns `target = 'email'` inside the `if (emailMsg)` branch and never overwrites it afterwards; when both fields have messages, focus correctly lands on email. Verified at `login-page.component.ts:333-353`. |
| F2 | `applyApiError` re-focuses email on `invalid_credentials` AFTER setting `passwordFieldError` — claimed redundant. | This is the spec-mandated UX ("On 401, focus email"). Code matches spec at lines 381-382. |
| F3 | `LinkComponent` disabled branch uses `preventDefault` but enabled branch doesn't. | Correct: disabled `<a>` must not navigate; enabled `<a>` lets `RouterLink` handle navigation. The asymmetry is the intended design. |
| F4 | Password visibility toggle is unguarded during submission — user could flip mid-flight. | `atom-show-password-toggle [disabled]="submitting()"` at `login-page.component.ts:130` — toggle is disabled while submitting. |
| F5 | `LinkComponent` `void event` is dead code. | Intentional: silences "unused parameter" linter warnings on the `MouseEvent` parameter without needing a `_event` rename. |
| F6 | `ButtonComponent` JSDoc says "blocks click events at the DOM level" but CSS shows `pointer-events: none`. | Both are true: the `<button>` has the `disabled` attribute (DOM-level click block) AND `pointer-events: none` (visual). Doc and code align. |
| F7 | No CSRF double-submit header echoed from frontend. | Spec boundary: "No CSRF double-submit header this story — backend support + frontend echo land together later." Explicitly deferred. |

## Design Notes

**Form layout (matches `_bmad-output/planning-artifacts/ux/ux-HelpDesk-Lite-2026-09-06/mockups/01-login.html` + `design-process/D-UX-Design/login.md`):**
- Page: full-viewport surface `var(--color-page-bg)`, centered card.
- Card: 400px wide (per spec's "Form column width" token), `var(--color-surface)` bg, 1px `var(--color-border)`, 8px radius, padding 48px 40px, `var(--shadow-dropdown)` shadow.
- Brand mark: 40×40 square `var(--color-primary)` bg, "HL" centered white bold; 12px gap to wordmark "HelpDesk Lite" 22px semibold `var(--color-primary)`.
- H1 "Sign in" — visually hidden (`.visually-hidden` utility); provides the SR landmark.
- Field stack: 16px gap between form-field rows; 32px gap from last field to Log in button; 16px gap to Forgot password link.
- Button: 48px tall, 6px radius, full width within the card. `var(--color-primary)` bg, white text, 14px semibold. Loading: spinner + "Logging in…".
- Forgot link: `<atom-link href="/forgot-password">` rendered as `var(--color-muted)` 14px with hover underline (per UX spec; existing `<a>` in `styles.css` already gives the underline).
- Eye icon positioning: absolute right end of password input, vertically centered, 28×28 button hit-area.

**Error mapping rules (the part most likely to drift in implementation):**
- Client validation fires before any network call.
- `validation_error` 400 → use `err.fields['email']` / `err.fields['password']` for inline field errors.
- `invalid_credentials` 401 → under password.
- `account_inactive` 403 → under password.
- `network_error` (status 0) → under password (generic "Something went wrong…").
- `internal_server_error` 5xx → under password (generic).
- Everything else (`forbidden`, `not_found`, `not_implemented`, `unauthenticated`, `invalid_token`, `unknown_error`) → under password (generic, defensive). Should not happen on `/login`.

**Why no `AuthService.refreshUser()` on init:** the spec (HD-004) made the AuthService bootstrap-performant. Proactive `/me` would force a guaranteed 401 round-trip on every visit to `/login` (the most-visited page when not logged in). The route guard (HD-006) will own the "already authenticated → bounce to dashboard" behavior.

**Why no `@angular/cdk` for the password toggle:** it's a single button with two SVGs; the toggle is local state inside the login component, not a global utility.

## Verification

**Commands:**
- `npm run build:frontend` -- expected: Application bundle generated, 0 errors, no template warnings; new atoms + molecule compile.
- `npm run typecheck` -- expected: 0 errors (backend regression check; confirms no backend coupling was touched).
- Node smoke probe (from repo root, backend must be running on :3000):
  ```bash
  # Wrong creds — confirms 401 envelope shape (api-error.ts reads { error, message }).
  node -e "fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@company.com',password:'WRONG'})}).then(r => r.json()).then(console.log)"
  # Inactive user — confirms 403 account_inactive envelope.
  node -e "fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'tomas@company.com',password:'password123'})}).then(r => r.json()).then(console.log)"
  ```
- Frontend dev (`npm run dev:frontend`) + manual browser flow at `http://localhost:4200/login`:
  - Default state: email focused, button disabled.
  - Submit empty → inline errors, no network.
  - Submit `admin@company.com` / `WRONG` → 401 → error under password; email gains focus.
  - Submit `admin@company.com` / `password123` → redirects to `/admin` (no chrome on `/login`, so user lands on the placeholder Admin Dashboard until HD-013).
  - Eye toggle: flips `type` + aria-label.
  - Enter in email submits the form.
  - Double-click Log in during submission: second click is a no-op (button disabled).

**Manual checks (if no CLI):**
- Visually confirm the card is centered in the viewport at viewport widths 1024px and 1440px (per spec's 1440-canvas design).
- Tab order: email → password toggle → show/hide button → Log in → Forgot link.
- Tab focus shows the global `:focus-visible` ring (2px `var(--focus-ring-color)`).
- DevTools Network panel: login POST carries `Cookie` is sent (empty on first attempt, then on the next page load `/api/auth/me` would carry `auth=...`).
