# D1 + D2 — Frontend testing slice (atoms, molecules, login page)

## Context

HD-005 logged two deferred items into `deferred-work.md` once the
production code shipped but no specs existed:

- **D1** — atoms (`button`, `input-text`, `link`,
  `show-password-toggle`, plus the badges / chrome-avatar /
  caret-down / divider-hr that surface in the chrome and ticket
  list) and molecules (`form-field`, plus the dashboard and
  ticket-detail molecules) had no test harness at all.
- **D2** — the `LoginPageComponent` had no specs.

Both pointed at a "Frontend testing slice (post-HD-016)" — HD-016
is the natural completion of the feature work, after which a
dedicated testing pass can land without blocking product velocity.

The deferred-work note mentioned "Jest + Testing Library" but
that's a misremembered constraint: the repo already runs Karma +
Jasmine via `@angular/build`'s test builder, and adding a second
runner (Jest) would double the test infrastructure for zero gain.
D1 stays with Karma + Jasmine.

## Scope

### Atoms (8 specs)

1. `input-text` — 13 tests: default type, type binding, value,
   placeholder, autocomplete, aria-describedby, aria-required,
   aria-invalid, disabled, valueChange emission.
2. `link` — 5 tests: routerLink, navigate emission, disabled
   state with aria-disabled + preventDefault.
3. `show-password-toggle` — 4 tests.
4. `badge-priority` — 4 tests.
5. `badge-role` — 3 tests.
6. `badge-status` — 4 tests.
7. `caret-down` — 1 test.
8. `chrome-avatar` — 8 tests covering initials derivation, "?"
   fallback, trim, size binding.
9. `divider-hr` — 1 test.

### Molecules (7 specs, 1 replacement)

1. `form-field` — 6 tests: error rendering, required indicator,
   label projection, content projection.
2. `dialog-modal` — 10 tests. The host stays in the chrome (it
   has `display: contents`); its scrim + modal children portal
   to `document.body` on mount via an effect. Test pattern:
   query `[role="dialog"]` and `.btn-primary` directly in
   `document.body`, use `afterEach(() => { document.body.innerHTML = ''; })`
   to clean up portaled children, and `await fixture.whenStable()`
   to let the portal effect run before clicking.
3. `dropdown-panel` — 3 tests. Uses a `HostComponent` with
   `anchor: HTMLElement | null` property set AFTER first CD
   (avoids NG0100 ExpressionChangedAfterItHasBeenCheckedError).
   Asserts right offset as `Math.max(0, window.innerWidth - X)`
   because Chrome headless viewport (~1687px) differs from
   jsdom's 1024 default.
4. `empty-state` — 4 tests.
5. `header-chrome` — 12 tests. Stubs AuthService with
   BehaviorSubject + userSnapshot/roleHomePath/refreshUser/logout.
   Tests brand mark, profile trigger, dropdown open/close, role
   badge, logout dialog, logout confirmation, logout error,
   role home navigation, Esc priority, outside click.
6. `ticket-row` — 4 tests.
7. `timeline-entry` — REPLACED the single pre-existing test
   with the full per-event-type matrix (12 tests).

### Page: D2 (LoginPageComponent) — 19 tests

The big one. Covers the public sign-in flow's contract end to
end:

| # | Behaviour |
|---|-----------|
| 1 | Brand mark + wordmark render on the card |
| 2 | Email + password labels render with `*` required indicator |
| 3 | Submit button disabled when email or password is empty |
| 4 | Empty form → per-field errors; auth.login NOT called |
| 5 | Whitespace-only password → rejected client-side; auth.login NOT called |
| 6 | Non-email value (e.g. `not-an-email`) → rejected client-side |
| 7 | Valid submit → `auth.login(trimmedEmail, rawPassword)` |
| 8 | Successful login → `router.navigateByUrl(roleHomePath())` |
| 9 | `?return_to=/tickets/new` is honored on success |
| 10 | Unsafe `return_to=http://evil` → console.warn + roleHomePath |
| 11 | Protocol-relative `return_to=//evil` → roleHomePath |
| 12 | Bare `return_to=/` → roleHomePath |
| 13 | 401 `invalid_credentials` → "Email or password is incorrect. Try again." |
| 14 | 401 `account_inactive` → "Your account is inactive. Contact your administrator." |
| 15 | 400 `validation_error.fields.email` → email field shows server message |
| 16 | 0 `network_error` → "Something went wrong. Please try again." |
| 17 | `submitting` resets to false after a failed login |
| 18 | Password show/hide toggle flips `<input type>` between `password` and `text` |
| 19 | "Forgot password?" link points to `/forgot-password` |

### Production fixes that fell out of the testing work

