/**
 * D9 — `ticketService.createTicket` integration tests.
 *
 * Pins the three behaviors the HD-008 spec's I/O & Edge-Case
 * Matrix promises for the ticket-creation write path:
 *
 *   1. **Happy path** — a single `createTicket` call returns a
 *      Ticket whose `number` is `HD-21` (counter starts at
 *      20), whose eager `submitter` include is the test user,
 *      and whose row exists in `tickets` post-call with
 *      `status === 'Open'`.
 *
 *   2. **Sequential counter increments** — three sequential
 *      `createTicket` calls return `HD-21`, `HD-22`, `HD-23`
 *      with no skipped numbers; `Counter.value` reads `23`
 *      after the third.
 *
 *   3. **DUPLICATE_NUMBER race** (the locked HD-008 row) —
 *      parallel `createTicket` calls all resolve and all
 *      `number`s are distinct. Verified at two contention
 *      levels:
 *      - **2× parallel** (start at 20) → `HD-21`, `HD-22`
 *        both succeed.
 *      - **10× parallel stress** (start at 9999) → all 10
 *        resolve with 10 distinct numbers, `Counter.value`
 *        is `10009`. Confirms the `lock: UPDATE` on the
 *        counter row actually serializes the increment +
 *        insert pair under higher contention.
 *
 * Why real MySQL and not sqlite / sequelize-mock: the
 * DUPLICATE_NUMBER assertion is about MySQL/InnoDB semantics
 * (`SELECT ... FOR UPDATE` + the UNIQUE index on
 * `tickets.number`). SQLite parses `FOR UPDATE` as a no-op;
 * sequelize-mock doesn't exercise the code path. Documented
 * at length in `_bmad-output/implementation-artifacts/
 * spec-d9-create-ticket-integration.md`.
 *
 * Why we call `createTicket` directly (no supertest, no
 * Express): the assertion target is the service function
 * (tx + counter + insert). Booting Express would gate the
 * spec on unrelated middleware and inflate the time budget.
 */

import { createTicket } from '../../src/services/ticketService';
import type { CreateTicketInput } from '../../src/utils/validation/ticketValidation';
import {
  sequelize,
  User,
  Ticket,
  Counter,
  resetTestDb,
} from './setup';

const validInput: CreateTicketInput = {
  title: 'My laptop is on fire',
  description: 'The keyboard is literally melting.',
  category: 'IT',
  priority: 'High',
  attachmentId: null,
};

async function makeSubmitter(): Promise<{ id: number; email: string }> {
  const user = await User.create({
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash: 'bcrypt-not-relevant-to-this-test',
    displayName: 'Test Submitter',
    role: 'User',
    isActive: true,
  });
  return { id: user.id, email: user.email };
}

