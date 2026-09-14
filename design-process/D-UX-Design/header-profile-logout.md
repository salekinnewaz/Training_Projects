# Header / My Profile / Logout

**Components covered:** App-header chrome strip (shared across all post-login pages); My Profile dropdown panel; Logout flow.
**Scenarios:** Both — Eli the End-User, Sam the Support Agent, and Admin all share the same chrome and the same dropdown panel.
**Purpose:** Establish the persistent app-chrome vocabulary that sits above every post-login page, the way a user identifies themselves in-context (name + role), and the way they exit the session safely.

## User Context

The header chrome is the **only persistent UI** the user sees across every page after login. It has three jobs:

1. **Brand mark** (left side) — "this is HelpDesk Lite," with a one-click return to the role-correct Dashboard if the user clicks it.
2. **Identity affordance** (right side) — a single "My Profile ▾" trigger. Clicking reveals a dropdown panel with the user's avatar, name, role, and the Logout action. The dropdown consolidates identity display + the logout action in one place.
3. **Logout** — accessed only via the dropdown panel (not in the static chrome). Protected by a confirmation dialog before logging out.

This is the simplest page in the design system but the most-shared surface; every other post-login page renders this chrome as the top strip.

## Design Decisions (locked during discussion)

- **Header chrome layout:** `[brand mark + wordmark] ............ [My Profile ▾]` — single right-side link, not two. The dropdown panel consolidates identity display and the logout action.
- **Dropdown panel content:** avatar (32px) + display name (semibold) + role badge ("Employee" / "Support Agent" / "Admin") + thin divider + Logout action. Anchored to the right edge of the trigger, 16px below.
- **Dropdown panel width:** 240px. Anchored right-aligned to the trigger link.
- **Logout confirmation:** click "Logout" inside the panel → confirmation dialog "Log out of HelpDesk Lite?" + Cancel + Log out. Cancel preserves the session. Confirmed logout clears the session and redirects to `/login`.
- **Brand mark click behavior:** clicking the brand mark in the header routes to the role-correct dashboard (`/dashboard` for Employee, `/queue` for Support Agent or Admin). This is the "home" affordance — same as the browser's "home" but in-app.
- **No "My Profile" route** — the dropdown is the only My Profile surface. There is no `/profile` page in MVP. The spec explicitly excludes editable profile fields (name, email) — those are provisioned via the auth backend.

## Content & Actions

### 1. App-header chrome strip

- **Height:** 64px.
- **Background:** `#ffffff` (white).
- **Bottom border:** `#dee2e6` 1px.
- **Left side (brand mark group):**
  - Logomark: 40×40 dark square (`#212529` fill, 6px radius) at x=32, y=12.
  - Wordmark: "HelpDesk Lite" — 22px semibold, `#212529`, baseline y=40, x=84.
  - Whole group is clickable (routes to role-correct Dashboard).
- **Right side (identity affordance):**
  - Single link: "My Profile" — 14px, `#495057`. Position: right-aligned to x=1408. The link has a small `▾` caret to indicate dropdown behavior. Active state: `#212529` (semibold, darker).
  - **No separate "Logout" link in the static chrome.** Logout is inside the dropdown panel.

### 2. My Profile dropdown panel

- **Anchor:** right-aligned to the "My Profile" trigger; 16px below the bottom of the chrome strip.
- **Width:** 240px. Height auto, based on content (≈96px tall).
- **Background:** `#ffffff`. Border: `#dee2e6` 1px. Radius: 6px. Shadow: `0 4px 12px rgba(33, 37, 41, 0.12)` to lift it off the page.
- **Layout (top-down):**
  - **Header zone (top, padded 16px):**
    - Avatar: 32×32 circle (`#adb5bd` bg, white initials).
    - Display name: 14px semibold, `#212529`, right of avatar.
    - Role badge below name: "Employee" / "Support Agent" / "Admin" — pill, 11px semibold. Same role-badge styling used elsewhere.
  - **Divider:** 1px `#dee2e6`, full panel width.
  - **Action zone (bottom, padded 8px):**
    - "Logout" — full-width button-style link, 14px medium, `#212529` text, `#f8f9fa` background. Hover: `#f1f3f5`. Padding 8px 16px.
