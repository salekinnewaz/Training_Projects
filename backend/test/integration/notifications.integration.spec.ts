/**
 * D-HD019 — `Notification` model integration tests.
 *
 * Pins the four behaviors the HD-019 spec's I/O & Edge-Case
 * Matrix promises for the notifications table:
 *
 *   1. **Insert + read-back** — a fresh row reads back with the
 *      same `type`, `title`, `userId`, `readAt === null`.
 *
 *   2. **Read scoping** — `findAll({ where: { userId } })` does
 *      NOT leak another user's rows (the IDOR contract the
 *      controller relies on).
 *
 *   3. **Unread count** — `count({ where: { userId, readAt: null } })`
 *      matches the manual filter.
 *
 *   4. **Mark read** — `update({ where: { id, userId } })`
 *      flips `readAt` only for the matching owner, leaves
 *      sibling rows alone, and reports 0 affected when the
 *      owner doesn't match.
 *
 * Real Postgres for the same reason D9 uses real Postgres — the
 * `UPDATE … WHERE id=? AND user_id=?` predicate is the IDOR
 * guard the controller enforces. SQLite + sequelize-mock don't
 * exercise the row-locking / predicate semantics.
 */

import {
  sequelize,
  User,
  Notification,
  resetTestDb,
  truncateAllTables,
} from './setup';

async function makeUser(email: string): Promise<{ id: number }> {
  const user = await User.create({
    email,
    passwordHash: 'bcrypt-not-relevant-to-this-test',
    displayName: email.split('@')[0],
    role: 'Support Agent',
    isActive: true,
  });
  return { id: user.id };
}

describe('Notification model (integration)', () => {
  beforeEach(async () => {
    // Wipe rows so each `it` starts from a known state. We use
    // truncate (not resetTestDb) because the counter seed is
    // irrelevant here — notifications don't use the counter.
    await resetTestDb({ counterStart: 20 });
    await truncateAllTables();
  });

  it('inserts and reads back a row with readAt null', async () => {
    const eli = await makeUser('eli@example.com');

    const created = await Notification.create({
      userId: eli.id,
      type: 'ticket_assigned',
      title: 'You were assigned HD-1',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });

    const fetched = await Notification.findByPk(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.userId).toBe(eli.id);
    expect(fetched!.type).toBe('ticket_assigned');
    expect(fetched!.title).toBe('You were assigned HD-1');
    expect(fetched!.readAt).toBeNull();
  });

  it('does not leak another user\'s rows when scoped by userId', async () => {
    const eli = await makeUser('eli@example.com');
    const sam = await makeUser('sam@example.com');

    await Notification.create({
      userId: eli.id,
      type: 'ticket_assigned',
      title: 'For Eli',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });
    await Notification.create({
      userId: sam.id,
      type: 'comment_added',
      title: 'For Sam',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });

    const eliRows = await Notification.findAll({
      where: { userId: eli.id },
    });
    expect(eliRows.length).toBe(1);
    expect(eliRows[0].title).toBe('For Eli');

    const samRows = await Notification.findAll({
      where: { userId: sam.id },
    });
    expect(samRows.length).toBe(1);
    expect(samRows[0].title).toBe('For Sam');
  });

  it('counts unread rows for the caller', async () => {
    const eli = await makeUser('eli@example.com');

    await Notification.create({
      userId: eli.id,
      type: 'ticket_assigned',
      title: 't1',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });
    await Notification.create({
      userId: eli.id,
      type: 'comment_added',
      title: 't2',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });
    await Notification.create({
      userId: eli.id,
      type: 'ticket_status_changed',
      title: 't3',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: new Date(),
    });

    const unread = await Notification.count({
      where: { userId: eli.id, readAt: null },
    });
    expect(unread).toBe(2);
  });

  it('mark-read scoped by id + userId: flips owner, skips others, returns 0 for non-owner', async () => {
    const eli = await makeUser('eli@example.com');
    const sam = await makeUser('sam@example.com');

    const eliNote = await Notification.create({
      userId: eli.id,
      type: 'ticket_assigned',
      title: 'Eli',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });
    const samNote = await Notification.create({
      userId: sam.id,
      type: 'comment_added',
      title: 'Sam',
      body: null,
      ticketId: null,
      actorId: null,
      readAt: null,
    });

    // Eli flipping his own row succeeds.
    const [rowsEli] = await Notification.update(
      { readAt: new Date() },
      { where: { id: eliNote.id, userId: eli.id } },
    );
    expect(rowsEli).toBe(1);

    // Sam trying to flip Eli's row returns 0.
    const [rowsSam] = await Notification.update(
      { readAt: new Date() },
      { where: { id: eliNote.id, userId: sam.id } },
    );
    expect(rowsSam).toBe(0);

    // Sam's own row is unaffected.
    const samRe = await Notification.findByPk(samNote.id);
    expect(samRe!.readAt).toBeNull();
  });
});

afterAll(async () => {
  // setup.ts owns the global afterAll for sequelize.close(); leaving
  // this hook for symmetry and to make the spec discoverable as
  // its own suite in the reporter.
  await sequelize.close();
});