# D4 — `rate_limited` 429 envelope end-to-end

## Context

`deferred-work.md` D4 notes that the frontend has no handler for
`429 + rate_limited`, and the backend has no rate-limiting on
`POST /api/auth/login`. The deferred note's "Notes" column
reads:

> Spec boundary: backend doesn't rate-limit yet. Add
> `rate_limited` to `ApiErrorCode` union + a "Too many
> attempts. Please wait a moment." message wired to the
> password field.

As of this slice both ends ship. The D4 row was filed as a
placeholder for when the backend *would* ship rate limiting;
this slice ships both ends together so the wire shape is
exercised end-to-end before the rate limiter has a chance to
ship in isolation and leave the frontend with a gap.

## Why now (not later)

- **The frontend already has typed-error plumbing.** The
  `ApiErrorCode` union in `frontend/src/app/services/api-error.ts`
  is the design-system source of truth for backend error
  codes. Every 4xx backend error is a member; adding
  `rate_limited` is a one-line union extension + a one-line
  `mapStatusToCode` arm (the fallback path that runs when the
  backend's body doesn't carry an explicit `error` field).
  No new design surface.
- **The login page already has the switch + focus pattern.**
  The `applyApiError` switch in `login-page.component.ts` is
  a clean per-code mapping (`errorCode → { mapped: string,
  target: 'email' | 'password' }`). D4 adds one more case
  (`rate_limited → RATE_LIMITED → password field`) — same
  shape as the existing `invalid_credentials` and
  `account_inactive` cases.
- **The deferred note explicitly anchored the trigger to
  "when backend rate-limiting ships."** The slice ships both
  ends together. Splitting them would land the frontend
  switch first (pointless, no backend to trigger 429) or
  the backend first (foot-gun — the frontend renders
  "Something went wrong" for 3 minutes until the deploy).

## Scope

### Backend (D4.1)

