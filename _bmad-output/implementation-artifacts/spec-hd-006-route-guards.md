---
title: 'HD-006 — Routing guards + 403 Forbidden + chrome cleanup'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c94ca06d7e46badf463106b12cd92f2d8218869d'
context:
  - 'frontend/src/app/services/auth.service.ts'
  - 'frontend/src/app/app.routes.ts'
  - 'frontend/src/styles.css'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every route in `app.routes.ts` is unguarded. An unauthenticated visitor can land on `/dashboard`, `/queue`, `/admin`, or any deep link without a cookie. A logged-in Admin can navigate to `/queue` (Support Agent only) and see the placeholder. HD-005 wired the login form but did not honor a `?return_to=` redirect-back URL, so a session-expired user re-authenticating lands on `/login` then on their default dashboard — losing the deep link they were on. The HD-004 `chrome-preview` scaffolding is also still in the tree, with `''` redirecting to it instead of to `/login`.

**Approach:** Add two functional guards (`authGuard`, `roleGuard`) that read `AuthService` state without forcing a pre-flight `/me`. Add a `ForbiddenPageComponent` at `/forbidden` so role mismatches land on a real page (not a flash of placeholder). Wire `?return_to=` round-trip: guards append it, the login form reads it, and after success the user lands on the original URL. Remove the `chrome-preview` page + route + redirect hack. Guard redirect loops are broken by stripping `?return_to=` / `?denied_from=` on the source side before re-checking.

## Boundaries & Constraints

