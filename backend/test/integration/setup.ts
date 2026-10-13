/**
 * Integration test bootstrap — D9.
 *
 * Runs as `setupFilesAfterEnv` for the `integration` Jest
 * project (see `backend/jest.config.js`). Two responsibilities:
 *
 *   1. **Override the DB env vars** BEFORE the Sequelize
 *      instance from `src/config/database` is constructed, so
 *      the integration suite points at the `helpdesk_lite_test`
 *      database on the same Postgres container the dev app uses.
 *      Static env mutation at module top + an early import of
 *      `src/models` cause the singleton to come up against the
 *      test DB once per Jest worker.
 *
 *   2. **Expose `resetTestDb({ counterStart })`**, a single
 *      helper that (a) `sync({ force: true })` to rebuild the
 *      schema and (b) seed the
 *      `('ticket_number', counterStart)` counter row the
 *      `nextTicketNumber` helper reads. Specs call it in
 *      `beforeEach` so each `it` starts with a known-good DB
 *      state.
 *
 * The integration suite intentionally:
 *   - uses a sibling DB on the **same** Postgres container
 *     (docker-compose.yml) so the test path is byte-identical
 *     to production (Postgres MVCC, FOR UPDATE, UNIQUE index on
 *     `tickets.number`).
 *   - does **not** import migrations or seeders — `sync({ force:
 *     true })` + a manual counter row cover everything
 *     `createTicket` touches. Migrations continue to be run in
 *     dev by `npm run db:migrate` only.
 *   - does **not** boot Express. The D9 spec is unit-style on
 *     the service layer: call a function, assert on the DB.
 *
 * Connectivity: the probe below runs once per worker. If the
 * Postgres container is not reachable, the test command fails
 * fast with a clear message ("start Postgres with `docker
 * compose up -d postgres`") instead of cascading connection
 * errors through every spec.
 */

import type { Sequelize } from 'sequelize';

// ── 1. Env override (must come before any src import that
//      causes `src/config/database` to run) ────────────────────
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_NAME = 'helpdesk_lite_test';
process.env.DB_USER = process.env.DB_USER ?? 'helpdesk';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'helpdesk_pwd';
// NODE_ENV=test silences morgan on the off-chance anything
// imports the Express app from inside a spec.
process.env.NODE_ENV = 'test';
// Prevent the runtime auth flow from blowing up if anything
// transitively imports the JWT helper.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-do-not-use';

// ── 2. Side-effect import so every model registers + the
//      central `defineAssociations()` runs once per worker ────
import {
  sequelize,
  User,
  Ticket,
  Comment,
  ActivityLog,
  Attachment,
  Counter,
} from '../../src/models';

// ── 3. Connectivity probe — fail fast with a clear message ──
let dbAvailable = false;

// 30s gives the dev Postgres container warm-up time + the initial
// `sequelize.sync({ force: true })` + the 10× parallel race a
// generous budget. Individual `it`s still complete in <1s.
jest.setTimeout(30000);

beforeAll(async () => {
  try {
    await sequelize.authenticate({ logging: false });
    dbAvailable = true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // Re-throw with a friendlier message. Jest's reporter
    // surfaces this verbatim.
    throw new Error(
      `Integration test DB is unreachable at ` +
        `${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'} ` +
        `as \`${process.env.DB_NAME}\`. ` +
        `Start the dev Postgres container with \`docker compose up -d postgres\` ` +
        `and wait for the healthcheck to pass. ` +
        `Underlying error: ${reason}`,
    );
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await sequelize.close();
  }
});

// ── 4. Helpers exported for the specs ────────────────────────

export interface ResetTestDbOptions {
  /**
   * Starting value for the `('ticket_number', …)` counter
   * row. Defaults to 20 to match the dev seeder
   * (`backend/src/seeders/20260915000000-demo-data.js:162`).
   */
  counterStart?: number;
}

/**
 * Wipe + rebuild the schema and re-seed the counter row.
 *
 * `sync({ force: true })` drops and recreates every table
 * declared by the registered models. After that, only the
 * counter row exists — no users, no tickets — so each `it`
 * starts with deterministic state.
 *
 * Use this in `beforeEach` for specs that create rows; use it
 * in `beforeAll` only if you're sure no test mutates the
 * counter.
 */
export async function resetTestDb(
  options: ResetTestDbOptions = {},
): Promise<void> {
  const counterStart = options.counterStart ?? 20;

  await sequelize.sync({ force: true });

  await Counter.create({
    name: 'ticket_number',
    value: counterStart,
  });
}

/**
 * Truncate row state between specs without dropping the
 * schema. Faster than `sync({ force: true })` — appropriate
 * when a spec only adds rows and doesn't change the schema
 * shape.
 *
 * Postgres-specific approach: disable the session's
 * `session_replication_role` to skip FK triggers, then
 * TRUNCATE … RESTART IDENTITY CASCADE which handles the
 * cascade graph natively.
 */
export async function truncateAllTables(): Promise<void> {
  const tables = [
    'comments',
    'activity_logs',
    'attachments',
    'tickets',
    'counters',
    'users',
  ];
  await sequelize.query("SET session_replication_role = 'replica'");
  try {
    // TRUNCATE … RESTART IDENTITY CASCADE handles FKs natively
    // in Postgres and resets any SERIAL/IDENTITY columns.
    for (const table of tables) {
      await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
  } finally {
    await sequelize.query("SET session_replication_role = 'origin'");
  }
}

export { sequelize, User, Ticket, Comment, ActivityLog, Attachment, Counter };
export type { Sequelize };
