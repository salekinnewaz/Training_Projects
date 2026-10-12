# D12 — `apiErrorFrom` idempotency (login + changePassword double-wrap fix)

## Context

The user reported that logging in with a wrong password renders
"Something went wrong. Please try again." instead of the expected
"Email or password is incorrect. Try again." Both copies live in
`frontend/src/app/pages/login-page/login-page.component.ts`
(`WRONG_CREDS` on line 67 vs `GENERIC_ERROR` on line 65); the page
switches on `err.errorCode` (lines 376–419).

The 401 response from the backend is
`{ error: "invalid_credentials", message: "Email or password is
incorrect. Try again." }` — verified end-to-end:

```
$ curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"sam@example.com","password":"WRONG"}'
{"error":"invalid_credentials","message":"Email or password is incorrect. Try again."}
```

So the bug is in the frontend error pipeline, not the backend.

## Root cause — the double wrap

The `authInterceptor` (registered via `provideHttpClient(withInterceptors([authInterceptor]))`)
converts `HttpErrorResponse` → `ApiError` first:

```ts
// auth.interceptor.ts:35-40
return next(stamped).pipe(
  catchError((err: unknown) => {
    if (err instanceof HttpErrorResponse) {
      return throwError(() => apiErrorFrom(err));   // wrap #1
    }
    return throwError(() => err);
  }),
);
```

Then every service has a defensive `catch` that calls
`apiErrorFrom` *again*:

```ts
// auth.service.ts:60-62 (login) and symmetrically for logout /
// doRefreshUser / changePassword
} catch (err) {
  throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);  // wrap #2
}
```

Before this slice, `apiErrorFrom` had no idempotency short-circuit.
It treated the `ApiError` it just received as if it were a fresh
`HttpErrorResponse`, called `readBody(err)` on `err.error` (an
`ApiError` has no `.error` field — only `.errorCode`, `.message`,
`.status`, `.fields`), found `body = {}`, and fell through to
`mapStatusToCode(401) = 'unauthenticated'`. The login page's switch
has no case for `unauthenticated` — it falls through to the
`default` branch (line 413) which sets `GENERIC_ERROR` = "Something
went wrong. Please try again."

The same bug affects `changePassword` (HD-018 page) and any other
service that uses the defensive `catch (err) { throw apiErrorFrom
(err) }` pattern. Verified the impact for both in
`auth.service.spec.ts`.

## Fix

`apiErrorFrom` is now idempotent. The first lines short-circuit if
the input is already an `ApiError`:

