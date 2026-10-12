# D7 — `<dialog-modal>` uses `<atom-button>` atom

## Context

`deferred-work.md` D7 notes that
`frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts`
hand-rolls `.btn-primary` / `.btn-secondary` styles instead of using
the existing `<atom-button>` atom. The deferred note's "Owner" column
reads "Pattern-convergence slice (post-HD-016)" and the "Notes"
column reads "Per HD-004/HD-005 impl notes, convergence is deliberate
non-goal. Land when dialogs gain a second use case (HD-008
create-ticket confirm)."

As of this slice `<dialog-modal>` has **three** consumers:

1. `users-tab-page` (HD-014) — "Delete user?" confirm.
2. `ticket-detail-page` (HD-008) — "Close ticket?" confirm.
3. `header-chrome` (HD-004) — "Log out?" confirm (just shipped).

The "second use case" trigger has fired. The molecule is now the
right surface to converge on the design-system source of truth for
buttons.

## Why now (not later)

- **The atom already covers the surface.** `<atom-button>` has
  `variant="primary|secondary|danger"`, `disabled`, `loading`,
  `pressed` (re-emits the host click), and a `size` input
  (HD-005/HD-007). The dialog needs two of those variants
  (primary + secondary) plus `disabled` (the confirming state).
  Every visual property the dialog cares about — height, padding,
  border-radius, font, hover treatment — is already in the atom
  and tokenized in `tokens.css`. The hand-rolled `.btn-primary` /
  `.btn-secondary` styles in the molecule were a 30-line
  re-implementation of the atom's primary/secondary rules.
- **Every future dialog gets the atom for free.** With
  `<dialog-modal>` converged, adding the
  `use-resolve-attachments-modal` or any other confirm dialog
  inherits the design-system source of truth. No new styles
  to write, no new class names to invent, no risk of a
  "modal v1 button" drifting from a "modal v2 button" because
  they're the same atom.
- **The pre-D7 auto-focus UX is preserved.** The dialog's
  "initial focus lands on the confirm button" rule
  (`ngAfterViewInit` → `confirmBtn.focus()`) is preserved. The
  atom gains a public `focus()` method that no-ops on disabled,
  mirroring the pre-D7 guard via the `[confirming]` input.
- **The deferred note explicitly anchored the trigger to "a
  second use case."** Three use cases is well past the
  trigger threshold. The convergence slice is the natural
  next step.

## Scope

### Modified files

1. **`frontend/src/app/components/atoms/button/button.component.ts`**
   — adds a public `focus()` method so consumers (initially
   `<dialog-modal>`) can drive keyboard focus from outside the
   atom. The inner `<button>` is now referenced via a `#innerBtn`
   template ref + `viewChild<ElementRef<HTMLButtonElement>>`.
   `focus()` no-ops when the button is disabled (a focused
   disabled element re-broadcasts the disabled cursor to
   assistive tech).
2. **`frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts`**
   — imports `ButtonComponent` and adds it to `imports: […]`.
   The two inline `<button class="btn btn-primary/secondary">`
   blocks are replaced with
   `<atom-button variant="primary/secondary" [disabled]="confirming()"
   (pressed)="cancel/confirm.emit()">…</atom-button>`. The
   hand-rolled `.btn`, `.btn-primary`, `.btn-secondary` styles
   are removed. The `viewChild` ref switches from
   `ElementRef<HTMLButtonElement>` to `ButtonComponent` so
   `ngAfterViewInit` can call `.focus()` on the atom's
   component instance (which itself delegates to the inner
   element + the disabled guard).
3. **`frontend/src/app/components/molecules/header-chrome/header-chrome.component.spec.ts`**
   — D7's only consumer-facing test change. The two tests that
   exercise the dialog's confirm button (`"calls auth.logout()
   and navigates to /login on dialog confirm"` and
   `"renders the logout error inline when auth.logout() throws
   an ApiError"`) used to query `document.body.querySelector('.btn-primary')`.
   Post-D7 the inner button carries the atom's `.primary` class
   instead. Selector updated to
   `.modal-actions button.primary` (more specific — scoped to
   the action row, not any random primary button on the page).
