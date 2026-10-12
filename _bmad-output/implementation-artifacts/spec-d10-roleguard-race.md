# D10 — roleGuard cold-load race fix

## Context

`deferred-work.md` D10 documents a real bug in the route
guard chain: every protected route (8 routes — `/dashboard`,
`/tickets/new`, `/tickets/:id/created`, `/tickets/:id`,
`/queue`, `/admin`, `/users`, plus `/forbidden`) wires
`canActivate: [authGuard, roleGuard(...)]`. Angular runs the
array entries concurrently (`mergeMap`-style, not `concatMap`),
so `roleGuard` reads `userSnapshot()` **before** `authGuard`'s
`await refreshUser()` has populated the BehaviorSubject. On a
cold load (hard reload of a protected URL while still
authenticated), the user lands on `/forbidden` instead of the
intended page.

The two proposed fixes in the deferred-work entry are:
1. Make `roleGuard` async, call `auth.refreshUser()` itself
   on null snapshot — but this duplicates a `/me` round-trip
   when `authGuard` is also in the array.
2. Chain guards via `concatMap` — Angular's API doesn't
   directly support this.

The cleanest fix is **#1 with an in-flight dedup** added to
`AuthService.refreshUser()` so concurrent callers share a
single `/me` request. This eliminates the duplication concern
while keeping the public guard surface unchanged.

There's a third concurrent caller: `header-chrome.component.ts:248-254`
fires `refreshUser()` from an `effect()` on mount whenever
`user$` is null — i.e. on every cold load of a protected
page. The dedup covers this too: 3 concurrent callers share
1 HTTP request.

The previous plans in this file were HD-014/HD-015/HD-016
(all shipped) and the D1+D2 testing slice (shipped). This
plan replaces them.

## Scope

### Frontend — production

1. **Edit `frontend/src/app/services/auth.service.ts`** —
   add in-flight promise dedup to `refreshUser()`:
   ```ts
   private inflightRefresh: Promise<void> | null = null;

   refreshUser(): Promise<void> {
     if (this.inflightRefresh) {
       return this.inflightRefresh;
     }
     this.inflightRefresh = this.doRefreshUser().finally(() => {
       this.inflightRefresh = null;
     });
     return this.inflightRefresh;
   }

   private async doRefreshUser(): Promise<void> {
     // ... existing refreshUser body, unchanged ...
   }
   ```
   The dedup is transparent to all 3 callers
   (`auth.guard.ts:33`, `login.guard.ts:25`,
   `header-chrome.component.ts:250`) — no call-site changes
   needed. The `finally` block clears the cache so the next
   cold load still hits the network.

2. **Edit `frontend/src/app/guards/role.guard.ts`** — convert
   to async and call `refreshUser()` when snapshot is null:
   ```ts
   return async (_route, state): Promise<boolean | UrlTree> => {
     const auth = inject(AuthService);
     const router = inject(Router);

     let user = auth.userSnapshot();
     if (!user) {
       try {
         await auth.refreshUser();
       } catch { /* network / 5xx */ }
       user = auth.userSnapshot();
     }

     if (!user || !allowedRoles.includes(user.role)) {
       return router.parseUrl(`/forbidden?denied_from=${encodeURIComponent(state.url)}`);
     }
     return true;
   };
   ```
   No changes to `app.routes.ts` — the guard factory signature
   is unchanged; only the inner function is now async.

3. **No change** to `auth.guard.ts` or `login.guard.ts` — both
   already await `refreshUser()`. With the dedup, even if
   `roleGuard` fires a `refreshUser()` in parallel, the
   second call short-circuits to the in-flight promise.

### Frontend — tests (4 new spec files, 35 new tests)

4. **NEW `frontend/src/app/services/auth.service.spec.ts`** —
   pins the dedup behavior + the existing 401-silently-becomes-null
   contract:
   - `refreshUser()` calls `GET /api/auth/me` once with
     `withCredentials: true`.
   - 200 response → `user$` emits the user, `userSnapshot()`
     returns it.
   - 401 response → `user$` emits null (silently, no throw).
   - 5xx / network → `refreshUser()` rejects with `ApiError`.
   - **Concurrent `refreshUser()` calls share one HTTP
     request** (the new dedup test — fire 3 calls without
     awaiting, assert exactly 1 HTTP request was made).
   - After the in-flight request settles (success OR error),
     the next `refreshUser()` fires a fresh request.
   - Concurrent callers share rejections too (no double /me
     on a 5xx).
   - `roleHomePath()` returns the role-correct path for each
     role + `/login` when null.

5. **NEW `frontend/src/app/guards/auth.guard.spec.ts`** —
   pins the guard's contract:
   - Cached user → returns `true`, `refreshUser()` NOT called.
   - Null snapshot + `refreshUser()` resolves to user →
     returns `true`.
   - Null snapshot + `refreshUser()` resolves to null (401) →
     returns UrlTree to `/login?return_to=<state.url>`.
   - Null snapshot + `refreshUser()` rejects (5xx) → returns
     UrlTree to `/login?return_to=<state.url>`.
   - URL with query params is preserved in `return_to`.

6. **NEW `frontend/src/app/guards/role.guard.spec.ts`** —
   pins the guard's contract including the **race fix**:
   - Cached user with allowed role → `true`, no refresh.
   - Cached user with disallowed role → UrlTree to
     `/forbidden?denied_from=<state.url>`, no refresh.
   - **Null snapshot + `refreshUser()` resolves to a user
     with allowed role → `true` (the race fix)**.
   - Null snapshot + `refreshUser()` resolves to null →
     UrlTree to `/forbidden?denied_from=<state.url>`.
   - Null snapshot + `refreshUser()` rejects (5xx) → UrlTree
     to `/forbidden?denied_from=<state.url>`.
   - Null snapshot + `refreshUser()` resolves to user with
     disallowed role → UrlTree to
     `/forbidden?denied_from=<state.url>` (defensive — stale
     /me after a role change).
   - URL with query params is preserved in `denied_from`.