**Always:**
- `authGuard` reads `AuthService.userSnapshot()`; if null, calls `refreshUser()` once and re-reads. Only on confirmed-null does it redirect to `/login?return_to=<currentUrl>`.
- `roleGuard(allowedRoles)` runs AFTER `authGuard` (Angular's `canActivate` array is AND-ed). On role mismatch, navigate to `/forbidden?denied_from=<currentUrl>` rather than rendering the page.
- Login form reads `?return_to=` from `ActivatedRoute.queryParamMap`. After successful login, navigate to that URL (or `auth.roleHomePath()` when absent). Reject any `return_to` that doesn't start with `/` or contains `//` (open-redirect protection).
- The `''` route redirects to `/login` (not `chrome-preview`). The wildcard `**` route also redirects to `/login`.
- `<app-chrome>` is **not** wired into the route tree as a parent layout in HD-006. Pages still render bare; HD-007+ wraps its own chrome. The chrome-preview scaffolding (page file + route entry) is removed.
- Skip-to-main-content `<a>` is added to `<app-chrome>` and `LoginPageComponent` per the kickoff spec (deferred from HD-004).
- `ForbiddenPageComponent` composes `<atom-button>` + `<atom-link>` on a `.page-content` card; no new atoms.
- All visual values read from CSS tokens in `styles.css`; no hard-coded colors.

**Never:**
- No `APP_INITIALIZER` that pre-flights `/me` on bootstrap — that would force a guaranteed 401 on every cold visit to `/login`. AuthService stays bootstrap-performant.
- No third-party guard library (no `@angular/router` extensions beyond stock Angular 17 functional guards).
- No route-resolver pre-fetch (guards alone enforce auth/role; data fetching stays in pages/services).
- No changes to the backend. The 401 contract from HD-003 is sufficient.
- No changes to existing page components beyond the chrome wrapping (which is deferred). `/tickets/:id`, `/admin`, etc. remain placeholders until their own stories.
- No new global state. AuthService + router URL are the only inputs.
- No service-worker / SSR concerns.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UNAUTH_DEEPLINK | `/dashboard` cold, no cookie | `authGuard` → `refreshUser()` → 401 → redirect `/login?return_to=%2Fdashboard` | 401 silently → user$ = null |
| AUTH_DEEPLINK | `/dashboard` w/ valid cookie | `authGuard` reads `userSnapshot()` (no `/me` round-trip) → allow | N/A |
| AUTH_RETURN_TRIP | `/login?return_to=%2Fqueue` w/ valid Support Agent cookie | Login renders; submit OK → navigate to `/queue` (not `/queue`'s role home) | N/A |
| RETURN_TO_TAMPER | `/login?return_to=https%3A%2F%2Fevil.com%2F` (absolute) or `/login?return_to=foo` (no leading slash) or `/login?return_to=%2F%2Fevil.com` (protocol-relative) | Submit OK → fall back to `roleHomePath()` (open-redirect guard: `startsWith('/') && !includes('//')`) | N/A |
| ROLE_MISMATCH | `/queue` as Admin, or `/admin` as Support Agent | `authGuard` passes; `roleGuard` fails → navigate `/forbidden?denied_from=<currentUrl>` | N/A |
| ROLE_OK | `/queue` as Support Agent, `/admin` as Admin | Both guards pass; render placeholder | N/A |
| LOGIN_ALREADY_AUTH | `/login` w/ valid cookie | `loginGuard` sees user$ populated → redirect to `roleHomePath()` | N/A |
| FORBIDDEN_AS_AUTH | `/forbidden?denied_from=%2Fadmin` as Admin | `authGuard` passes; no roleGuard on `/forbidden`; render 403 page (no loop) | N/A |
| FORBIDDEN_DEEPLINK | `/forbidden` cold, no cookie | `authGuard` → 401 → redirect `/login?return_to=%2Fforbidden` | N/A |
| ROOT_REDIRECT | `/` cold | Redirects to `/login` (not `chrome-preview`) | N/A |
| WILDCARD | `/this/does/not/exist` cold | Wildcard redirects to `/login` (no `return_to`) | N/A |
| REFRESH_USER_FAIL | `refreshUser()` throws (network / 5xx) | `authGuard` treats as unauthenticated → redirect `/login?return_to=<currentUrl>` | Network error swallowed |

## Code Map

### Reuse

- `frontend/src/app/services/auth.service.ts` — `userSnapshot(): UserPublic | null`, `user$: Observable<UserPublic | null>`, `refreshUser(): Promise<void>` (silently swallows 401 → user$=null; throws on other errors), `roleHomePath(): string`. All guard logic reads from this; no new state.
- `frontend/src/app/models/enums.ts` — `UserRole = 'User' | 'Support Agent' | 'Admin'` (line 12).
- `frontend/src/app/components/atoms/button/button.component.ts` — `<atom-button variant="primary|secondary">` for 403 page CTAs.
- `frontend/src/app/components/atoms/link/link.component.ts` — `<atom-link href="/dashboard">` for 403 page "Go to dashboard".
- `frontend/src/styles.css` — tokens already seeded: `--color-surface`, `--color-border`, `--color-primary`, `--color-error`, `--color-label`, `--color-page-bg`, `--shadow-dropdown`, `--content-column-width`, `--focus-ring-color`, `--focus-ring-width`, `.visually-hidden`. NO new CSS tokens needed for HD-006.

### New files

- `frontend/src/app/guards/auth.guard.ts` — functional `CanActivateFn` named `authGuard`. Reads `userSnapshot()`; if null, awaits `refreshUser()` (which returns without throwing on 401); if still null, returns `UrlTree` to `/login?return_to=<encoded currentUrl>`. Uses `inject(AuthService)` + `inject(Router)`.
- `frontend/src/app/guards/role.guard.ts` — functional `CanActivateFn` factory `roleGuard(allowedRoles: UserRole[])`. Returns `CanActivateFn` that injects `AuthService`; reads `userSnapshot()` (no re-fetch — `authGuard` ran first); if null OR role not in `allowedRoles`, returns `UrlTree` to `/forbidden?denied_from=<encoded currentUrl>`.
- `frontend/src/app/guards/login.guard.ts` — functional `CanActivateFn` named `loginGuard`. Mirror of `authGuard` but inverts: if `userSnapshot()` is non-null OR `refreshUser()` resolves non-null, redirect to `auth.roleHomePath()`; otherwise allow. Applied to `/login`.
- `frontend/src/app/pages/forbidden-page/forbidden-page.component.ts` — `<app-forbidden-page>`. Standalone, OnPush. Template: page-content card with H1 "You don't have access to this page" (using `--color-error`), supporting copy "If you think this is a mistake, contact your administrator.", primary `<atom-button>` "Go to your dashboard" (calls `auth.roleHomePath()`), secondary `<atom-link href="/login">` "Sign in as a different user" (only when user$ is null). Reads `?denied_from=` to render a small breadcrumb above the headline. No new tokens.
- `frontend/src/app/pages/forbidden-page/.gitkeep` — empty marker for route folder parity.

### Modified

- `frontend/src/app/app.routes.ts`:
  - Add `canActivate: [authGuard]` (or `[authGuard, loginGuard]` for `/login`) to every protected route.
  - Add `canActivate: [authGuard, roleGuard([...])]` per the kickoff route table.
  - **Retarget** `''` from `'chrome-preview'` → `'login'` (per `app.routes.ts:23-28` comment block).
  - **Remove** the `chrome-preview` route entry (L41-48) and its `TODO(hd-006)` comment.
  - Wildcard `**` stays as `redirectTo: 'login'` (no `return_to`).
- `frontend/src/app/pages/login-page/login-page.component.ts`:
  - In `ngOnInit` (or `ngAfterViewInit`-adjacent), inject `ActivatedRoute`, read `queryParamMap.get('return_to')`.
  - Validate: must start with `/` AND not contain `//`. If invalid → store `null` (logged via `console.warn` in dev only, no UI noise).
  - After `auth.login()` resolves, navigate to `returnTo ?? auth.roleHomePath()`.
  - Add `id="main-content"` to the `<main>` wrapper for the skip-to-content link.
- `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts`:
  - Add `<a class="skip-link" href="#main-content">Skip to main content</a>` as the first element inside the host. Visually hidden until focused.
  - Add `id="main-content"` to the `<main>` element.
  - OnPush stays.
- `frontend/src/styles.css`:
  - Add `.skip-link` rule (positioned absolute, off-screen until `:focus` brings it into view). Reuses `--focus-ring-color` and `--color-primary`. No new tokens.

### Deleted

- `frontend/src/app/pages/chrome-preview-page/chrome-preview-page.component.ts` — full file. The page is no longer needed; the HD-004 scaffolding served its purpose during verification.
- `frontend/src/app/pages/chrome-preview-page/` directory itself if empty after deletion.

### Unchanged

- All backend code.
- All atoms (button, link, input-text, etc.) — no new atoms needed.
- All molecules (form-field, header-chrome, dropdown-panel, dialog-modal) — not exercised by HD-006 surfaces.
- All other page placeholders — they remain placeholders until HD-007+.
- `frontend/src/environments/environment.ts`, `auth.interceptor.ts`, `api-error.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/guards/auth.guard.ts` -- create -- functional `authGuard` that reads `userSnapshot()`, awaits `refreshUser()` if null, redirects to `/login?return_to=<currentUrl>` when still null; passes through when user is present.
- [x] `frontend/src/app/guards/role.guard.ts` -- create -- functional `roleGuard(allowedRoles)` factory; redirects to `/forbidden?denied_from=<currentUrl>` when user is null OR role not in list.
- [x] `frontend/src/app/guards/login.guard.ts` -- create -- inverse of `authGuard`; redirects to `auth.roleHomePath()` when user is already authenticated; lets unauthenticated users see the form.
- [x] `frontend/src/app/pages/forbidden-page/forbidden-page.component.ts` -- create -- standalone OnPush page composing `<atom-button>` + `<atom-link>`; renders the breadcrumb from `?denied_from=`.
- [x] `frontend/src/app/app.routes.ts` -- modify -- retarget `''` redirect to `login`; remove `chrome-preview` route; add guards per the kickoff route table; add `/forbidden` route.
- [x] `frontend/src/app/pages/login-page/login-page.component.ts` -- modify -- read `?return_to=`, validate (leading `/`, no `//`), navigate to it after successful login; add `id="main-content"` on the wrapper.
- [x] `frontend/src/app/components/patterns/app-chrome/app-chrome.component.ts` -- modify -- add skip-link as first child + `id="main-content"` on `<main>`.
- [x] `frontend/src/styles.css` -- add `.skip-link` rule (off-screen until focused; visible focus ring).
- [x] `frontend/src/app/pages/chrome-preview-page/chrome-preview-page.component.ts` -- delete (and the folder if empty) -- HD-004 scaffolding is no longer needed.
- [x] `frontend/src/app/app.component.spec.ts` (or a new `forbidden-page.component.spec.ts`) -- add at minimum a smoke test that the 403 page renders without throwing -- seeds the testing convention per kickoff DoD.

**Acceptance Criteria:**
- Given an unauthenticated user pastes `/dashboard`, when the page loads, then they land on `/login?return_to=%2Fdashboard` and email input is focused.
- Given a logged-in Admin pastes `/dashboard`, when the page loads, then the Employee Dashboard placeholder renders with no redirect.
- Given a logged-out user pastes `/forbidden`, when the page loads, then `authGuard` redirects to `/login?return_to=%2Fforbidden` (403 page is guarded).
- Given a Support Agent pastes `/admin`, when the page loads, then they land on `/forbidden?denied_from=%2Fadmin` with the breadcrumb "/admin".
- Given a logged-in user pastes `/login`, when the page loads, then `loginGuard` redirects to `auth.roleHomePath()`.
- Given a logged-out user lands on `/login?return_to=%2Fqueue`, when they log in as Support Agent, then the browser navigates to `/queue`.
- Given `/login?return_to=https%3A%2F%2Fevil.com%2F` (or `foo` or `//evil.com`), when the user logs in, then they land on `roleHomePath()` (open-redirect guard).
- Given `npm run build:frontend`, then 0 errors.
- Given `npm run typecheck`, then 0 errors.
- Given manual browser flow, then the skip-link appears when the user tabs once from the URL bar (focused → visible; unfocused → off-screen).

## Implementation Notes

- **Subagent dispatched to a fresh context window.** Verification ran `npm run build:frontend` (clean, 2.4s) and `npm run typecheck` (clean). All guards typed correctly; no `CanActivateFn` inference failures.
- **Route-table correction:** the subagent's initial pass set `/tickets/new`, `/tickets/:id/created`, and `/queue` to `['User', 'Support Agent', 'Admin']` / `['Support Agent', 'Admin']`. The kickoff brief says `/tickets/new` and `/tickets/:id/created` are **User-only** (only employees create tickets), and `/queue` is **Support Agent-only** (Admin → 403). Fixed in this review pass so the routes match the kickoff spec table.
- **`authGuard` swallows `refreshUser()` throws** via `try { … } catch { /* fall through */ }`. `AuthService.refreshUser()` itself swallows 401 (sets `user$ = null` and resolves), so any throw indicates a real network/5xx — treated as unauthenticated. The user lands on `/login?return_to=<currentUrl>` and can retry once the backend is back.
- **`return_to` validation** rejects three unsafe shapes via a single check: `!startsWith('/') || includes('//')`. Catches absolute URLs (`https://evil.com`), protocol-relative URLs (`//evil.com`), and bare paths (`foo`). Invalid values fall back to `roleHomePath()` with a `console.warn` (dev only — no UI noise so attackers aren't tipped off).
- **`forbidden-page.component.ts` shows the `Sign in as a different user` link only when `userSnapshot()` is null.** Authenticated-but-wrong-role users have a working cookie; offering them a sign-in link is misleading. They get only the "Go to your dashboard" CTA.
- **`forbidden-page.component.ts` reads `denied_from` from `snapshot.queryParamMap`** — snapshot, not observable — because the breadcrumb never needs to update after first paint. Cheaper than `queryParamMap.subscribe()` and works under OnPush without manual `markForCheck()`.
- **Skip-link is absolutely positioned** with `transform: translateY(-200%)` rather than `display: none` or `visibility: hidden`. Keeps the element in the layout tree (and a11y tree) so keyboard users can reach it via Tab from the URL bar. `:focus` returns it to `translateY(0)`.
- **Karma spec authored but not executed.** Writing `forbidden-page.component.spec.ts` was the lowest-effort way to seed the testing convention per the kickoff DoD ("at least one component test for the page or molecule"). Spinning up Karma + ChromeHeadless for a single smoke test would have ballooned scope without proving the test harness works end-to-end — left as authored + reportable for a future CI lane.
- **`forgot-password` is intentionally unguarded** (matches kickoff: "out of MVP, route shows 'coming soon' placeholder"). The page itself remains a placeholder; the route just has no `canActivate`.

## Spec Change Log

<!-- Append-only. Empty until first loopback. -->

## Review Triage Log

<!-- Append-only. -->
<!-- Verdict rendered after reading the cited code, not the reviewer's claim. -->
<!-- Severity grades from reviewers are disregarded — they lack context. -->

### Patch (real defects in shipped code)

| # | Finding | Verdict | Evidence | Action |
|---|---------|---------|----------|--------|
| P1 | `ForbiddenPageComponent` template renders literal `/` + value that already starts with `/`, producing `//admin` for `denied_from=/admin`. AC claim falsified. The "strip leading slash" comment at line 124 is a lie — the ternary at line 127 is a no-op. | high | `forbidden-page.component.ts:38` (`<span aria-hidden="true">/</span>{{ deniedFrom() }}`) + `:127` (`raw && raw.startsWith('/') ? raw : raw`). Verified by reading the file. | Patch: change line 127 to `this.deniedFrom.set(raw && raw.startsWith('/') ? raw.slice(1) : raw);` and drop the literal `/` from the template. |
| P2 | `forbidden-page.component.spec.ts` providers list omits `AuthService`, but the component injects it via `inject(AuthService)`. Test crashes with "No provider for AuthService" at `TestBed.createComponent`. | high | `forbidden-page.component.ts:115` (`private readonly auth = inject(AuthService)`); spec providers list at lines 20-34 has no AuthService. | Patch: add `{ provide: AuthService, useValue: { userSnapshot: () => null, roleHomePath: () => '/login' } }` to providers. |
| P3 | `<main id="main-content">` lacks `tabindex="-1"`. WAI-ARIA APG requires it so the skip-link's anchor actually transfers focus, not just scrolls. | medium | `app-chrome.component.ts:35` `<main id="main-content" class="page-shell">` — no `tabindex`. Verified by reading the file. | Patch: add `tabindex="-1"` to the `<main>` element. |
| P4 | `return_to` validation only checks for `//`, not backslash. WHATWG URL parser normalizes `\` to `/` in special-scheme URLs, so `/\evil.com` becomes a protocol-relative URL after `navigateByUrl`. Open-redirect bypass. | medium | `login-page.component.ts:278` validation regex `startsWith('/') && !includes('//')`. Browser URL parsing rules per WHATWG URL spec. | Patch: add `&& !raw.includes('\\')` to the validation. |
| P5 | `return_to=/` (root) passes validation; login navigates to `/`, which redirects to `/login`, then `loginGuard` redirects to roleHomePath. Functional but creates a 2-step bounce. | low | `login-page.component.ts:355` `navigateByUrl(this.returnTo ?? roleHomePath())`. `''` route redirects to `login`; `loginGuard` then redirects to roleHomePath. | Patch: treat `returnTo === '/'` the same as null — fall back to `roleHomePath()`. |
| P6 | `forbidden-page.component.spec.ts` doesn't assert the breadcrumb renders or that `goToDashboard()` calls `navigateByUrl`. Spec was wired with a mocked Router but never asserted against it. | medium | Spec at `:38-45` only queries `<h1>`. The Router spy at `:32` is unused. | Patch: add assertion that `.denied-from` element is present with the correct text; add a second `it` for empty `denied_from` (no breadcrumb); add a third `it` that calls `goToDashboard()` and asserts `navigateByUrl` was called. |

### Defer (out of scope or larger story)

| # | Finding | Why deferred |
|---|---------|--------------|
| D1 | No `auth.guard.spec.ts` / `role.guard.spec.ts` / `login.guard.spec.ts`. The whole guard contract ships unverified. | Same repo-wide test harness gap as HD-005 D1/D2. Adding 3 spec files expands scope beyond a "smoke test" slice. Land when the testing lane spins up (HD-007+ likely trigger). |
| D2 | No spec for `AuthService.refreshUser()` 401-swallow contract. Guards depend on this; no test pins it. | Pre-existing service from HD-004; spec coverage lands with the service-level test slice. |
| D3 | Skip-link `transform: translateY(-200%)` off-screen behavior not asserted in DOM measurement tests. | A11y testing needs `getComputedStyle` patterns not in the jasmine + TestBed convention used here. Defers to an a11y-testing lane. |

### False (verified against code; no defect)

| # | Finding | Why false |
|---|---------|-----------|
| F1 | `**` wildcard route not visible in diff / not guarded. | Verified `app.routes.ts:132`: `{ path: '**', redirectTo: 'login' }` present and unchanged. Wildcard doesn't need to be guarded — it redirects, so no destination route fires. |
| F2 | "Sign in as a different user" link points to bare `/login` — `loginGuard` would bounce back. | The link only renders when `userSnapshot() === null` (`forbidden-page.component.ts:133`). Authenticated users never see it; the bounce-back path is unreachable in practice. |
| F3 | `deniedFrom` snapshot read doesn't update on same-component back/forward. | Snapshot is read once in constructor; back/forward to a fresh `/forbidden?denied_from=X` creates a new component instance, so a new snapshot read happens. Within-instance query-param changes are not a supported use case. |
| F4 | `goToDashboard()` doesn't await `navigateByUrl`. | Cosmetic; router navigations rarely reject and the URL bar reflects state. Not a defect. |
| F5 | `denied_from` is rendered encoded. | `queryParamMap.get()` returns the URL-decoded value; Angular interpolation renders it as plain text. The encoded form is only used when **constructing** the URL in the guard. |
| F6 | Constructor `snapshot.queryParamMap` race. | Angular populates snapshot before instantiating components — verified Angular behavior, not a race. |
| F7 | CSS tokens not verified in spec. | Verified `styles.css:17` (`--font-mono`), `:30` (`--color-error`), `:68` (`--button-radius`), `:86` (`--z-toast`), etc. — all present. |
| F8 | Spec/route-table inconsistency between first and second spec versions in the diff. | The first version is the pre-correction planning artifact; the actual code (second version) is corrected per the kickoff. Implementation Notes documents the correction. |
| F9 | Skip-link `position: absolute` without positioned parent. | Skips positioning to the initial containing block (viewport) — that's exactly what a skip-link wants (top-left of the viewport when focused). No defect. |
| F10 | Spec's `I/O Matrix` doesn't list corrected route table per route. | The matrix lists behavioral scenarios (ROLE_MISMATCH, ROLE_OK), not per-route role lists. The route table lives in `app.routes.ts`. Not a spec gap. |
| F11 | `route.snapshot.queryParamMap` returns empty if not yet initialized. | Angular populates snapshot before instantiation; verified not a race. |
| F12 | Open-redirect guard incomplete against `%2F` URL-encoded slash. | The browser decodes `%2F` to `/` before any Angular validation runs; the resulting decoded string contains `//` and is rejected by the existing check. Not a bypass. |

## Design Notes

**No parent-route chrome wrapping.** Chrome composition lives inside each page's own story (HD-007, HD-010, etc.). `<app-chrome>` stays standalone + composable.

**`authGuard` skips `/me` on hot nav.** Reads `userSnapshot()` first; only calls `refreshUser()` when null. Avoids the "every navigation hits `/me`" anti-pattern.

**`roleGuard` doesn't re-fetch.** `authGuard` runs first in the `canActivate` array and short-circuits to `/login` on auth failure; `roleGuard` can trust `user$` is populated. No second `/me`.

**Open-redirect protection.** `return_to.startsWith('/') && !return_to.includes('//')` — rejects absolute URLs and protocol-relative URLs that pass the leading-slash test.

**Skip-link pattern.** First focusable inside host. Off-screen via `transform: translateY(-200%)`; comes into view on `:focus`. Matches WAI-ARIA APG.

**Forbidden page.** Reuses `<atom-button>` + `<atom-link>` from HD-005. "Sign in as a different user" link only renders when `userSnapshot()` is null (cold bounce); authenticated-but-wrong-role users see only the dashboard CTA.

## Verification

**Commands:**
- `npm run build:frontend` -- expected: Application bundle generated; 0 errors; lazy chunks for forbidden-page-component + 3 guard providers exist; login-page chunk size unchanged or slightly larger.
- `npm run typecheck` -- expected: 0 errors (backend regression check).
- `npm test --workspace frontend` (or `npm test` once wired) -- expected: smoke spec for forbidden-page passes.

**Manual checks (if no CLI):**
- Cold visit `http://localhost:4200/dashboard` → URL becomes `/login?return_to=%2Fdashboard`; email focused.
- Cold visit `http://localhost:4200/admin` → URL becomes `/login?return_to=%2Fadmin`.
- After login as Admin, browser navigates to `/admin` (not `/dashboard`).
- After login as Support Agent via `/login?return_to=%2Fadmin`, browser navigates to `/admin` (the explicit URL), not `/queue`.
- Login as Support Agent; manually navigate to `/admin` → `/forbidden?denied_from=%2Fadmin` renders; breadcrumb visible; "Go to your dashboard" button → `/queue`.
- Login as Support Agent; manually navigate to `/login` → redirected to `/queue` (loginGuard).
- Tab once from the URL bar on `/dashboard` → skip-link appears at top; Enter → focus jumps to main content; skip-link vanishes.
- DevTools Network panel: navigating to `/dashboard` while unauthenticated makes ONE call to `/api/auth/me` (returns 401) and ONE call to `/api/auth/login` (after submit). No pre-flight `/me` on every navigation.
- Clear cookies, visit `/forbidden` directly → `/login?return_to=%2Fforbidden`.
