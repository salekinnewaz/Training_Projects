# Login

**Route:** `/login`
**Scenario:** Both — Eli the End-User (priority 03) and Sam the Support Agent (priority 02) pass through this page on entry.
**Purpose:** Authenticate the user and route them to the role-correct dashboard (Employee Dashboard for End-User role; Agent Dashboard / Kanban for Support Agent or Admin role), in a single deliberate form with no marketing copy and no friction beyond credentials.

## User Context

Both archetypes arrive alert and with intent. **Eli the End-User** is blocked, mildly frustrated, often time-pressured; they need to file a request and return to work. **Sam the Support Agent** is starting their day; their first scan of the queue is a triage ritual. For both, Login must feel like an unobtrusive threshold — present but quick. Neither archetype is exploring; both are returning.

The page must feel *considered*, not minimal-in-a-demeaning-way. Whitespace, type, and button color signal "this tool takes its job seriously." A sketch-quality form would undermine the trust handshake that Login is responsible for.

## Content & Actions

The page contains exactly six elements:

1. **Brand mark** — logomark + wordmark "HelpDesk Lite." Centered horizontally near the top of the page. Sized so it is the visual anchor without crowding the form below.
2. **Page title (visually hidden but present for screen readers)** — "Sign in." Provides a single H1 landmark.
3. **Email field** — `<input type="email">` with the label "Email" rendered as a visible label above the input. Placeholder "you@company.com" inside the field. Required. Auto-focused on page load so Eli can start typing immediately when blocked.
4. **Password field** — `<input type="password">` with the label "Password" rendered as a visible label above the input. Required. Masked by default.
5. **Show / hide password toggle** — eye icon button positioned at the right end of the password field. Toggles `type="password"` ↔ `type="text"`. Toggle state is local to this page load; not remembered across navigations. `aria-label="Show password"` / `aria-label="Hide password"` toggles with state.
6. **Log in button** — primary CTA, full width within the form column. Disabled until both fields have content. Clicking or pressing Enter in either field submits the form.
7. **"Forgot password?" link** — sits below the Log in button, smaller type and lower contrast. Routes to the password reset flow (designed elsewhere; this page spec only links to it).

**No other content.** No marketing copy, no value prop, no signup link (accounts are Admin-provisioned), no SSO buttons, no Remember-me checkbox, no accessibility / terms / version footer.

## Behavior

- **Auto-focus** on the email input when the page loads.
- **Submit triggers** on (a) clicking the Log in button, or (b) pressing Enter in either field.
- **Client-side validation** runs on submit:
  - Email empty or invalid format → inline error under email field: "Enter a valid email address." Field keeps focus, value preserved.
  - Password empty → inline error under password field: "Enter your password." Field keeps focus.
  - Both fields valid → submit proceeds.
- **In-flight state:** when the auth request is sent, the Log in button changes label to "Logging in…" with a small spinner, and both inputs plus the button become disabled. The user cannot double-click, double-submit, or edit while a request is in flight. Client-side deduplication + server-side idempotency ensure that even if a duplicate request reaches the server it is a no-op.
- **On success:** the server determines the user's role and routes to the role-correct dashboard (Employee Dashboard for `role = User`; Agent Dashboard for `role = Support Agent` or `role = Admin`). No intermediate landing page.
- **On failure:** see States below.
- **Already-logged-in handling:** if a request to `/login` arrives with a still-valid session, redirect immediately to the user's dashboard. No "you're already signed in" page.
- **Show / hide password toggle:** clicking the eye icon flips `type` between `password` and `text` and updates `aria-label` accordingly. Keyboard accessible (focusable, activatable with Enter / Space).
- **Forgot password link:** standard `<a href="/forgot-password">`. Reset flow itself is a separate page spec.

## States