- **Dismissal:** click anywhere outside the panel, press `Esc`, or click the "My Profile" trigger again (toggle).

### 3. Logout confirmation dialog

- **Trigger:** clicking "Logout" inside the dropdown panel.
- **Dialog content:**
  - Headline: "Log out of HelpDesk Lite?" — 16px semibold, `#212529`.
  - Body: none (the question is the headline; no extra copy needed for MVP).
  - Actions: `Cancel` (secondary, muted) + `Log out` (primary, `#212529` fill, white label).
- **Behavior:**
  - **Cancel:** dialog closes, session preserved, user remains on their current page.
  - **Log out:** POST `/api/auth/logout` → on success, redirect to `/login`. On server error, dialog stays open with an inline error: "Couldn't log you out. Try again." (User can retry or cancel.)
- **Keyboard:** `Esc` cancels; `Enter` on the "Log out" button confirms (focus defaults to "Log out" so accidental Enter confirms — but the dialog itself is the protective step).

### 4. Brand-mark click behavior

- **Click on brand mark** (logomark or wordmark):
  - If the user is on the role-correct Dashboard already, no-op.
  - Otherwise, route to `/dashboard` (Employee) or `/queue` (Support Agent / Admin).
- **Hover:** brand mark text color shifts from `#212529` to a slightly lighter `#495057` (subtle hover affordance — not a strong state change, just a hint).

## Behavior

### Dropdown open/close

- **Click "My Profile ▾":** panel opens, anchored right-aligned to the trigger.
- **Click "My Profile ▾" again (with panel open):** panel closes.
- **Click anywhere outside the panel:** panel closes (no action triggered).
- **Press `Esc`:** panel closes.
- **Click on "Logout" inside panel:** confirmation dialog opens; panel stays open behind it (dimmed). On Cancel, panel remains open. On Log out, session ends.
- **Hover on panel trigger when open:** the trigger keeps its active state (`#212529` semibold).

### Brand-mark click

- **Mouse:** click anywhere on the logomark or wordmark → routes to role-correct Dashboard.
- **Keyboard:** `Tab` focuses the brand mark group (one focusable element); `Enter` activates.

### Logout lifecycle

- **POST `/api/auth/logout`** clears the session cookie.
- **Success:** redirect to `/login`. No "You've been logged out" toast (the Login form is the destination; the user understands they logged out).
- **Failure:** inline error in the dialog: "Couldn't log you out. Try again." Dialog stays open. User can retry Log out or Cancel.
- **Concurrent session invalidation:** if the session has already expired server-side (rare race), the Logout POST may return 401; treat as success (the user is effectively logged out) and redirect to `/login`.

### Cross-page

- **Persistent across navigation:** the header chrome is rendered on every post-login page. It does not change based on the page underneath.
- **State on role change:** if Admin changes Sam's role from Support Agent to Admin via the Users tab, the header chrome updates on next page load (the role badge inside the dropdown reflects the new role). No live updates within a session; spec defers live updates to v1.x.
- **State on deactivation:** if Admin deactivates the current user, the user's next request returns 403; the chrome doesn't change in-place, but the page redirects to a session-expired state.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (chrome only)** | Page loaded, dropdown closed | Standard chrome: brand mark + "My Profile ▾". |
| **Dropdown open** | User clicked "My Profile" | Panel anchored below the trigger with avatar + name + role + Logout. |
| **Logout confirmation dialog** | User clicked "Logout" inside the dropdown | Modal dialog: "Log out of HelpDesk Lite?" + Cancel + Log out. Dropdown behind it is dimmed. |
| **Logout error** | POST `/api/auth/logout` failed | Inline error in the dialog: "Couldn't log you out. Try again." Cancel + Log out remain. |
| **Post-logout** | Successful logout | Redirect to `/login`. Header chrome no longer rendered. |
| **Brand-mark hover** | Mouse over the brand mark group | Subtle color shift `#212529` → `#495057`. |
| **Brand-mark focus (keyboard)** | `Tab` focused the brand mark | Outline ring (`#4263eb` 2px, focus-visible only). |

