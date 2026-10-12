---
title: 'HD-018 — Password change (self-service)'
---

# HD-018 — Password change (self-service)

## Intent

There is currently no way for an authenticated user to change
their password. The only paths in / out of the system are the
login form and the Admin-managed `PUT /api/users/:id/role` and
`/status` flows. An employee who suspects their password is
compromised has no self-service remedy — they must ask an
Admin to deactivate them, then ask another Admin to create a
new account. That's a real usability gap.

HD-018 closes the gap with a self-service password-change
flow:

- **Backend**: `PATCH /api/auth/me/password`. Verifies the
  current password against the stored hash (defense-in-depth —
  the JWT is the proof of identity, but requiring the current
  password ensures a stolen cookie alone can't change the
  account password). On success returns 204 and updates the
  stored hash. The existing JWT cookie stays valid (token
  rotation is out-of-MVP; see "Notes for the implementer").
- **Frontend**: A new `/profile/password` page reachable from
  the header-chrome's profile menu ("Change password" entry
  above the existing "Log out" action). Three fields (current,
  new, confirm), per-field validation matching the backend
  exactly, success banner + auto-redirect to the role-correct
  home.

A future HD-019 can add the matching forgot-password / reset
flow (with email-token transport). That's a bigger story
(email service is a real dependency) and is intentionally
out-of-scope here — HD-018 is the closed-loop, no-external-
dependencies slice.

## Boundaries

### In scope

- 1 new backend route (`PATCH /api/auth/me/password`).
- 1 new backend handler (`changePassword` in
  `authController.ts`).
- 1 new backend validator (`validateChangePasswordBody` in
  `utils/validation/authValidation.ts`) + 1 new spec file
  (13 tests).
- 1 new backend controller spec (`authController.spec.ts`)
  covering 6 cases (204 happy, 400 bad body, 400 array, 403
  wrong current, 401 deactivated, 401 missing).
- 1 new OpenAPI doc entry + 1 new request schema
  (`ChangePasswordRequest`).
- 1 new `authController.spec.ts` (no authController spec
  existed before).
- 1 new frontend service method (`AuthService.changePassword`).
- 4 new tests in `auth.service.spec.ts`.
- 1 new frontend page (`ChangePasswordPageComponent` at
  `/profile/password`) + 9-page spec.
