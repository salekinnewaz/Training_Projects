# D5 — `asFieldMap` tripwire for non-string field values

## Context

`deferred-work.md` D5 notes that `frontend/src/app/services/api-error.ts`'s
`asFieldMap` helper only handles string field values and drops
`string[]` silently. The deferred note's "Owner" column reads
"When HD-008 (create-ticket) lands field-level validation" and
the "Notes" column reads "Defensive; revisit if backend starts
emitting array field messages."

The D5 row is **closed without widening the type** — the
backend has been emitting single-string field messages for
every validation error since HD-005/HD-008, and there is no
spec or story that introduces multi-message fields. The
**tripwire** is the right close-out: keep the
`Record<string, string>` contract (so existing pages and
`FormFieldComponent` are unchanged), but emit a
`console.warn` whenever a non-string value is dropped. A
future regression that introduces array field messages is
**loud in dev** and **in CI's stderr capture** instead of
silently dropping user-visible data.

## Why a tripwire (not a full UI widening)

Two alternatives were considered:

- **Option A (this slice — chosen):** keep
  `Record<string, string>`, add `console.warn` on drop.
- **Option B (rejected):** widen to
  `Record<string, string | string[]>`, thread `<ul>` rendering
  through `FormFieldComponent`, update 3 pages
  (`login-page`, `create-ticket-page`, `change-password-page`).

The deferred note's wording ("Defensive; revisit if backend
starts emitting array field messages") explicitly defers
Option B to the moment the backend changes. As of this slice
the backend has not changed and there is no story in flight
to make it change. Widing the type now would:

1. **Yak-shave the UI** — `FormFieldComponent.error` becomes
   `string | string[]`, the template needs an `@if (isArray)`
   branch with a `<ul>`, and the 3 consuming pages have to
   pass the array shape through. All of this is dead code
   until a backend story lands.
2. **Force a public API change on a defensive surface** —
   `ApiError.fields`'s shape is part of the typed-error
   contract that every consumer in the codebase switches on.
   Changing it without a real backend emitter is a high-cost
   refactor for zero user-visible benefit today.
3. **Lose the "if it ever happens" signal** — if the backend
   *does* quietly start emitting arrays, the current
   `Record<string, string>` type would silently drop them at
   runtime. A tripwire makes the regression visible in dev +
   CI without any API change.

The tripwire is the right answer today, the right answer
tomorrow, and the right answer the day a backend story
introduces array fields (at which point Option B becomes a
clearly-scoped, motivated slice — see the "Follow-up" row
below).

## Scope

### Modified files

1. **`frontend/src/app/services/api-error.ts`** —
   `asFieldMap` (lines 65-74 area) gains a `console.warn`
   inside the `else if (v !== null && v !== undefined)`
   branch. The string-valued happy path is unchanged. The
   `Record<string, string>` return type is unchanged. The
   `else` branch (where the warn lives) is the only path
   that previously dropped values silently.

2. **`frontend/src/app/services/api-error.spec.ts`** —
   the existing test "drops non-string field values silently
   (defensive)" is renamed to "drops non-string field values
   silently (defensive) — D5 tripwire fires" and its
   docblock is updated to describe the new behavior. No new
   assertion — the test continues to pass and the WARN is
   surfaced in the test output as confirmation.

### New files

1. **`_bmad-output/implementation-artifacts/spec-d5-asFieldMap-tripwire.md`** —
   this spec doc.

2. **`_bmad-output/d5.diff`** — the diff snapshot.

## Files

**New:**
- `_bmad-output/implementation-artifacts/spec-d5-asFieldMap-tripwire.md`
- `_bmad-output/d5.diff`

**Modified:**
- `frontend/src/app/services/api-error.ts` (tripwire in
  `asFieldMap`)
- `frontend/src/app/services/api-error.spec.ts`
  (docblock update on the existing drop-silently test)
- `_bmad-output/implementation-artifacts/deferred-work.md`
  (D5 row close)

## Reuse (no new patterns)

- **`console.warn`** — already used elsewhere in the codebase
  (e.g. `login-page.component.ts:293` for the
  unsafe-return_to log; `attachmentsController.ts:67` for
  the storage-missing warning; several others). Same idiom.