Two production components had an Angular 17 effect that mutated
a signal without the documented opt-in:

- `dialog-modal.component.ts` (constructor effect that portals
  children to `document.body`)
- `dropdown-panel.component.ts` (constructor effect that caches
  the anchor's bounding rect)

Both now pass `{ allowSignalWrites: true }` to the `effect()`
call. Without the opt-in, the tests would have crashed with
NG0600 on the first CD cycle that triggers the effect.

## Files

**New (specs only):**
- `frontend/src/app/components/atoms/badge-priority/badge-priority.component.spec.ts`
- `frontend/src/app/components/atoms/badge-role/badge-role.component.spec.ts`
- `frontend/src/app/components/atoms/badge-status/badge-status.component.spec.ts`
- `frontend/src/app/components/atoms/caret-down/caret-down.component.spec.ts`
- `frontend/src/app/components/atoms/chrome-avatar/chrome-avatar.component.spec.ts`
- `frontend/src/app/components/atoms/divider-hr/divider-hr.component.spec.ts`
- `frontend/src/app/components/atoms/input-text/input-text.component.spec.ts`
- `frontend/src/app/components/atoms/link/link.component.spec.ts`
- `frontend/src/app/components/atoms/show-password-toggle/show-password-toggle.component.spec.ts`
- `frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.spec.ts`
- `frontend/src/app/components/molecules/dropdown-panel/dropdown-panel.component.spec.ts`
- `frontend/src/app/components/molecules/empty-state/empty-state.component.spec.ts`
- `frontend/src/app/components/molecules/form-field/form-field.component.spec.ts`
- `frontend/src/app/components/molecules/header-chrome/header-chrome.component.spec.ts`
- `frontend/src/app/components/molecules/ticket-row/ticket-row.component.spec.ts`
- `frontend/src/app/pages/login-page/login-page.component.spec.ts`
- `_bmad-output/d1.diff`

**Modified (production):**
- `frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts` (add `allowSignalWrites: true` to the portal effect)
- `frontend/src/app/components/molecules/dropdown-panel/dropdown-panel.component.ts` (add `allowSignalWrites: true` to the anchor effect)
- `frontend/src/app/components/molecules/timeline-entry/timeline-entry.component.spec.ts` (replaced with the full per-event-type matrix)

**Modified (documentation):**
- `_bmad-output/implementation-artifacts/deferred-work.md` (mark D1 + D2 closed)

## Reuse

- **`@angular/core/testing`** + Karma + Jasmine — already the
  repo's test runner; no new infra.
- **`provideRouter([])`** in test beds — gives the real Router
  for components that use `<atom-link>` (which depends on
  `RouterLink`, which depends on the Router's `events`
  Observable). Stubbing `Router` with a plain `useValue` breaks
  `RouterLink` silently.
- **`spyOn(realInstance, method)`** instead of stubbing when the
  consumer needs real class internals (e.g. spying on
  `router.navigateByUrl` after `TestBed.inject(Router)`).
- **`afterEach(() => { document.body.innerHTML = ''; })`** —
  dialog-modal portals children to `document.body`; without
  cleanup the portaled DOM leaks across tests.
- **`await fixture.whenStable(); fixture.detectChanges();`** —
  the dialog portal effect runs lazily, so testing the
  portaled buttons needs a microtask flush + an extra CD round.

## Boundaries (never)

- No Jest / Testing Library install. Stays with Karma + Jasmine.
- No e2e / Cypress / Playwright layer. Specs are unit + shallow
  integration; the manual browser smoke from the existing
  stories is the e2e surface for now.
- No test for `<app-chrome>` integration with the route
  (header-chrome covers the chrome; route integration is
  exercised by the page-level specs in D2 and beyond).
- No new atoms or molecules. The testing slice is read-only
  against the component surface.

## Verification

1. `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox` — **270/276 pass**.
   The 6 failures are pre-existing, unchanged from the HD-016
   baseline (3 `EmployeeDashboard` `toSignal(undefined.subscribe)`
   + 3 `ForbiddenPageComponent`). No new failures from D1/D2.
2. `cd frontend && npx ng build --configuration=development`
   — exits 0.
3. `git diff --stat` against `origin/main` — 19 files changed
   (16 new specs, 2 production fixes, 1 timeline-entry spec
   replacement).

## Commit

Two commits, mirroring the HD-013 / HD-014 / HD-015 / HD-016
pattern:

1. `feat(D1+D2): frontend testing slice — atoms, molecules,
   login page` — the implementation.
2. `docs: D1+D2 implementation diff snapshot` — the
   `_bmad-output/d1.diff`.

Both pushed to `origin/main`.