- 1 new route in `app.routes.ts` (authGuard'd).
- 1 new entry in the header-chrome profile dropdown
  ("Change password" between the existing divider and the
  "Log out" action).

### Out of scope

- No token rotation (existing JWT cookie stays valid after a
  password change). See "Notes for the implementer".
- No "forgot password" / email-token reset flow
  (HD-019 territory).
- No Admin-set-password flow (Admins can already deactivate +
  recreate; HD-019 will likely add a real "Admin sets another
  user's password" endpoint).
- No password-strength meter UI. The 8-char + letter + number
  policy is enforced; the spec doesn't call for live feedback
  beyond the inline error after a failed submit.
- No re-authentication requirement for the current-password
  field (we already require the user to type it, which is
  functionally equivalent).
- No audit log of password changes (we'd need a separate
  ActivityLog row keyed on `userId`, not `ticketId` — bigger
  schema work, deferred).
- No email notification on password change.
- No backend integration test (no in-memory DB — D9 gap
  still open; the controller spec mocks User scope).

## I/O matrix

| User action | System response |
|---|---|
| Open `/profile/password` from the chrome menu | Page renders the form, focused on the Current password field. |
| Submit empty form | Per-field errors: "Enter your current password." / "Enter a new password." / "Re-enter the new password." changePassword NOT called. |
| Submit with mismatched confirm | "Passwords don't match." under the confirm field. changePassword NOT called. |
| Submit valid form | PATCH 204 → green "Password changed. Taking you back…" banner → after 1.5s, `navigateByUrl(roleHomePath())`. |
| Submit with new password < 8 chars (client-side) | "New password must be at least 8 characters." under the new-password field. changePassword NOT called. |
| Submit with new password with no letter (client-side) | "New password must include a letter." under the new-password field. changePassword NOT called. |
| Submit with new password with no number (client-side) | "New password must include a number." under the new-password field. changePassword NOT called. |
| `PATCH /auth/me/password` with new password 5 chars (server-side bypass attempt) | 400 `validation_error` with `fields.newPassword` mapped to the new-password field. |
| `PATCH /auth/me/password` with wrong current password | 403 `invalid_credentials` → "Your current password is incorrect." under the current-password field. |
| `PATCH /auth/me/password` with deactivated user | 401 `account_inactive` + `Set-Cookie: auth=;` cleared. Top-of-form banner. The next `/me` round-trip the chrome does on cold load will see the user is gone and bounce to /login. |
| `PATCH /auth/me/password` with no session cookie | 401 `unauthenticated` from authMiddleware. Top-of-form banner. |
| Network failure | 0 / `network_error` → "Could not reach the server. Check your connection." Top-of-form banner. |
| Cancel link | `navigateByUrl(roleHomePath())`, no API call. |
| Show/hide password toggle | All three inputs flip `type` between 'password' and 'text'. |

## Test plan

### Unit (Jest) — backend

`backend/src/utils/validation/authValidation.spec.ts` (new
file, 13 tests):

- Happy path returns `{ currentPassword, newPassword }`.
- Rejects a non-object body (array / null) with
  `fields._body = "Request body must be a JSON object."`.
- Rejects a missing / non-string `currentPassword` with
  `fields.currentPassword = "Enter your current password."`.
- Rejects a missing / non-string `newPassword` with
  `fields.newPassword = "Enter a new password."`.
- Rejects a newPassword under 8 chars with
  `fields.newPassword = "New password must be at least 8 characters."`.
- Accepts a newPassword at exactly 8 chars (boundary).
- Rejects a newPassword over 128 chars with
  `fields.newPassword = "New password must be 128 characters or fewer."`.
- Rejects a newPassword with no letter with
  `fields.newPassword = "New password must include a letter."`.
- Rejects a newPassword with no number with
  `fields.newPassword = "New password must include a number."`.
- Rejects an unknown extra key with
  `fields._body = "Unknown field \"<name>\". Allowed: ..."`.
- Rejects an unknown extra key in the error path with the
  expected per-key message.

`backend/src/controllers/authController.spec.ts` (new file,
6 tests):

- 204 happy path: bcrypt.compare returns true, the new hash
  is computed, the user row is updated.
- 400 with empty newPassword: validator throws, `next` is
  called with the HttpError, User.findByPk NOT called.
- 400 with array body: same shape.
- 403 with wrong current password: bcrypt.compare returns
  false, `next` is called with `HttpError(403,
  'invalid_credentials', ...)`, User.update NOT called.
- 401 with deactivated user (findByPk returns isActive=false):
  clearAuthCookie called, `next` called with
  `HttpError(401, 'account_inactive', ...)`.
- 401 with missing user (findByPk returns null): same as
  above.

### Unit (Jasmine) — frontend

`frontend/src/app/services/auth.service.spec.ts` extends
with 4 tests in a new `changePassword` describe:

- 204 happy: PATCH `/auth/me/password` with
  `{ currentPassword, newPassword }`, resolves.
- 400 with `fields.newPassword` → throws `ApiError(400,
  'validation_error')` with the fields map.
- 403 with `invalid_credentials` → throws `ApiError(403,
  'invalid_credentials')` with the server's message.
- 401 with `account_inactive` → throws `ApiError(401,
  'account_inactive')`.

`frontend/src/app/pages/change-password-page/change-password-page.component.spec.ts`
(new file, 9 tests):

- Empty form submit → per-field errors, changePassword NOT
  called.
- Mismatched confirm → "Passwords don't match." under
  confirm, changePassword NOT called.
- Happy path (fakeAsync + tick(1600)) →
  changePassword called, success banner renders, after
  1.5s `navigateByUrl('/dashboard')`.
- 400 with `fields.newPassword` → new-password field shows
  the server's message.
- 403 with `invalid_credentials` → current-password field
  shows "Your current password is incorrect."
- 401 with `account_inactive` → top-of-form banner.
- Network error (`ApiError(0, 'network_error', ...)`) →
  top-of-form banner with the server's message.
- Cancel → navigateByUrl('/dashboard'), no API call.
- Password show/hide toggle flips `passwordVisible` signal.

### Integration — OpenAPI doc

`backend/src/docs/openapi.spec.ts` extended:

- New path `/auth/me/password` (1 new entry → 21 paths total).
- New schema `ChangePasswordRequest` (1 new entry).

### Manual browser smoke

- Log in as `user@company.com`. Click avatar → menu shows
  "Change password" + "Log out". Click "Change password" →
  `/profile/password` form renders.
- Submit empty → 3 inline errors, no spinner.
- Fill in `password` / `password` / `password` (all 8+ chars
  with letter+number) → submit → green "Password changed."
  banner → after 1.5s, redirected to `/dashboard`.
- Open DevTools → Application → Cookies → confirm `auth`
  cookie is still there (token not rotated).
- Log in again with the new password → success.
- Log in with the old password → "Email or password is
  incorrect." (the hash was actually updated).
- Try changing to `short` (5 chars) → inline error
  "New password must be at least 8 characters.".
- Try changing to `abcdefgh` (no number) → inline error
  "New password must include a number.".
- Try changing with the wrong current password → inline
  error "Your current password is incorrect." (from 403).
- Stop the backend, submit → top-of-form banner with
  "Could not reach the server. Check your connection.".
- Open DevTools Network tab, confirm exactly one
  `PATCH /api/auth/me/password` request, with body
  `{ "currentPassword": "...", "newPassword": "..." }`
  and a 204 response.
- Visit `http://localhost:3000/api/docs` → confirm the
  new endpoint appears under the "Auth" tag.

## Files

**New:**

- `backend/src/utils/validation/authValidation.ts`
- `backend/src/utils/validation/authValidation.spec.ts`
- `backend/src/controllers/authController.spec.ts`
- `frontend/src/app/pages/change-password-page/change-password-page.component.ts`
- `frontend/src/app/pages/change-password-page/change-password-page.component.spec.ts`
- `_bmad-output/implementation-artifacts/spec-hd-018-password-change.md`
  (this file)
- `_bmad-output/hd018.diff`

**Modified:**

- `backend/src/controllers/authController.ts` (add
  `changePassword` handler + JSDoc `@openapi` block)
- `backend/src/routes/auth.ts` (mount the new route behind
  `authMiddleware`)
- `backend/src/docs/openapi.ts` (add `ChangePasswordRequest`
  to `components.schemas`)
- `backend/src/docs/openapi.spec.ts` (assert new path +
  schema in the registry)
- `frontend/src/app/services/auth.service.ts` (add
  `changePassword` method)
- `frontend/src/app/services/auth.service.spec.ts` (4 new
  tests; also drop the unused `authInterceptor` registration
  for service-level isolation, matching the
  `user.service.spec.ts` / `ticket.service.spec.ts` pattern)
- `frontend/src/app/components/molecules/header-chrome/header-chrome.component.ts`
  (add "Change password" menu entry + `goChangePassword`
  handler)
- `frontend/src/app/app.routes.ts` (add `/profile/password`
  route, authGuard'd)

## Implementation order

1. Write `validateChangePasswordBody` + its spec. Run
   `cd backend && npm test` — 19/19 validator tests pass.
2. Write `changePassword` handler in `authController.ts` +
   the JSDoc `@openapi` block.
3. Mount the route in `routes/auth.ts` behind
   `authMiddleware`.
4. Add `ChangePasswordRequest` to `openapi.ts` + update
   `openapi.spec.ts` to assert the new path.
5. Write `authController.spec.ts` (no existing file).
   Run `cd backend && npm test` — 30/30 controllers
   (was 24, +6) + 19/19 validators + 1/1 openapi = 50/50.
6. `cd backend && npm run typecheck` — exits 0.
7. Add `changePassword` to `AuthService` + 4 spec tests.
   Run the auth spec in isolation — 22/22.
8. Write `ChangePasswordPageComponent` + the route.
9. Add the "Change password" entry to the header-chrome
   dropdown.
10. Write the page spec. Run it in isolation — 9/9.
11. Run the full frontend suite — 329/335 (was 316/322;
    +13 net tests, 0 new failures — same 6 pre-existing
    baseline).
12. `cd frontend && npx ng build --configuration=development`
    — exits 0.
13. Generate `hd018.diff` against the HD-017 baseline
    (`git diff 3757be9`).
14. Two-commit pattern:
    - `feat(HD-018): self-service password change page + endpoint`
    - `docs: HD-018 implementation diff snapshot`
15. Push to `origin/main`.

## Verification

1. `cd backend && npm test` — **114/114 pass** (was 95, +19:
   13 new authValidation + 6 new authController).
2. `cd backend && npm run typecheck` — exits 0.
3. `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox` — **329/335 pass**
   (was 316/322; +13 net tests = 4 auth.service + 9
   change-password-page; same 6 pre-existing baseline
   failures; same 1 Jasmine afterAll global error).
4. `cd frontend && npx ng build --configuration=development`
   — exits 0.
5. Manual browser smoke per the I/O matrix.

## Reuse (no new atoms/molecules)

- **Existing form atoms** — `<form-field>`, `<atom-input>`,
  `<atom-button>`, `<atom-link>`, `<atom-show-password-toggle>`
  — the page composes the same set LoginPage already uses.
  No new atom or molecule.
- **`ApiError` + `fields` map** — same per-field error pattern
  from `create-ticket-page` and `login-page`. The 400 path
  is `fields.currentPassword` / `fields.newPassword` /
  `fields._body`; the 403 path is `err.errorCode ===
  'invalid_credentials'`; the 401 path is
  `err.errorCode === 'account_inactive' || err.status === 401`.
- **`<app-chrome>`** — wraps the page so the persistent
  header renders. Mirrors every other post-login page.
- **Profile dropdown divider + profile-action** — reuses
  the existing `.profile-action` class on the "Change
  password" button. No new CSS for the menu item itself;
  one new line in the dropdown is all it takes.
- **`HttpTestingController` + `provideHttpClient(withInterceptorsFromDi())`**
  — same pattern as `user.service.spec.ts` and
  `ticket.service.spec.ts`. The `authInterceptor` has its
  own coverage in the page-level specs; service-level tests
  exercise the service's wire contract in isolation.
- **`HttpClient.patch` with `observe: 'response'`,
  `responseType: 'json'`** — same shape as `login()` and
  `logout()`. The 204 is fine to ignore (no body to unwrap).

## Notes for the implementer

- **Token rotation** — we deliberately do NOT rotate the
  JWT on a successful password change. The reasons:
  1. The user would be forced to re-login immediately,
     which is jarring UX for a 5-second password change.
  2. The blast radius of a stolen cookie is bounded by the
     cookie's expiry (default 24h, see
     `utils/jwt.ts:TOKEN_EXPIRY`). If you suspect your
     password is compromised, you'd already be doing a
     password change because of the suspicion, and you'd
     also log out (the chrome has a Log out button).
  3. Token rotation needs a "tokens issued before N" stamp
     on the JWT or a server-side token-version counter,
     which is a meaningful schema change. Worth a future
     security story, not in MVP.
  If a stronger guarantee is required, a future
  HD-019-or-later can add a `tokenVersion` column to
  `users` and check it in `authMiddleware`.

- **403 vs 401 for wrong current password** — we picked 403
  intentionally. 401 is "you are not authenticated"; the
  user IS authenticated (they have a valid JWT cookie) but
  the credential they presented (current password) is wrong.
  403 "forbidden" is the right status. The login endpoint
  uses 401 because there the user is NOT yet authenticated
  and the wrong password is a credential-rejection. The
  two shapes diverge by design.

- **bcrypt cost factor (10)** — matches the existing
  `utils/password.ts:DUMMY_HASH` definition. If the team
  later raises it to 12 for new hashes, the old hashes
  will still work on next login (bcrypt embeds the cost in
  the hash itself).

- **`clearAuthCookie` on the deactivated path** — when
  `User.findByPk` returns a deactivated user (between the
  authMiddleware check and our handler), we clear the
  cookie. The next `/me` round-trip the chrome's mount
  effect does will see the missing cookie, the user$ will
  emit null, and the chrome's profile trigger will collapse
  — at which point the user is effectively logged out and
  the next page navigation will land on /login via the
  authGuard.

- **Per-page `setTimeout(1500)` for the success banner** —
  the page's happy-path test uses `fakeAsync` + `tick(1600)`
  to flush this synchronously. Important: if the test
  spec were to use a real `setTimeout` + `await` instead,
  the timer would fire during a later spec (the test
  runner doesn't isolate real timers across specs in
  Karma + Jasmine), polluting the suite. fakeAsync is the
  right tool.

- **Client-side + server-side password complexity** —
  intentionally redundant. The client-side checks give
  instant feedback; the server-side checks are the source
  of truth (a curl attacker can bypass the client). The
  error messages match exactly so the user sees the same
  text whether the validator catches it or the controller
  catches it.

- **Why no `Bearer` or CSRF protection** — the endpoint
  rides the same httpOnly cookie as every other authed
  request. The `authMiddleware` validates the JWT. CSRF
  risk is bounded because the cookie is SameSite=Lax
  (set in `utils/cookies.ts:COOKIE_OPTIONS`), so a
  cross-site form post can't carry it. The endpoint is
  POST-shaped (PATCH is not a form method), so the
  browser-issued cross-site request primitive can't even
  reach it without a preflight.

- **OpenAPI `@openapi` block placement** — placed
  immediately above the `changePassword` export in
  `authController.ts`, matching the convention used by
  every other handler. `swagger-jsdoc` picks it up at
  boot and merges it into `paths` under
  `/auth/me/password`.
