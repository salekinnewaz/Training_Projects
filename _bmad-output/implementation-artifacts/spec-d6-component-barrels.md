# D6 — `components/atoms/` and `components/molecules/` barrel files

## Context

`deferred-work.md` D6 notes that the project has no barrel
`index.ts` files in the design-system tiers, and that every
consumer (13 pages, 9 molecules, every spec) imports by full
path:

```ts
import { ButtonComponent } from '../../components/atoms/button/button.component';
```

The deferred note's "Owner" column reads "Style convergence
slice (post-HD-016)" and the "Notes" column reads "Every
consumer imports by full path today. Land barrel files when a
third deep-import need surfaces." With 13 atoms and 9
molecules and 100% path consistency (verified), the "third
deep-import need" is *now* — barrels are pure additive, no
consumer migration is required, and the deep paths keep
working unchanged.

## Why barrels (and why now)

The pain point isn't ergonomic — it's a **churn tax**. Every
time a new component is added to either tier:

- Every page that imports the new component picks the deep
  path by default (because that's what every other page does).
- If the third consumer ever wants to swap to a barrel, it has
  to import from a non-existent file (`../../components/atoms`),
  hitting a TS2307 error before the barrel exists.
- A barrel is one file with N re-export lines — adding it
  today costs ~25 lines of code and ~0 risk; waiting for the
  "third need" is just deferring a one-line addition while
  the cost of writing the barrel (and the cost of *every*
  import that runs through it) is exactly the same.

The fix is small, the risk is zero (the barrels are
**additive only** — see Boundaries below), and the user-
facing benefit is a single import line per component in
future slices.

## Scope

### New files

1. **`frontend/src/app/components/atoms/index.ts`** —
   13 selective re-exports for the atom components + their
   public types (`SelectOption`, `SelectPlaceholderOption`,
   `CheckCircleSize`).
2. **`frontend/src/app/components/molecules/index.ts`** —
   9 selective re-exports for the molecule components + their
   public types (`ActorLookup` from `timeline-entry`).

### Modified files

None. This is a strictly additive slice — see
**Boundaries** below for the explicit no-consumer-migration
contract.

## Files

**New:**
- `frontend/src/app/components/atoms/index.ts`
- `frontend/src/app/components/molecules/index.ts`
- `_bmad-output/implementation-artifacts/spec-d6-component-barrels.md`
- `_bmad-output/d6.diff`

**Modified:**
- `_bmad-output/implementation-artifacts/deferred-work.md`
  (D6 row close)

## Reuse (no new patterns)

- **`export { Foo } from './foo/foo.component'`** — vanilla ES
  module re-export; the standard barrel primitive. No
  third-party `barrel-bench` / barrel-builder / `ng-packagr`
  needed.
- **TypeScript's `export type` syntax** — used for
  `SelectOption`, `SelectPlaceholderOption`, `CheckCircleSize`,
  `ActorLookup`. Same primitive as every other type-only
  export in the codebase.
- **`tsconfig.spec.json`'s `isolatedModules: true`** — every
  re-export line in both barrels is value-or-type, never a
  re-exported value-as-type, so `isolatedModules` is happy.
- **No new dev dependency** — barrel files are pure ES module
  syntax.

## Re-exports included

### Atoms (13 components + 3 types)

| Component / Type               | Source file                                  |
|--------------------------------|----------------------------------------------|
| `ButtonComponent`              | `button/button.component.ts`                 |
| `InputTextComponent`           | `input-text/input-text.component.ts`         |
| `LinkComponent`                | `link/link.component.ts`                     |
| `ShowPasswordToggleComponent`  | `show-password-toggle/...`                   |
| `TextareaComponent`            | `textarea/textarea.component.ts`             |
| `SelectComponent`              | `select/select.component.ts`                 |
| `SelectOption`                 | `select/select.component.ts` (type)          |
| `SelectPlaceholderOption`      | `select/select.component.ts` (type)          |
| `BadgePriorityComponent`       | `badge-priority/...`                         |
| `BadgeRoleComponent`           | `badge-role/...`                             |
| `BadgeStatusComponent`         | `badge-status/...`                           |
| `CaretDownComponent`           | `caret-down/...`                             |
| `CheckCircleComponent`         | `check-circle/...`                           |
| `CheckCircleSize`              | `check-circle/...` (type: `24 | 32 | 64`)    |
| `ChromeAvatarComponent`        | `chrome-avatar/...`                          |
| `DividerHrComponent`           | `divider-hr/...`                             |

### Molecules (9 components + 1 type)

| Component / Type             | Source file                                  |
|------------------------------|----------------------------------------------|
| `DialogModalComponent`       | `dialog-modal/...`                           |
| `DropdownPanelComponent`     | `dropdown-panel/...`                         |
| `EmptyStateComponent`        | `empty-state/...`                            |
| `FormFieldComponent`         | `form-field/...`                             |
| `HeaderChromeComponent`      | `header-chrome/...`                          |
| `KanbanCardComponent`        | `kanban-card/...`                            |
| `TicketRowComponent`         | `ticket-row/...`                             |
| `TimelineEntryComponent`     | `timeline-entry/...`                         |
| `ActorLookup`                | `timeline-entry/...` (type:                  |
|                              | `Record<number, string>`)                    |
| `UserRowComponent`           | `user-row/...`                               |

## Why selective (not `export *`)

Three reasons:

1. **Explicit surface.** A new atom added later doesn't
   accidentally leak into a consumer's bundle via the barrel
   until someone adds it to `index.ts`. The barrel is
   deliberately a curated list.
2. **TypeScript `isolatedModules` compatibility.** The tsconfig
   sets `isolatedModules: true`; `export *` re-exports of
   value+type mixed modules under isolatedModules need a
   `type` qualifier on the `export` line. Selective re-exports
   sidestep that.
3. **Diff-friendliness.** When a component is renamed or
   removed, the diff shows up in exactly one file (the
   barrel) plus the deep path. `export *` hides the surface
   in a transitive closure that's hard to audit.

## Test plan

### Existing tests (unchanged behavior)

`cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`

- Baseline: **344/351** (7 pre-existing failures, all in
  `EmployeeDashboardPageComponent` × 3, `ForbiddenPageComponent`
  × 3, `UserRowComponent` × 1 — same as before this slice).
- After D6: **344/351** (no change). Barrels are
  non-discoverable at the karma-spec layer (Karma discovers
  `*.spec.ts` files, not barrels), so no test runs a barrel
  import. The barrel is consumed only by future application
  code, not by the existing test fixtures.

### Type-check (proves the barrels parse)

`cd frontend && npx tsc --noEmit -p tsconfig.spec.json`

- Exits 0. Both `index.ts` files compile; the `export type`
  lines are well-formed; the imports resolve.

### No new test (intentional)

The barrel itself is one-line-per-entry; the kind of failure
that a regression test would catch is "barrel is missing
export X", which fails at TypeScript compile time. A spec
that imports from the barrel would be testing TypeScript, not
the application. **No spec added in this slice.**

## Boundaries (never)

- **No consumer migration.** Every page, every spec, every
  existing deep-path import continues to work. The deep paths
  are not deprecated by this slice — barrels are additive,
  full stop. A future slice can migrate consumers at its own
  pace.
- **No `export *` shorthand.** Each entry is an explicit
  named re-export (or `export type` for type-only entries).
  See "Why selective" above.
- **No new components in the barrel.** If a new atom or
  molecule is added later, it must be added to the barrel
  in the same slice that adds the component. This is
  enforced by the test plan in the slice that adds the
  component (a `grep` for the component name in
  `index.ts`).
- **No barrel for `organisms/` or `patterns/`.** The
  deferred note scoped D6 to atoms and molecules. Organisms
  (currently: `file-drop`) and patterns (currently:
  `app-chrome`) are larger and have more cross-tier
  dependencies; their barrel is a separate decision.
- **No `index.ts` for `services/`, `models/`, `pages/`,
  `guards/`, `utils/`.** Same scope reasoning.

## Verification

1. `cd frontend && npx tsc --noEmit -p tsconfig.spec.json` —
   exits 0 (barrels parse).
2. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`
   — **344/351** unchanged.
3. `git diff --stat` — should show exactly:
   - 2 new files (`components/atoms/index.ts` and
     `components/molecules/index.ts`);
   - 1 modified file (`_bmad-output/.../deferred-work.md`
     for the D6 row close).
4. `git diff frontend/src/app` (excluding the new
   `index.ts` files) — should be empty. No existing file
   was modified.

## Commit

Two commits, mirroring the D9 / D10 / D12 pattern:

1. `feat(D6): barrel index.ts for components/atoms and components/molecules`
   — the implementation (the two new `index.ts` files + the
   `deferred-work.md` row close).
2. `docs: D6 implementation diff snapshot` — the
   `_bmad-output/d6.diff`.

Both pushed to `origin/main`.
