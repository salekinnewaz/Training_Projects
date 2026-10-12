# D9 — `ticketService.createTicket` integration test slice

## Context

`deferred-work.md` D9 documents that the HD-008 spec's
**DUPLICATE_NUMBER** edge case — "two parallel `POST
/api/tickets` calls both succeed with distinct `HD-<n>`" — has
no pinning test. Every existing backend spec mocks
`services/ticketService` at the module boundary; the actual
`createTicket` body (single `sequelize.transaction` →
`nextTicketNumber(tx)` doing `findByPk('ticket_number', { lock:
UPDATE })` → `row.update({ value: next }, { transaction: tx })`
→ `Ticket.create({...}, { transaction: tx })`) is exercised
only in production.

The HD-008 spec locked DUPLICATE_NUMBER as **Backend-handled
behavior**, but its "tests assert both inserts succeed with
distinct numbers" line was explicitly called out in the spec's
Implementation Notes (HD-008, line 211) as **aspirational** and
routed to D9. The spec's Review Triage Log ("Rejected" row at
line 247) confirms: "Direct unit test for
`ticketService.createTicket` transaction + counter | defer |
Needs integration testing infra (in-memory DB or sequelize-
mock); out of MVP scope; ... Defer to backend testing infra
story."

This slice closes the gap by introducing backend integration
testing — one new file, one DB bootstrap, one Jest project
split — and three tests that pin the contract.

## Why real MySQL (not sqlite, not sequelize-mock)

Two alternatives were considered and rejected; the rejection is
documented here for posterity:

- **sqlite in-memory**: SQLite parses `SELECT ... FOR UPDATE`
  but the clause is a **no-op** (SQLite uses file-level + WAL
  locks, not row locks). Running DUPLICATE_NUMBER under sqlite
  would degrade the test to a UNIQUE-constraint failure on
  `tickets.number` and silently lose the real assertion — that
  the `lock: UPDATE` on the counter row is what **serializes**
  the two transactions. The race would still produce distinct
  numbers by accident (because of the DB-level UNIQUE index on
  `tickets.number`), but it would not pin the mechanism.
  Without the `lock: UPDATE` test, the assertion would pass
  even if the service regressed to a non-locking read-modify-
  write that happened to get lucky.
- **sequelize-mock**: a pure stub that returns canned values
  for the Sequelize API. The tx + lock + insert code path is
  not exercised at all. Defeats the purpose.

**Real MySQL is the only honest choice** because:

1. The `Counter.findByPk(..., { lock: UPDATE })` is MySQL /
   InnoDB semantics — must be exercised against the same engine
   to hold.
2. The `tickets.number` UNIQUE index lives in MySQL — that's
   the safety net under contention; the 10× parallel stress
   test would degrade into a constraint-violation cascade
   under sqlite.
3. The dev `docker-compose.yml` already runs MySQL 8; we just
   point tests at a sibling database (`helpdesk_lite_test`) on
   the same container, reusing the existing credentials.

## Architecture

### Where the test DB comes from

- **Same container** (`helpdesk-lite-mysql`, port 3306, MySQL 8
  InnoDB) — no new service in `docker-compose.yml`.
- **Different database name** — `helpdesk_lite_test` instead of
  `helpdesk_lite`. Sits on the same MySQL instance; the two
  are fully isolated.
- **Bootstrap via `docker-entrypoint-initdb.d/`** — the new
  `docker/mysql-init/01-helpdesk_lite_test.sql` file creates
  `helpdesk_lite_test` and grants the dev `helpdesk` user
  access. Runs once on first container start (or after
  `docker compose down -v`). The `helpdesk` user otherwise has
  privileges only on `helpdesk_lite` (granted by MySQL's
  built-in `MYSQL_DATABASE` env var), so the grant is
  mandatory.
- **Env-driven**: the existing Sequelize instance reads
  `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` /
  `DB_PORT`. The integration setup file overrides these in
  `process.env` *before* the first import of
  `src/config/database` resolves. No change to
  `src/config/database.ts`.
- **`.env.test.example`** is the new tracked template; the
  actual `.env.test` is gitignored (per-developer, optional).

### How schemas get into the test DB

- **`sequelize.sync({ force: true })`** in the setup file's
  `resetTestDb({ counterStart })` helper. Runs every model
  `init()` + the central `defineAssociations()`. Importing
  `src/models` (in the setup file) causes both as a side
  effect. Force-true wipes any pre-existing tables so the test
  DB is always deterministic.
- **No migrations** run. Migrations are CJS files owned by
  `sequelize-cli`; running them under ts-jest requires ts-node
  or a separate process. Skipped because `sync({ force: true
  })` + a manually-inserted `('ticket_number', N)` counter row
  covers what `createTicket` touches. Migrations continue to
  be exercised in dev by `npm run db:migrate` — unchanged.
- **No seeders**. The setup file's helper seeds the counter
  row directly via
  `Counter.create({ name: 'ticket_number', value: 20 })`,
  matching the dev seeder at
  `backend/src/seeders/20260915000000-demo-data.js:162`. The
  starting value is an argument so individual tests can choose
  (the 10× parallel stress uses 9999 so any collision or
  skipped number is visible at a glance).

### How test rows stay isolated

Each `it` block runs with a clean DB:

- `beforeEach` calls `resetTestDb({ counterStart: 20 })` which
  does `sync({ force: true })` (drops + recreates every table)
  then re-seeds the counter row.
- The setup file also exports a `truncateAllTables()` helper
  for future specs that want fast row-only resets. The D9
  suite doesn't use it (we want the full schema reset
  guarantee).

### Jest project split

`backend/jest.config.js` switches from a single project to a
`projects: [unit, integration]` array. Each project has its
own `testMatch` and the unit project ignores files matching
`.integration.spec.ts$` so the two never double-discover.

`setupFilesAfterEnv` (per Jest docs) runs after the test
framework is set up but before any `it` is invoked — exactly
when we need the env-override + DB probe to land.

`jest.setTimeout(30000)` is called inside the setup file to
give the MySQL container warm-up + the 10× parallel race a
generous budget. Individual `it`s still complete in <300ms
(measured).

## Scope

### New files

1. **`backend/test/integration/setup.ts`** — the
   `setupFilesAfterEnv` file.
   - Forces `process.env.DB_NAME = 'helpdesk_lite_test'` and
     resets the other DB env vars to dev defaults before any
     `require('../src/config/database')` runs. Importing
     `src/models` causes the Sequelize instance to come up
     against the test DB.
   - Probes the DB in `beforeAll`; re-throws with a friendly
     message ("start MySQL with `docker compose up -d mysql`")
     on connect failure so the suite fails fast instead of
     cascading connection errors.
   - `afterAll` closes the Sequelize connection so Jest exits
     cleanly.
   - Exports `resetTestDb({ counterStart })` for the
     per-spec `beforeEach`.
   - Exports `truncateAllTables()` for future specs that want
     a fast row-only reset.

2. **`backend/test/integration/createTicket.integration.spec.ts`**
   — three tests:
   1. **Happy path** — `createTicket(submitterId, validInput)`
      returns a Ticket whose `number` is `HD-21` (counter
      starts at 20), whose `submitter` include is hydrated
      with the test user, and whose row exists in `tickets`
      post-call with `status === 'Open'`.
   2. **Sequential counter increments** — three sequential
      `createTicket` calls return `HD-21`, `HD-22`, `HD-23`
      with no skipped numbers and the `Counter.value` column
      reads `23` after the third.
   3. **DUPLICATE_NUMBER race (the locked spec row)** — two
      sub-cases:
      - **2× parallel** (start at 20) → `HD-21`, `HD-22`
        both succeed.
      - **10× parallel stress** (start at 9999) → all 10
        resolve with 10 distinct numbers, `Counter.value` is
        `10009`. Confirms the `lock: UPDATE` on the counter
        row actually serializes the increment + insert pair
        under higher contention.

3. **`backend/.env.test.example`** — tracked template with
   `DB_NAME=helpdesk_lite_test` plus the dev credentials
   from `.env`.

4. **`docker/mysql-init/01-helpdesk_lite_test.sql`** — MySQL
   init script. Creates the test DB and grants the
   `helpdesk` user access. Mounted into
   `docker-entrypoint-initdb.d/` via `docker-compose.yml`.
   Runs once on first container start (or after
   `docker compose down -v`).

5. **`backend/tsconfig.test.json`** — extends
   `tsconfig.json` and adds the `test/` directory to
   `include`. Used by the `typecheck` script (which now runs
   `tsc --noEmit` twice — once on `tsconfig.json`, once on
   `tsconfig.test.json`) so the integration spec files are
   typechecked too.

6. **This spec doc** — `_bmad-output/implementation-artifacts/
   spec-d9-create-ticket-integration.md`.

### Modified files

1. **`backend/jest.config.js`** — `projects: [unit,
   integration]` split (see Architecture above).
   Backward-compat: every existing `*.spec.ts` continues to
   run under the `unit` project.

2. **`backend/package.json`** — adds
   `"test:integration": "jest --selectProjects integration"`
   and chains `tsc --noEmit -p tsconfig.test.json` into
   `typecheck`.

3. **`backend/.gitignore`** — adds `.env.test`.

4. **`backend/tsconfig.json`** — **unchanged**. The test
   directory is now covered by `tsconfig.test.json` instead
   of polluting the build's `rootDir: "src"` constraint.

5. **`docker-compose.yml`** — adds the
   `./docker/mysql-init:/docker-entrypoint-initdb.d:ro`
   volume mount so the init script runs on first container
   start.

6. **`README.md`** — adds a "Tests" section documenting the
   two Jest projects, the `npm run test:integration` script,
   and the `.env.test` override escape hatch.

7. **`_bmad-output/implementation-artifacts/deferred-work.md`**
   — closes the D9 row.

8. **`_bmad-output/implementation-artifacts/spec-hd-008-create-
   ticket.md`** — adds a "Pinned by D9 slice" entry to the
   Review Triage Log so the original aspirational note is no
   longer aspirational.

## Files

**New:**
- `backend/test/integration/setup.ts`
- `backend/test/integration/createTicket.integration.spec.ts`
- `backend/.env.test.example`
- `backend/tsconfig.test.json`
- `docker/mysql-init/01-helpdesk_lite_test.sql`
- `_bmad-output/implementation-artifacts/spec-d9-create-ticket-integration.md`
- `_bmad-output/d9.diff`

**Modified:**
- `backend/jest.config.js` (projects split)
- `backend/package.json` (`test:integration` script +
  typecheck chain)
- `backend/.gitignore` (`.env.test`)
- `docker-compose.yml` (init script mount)
- `README.md` (Tests section)
- `_bmad-output/implementation-artifacts/deferred-work.md`
  (D9 close)
- `_bmad-output/implementation-artifacts/spec-hd-008-create-ticket.md`
  (Followup Log row; aspirational-note resolved)

## Reuse (no new patterns)

- **`sequelize.sync({ force: true })`** — vanilla Sequelize v6
  API; the project's models all use `Model.init(...)` which
  this knows how to drive. Zero new dependency.
- **`TRUNCATE TABLE` with `SET FOREIGN_KEY_CHECKS = 0`** —
  native MySQL; no new library. (D9 doesn't use TRUNCATE —
  the setup file ships a `truncateAllTables` helper for
  future specs but the D9 spec itself uses
  `sync({ force: true })`.)
- **Jest `projects` config** — built into Jest 29 since v22;
  no third-party wrapper needed.
- **`testEnvironment: 'node'`** — same as the current config;
  no jsdom / supertest.
- **`describe` / `it` / `beforeAll` / `beforeEach` / `afterAll`**
  — standard Jest; no new test API.
- **Direct calls to `ticketService.createTicket`** — no
  supertest, no Express mock. The spec is *unit-style* on the
  service layer (call a function, assert on DB), not a
  controller-level integration. Right primitive for
  "exercise the tx path" and avoids the cost of booting
  Express for four tests.
- **The existing `Counter` / `Ticket` / `User` models** —
  imported via `src/models` in the spec; no model duplication.

## Test plan

### Unit specs (unchanged behavior)

- Every existing `*.spec.ts` continues to run under the
  `unit` Jest project. The only structural change is that
  the unit project's `testMatch` is now
  `<rootDir>/src/**/*.spec.ts` minus files matching
  `.integration.spec.ts$` — none of the existing specs
  end in `.integration.spec.ts`, so all 114 existing
  assertions continue to run.

### Integration spec (new) — 4 tests

`backend/test/integration/createTicket.integration.spec.ts`:

1. **Happy path** (real tx + counter + insert):
   - Seed counter at 20 (matches dev seeder).
   - Create one ticket:
     `createTicket(submitter.id, validInput)` where
     `validInput` matches the shape from
     `backend/src/utils/validation/ticketValidation.ts:33-39`.
   - Assert the returned Ticket has `number === 'HD-21'`,
     `submitterId === submitter.id`, `status === 'Open'`,
     `title`/`priority`/`category` match the input; the eager
     `submitter` include is hydrated (cast to access the
     runtime-only include).
   - Assert the DB row exists with the right persisted state.
   - Assert `Counter.value === 21`.

2. **Sequential counter increments**:
   - Seed counter at 20.
   - Three sequential `createTicket` calls (await each before
     next).
   - Assert `numbers` are exactly
     `['HD-21', 'HD-22', 'HD-23']`, `Counter.value` is `23`,
     and `tickets` has exactly three rows with those
     numbers.

3. **DUPLICATE_NUMBER — 2× parallel**:
   - Seed counter at 20; run
     `Promise.all([createTicket(...), createTicket(...)])`.
   - Both must resolve. The two `number` strings must be
     distinct. The set of numbers must be exactly
     `{HD-21, HD-22}`.
   - `tickets` has exactly two rows; both point at the
     submitter. `Counter.value` is `22`.

4. **DUPLICATE_NUMBER — 10× parallel stress**:
   - Re-seed counter at 9999; run
     `Promise.all([...ten createTicket calls])`.
   - All 10 must resolve. All 10 numbers must be distinct
     (Set size === array length).
   - The set must be exactly
     `{HD-10000, …, HD-10009}`.
   - `Counter.value` is `10009`. `tickets` has exactly 10
     rows — the UNIQUE index held.

### Manual smoke (post-merge)

Per the README addition:
- `docker compose up -d mysql` (existing) — wait for
  `mysqladmin ping` to pass.
- `cd backend && npm run test:integration` — confirm 4/4
  pass; observe the integration DB has tables + the
  `('ticket_number', 10009)` row after the fourth test.
- `cd backend && npm test` — confirm both projects run
  and the total count matches (was 114; +4 from the
  integration project → 118).
- `docker compose down -v` to wipe the volume, `up -d`
  again, `npm run test:integration` — confirm it still
  passes (proves the setup is robust to a wiped DB; the
  init script recreates the test DB + grant on first
  start).

## Boundaries (never)

- **No new dev dependency** beyond what the project
  already has. (Considered `sqlite3` to dodge the real
  DB; the real MySQL on the same container is fine and
  exercises `FOR UPDATE` honestly. Considered
  `sequelize-mock`; it doesn't exercise anything. Both
  rejected.)
- **No migration files added**. `sequelize.sync({ force:
  true })` covers schema; adding a migration would be
  out-of-scope churn.
- **No `app.use(express())` boot** in the integration
  spec. No supertest, no agent. The D9 spec calls
  `ticketService.createTicket` directly because that's
  the surface the matrix is checking. Booting Express
  would gate the spec on unrelated infrastructure.
- **No change to `ticketService.createTicket`** — the D9
  spec is purely additive. Any fix discovered while
  writing the slice goes into a separate story.
- **No GitHub Actions / CI** in this slice. There is no
  CI today; adding a workflow file is out-of-scope and
  would also need a hosted MySQL (a separate infra
  decision). D9 is the in-repo slice; CI integration is
  a follow-up.
- **No `DATABASE_URL` switch** — keep the existing
  `DB_*` env vars; the test setup file overrides them.
- **No refactor of `jest.mock('../models', …)` in
  existing specs.** They continue to mock at the module
  boundary; this is consistent and intentional.

## Verification

1. `docker compose up -d mysql` (start container; wait
   for healthcheck).
2. `cd backend && npm run test:integration` — **4/4
   pass**.
3. `cd backend && npm test` — **118/118 pass** (was
   114, +4 from the integration project, no unit-project
   regression).
4. `cd backend && npm run typecheck` — exits 0
   (both `tsc --noEmit` and `tsc --noEmit -p
   tsconfig.test.json` succeed).
5. `cd backend && npm run build` — exits 0
   (proves dropping `rootDir: "src"` was reverted and
   the build output is still `dist/server.js`).
6. Manual: `docker compose down -v`, `up -d mysql`,
   `cd backend && npm run test:integration` — still
   passes (proves the init script + setup file are
   self-sufficient).
7. `docker exec -it helpdesk-lite-mysql mysql -uhelpdesk
   -phelpdesk_pwd helpdesk_lite_test -e 'SHOW TABLES'`
   — confirm `tickets`, `comments`, `activity_logs`,
   `attachments`, `counters`, `users` exist with the
   expected columns.

## Commit

Two commits, mirroring the D10 pattern:

1. `feat(D9): integration test for ticketService.createTicket`
   — the implementation (new test file, setup, projects,
   scripts, docs, docker init).
2. `docs: D9 implementation diff snapshot` — the
   `_bmad-output/d9.diff`.

Both pushed to `origin/main`.
