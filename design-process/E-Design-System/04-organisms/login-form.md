# Login Form (organism)

**Category:** Organism
**Composed of:** brand mark + visually-hidden `<h1>` + 2 × [form-field](../03-molecules/form-field.md) (Email, Password with show/hide toggle) + [button](../02-atoms/button.md) (Log in primary CTA) + "Forgot password?" link
**Phase 4 source:** Login (`login.md`)

---

## Overview

The Login form is the unauthenticated threshold to HelpDesk Lite. It authenticates the user and routes them to the role-correct dashboard in a single deliberate submission. The form is centered horizontally near the top of the page, with the brand mark as the visual anchor above it.

The form is a single column, 400px wide, with Email + Password + a show/hide password toggle, a primary Log in button, and a muted "Forgot password?" link below. No marketing copy, no value prop, no signup link (accounts are Admin-provisioned).

## Anatomy

1. **Brand mark** (above the form, centered) — logomark + wordmark "HelpDesk Lite". Sized as the visual anchor.
2. **Page title** (visually hidden, SR-only) — `<h1>` reading "Sign in."
3. **Email field** — `<input type="email">` with label "Email", placeholder "you@company.com", auto-focused on page load.
4. **Password field** — `<input type="password">` with label "Password", masked by default, with the eye-icon show/hide toggle at the right end.
5. **Log in button** — primary CTA, full width within the form column, disabled until both fields have content.
6. **"Forgot password?" link** — sits below the Log in button, smaller type and lower contrast. Routes to `/forgot-password` (designed elsewhere).

## Layout (1440×900 canvas)

- Brand mark: logomark y=180 (40px tall, ends at y=220), wordmark baseline y=208. Centered horizontally at x=720.
- Email label baseline: y=320. Email input: y=332..376.
- Password label baseline: y=404. Password input: y=416..460.
- Show/hide eye toggle: x=884..912 (right end of password input), y=424..452.
- Log in button: y=488..536. Label baseline y=518.
- Forgot password? text baseline: y=568.

## Behavior summary

- **Auto-focus** on the email input when the page loads.
- **Submit triggers** on (a) clicking Log in, or (b) pressing Enter in either field.
- **Client-side validation** runs on submit: empty/invalid email → "Enter a valid email address."; empty password → "Enter your password.".
- **In-flight state:** button changes to "Logging in…" with a small spinner; inputs + button disabled.
- **On success:** server determines role, redirects to `/dashboard` (Employee) or `/queue` (Support Agent or Admin).
- **On 401 (wrong credentials):** inline error "Email or password is incorrect. Try again." — single ambiguous message (no account enumeration).
- **On 403 (account inactive):** "Your account is inactive. Contact your administrator."
- **On 429 (rate-limited):** "Too many attempts. Try again in a few minutes." Button disabled for the cool-down window.
- **Already-logged-in handling:** immediate redirect to role-correct dashboard, no Login UI shown.
- **Show/hide password toggle:** clicking flips `type` and updates `aria-label`.
- **Forgot password link:** standard `<a href="/forgot-password">` to the password reset flow (separate spec).

## Tokens Used

- All [form-field](../03-molecules/form-field.md) tokens (label color, input border, focus ring, error color, etc.)
- All [button](../02-atoms/button.md) tokens (primary fill `#212529`, white label, 48px height, 6px radius)
- [link](../02-atoms/link.md) tokens for "Forgot password?"
- [divider](../02-atoms/divider.md) tokens (not used on this organism — none)
- `color-page-bg` (`#f8f9fa`) for page background
- `color-surface` (`#ffffff`) for input backgrounds
- `font-size-wordmark` (22px) for brand wordmark
- `space-form-column` (400px) for form width

## Used In

- **Login** (`login.md`): the only place this organism appears in MVP.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — not used here; Login is unauthenticated, no chrome.
- [form-field](../03-molecules/form-field.md) — atom-level spec for the input pattern.
- [confirmation-dialog](../05-patterns/confirmation-dialog.md) — Login has no dialog in MVP.
- [server-error-state](../05-patterns/server-error-state.md) — network/5xx error pattern.