**Note on the wireframe:** the canonical frame is **Default (chrome only)** with the dropdown panel rendered as a separate frame (or as an open-state overlay on the chrome frame, depending on visual budget).

## Visual Tokens (extracted from approved wireframe)

Inherited from Login + Ticket Detail + Users tab. New tokens introduced:

- **Dropdown shadow:** `0 4px 12px rgba(33, 37, 41, 0.12)`.
- **Dropdown action-zone background:** `#f8f9fa` (page surface, reused).
- **Dropdown action-zone hover:** `#f1f3f5` (existing hover tint).
- **Focus ring color:** `#4263eb` 2px (`focus-visible` only; keyboard-only; same color as Support Agent role-border — consistent focus vocabulary across the app).
- **Role badge in dropdown** (Support Agent shown): bg `#edf2ff`, text/border `#4263eb` — matches the role-border color used elsewhere on Support Agent surfaces.

| Token | Value | Where used |
|---|---|---|
| Chrome background | `#ffffff` | App-header strip |
| Chrome border | `#dee2e6` 1px | Bottom of chrome |
| Brand mark fill | `#212529` | Logomark |
| Brand mark text | `#212529` → `#495057` (hover) | Wordmark |
| Trigger link | `#495057` → `#212529` (active/hover) | "My Profile" link |
| Trigger caret | `#212529` (active) / `#495057` (default) | "▾" indicator |
| Dropdown panel bg | `#ffffff` | Panel surface |
| Dropdown panel border | `#dee2e6` 1px | Panel outline |
| Dropdown shadow | `0 4px 12px rgba(33,37,41,0.12)` | Lift effect |
| Dropdown divider | `#dee2e6` 1px | Inside panel |
| Dropdown action bg | `#f8f9fa` | "Logout" action background |
| Dropdown action hover | `#f1f3f5` | "Logout" hover state |
| Role badge bg (Support Agent) | `#edf2ff` | Pill inside dropdown |
| Role badge border/text (Support Agent) | `#4263eb` | Pill inside dropdown |
| Dialog overlay | `rgba(33, 37, 41, 0.4)` | Modal scrim |
| Dialog primary button | `#212529` fill, `#ffffff` text | "Log out" |
| Dialog secondary button | `#ffffff` fill, `#dee2e6` 1px border, `#495057` text | "Cancel" |
| Focus ring | `#4263eb` 2px | Keyboard focus |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | (not used on this page) | — |

| Token | Value | Where used |
|---|---|---|
| Chrome background | `#ffffff` | App-header strip |
| Chrome border | `#dee2e6` 1px | Bottom of chrome |
| Brand mark fill | `#212529` | Logomark |
| Brand mark text | `#212529` → `#495057` (hover) | Wordmark |
| Trigger link | `#495057` → `#212529` (active/hover) | "My Profile" link |
| Trigger caret | `#495057` | "▾" indicator |
| Dropdown panel bg | `#ffffff` | Panel surface |
| Dropdown panel border | `#dee2e6` 1px | Panel outline |
| Dropdown shadow | `0 4px 12px rgba(33,37,41,0.12)` | Lift effect |
| Dropdown divider | `#dee2e6` 1px | Inside panel |
| Dropdown action bg | `#f8f9fa` | "Logout" action background |
| Dropdown action hover | `#f1f3f5` | "Logout" hover state |
| Dialog overlay | `rgba(33, 37, 41, 0.4)` | Modal scrim |
| Focus ring | `#4263eb` 2px | Keyboard focus |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | (not used on this page) | — |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Chrome height | 64px | Same as all other post-login pages |
| Logomark | 40×40, 6px radius, x=32, y=12 | Left of wordmark |
| Wordmark baseline | y=40 | "HelpDesk Lite", 22px semibold |
| Trigger link x | right-aligned to x=1408 | With `▾` caret |
| Dropdown width | 240px | Right-aligned to trigger |
| Dropdown position | 16px below chrome bottom | y=80 |
| Avatar in dropdown | 32px circle | Top-left of panel header |
| Role badge in dropdown | 22px tall pill | Below name, same as page-level role badge |
| Dialog width | 360px | Centered horizontally |
| Dialog padding | 24px | Inside dialog |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is **Default (chrome only)** with the dropdown panel rendered as an overlay to demonstrate the open state.