describe('ticketService.createTicket (integration)', () => {
  beforeEach(async () => {
    // Counter starts at 20 in every spec — matches the dev
    // seeder at `backend/src/seeders/20260915000000-demo-data.js:162`
    // so the first ticket is `HD-21`.
    await resetTestDb({ counterStart: 20 });
  });

  // ── 1. Happy path ───────────────────────────────────────
  it('returns HD-21 with the submitter eager-loaded and writes a ticket row', async () => {
    const submitter = await makeSubmitter();

    const ticket = await createTicket(submitter.id, validInput);

    // Returned instance has the expected shape.
    expect(ticket.number).toBe('HD-21');
    expect(ticket.submitterId).toBe(submitter.id);
    expect(ticket.status).toBe('Open');
    expect(ticket.title).toBe(validInput.title);
    expect(ticket.priority).toBe('High');
    expect(ticket.category).toBe('IT');
    // Eager-loaded include is hydrated. The Ticket model
    // class only declares scalar attrs; the `submitter`
    // include is set on the runtime instance at query time
    // by Sequelize. Cast to access it.
    const ticketWithSubmitter = ticket as unknown as {
      submitter?: { id: number };
    };
    expect(ticketWithSubmitter.submitter).toBeDefined();
    expect(ticketWithSubmitter.submitter?.id).toBe(submitter.id);

    // DB row exists with the right persisted state.
    const row = await Ticket.findByPk(ticket.id);
    expect(row).not.toBeNull();
    expect(row?.number).toBe('HD-21');
    expect(row?.status).toBe('Open');
    expect(row?.submitterId).toBe(submitter.id);

    // Counter incremented to 21.
    const counter = await Counter.findByPk('ticket_number');
    expect(Number(counter?.value)).toBe(21);
  });

  // ── 2. Sequential counter increments ─────────────────────
  it('increments the counter correctly across three sequential calls', async () => {
    const submitter = await makeSubmitter();

    const t1 = await createTicket(submitter.id, validInput);
    const t2 = await createTicket(submitter.id, validInput);
    const t3 = await createTicket(submitter.id, validInput);

    expect(t1.number).toBe('HD-21');
    expect(t2.number).toBe('HD-22');
    expect(t3.number).toBe('HD-23');

    const counter = await Counter.findByPk('ticket_number');
    expect(Number(counter?.value)).toBe(23);

    const allRows = await Ticket.findAll({ order: [['id', 'ASC']] });
    expect(allRows.length).toBe(3);
    expect(allRows.map((r) => r.number)).toEqual([
      'HD-21',
      'HD-22',
      'HD-23',
    ]);
  });

  // ── 3. DUPLICATE_NUMBER race (the locked HD-008 row) ──────
  describe('DUPLICATE_NUMBER — parallel createTicket calls', () => {
    it('two parallel calls both succeed and get distinct numbers', async () => {
      const submitter = await makeSubmitter();

      const [a, b] = await Promise.all([
        createTicket(submitter.id, validInput),
        createTicket(submitter.id, validInput),
      ]);

      // Both must have resolved.
      expect(a).toBeDefined();
      expect(b).toBeDefined();

      // The two numbers are distinct.
      expect(a.number).not.toBe(b.number);

      // And the set of numbers is exactly {HD-21, HD-22}.
      const numbers = [a.number, b.number].sort();
      expect(numbers).toEqual(['HD-21', 'HD-22']);

      // Two rows in tickets, both pointing at the submitter.
      const rows = await Ticket.findAll({ order: [['id', 'ASC']] });
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(row.submitterId).toBe(submitter.id);
      }

      // Counter is at 22.
      const counter = await Counter.findByPk('ticket_number');
      expect(Number(counter?.value)).toBe(22);
    });

    it('10 parallel calls all succeed with 10 distinct numbers (lock stress)', async () => {
      // Start the counter at 9999 so we can spot any number
      // collision or skipped number at a glance.
      await resetTestDb({ counterStart: 9999 });
      const submitter = await makeSubmitter();

      const tickets = await Promise.all(
        Array.from({ length: 10 }, () =>
          createTicket(submitter.id, validInput),
        ),
      );

      expect(tickets.length).toBe(10);
      // All numbers are distinct (Set size === array length).
      const numbers = tickets.map((t) => t.number);
      const unique = new Set(numbers);
      expect(unique.size).toBe(10);

      // The set is exactly the 10 consecutive ticket numbers
      // starting at 10000.
      const sorted = [...unique].sort();
      expect(sorted[0]).toBe('HD-10000');
      expect(sorted[9]).toBe('HD-10009');
      expect(sorted).toEqual([
        'HD-10000',
        'HD-10001',
        'HD-10002',
        'HD-10003',
        'HD-10004',
        'HD-10005',
        'HD-10006',
        'HD-10007',
        'HD-10008',
        'HD-10009',
      ]);

      // Counter is at the final value.
      const counter = await Counter.findByPk('ticket_number');
      expect(Number(counter?.value)).toBe(10009);

      // 10 rows in tickets — UNIQUE index held.
      const rowCount = await Ticket.count();
      expect(rowCount).toBe(10);
    });
  });
});

// Suppress an unused-import warning if a future test
// ever drops the sequelize handle — keep the import as
// documentation that this suite talks to the live
// instance.
void sequelize;