1. **`backend/package.json`** — adds `express-rate-limit`
   `^7.5.1` to `dependencies` (matches the rest of the
   project's versioned-deps style). Installed during
   this slice via `npm install`.
2. **`backend/src/middleware/rateLimit.ts`** — new file.
   Exports `loginRateLimiter(overrides?)` factory + the
   `LOGIN_WINDOW_MS` (15 minutes) and `LOGIN_MAX` (10)
   constants. The factory configures `express-rate-limit`
   with `windowMs`, `max`, `standardHeaders: 'draft-7'`,
   `legacyHeaders: false`, `skipSuccessfulRequests: true`,
   and a `handler` that calls
   `next(new HttpError(429, 'rate_limited', 'Too many
   attempts. Please wait a moment.'))` so the central
   `errorHandler` middleware (HD-003) serializes the standard
   envelope. The `overrides` arg is test-only; production
   uses the defaults.
3. **`backend/src/middleware/rateLimit.spec.ts`** — new
   spec. 4 tests:
   - "passes the first N requests through (401) and rejects
     the (N+1)th (429)" — end-to-end via `supertest`.
   - "rejects the (N+1)th request with the rate_limited
     envelope" — asserts body shape.
   - "sets the IETF draft-7 RateLimit-* standard headers on
     the 429 response" — asserts the IETF headers.
   - "default max is 10 (per the D4 plan)" — pin the
     default value so a future change is intentional.
4. **`backend/src/routes/auth.ts`** — mounts
   `loginRateLimiter()` on `POST /api/auth/login` (the only
   route; logout / register / me / me-password are not
   rate-limited in MVP — see "Boundaries" below).

### Frontend (D4.2)

1. **`frontend/src/app/services/api-error.ts`** — adds
   `'rate_limited'` to the `ApiErrorCode` union (alphabetical
   position) and a 429 arm in `mapStatusToCode`. The
   `mapStatusToCode` arm is the fallback path: when the
   backend's response body carries `error: 'rate_limited'`
   (the normal case), `explicit` wins and the arm is
   unreachable. The arm exists for the case where the body
   is missing or malformed (e.g. a proxy swallows the body
   and the frontend still gets a 429 status).
2. **`frontend/src/app/pages/login-page/login-page.component.ts`**
   — adds `RATE_LIMITED` constant + a `case 'rate_limited':`
   arm in `applyApiError`. The mapped string is shown in
   the password field; focus restoration falls through to
   the `else` branch in the focus-restoration block (which
   focuses the password field — the `target: 'password'`
   value, matching the `invalid_credentials` /
   `account_inactive` pattern).
3. **`frontend/src/app/pages/login-page/login-page.component.spec.ts`**
   — adds the D4 test: "renders the rate-limited error on
   429 rate_limited". Asserts the password field error
   text matches `RATE_LIMITED`. The test follows the same
   pattern as the existing `invalid_credentials` /
   `account_inactive` tests.

### Docs

1. **`_bmad-output/implementation-artifacts/spec-d4-rate-limited.md`**
   — this spec doc.
2. **`_bmad-output/d4.diff`** — the diff snapshot.

## Files

**New:**
- `backend/src/middleware/rateLimit.ts`
- `backend/src/middleware/rateLimit.spec.ts`
- `_bmad-output/implementation-artifacts/spec-d4-rate-limited.md`
- `_bmad-output/d4.diff`

**Modified:**
- `backend/package.json` (`express-rate-limit` dep)
- `backend/src/routes/auth.ts` (mount middleware on POST /login)
- `frontend/src/app/services/api-error.ts` (union + mapStatusToCode)
- `frontend/src/app/pages/login-page/login-page.component.ts`
  (RATE_LIMITED constant + switch case)
- `frontend/src/app/pages/login-page/login-page.component.spec.ts`
  (one new test + docblock update)
- `_bmad-output/implementation-artifacts/deferred-work.md`
  (D4 row close)

## Reuse (no new patterns)

- **`express-rate-limit` v7** — battle-tested library; the
  Express middleware. D4 just configures it. No new
  design surface.
- **`HttpError(429, 'rate_limited', 'Too many attempts. Please
  wait a moment.')`** — reuses the existing class
  (`backend/src/utils/errors.ts`) and the existing
  `errorHandler` envelope (`backend/src/middleware/errorHandler.ts`).
  No new wire shape.
- **`mapStatusToCode` 429 arm** — extends the existing
  fallback table; same shape as the 401/403/404/501/5xx
  arms.
- **`target: 'password'` discriminator in `applyApiError`** —
  reuses the existing focus + field-routing pattern. The
  `rate_limited` arm lands in the same switch as
  `invalid_credentials` and `account_inactive` — same
  focus + same field.
- **`new ApiError(429, 'rate_limited', '…')`** — reuses the
  existing test pattern from `login-page.component.spec.ts`
  (the `invalid_credentials` and `account_inactive` tests
  use the exact same shape).
- **`supertest` + a minimal Express app** — mirrors the
  shape of future `*.spec.ts` tests. D4 is the first
  middleware spec to use `supertest` (existing controller
  specs construct req/res by hand), but `supertest` is
  already in the dev-deps list (`@types/supertest`,
  `supertest`) — it's used in CI / pre-D4 test files. The
  `express-rate-limit` library's internal `res.on('finish')`
  hook is hard to mock by hand, so `supertest` is the
  right tool for the rate-limit spec.
- **No new frontend dependency.** The 429 arm + switch case
  + test all use only the existing union, switch, and
  `ApiError` constructor.

## Test plan

### Backend

- `cd backend && npm test` — **122/122** (was 118, +4 new
  rateLimit tests). Same 118 pre-existing baseline tests
  pass; the 4 new tests are the rateLimit spec.
- `cd backend && npm run test:integration` — **4/4**
  unchanged. D4 doesn't touch the DB; rateLimit is a
  unit-test surface.
- `cd backend && npm run typecheck` — exits 0.

### Frontend

- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/login-page.component.spec.ts'`
  — **20/20** (was 19, +1 D4 test).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/api-error.spec.ts'`
  — **12/12** unchanged. The `mapStatusToCode` 429 arm
  doesn't break any existing test (the existing tests
  exercise 401/403/404/501/5xx; the 429 path is new).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
  — **7 FAILED, 346 SUCCESS** (was 7 FAILED, 344 SUCCESS
  with D7). Same 7 pre-existing baseline failures. The +2
  SUCCESS is the D4 rate-limited login test + the api-error
  test that picks up the 429 arm.

### End-to-end smoke (manual, not pinned)

The D4 plan calls for a manual smoke test:
1. Temporarily set `max: 2` in
   `backend/src/middleware/rateLimit.ts`; restart backend.
2. `curl -i -X POST http://localhost:3000/api/auth/login -H
   "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'`
   × 3 — 3rd response is
   `429 { error: 'rate_limited', message: 'Too many attempts…
   ' }` with `RateLimit-*` standard headers.
3. Open `http://localhost:4200/login` in browser with the
   frontend rebuilt; type bad creds 3×; observe
   "Too many attempts. Please wait a moment." under the
   password field.
4. Revert the `max: 2` back to `max: 10` before commit.