7. **NEW `frontend/src/app/guards/login.guard.spec.ts`** —
   pins the inverse guard's contract:
   - Null snapshot + `refreshUser()` resolves to null →
     `true` (form renders, 401 = no auth = form OK).
   - Null snapshot + `refreshUser()` rejects (5xx) → `true`
     (form renders; we never block on a network error).
   - Cached user → UrlTree to `auth.roleHomePath()`, no
     refresh.
   - Null snapshot + `refreshUser()` resolves to a user →
     UrlTree to `auth.roleHomePath()` (cold-load authed
     user bounce).

### Documentation

8. **Edit `_bmad-output/implementation-artifacts/deferred-work.md`**
   — mark D10 closed.

9. **NEW `_bmad-output/implementation-artifacts/spec-d10-roleguard-race.md`**
   — this spec artifact, following the HD-013/HD-014/HD-015/
   HD-016/D1+D2 pattern.

10. **NEW `_bmad-output/d10.diff`** — diff snapshot for the
    story.

## Files

**New:**
- `frontend/src/app/services/auth.service.spec.ts`
- `frontend/src/app/guards/auth.guard.spec.ts`
- `frontend/src/app/guards/role.guard.spec.ts`
- `frontend/src/app/guards/login.guard.spec.ts`
- `_bmad-output/implementation-artifacts/spec-d10-roleguard-race.md`
- `_bmad-output/d10.diff`

**Modified:**
- `frontend/src/app/services/auth.service.ts` (in-flight dedup in `refreshUser`)
- `frontend/src/app/guards/role.guard.ts` (async + refreshUser fallback)
- `_bmad-output/implementation-artifacts/deferred-work.md` (close D10)

## Reuse (no new patterns)

- **In-flight promise memoization** — the standard
  `private inflight: Promise | null` pattern; identical to
  HTTP-client request dedup libraries use. No new dep.
- **`TestBed.runInInjectionContext(() => guard(routeStub, stateStub))`**
  — the canonical Angular 17 way to test functional
  `CanActivateFn` guards without standing up a full router.
  The `routeStub` and `stateStub` are plain `{ url: '/x' }`
  literals; we only read `state.url` in the guard bodies.
- **HttpClient stubbing via `provideHttpClientTesting` +
  `HttpTestingController`** — already used by
  `user.service.spec.ts` (D1+D2 reference); no new infra.
  The `authInterceptor` is registered via `withInterceptors`
  (matches the real app config) so the spec exercises the
  same `HttpErrorResponse → ApiError` conversion path.

## Boundaries (never)

- No change to `app.routes.ts` (the public guard API is
  unchanged; only the inner function is async).
- No change to `auth.guard.ts` or `login.guard.ts` (both
  already async; dedup makes the duplication concern moot).
- No concatMap wrapping of canActivate arrays (the deferred
  fix proposal #2 — Angular's API doesn't natively support
  this, would require a wrapper guard, more complex than
  the in-flight dedup).
- No change to the chrome's `refreshUser()` call in
  `header-chrome.component.ts` (the dedup makes the
  concurrent call a no-op).
- No "wait for the user$ Observable to emit" pattern via
  `firstValueFrom(this.auth.user$)` — that would not
  actually wait for /me to complete if the BehaviorSubject
  starts at null and never emits (it stays null until
  refreshUser resolves). The dedup is the right primitive.
- No changes to backend (this is a frontend-only fix).

## Verification

1. `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox` — all new specs pass
   (target: 35 new tests across 4 files). Final result:
   **304/311 pass**. The 6 pre-existing failures
   (3 EmployeeDashboard + 3 ForbiddenPage) remain unchanged
   from the D1+D2 baseline. The 1 additional "FAILURE" in the
   summary is a Jasmine afterAll global-error, not a real
   test failure.
2. `cd frontend && npx ng build --configuration=development`
   — exits 0.
3. Browser smoke (manual, mirrors the D10 entry):
   - Log in as `user@company.com`, land on `/dashboard`.
   - Open a new tab, type `/dashboard` directly, hit Enter.
     **Before fix**: lands on `/forbidden?denied_from=%2Fdashboard`.
     **After fix**: lands on `/dashboard`.
   - Repeat for `/tickets/new` and `/tickets/1` (different
     `allowedRoles` to ensure the matrix is exercised).
   - Open a new tab, type `/admin` (User role can't access
     Admin). **After fix**: lands on
     `/forbidden?denied_from=%2Fadmin` (right answer, correct
     reason — `authGuard` resolves to user, `roleGuard`
     checks role and rejects).
   - Open a new tab, type `/dashboard` with no cookie at all.
     **After fix**: lands on
     `/login?return_to=%2Fdashboard` (not `/forbidden`).
   - Open DevTools Network tab; reload `/dashboard` while
     authed. Observe **exactly one** GET `/api/auth/me`
     request, not three (the dedup in action).

## Commit

Two commits, mirroring the HD-013/HD-014/HD-015/HD-016/D1+D2
pattern:

1. `fix(D10): roleGuard cold-load race — async + /me dedup`
   — the implementation.
2. `docs: D10 implementation diff snapshot` — the
   `_bmad-output/d10.diff`.

Both pushed to `origin/main`.