4. **`frontend/src/app/components/atoms/button/button.component.spec.ts`**
   — adds two new D7-pinned assertions for the public `focus()`:
   - "D7: focus() moves keyboard focus to the inner button"
   - "D7: focus() is a no-op when the button is disabled"

### New files

1. **`_bmad-output/implementation-artifacts/spec-d7-dialog-modal-atom-button.md`**
   — this spec doc.
2. **`_bmad-output/d7.diff`** — the diff snapshot.

## Files

**New:**
- `_bmad-output/implementation-artifacts/spec-d7-dialog-modal-atom-button.md`
- `_bmad-output/d7.diff`

**Modified:**
- `frontend/src/app/components/atoms/button/button.component.ts`
  (public `focus()` method + `#innerBtn` template ref)
- `frontend/src/app/components/molecules/dialog-modal/dialog-modal.component.ts`
  (template + styles + viewChild refactor)
- `frontend/src/app/components/molecules/header-chrome/header-chrome.component.spec.ts`
  (selector update for the 2 dialog-confirm tests)
- `frontend/src/app/components/atoms/button/button.component.spec.ts`
  (2 new `focus()` assertions + docblock update)
- `_bmad-output/implementation-artifacts/deferred-work.md`
  (D7 row close)

## Reuse (no new patterns)

- **`<atom-button>` atom** — already the design-system source of
  truth for buttons (HD-005/HD-007). D7 just consumes what's
  already there. The atom's existing `variant`, `disabled`,
  `loading`, `(pressed)` outputs are the entire surface
  used by the dialog.
- **`viewChild<ButtonComponent>`** — same signal-based viewChild
  API the codebase already uses for atom refs (e.g.
  `dialog-modal`'s pre-D7 `viewChild<ElementRef<HTMLButtonElement>>`
  was the only place that reached into a button's native
  element). The atom now owns that detail.
- **`queueMicrotask(() => this.confirmBtn()?.focus())`** — same
  microtask-deferred focus pattern the dialog used pre-D7. The
  microtask lets the portal effect land the modal in `body`
  before focus runs; the `confirmBtn()` is now a `ButtonComponent`
  ref instead of a `ElementRef`.
- **`#innerBtn` template ref** — the same `viewChild` + template
  ref pattern used elsewhere in the codebase (e.g. the dialog's
  pre-D7 `#confirmBtn`). No new concept.
- **`focus()` no-op-on-disabled guard** — the atom's disabled
  state is already wired (`button:disabled { pointer-events:
  none; cursor: not-allowed; }` in the existing styles). The
  `focus()` method just adds the runtime check so callers don't
  have to repeat it.

## Test plan

### Existing tests (unchanged behavior)

- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/dialog-modal.component.spec.ts'`
  — **10/10** pass. The "emits cancel when the cancel button is
  clicked" + "emits confirm when the confirm button is clicked"
  tests still pass because the atom's `(pressed)` output
  re-emits the host click (which the dialog binds to
  `cancel.emit()` / `confirm.emit()`).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/header-chrome.component.spec.ts'`
  — **12/12** pass. The 2 dialog-confirm tests with the updated
  selector (`.modal-actions button.primary`) are now green.
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/button.component.spec.ts'`
  — **5/5** pass (3 pre-D7 + 2 new `focus()` tests).

### Full frontend suite

- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
  — **7 FAILED, 346 SUCCESS**. The 7 pre-existing baseline
  failures (EmployeeDashboardPageComponent × 3,
  ForbiddenPageComponent × 3, UserRowComponent × 1) are
  unchanged. Pre-D7: 7 FAILED, 344 SUCCESS. The +2 SUCCESS are
  the new `focus()` tests in the button spec.

### Backend (no impact)

- `cd backend && npm test` — **118/118** unchanged. D7 is
  frontend-only.

### Test isolation (acknowledged, not a regression)

The dialog-modal spec has a pre-existing test-isolation quirk:
`afterEach: document.body.innerHTML = ''` races with Angular's
TestBed teardown, producing an `afterAll` "TypeError: Cannot
read properties of null (reading 'appendChild')" log line. This
is **independent of D7** — it shows up on every `main` baseline
run (verified by stashing the D7 changes and re-running; the
baseline suite also has 7 → 8 FAILED flakiness from this race).
A test that occasionally loses a dialog-modal assertion in the
**full** suite (passes 10/10 in isolation) is a known pre-D7
flake, not a D7 regression. The fix is a separate
test-infrastructure slice (e.g. `afterEach: TestBed.resetTestingModule()`
before the body wipe, or moving the body wipe to `beforeEach`).
Filed implicitly as a follow-up — not in this slice's scope.