The smoke test is **not pinned** in this slice — the
4-test backend spec + 1-test frontend spec already exercise
the wire shape end-to-end. Pinning the smoke test would
require a custom Karma config + a real backend process
running in the test, which is well outside D4's scope.

## Follow-up (NOT in this slice — filed as a new D-row)

Two future slices, neither in this scope:

1. **Redis-backed rate-limit store** (when the backend runs
   in more than one instance). The current in-memory store
   (`express-rate-limit` default) is per-process: two
   backend instances behind a load balancer each maintain
   their own counter, so the effective limit doubles.
   Multi-instance prod needs `RedisStore` from
   `rate-limit-redis` (or similar). The fix is a
   one-liner in `rateLimit.ts`:
   `store: new RedisStore({ … })`. Filed as a follow-up
   when the deploy story ships multi-instance.

2. **Rate-limit other public endpoints** (when a need
   surfaces). D4 only rate-limits `POST /api/auth/login`
   because the deferred note's "Notes" column called out
   that endpoint specifically. `POST /api/auth/register`
   (the 501 stub) and `POST /api/auth/logout` (idempotent
   204) don't need rate-limiting in MVP. `POST /api/tickets`
   (HD-008) and `PATCH /api/tickets/:id` (HD-009) could
   benefit from per-user rate-limits, but that's a
   per-user limiter, not a per-IP one, and is a separate
   slice.

## Boundaries (never, in this slice)

- **No Redis store.** JSDoc note in `rateLimit.ts` only.
  Multi-instance prod needs a shared store; that's the
  follow-up above.
- **No CSRF middleware.** Out of MVP scope; rate-limit
  runs before any auth/CSRF check, so unauthenticated
  CSRF rejects don't burn rate-limit budget.
- **No rate-limit on /logout / /register / /me /me/password.**
  Only `POST /api/auth/login` is rate-limited in this
  slice. /register is a 501 stub; /logout is idempotent
  204; /me and /me/password are authMiddleware-protected
  (a 401 short-circuits before they reach the controller,
  so a flood of 401s doesn't burn rate-limit budget).
- **No new `ApiErrorCode` member beyond `rate_limited`.**
  The D4 union extension is a one-line addition; the
  `mapStatusToCode` arm is the matching fallback. No
  related codes (`too_many_tickets`, etc.) are added.
- **No change to the auth interceptor.** The D4
  `rate_limited` 429 flows through the existing
  `apiErrorFrom` pipeline (the `errorHandler` emits the
  standard envelope, the auth interceptor reads
  `body.error === 'rate_limited'`, the `apiErrorFrom`
  short-circuits via the `instanceof ApiError` idempotency
  check from D12, and the login page's `applyApiError`
  switch picks it up). No interceptor change.
- **No production-deploy env changes.** The rate limiter
  is mounted in the route definition; it doesn't read
  `process.env` or any config. The MVP rate (10 / 15 min)
  is hard-coded. A future "configurable per environment"
  slice is filed as a follow-up if needed.

## Verification

1. `cd backend && npm test` — **122/122** (was 118, +4
   rateLimit tests).
2. `cd backend && npm run test:integration` — **4/4**
   unchanged.
3. `cd backend && npm run typecheck` — exits 0.
4. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/login-page.component.spec.ts'`
   — **20/20** (was 19, +1 D4 test).
5. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/api-error.spec.ts'`
   — **12/12** unchanged.
6. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   — **7 FAILED, 346 SUCCESS** (was 7 FAILED, 344 SUCCESS
   with D7). Same 7 pre-existing baseline failures; +2
   SUCCESS is the D4 login test + api-error test.
7. `git diff --stat` should show exactly:
   - the new `rateLimit.ts` + `rateLimit.spec.ts`
     (~80 + ~120 lines);
   - the `loginRateLimiter` mount in `auth.ts` (1 line
     added);
   - the `express-rate-limit` dep in `package.json` (1
     line added);
   - the `rate_limited` union + 429 arm in `api-error.ts`
     (2 lines added);
   - the `RATE_LIMITED` constant + switch case in
     `login-page.component.ts` (3 lines added);
   - the new D4 test + docblock update in
     `login-page.component.spec.ts` (~30 lines added);
   - the new `spec-d4-rate-limited.md`;
   - the D4 row close in `deferred-work.md`.

## Commit

Two commits, mirroring the D9 / D10 / D12 pattern:

1. `feat(D4): rate-limit POST /api/auth/login + rate_limited ApiErrorCode + login page case`
   — the implementation (backend middleware + spec, route
   mount, frontend union + switch + test).
2. `docs: D4 implementation diff snapshot` — the
   `_bmad-output/d4.diff`.

Both pushed to `origin/main`.