| State | Trigger | Display |
|---|---|---|
| **Default** | Page loaded | Email field auto-focused, password empty, button disabled, no messages. |
| **Validating** | User submits with empty / malformed fields | Inline error(s) under the offending field(s); field retains focus and value; no spinner. |
| **Submitting** | Auth request in flight | Button shows "Logging in…" + spinner; inputs + button disabled; no inline error. |
| **Wrong credentials** | Server returns 401 (incorrect email or password) | Inline error under password field: "Email or password is incorrect. Try again." Inputs preserved. Field focus moves to email so user can correct. No distinction between "wrong email" and "wrong password" — single ambiguous message avoids account enumeration. |
| **Account inactive** | Server returns 403 with reason `account_inactive` | Inline error under password field: "Your account is inactive. Contact your administrator." Inputs preserved. |
| **Rate-limited** | Server returns 429 | Inline error under password field: "Too many attempts. Try again in a few minutes." Inputs preserved. Button disabled for the duration of the cool-down window. |
| **Network / server error** | Request fails (network unreachable, 5xx) | Inline error under password field: "Something went wrong. Please try again." Inputs preserved. No retry button — user clicks Log in again. |
| **Already-logged-in** | Request hits Login with valid session | Immediate redirect to user's role-correct dashboard. No Login UI shown. |

## Success

The user has been authenticated and routed to the correct dashboard for their role in a single submission. The form has not asked them to declare who they are — the system knows. They feel like they have entered a tool that knows them, in under five seconds, with no friction beyond the credentials themselves.

**Eli** proceeds to Employee Dashboard and files the request that brought them here. **Sam** proceeds to Agent Dashboard and begins the morning triage ritual. **Admin** proceeds to Agent Dashboard with the Users tab visible.

## Visual Tokens (extracted from approved wireframe)

These values are the source for the rest of the app's design system. They were finalized in the wireframe pass for this page and must propagate to all subsequent pages.

| Token | Value | Used by |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface (input bg, button label) | `#ffffff` | Inputs, button text |
| Primary (logomark, button bg, brand wordmark) | `#212529` | Logomark, "HelpDesk Lite" wordmark, Log in button fill |
| Border default | `#adb5bd` 1px | Email + Password input borders |
| Border subtle (button, toggle) | `#dee2e6` 1px | Show/hide toggle border |
| Label text | `#495057` | Field labels (14px medium), show/hide icon stroke |
| Muted text | `#868e96` | Forgot password? link |
| Inline error text | (to be defined during Mimir implementation — recommended `#c92a2a`) | Inline validation messages under fields |
| Placeholder / dot mask | `#adb5bd` | Placeholder text, masked password dots |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |

| Spacing & form geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Form column width | 400px | Centered: x = 520 to 920 |
| Form column horizontal center | x = 720 | Used for both form and brand mark alignment |
| Field height | 44px | Email + Password |
| Field radius | 4px | |
| Button height | 48px | Log in |
| Button radius | 6px | |
| Logomark | 40×40 px, radius 6px | |
| Spacing label → field | 12px | Label baseline → field top |
| Spacing field → field | 28px (40px gap including 16px breathing room) | Email bottom → Password top |
| Spacing password → button | 28px (40px gap) | Password bottom → Log in top |
| Spacing button → forgot link | 32px | Log in bottom → Forgot password? baseline |
| Page title position | visually hidden (SR-only) | "Sign in" H1 |

**Layout (top-down y-positions on a 900px canvas):**
- Brand mark: logomark y=180 (40px tall, ends at y=220), wordmark baseline y=208.
- Email label baseline: y=320; Email input: y=332 to y=376.
- Password label baseline: y=404; Password input: y=416 to y=460.
- Show/hide eye toggle: x=884 to x=912 (right end of password input), y=424 to y=452.
- Log in button: y=488 to y=536; label baseline y=518.
- Forgot password? text baseline: y=568.

**Eye icon:** ellipse 9×5 (stroke 1px, no fill) + central pupil 2px radius — corresponds to a "show" state. The toggle rotates / fills when state flips to "hide"; see Behavior section.

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None. All design decisions for the MVP Login spec were resolved during the discussion:

- Brand mark: placeholder logomark + wordmark "HelpDesk Lite"; final visual established in the wireframe / token-extraction step.
- Type and color tokens: established in this spec's wireframe and propagated to other pages.
- Password reset flow: separate page spec, not in scope here.
- Threshold for rate-limit message (N attempts / cool-down window): TBD with backend implementation; the spec only requires that the message and disabled-state behavior be in place.

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md, 02-sam-runs-the-queue.md, design-process/A-Product-Brief/product-brief.md_
_Wireframe approved 2026-09-14; spec synced with tokens same day._