- Chrome strip: y=0..64.
- Logomark: x=32, y=12, 40×40.
- Wordmark: x=84, baseline y=40.
- "My Profile ▾" trigger: x=1408 right-aligned, baseline y=40.
- Dropdown panel (open state, anchored): x=1168..1408 (240px wide), y=80..176 (96px tall).
  - Avatar: cx=1192, cy=104, r=16.
  - Name: x=1216, baseline y=109.
  - Role badge: x=1216, y=120..142 (22px pill).
  - Divider: y=152, x=1168..1408.
  - Logout action: x=1168..1408, y=152..176 (24px tall, padded).
- Logout dialog (when triggered): centered horizontally (cx=720), y=380..456 (76px tall, 360px wide).
  - Headline: y=412, 16px semibold.
  - Cancel button: x=540..620, y=440..472.
  - Log out button: x=820..900, y=440..472, `#212529` fill.

## Success

The chrome is the only thing the user sees across every page. It has to be invisible when the user is doing their work (Ticket Detail, Kanban, Create Ticket) and reliably accessible when they need to identify themselves or leave the session. Two specific success moments:

1. **Identity moment:** Sam clicks "My Profile ▾" and instantly sees "Sam Patel · Support Agent." Zero ambiguity about who's logged in.
2. **Logout moment:** Sam clicks "My Profile ▾" → clicks "Logout" → confirms in the dialog → lands on `/login` ready for someone else to take over (or for Sam to log back in after a break). The confirmation dialog means accidental clicks don't strand anyone; the redirect is clean.

The chrome has no other job. Brand mark is a "home" affordance — secondary, but it earns its keep by getting Sam back to the Kanban from any deep link without keyboard gymnastics.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking this spec):
- **Editable profile fields** (name, email, password change): out of MVP. Profile changes are via the auth backend; in-app profile editing is a v1.x follow-up.
- **"Active sessions" list** (see / sign out of other devices): out of MVP. Same auth-backend dependency.
- **Profile picture upload:** out of MVP. Avatars are initials-on-grey.
- **Notification preferences** (email me when a ticket I'm watching updates): out of MVP. Email notifications themselves are out of MVP per Submission Confirmation spec.
- **Dark mode / theme switcher:** out of MVP.

---

## Spec Migration Notes

**This spec changes the chrome pattern on all 7 post-login pages.** Prior specs / wireframes showed two right-side links (`[My Profile] [Logout]`). With this spec, the rendered chrome becomes `[My Profile ▾]` only; Logout lives inside the dropdown. All 7 wireframes need to be updated to match the new pattern:

- `wireframes/ticket-detail.svg` / `.png`
- `wireframes/submission-confirmation.svg` / `.png`
- `wireframes/create-ticket.svg` / `.png`
- `wireframes/employee-dashboard.svg` / `.png`
- `wireframes/agent-kanban.svg` / `.png`
- `wireframes/users-tab.svg` / `.png`

**Change to apply to each:**
- Remove the static `Logout` text link (was at x=1364, y=40).
- Add a small `▾` caret immediately right of the `My Profile` text (at x=1364, baseline y=40; caret at x=1372, drawn as a small V polyline).
- The `My Profile` text shifts left from x=1280 to roughly x=1280, with the caret to its right. The static logout link is gone.

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md (Screen 1) + 02-sam-runs-the-queue.md (Screen 1) — both confirm "Header elements: My Profile (link) and Logout (link)" shared across roles. design-process/D-UX-Design/login.md (initial type stack + chrome vocabulary). design-process/D-UX-Design/users-tab.md (dropdown pattern for the self-protection row, role-badge styling)._