## Follow-up (NOT in this slice — filed as a new D-row)

The dialog-modal test-isolation flake is real and should be
addressed in a future test-infrastructure slice. The work would
be: replace the `afterEach: document.body.innerHTML = ''` line
in `dialog-modal.component.spec.ts` with
`TestBed.resetTestingModule()` (or move the body wipe to
`beforeEach`) so each test starts from a clean Angular context.
D7 doesn't fix this; D7 doesn't make it worse. The flake
existed before D7 and is documented here so a future reader
doesn't misattribute it to the atom-button refactor.

## Boundaries (never, in this slice)

- **No new atom API surface beyond `focus()`.** The atom's
  public inputs (`variant`, `disabled`, `type`, `loading`,
  `size`) and outputs (`pressed`) are unchanged. No new
  variants, no new sizes, no new `aria-*` attribute toggles.
- **No convergence of any other molecule.** D7 touches
  `<dialog-modal>` only. `<dropdown-panel>`, `<form-field>`,
  `<empty-state>`, etc. are not in scope. Each molecule gets
  its own slice when its hand-rolled styles reach a similar
  threshold (3+ consumers, or a clear divergence from the
  atom's surface).
- **No auto-focus behavior change.** The pre-D7
  "auto-focus confirm button on open" UX is preserved exactly.
  The atom-level `focus()` method is a literal no-op when
  disabled, mirroring the pre-D7 guard. If auto-focus ever
  needs to be removed, that's a separate spec — D7 keeps the
  existing UX.
- **No `(click)`-to-`(pressed)` migration outside the dialog.**
  The atom's `(pressed)` output already exists from HD-007
  (so callers can navigate via `(pressed)="navigate()"`
  instead of wrapping the button in an `<a routerLink>`).
  D7 doesn't change how the atom's `(click)` is bound or how
  the existing callers (login submit, dashboard "New ticket",
  users form Save, etc.) use the atom.
- **No new spec for the dialog-modal render order.** The
  pre-existing test-isolation flake is acknowledged but not
  fixed in this slice (see "Test isolation" above and
  "Follow-up" below).

## Verification

1. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/button.component.spec.ts'`
   — **5/5** pass (3 pre-D7 + 2 new `focus()` tests).
2. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/dialog-modal.component.spec.ts'`
   — **10/10** pass (the afterAll "TypeError" log is the
   pre-existing TestBed teardown race, unchanged from
   baseline).
3. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/header-chrome.component.spec.ts'`
   — **12/12** pass (the 2 dialog-confirm tests with the
   updated `.modal-actions button.primary` selector are
   green).
4. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   — **7 FAILED, 346 SUCCESS**. Same 7 pre-existing baseline
   failures; the only delta is +2 SUCCESS (the new
   `focus()` tests).
5. `cd backend && npm test` — **118/118** unchanged.
6. `git diff --stat` should show exactly:
   - the `focus()` method + `#innerBtn` template ref in
     `button.component.ts` (~15 added lines, 0 removed);
   - the template + styles + viewChild refactor in
     `dialog-modal.component.ts` (~10 added, ~25 removed);
   - the selector update in
     `header-chrome.component.spec.ts` (2 selector strings);
   - the 2 new `focus()` tests + docblock update in
     `button.component.spec.ts` (~25 added);
   - the new `spec-d7-dialog-modal-atom-button.md`;
   - the D7 row close in `deferred-work.md`.

## Commit

Two commits, mirroring the D9 / D10 / D12 pattern:

1. `feat(D7): dialog-modal uses <atom-button> + public focus() on atom-button`
   — the implementation (button atom, dialog molecule,
   header-chrome selector update, 2 new button spec tests).
2. `docs: D7 implementation diff snapshot` — the
   `_bmad-output/d7.diff`.

Both pushed to `origin/main`.