- **`eslint-disable-next-line no-console`** — already used
  in 6+ files in the codebase to silence the linter on
  intentional `console.*` calls. Same pattern.
- **No type widening** — the `Record<string, string>`
  contract is preserved. No `form-field` change, no page
  change, no `ApiError` public-API change.
- **No new test** — the existing test already exercises
  the non-string-drop path. The tripwire makes the test's
  output louder; the assertion is unchanged.

## Test plan

### Existing tests (unchanged behavior)

- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/api-error.spec.ts'`
  — **12/12** pass. The "drops non-string field values
  silently (defensive) — D5 tripwire fires" test now prints
  a `WARN: '[api-error] dropping non-string field "count"
  (type=number); …'` line to stderr. The assertion on
  `result.fields` still passes (only `email: 'Email is
  required.'` is kept).
- `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
  — **344/351** unchanged (same 7 pre-existing baseline
  failures; tripwire is non-fatal).

### Backend (no impact)

- `cd backend && npm test` — **118/118** unchanged. D5 is
  frontend-only.

### No new test (intentional)

A new test that asserts the `console.warn` is called would be
testing the tripwire, not the application. The tripwire
itself is one line of code; the kind of regression that a
test would catch is "tripwire was deleted", which fails at
code review, not at runtime. **No spec added in this slice.**

## Follow-up (NOT in this slice — filed as a new D-row)

The day a backend story introduces array field messages (or
an equivalent multi-message shape), the work to widen
`ApiError.fields` to `Record<string, string | string[]>`
becomes a clearly-scoped, motivated slice. The work would
be:

- Widen `ApiError.fields` to `Record<string, string | string[]>`.
- Widen `FormFieldComponent.error` to `string | string[]`
  and add a `<ul>` rendering branch in its template.
- Update `login-page`, `create-ticket-page`,
  `change-password-page` to pass the array shape through.
- Replace the tripwire (or keep it for the
  `string` not-`string[]` corner — `string[]` is now legal
  and shouldn't warn).
- Update the `api-error.spec.ts` "drops non-string field
  values" test to assert on the new array shape.

The "production bug" D-row for this is intentionally **not
filed in this slice** — the trigger is "backend starts
emitting arrays", which has not happened and is not on any
sprint. Filing it now would be noise. Reopen D5 (or file
D13) the day the backend changes.

## Boundaries (never)

- **No `Record<string, string | string[]>` widening.** This
  slice is a tripwire, not a type change. The contract is
  preserved.
- **No `FormFieldComponent` change.** The component
  continues to render a single `string` error. Multi-message
  UI is a follow-up.
- **No page-level error-render change.** `login-page`,
  `create-ticket-page`, `change-password-page` continue to
  treat `err.fields` as `Record<string, string>` and render
  one message per field.
- **No new `ApiErrorCode` member.** The tripwire doesn't
  add a new code; the existing codes are unchanged.
- **No `throw` on non-string.** `console.warn` is
  intentionally non-fatal — a stray non-string in a
  test mock body shouldn't break the test. A `throw`
  variant was considered; rejected because tests would
  have to wrap every `httpErr(400, { fields: { …, x: 3
  } })` in a try/catch.
- **No silent removal of the WARN.** The tripwire is the
  point of the slice; it stays until the type is widened.

## Verification

1. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/api-error.spec.ts'`
   — **12/12** pass; the WARN prints once (on the
   non-string-drop test). The other 11 tests don't print
   any WARN (their bodies don't have non-string field
   values).
2. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   — **344/351** unchanged.
3. `cd backend && npm test` — **118/118** unchanged.
4. `git diff --stat` should show exactly:
   - the `asFieldMap` change in `api-error.ts` (~15 added
     lines, 0 removed);
   - the docblock update in `api-error.spec.ts`;
   - the new `spec-d5-asFieldMap-tripwire.md`;
   - the D5 row close in `deferred-work.md`.

## Commit

Two commits, mirroring the D9 / D10 / D12 pattern:

1. `feat(D5): asFieldMap tripwire for non-string field values`
   — the implementation (`asFieldMap` + spec docblock).
2. `docs: D5 implementation diff snapshot` — the
   `_bmad-output/d5.diff`.

Both pushed to `origin/main`.