```ts
export function apiErrorFrom(err: HttpErrorResponse | ApiError): ApiError {
  // Idempotent: if the caller already converted via the auth
  // interceptor (or any other layer that does this conversion
  // first), hand the existing ApiError straight back. Without
  // this short-circuit, the service-layer `catch (err) { throw
  // apiErrorFrom(err) }` defensive wrapper would re-read the
  // ApiError's `.error` and `.status` fields, miss the
  // `.errorCode` we already set, and downgrade an
  // `invalid_credentials` 401 to a `unauthenticated` /
  // `unknown_error` 401 — which is what made the HD-005
  // login page show the generic "Something went wrong" copy
  // on a wrong-password attempt when the auth interceptor was
  // registered (i.e. in production).
  if (err instanceof ApiError) {
    return err;
  }
  // ... rest unchanged
}
```

Three lines + a 12-line docblock. The function's type signature is
widened to `HttpErrorResponse | ApiError` to make the contract
explicit at every call site — the defensive `as Parameters<typeof
apiErrorFrom>[0]` cast that each service was already doing now
typechecks cleanly without the cast.

## Why not drop the service-layer defensive wrap?

Two reasons to keep the service-side `catch (err) { throw
apiErrorFrom(err) }`:

1. **The auth interceptor is not always registered.** Tests
   register it explicitly via `withInterceptors([authInterceptor])`,
   but the service contract — "always throw a typed `ApiError`" —
   is what consumers depend on. If a future caller wires
   `provideHttpClient()` without the interceptor (e.g. a dev tool,
   a service worker, a mocked test), the service must still
   convert raw `HttpErrorResponse` to `ApiError` or its callers
   will break.
2. **Defense in depth.** The auth interceptor could be removed or
   re-ordered in `app.config.ts` and the rest of the app would
   still work. The service-level conversion is the load-bearing
   contract; the interceptor is a convenience that pushes the
   conversion earlier in the pipeline.

The cost of keeping both layers is the double-wrap, and the
idempotency short-circuit is the cheap fix.

## Scope

### Modified files

1. **`frontend/src/app/services/api-error.ts`** — the
   `apiErrorFrom` function signature is widened to
   `HttpErrorResponse | ApiError`, and the function body short-
   circuits on `err instanceof ApiError`. The leading docblock is
   rewritten to mention the bug + the regression test.

2. **`frontend/src/app/services/auth.service.spec.ts`** — adds
   the "double-wrap preserves errorCode" regression block. The
   `beforeEach` now wires the *real* `authInterceptor` via
   `withInterceptors([authInterceptor])` (was
   `withInterceptorsFromDi()` with no interceptor), so the tests
   exercise the same pipeline the app uses in production. Three
   new test cases:
   - `login()` rejects with `ApiError(401, invalid_credentials)`
     on a wrong-password 401
   - `login()` rejects with `ApiError(401, account_inactive)` on
     a deactivated-user 401
   - `changePassword()` rejects with
     `ApiError(403, invalid_credentials)` (preserves errorCode
     through both wraps)
   - A belt-and-suspenders `apiErrorFrom` idempotency pin at the
     unit level (so a future refactor that drops the testbed
     setup still trips the contract)

### New files

1. **`frontend/src/app/services/api-error.spec.ts`** — the new
   dedicated spec for `apiErrorFrom`. 12 tests in two describe
   blocks:
   - **idempotency (regression)** — 4 tests pinning the
     `instanceof ApiError → same instance` contract for the four
     ApiError shapes the auth interceptor can produce
     (401 invalid_credentials, 401 account_inactive, 403
     forbidden, 400 validation_error with fields).
   - **HttpErrorResponse → ApiError** — 8 tests pinning the
     positive-coverage matrix (401 with explicit error, 401 with
     null body via status fallback, status 0 → network_error,
     validation_error with fields map, non-string field values
     dropped silently (D5 pin), 5xx → internal_server_error via
     status fallback, unknown status with string body preserves
     explicit error code, "Request failed." fallback when both
     body.message and err.message are empty).

2. **`_bmad-output/implementation-artifacts/spec-d12-apierror-idempotency.md`** —
   this spec doc.

3. **`_bmad-output/d12.diff`** — the diff snapshot.

## Files

**New:**
- `frontend/src/app/services/api-error.spec.ts`
- `_bmad-output/implementation-artifacts/spec-d12-apierror-idempotency.md`
- `_bmad-output/d12.diff`

**Modified:**
- `frontend/src/app/services/api-error.ts` (idempotency fix)
- `frontend/src/app/services/auth.service.spec.ts` (regression tests
  + interceptor wiring)

## Reuse (no new patterns)

- **Existing `instanceof` check** — the same primitive used at
  every service boundary in the codebase; nothing new.
- **Existing `ApiError` class** — no new error types, no new
  fields. The `idempotency` is purely a function-level short-
  circuit.
- **Existing `withInterceptors([authInterceptor])` test wiring**
  — the `login-page.component.spec.ts` (D1+D2) already wires
  the real interceptor; this slice brings `auth.service.spec.ts`
  in line with the same pattern.
- **No new dev dependency**, no package.json churn.

## Test plan

### New unit specs (frontend)

`frontend/src/app/services/api-error.spec.ts` — 12 tests, all
passing:

- 4 idempotency regressions (the load-bearing assertions)
- 8 HttpErrorResponse → ApiError positive coverage

### New regression block in `auth.service.spec.ts`

4 tests added, all passing — the wire-level pin that the
interceptor + service chain doesn't downgrade `errorCode`.

### Full frontend suite

`cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`

- Baseline: **328/335** (7 pre-existing failures, all in
  `EmployeeDashboardPageComponent` × 3, `ForbiddenPageComponent`
  × 3, `UserRowComponent` × 1 — all AuthService mock gaps
  surfaced in HD-008 and tracked separately)
- After this slice: **344/351** (same 7 pre-existing failures,
  +16 new passing tests = +12 api-error + 4 auth.service
  double-wrap)

No new failures introduced. No previously-passing test regresses.

### Full backend suite (unchanged but re-verified)

`cd backend && npm test` → **118/118** pass (D9 + everything
else). No backend change in this slice.

### End-to-end manual smoke (post-merge)

- `docker compose up -d mysql` (if not running)
- `cd backend && npm run dev` (port 3000)
- `cd frontend && npm start` (port 4200)
- Open `http://localhost:4200/login`
- Enter `sam@example.com` / `WRONG`
- **Expected**: "Email or password is incorrect. Try again."
  appears under the password field; the email field gets focus.
- **Was before this slice**: "Something went wrong. Please try
  again." appeared (the bug).

Verified locally during the slice — backend returns the right
401, `apiErrorFrom` now propagates the `invalid_credentials` code
through both wraps, the login page's switch renders the right
copy.

## Boundaries (never)

- **No change to the auth interceptor.** The bug is in the
  combination of the interceptor + the service defensive wrap;
  the fix is in `apiErrorFrom` so both layers (and any future
  layer that does the same conversion first) work correctly.
- **No change to the login page logic.** The page's switch
  already handles `invalid_credentials` / `account_inactive` /
  `validation_error` / `network_error` / `internal_server_error`
  / `unknown_error` correctly. The fix makes the upstream code
  deliver the right `errorCode` to it.
- **No new `ApiErrorCode` union members.** The bug is purely
  about preserving an existing `errorCode` through a re-wrap.
- **No backend change.** The backend has been returning the
  right 401 envelope all along.
- **No new env / config / routing / DI changes.** Three lines
  in one function and a regression test.

## Verification

1. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   — **344/351** pass (was 328/335, +16 new tests, same 7
   pre-existing baseline failures).
2. `cd backend && npm test` — **118/118** pass.
3. End-to-end smoke (above) — wrong-password now renders
   "Email or password is incorrect. Try again."
4. `git diff` review — should show only:
   - the `api-error.ts` short-circuit + docblock;
   - the new `api-error.spec.ts`;
   - the `auth.service.spec.ts` regression block + interceptor
     wiring change.

## Commit

Two commits, mirroring the D9 + D10 pattern:

1. `fix(D12): apiErrorFrom idempotency — preserve errorCode
   through service defensive wrap` — the implementation
   (api-error.ts + spec files).
2. `docs: D12 implementation diff snapshot` — the
   `_bmad-output/d12.diff`.

Both pushed to `origin/main`.
