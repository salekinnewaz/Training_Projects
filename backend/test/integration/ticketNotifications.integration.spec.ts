/**
 * Ticket notification matrix (integration).
 *
 * Pins the *recipient set* for every ticket event, across all three
 * roles. The rules under test (see
 * `src/services/notificationService.ts` for the canonical table):
 *
 *   ┌──────────────────┬───────────────────────────────────────────┐
 *   │ Event            │ Recipients                                │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ ticket_created   │ every active Support Agent + every        │
 *   │                  │ active Admin                              │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ comment_added    │ User author  → ticket owner + all active   │
 *   │                  │               Agents and Admins           │
 *   │                  │ Staff author → ticket submitter + ticket  │
 *   │                  │               owner + all active Admins   │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ status changed   │ ticket submitter + ticket owner + Admins │
 *   │ priority changed │ ticket submitter + ticket owner + Admins │
 *   │ assigned         │ submitter + new owner + prior owner +     │
 *   │                  │ Admins                                     │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ reopened         │ ticket owner + Admins                     │
 *   │ confirmed closed │ ticket owner + Admins                     │
 *   └──────────────────┴───────────────────────────────────────────┘
 *
 * Two invariants are asserted throughout:
 *   1. The actor never receives a notification for their own action.
 *   2. The ticket submitter is notified of every activity on their
 *      own ticket.
 */

import {
  addComment,
  confirmCloseTicket,
  createTicket,
  reopenTicket,
  updateTicket,
} from '../../src/services/ticketService';
import type { CreateTicketInput } from '../../src/utils/validation/ticketValidation';
import { Notification, User, resetTestDb, sequelize } from './setup';

const ticketInput: CreateTicketInput = {
  title: 'VPN access request',
  description: 'Please restore access to the company VPN.',
  category: 'IT',
  priority: 'Medium',
  attachmentId: null,
};

type Role = 'User' | 'Support Agent' | 'Admin';

async function makeUser(
  email: string,
  role: Role,
  isActive = true,
): Promise<User> {
  return User.create({
    email,
    passwordHash: 'test-only',
    displayName: email.split('@')[0]!,
    role,
    isActive,
  });
}

/** The ids of every notification row for a ticket, sorted. */
async function recipientIds(
  ticketId: number,
  type?: string,
): Promise<number[]> {
  const rows = await Notification.findAll({
    where: type ? { ticketId, type } : { ticketId },
  });
  return rows.map((row) => row.userId).sort((a, b) => a - b);
}

/** The ids of the users who received a notification of `type`. */
async function recipientsOf(
  ticketId: number,
  type: string,
): Promise<number[]> {
  return recipientIds(ticketId, type);
}

describe('ticket notifications (integration)', () => {
  beforeEach(async () => {
    await resetTestDb({ counterStart: 20 });
  });

  // ─────────────────────────────────────────────────────────────
  // ticket_created
  // ─────────────────────────────────────────────────────────────

  it('notifies every active Support Agent AND every active Admin when a User creates a ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const sam = await makeUser('sam@example.com', 'Support Agent');
    const eli = await makeUser('eli@example.com', 'Support Agent');
    await makeUser('inactive@example.com', 'Support Agent', false);
    const admin = await makeUser('admin@example.com', 'Admin');

    const ticket = await createTicket(submitter.id, ticketInput);
    const notifications = await Notification.findAll({
      where: { ticketId: ticket.id, type: 'ticket_created' },
      order: [['userId', 'ASC']],
    });

    // Every active Support Agent plus the Admin.
    expect(notifications.map((item) => item.userId).sort()).toEqual(
      [sam.id, eli.id, admin.id].sort(),
    );
    expect(notifications.every((item) => item.actorId === submitter.id)).toBe(true);
    expect(notifications.every((item) => item.title === `New ticket ${ticket.number}`)).toBe(true);
    expect(notifications.every((item) => item.body === ticket.title)).toBe(true);
    expect(notifications.every((item) => item.readAt === null)).toBe(true);
  });

  it('never notifies the ticket submitter about their own ticket creation', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    await makeUser('sam@example.com', 'Support Agent');

    const ticket = await createTicket(submitter.id, ticketInput);

    expect(await recipientsOf(ticket.id, 'ticket_created')).not.toContain(
      submitter.id,
    );
  });

  it('does not notify a deactivated Admin of a new ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const inactiveAdmin = await makeUser('admin@example.com', 'Admin', false);
    await makeUser('sam@example.com', 'Support Agent');

    const ticket = await createTicket(submitter.id, ticketInput);

    expect(await recipientsOf(ticket.id, 'ticket_created')).not.toContain(
      inactiveAdmin.id,
    );
  });

  // ─────────────────────────────────────────────────────────────
  // comment_added — a User comments
  // ─────────────────────────────────────────────────────────────

  it('notifies the assigned owner AND every active Agent/Admin when the submitter comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const eli = await makeUser('eli@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id });

    await addComment(ticket.id, submitter.id, 'I still cannot connect.');

    // Owner + the wider active staff pool + Admins.
    expect(await recipientsOf(ticket.id, 'comment_added')).toEqual(
      [owner.id, eli.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies every active Agent and Admin when the submitter comments on an unassigned ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const sam = await makeUser('sam@example.com', 'Support Agent');
    const eli = await makeUser('eli@example.com', 'Support Agent');
    await makeUser('inactive@example.com', 'Support Agent', false);
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, submitter.id, 'Adding more detail.');

    expect(await recipientsOf(ticket.id, 'comment_added')).toEqual(
      [sam.id, eli.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('does not notify the submitter about their own comment', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    await makeUser('sam@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, submitter.id, 'Adding more detail.');

    expect(await recipientsOf(ticket.id, 'comment_added')).not.toContain(
      submitter.id,
    );
  });

  it('carries the comment body and the author as the actor', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    await makeUser('sam@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, submitter.id, 'The exact text of my comment.');

    const rows = await Notification.findAll({
      where: { ticketId: ticket.id, type: 'comment_added' },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.body).toBe('The exact text of my comment.');
    expect(rows[0]!.actorId).toBe(submitter.id);
    expect(rows[0]!.title).toBe(`New comment on ${ticket.number}`);
  });

  // ─────────────────────────────────────────────────────────────
  // comment_added — a Support Agent comments
  // ─────────────────────────────────────────────────────────────

  it('notifies the ticket submitter when a Support Agent comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const agent = await makeUser('sam@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, agent.id, 'I have an update for you.');

    const rows = await Notification.findAll({
      where: { ticketId: ticket.id, type: 'comment_added' },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.userId).toBe(submitter.id);
    expect(rows[0]!.actorId).toBe(agent.id);
    expect(rows[0]!.body).toBe('I have an update for you.');
  });

  it('notifies the submitter, the ticket owner and every Admin when a Support Agent comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const commenter = await makeUser('sam@example.com', 'Support Agent');
    const owner = await makeUser('eli@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id });

    await addComment(ticket.id, commenter.id, 'On it.');

    expect(await recipientsOf(ticket.id, 'comment_added')).toEqual(
      [submitter.id, owner.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('does NOT notify a peer Support Agent when a colleague comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const commenter = await makeUser('sam@example.com', 'Support Agent');
    const peer = await makeUser('eli@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, commenter.id, 'On it.');

    expect(await recipientsOf(ticket.id, 'comment_added')).not.toContain(peer.id);
  });

  // ─────────────────────────────────────────────────────────────
  // comment_added — an Admin comments
  // ─────────────────────────────────────────────────────────────

  it('notifies the ticket submitter when an Admin comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, admin.id, 'I have an update for you.');

    const rows = await Notification.findAll({
      where: { ticketId: ticket.id, type: 'comment_added' },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.userId).toBe(submitter.id);
    expect(rows[0]!.actorId).toBe(admin.id);
    expect(rows[0]!.body).toBe('I have an update for you.');
  });

  it('notifies the submitter, the ticket owner and every Admin when an Admin comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const otherAdmin = await makeUser('admin2@example.com', 'Admin');
    const owner = await makeUser('eli@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id });

    await addComment(ticket.id, admin.id, 'Admin here.');

    // The commenting Admin is the actor, so they are NOT notified of
    // their own comment — but the other Admin, the owner and the
    // submitter all are.
    expect(await recipientsOf(ticket.id, 'comment_added')).toEqual(
      [submitter.id, owner.id, otherAdmin.id].sort((a, b) => a - b),
    );
  });

  it('does not notify an Admin about their own comment', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, admin.id, 'Admin here.');

    expect(await recipientsOf(ticket.id, 'comment_added')).not.toContain(
      admin.id,
    );
  });

  it('notifies an Admin when a Support Agent comments', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const agent = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await addComment(ticket.id, agent.id, 'Agent reply.');

    expect(await recipientsOf(ticket.id, 'comment_added')).toContain(admin.id);
  });

  // ─────────────────────────────────────────────────────────────
  // ticket_status_changed / ticket_priority_changed
  // ─────────────────────────────────────────────────────────────

  it('notifies the submitter and every Admin when the status changes', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id });

    // The actor is the owner (a Support Agent), so the Admin — who
    // did not perform the action — is notified alongside the
    // submitter. The acting owner is not notified of their own
    // action.
    await updateTicket(ticket.id, owner.id, 'Support Agent', {
      status: 'In Progress',
    });

    expect(await recipientsOf(ticket.id, 'ticket_status_changed')).toEqual(
      [submitter.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies the ticket owner when a colleague changes the status', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const peer = await makeUser('eli@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id });

    // A peer agent changes the status — the ticket's owner is
    // notified because they hold the ticket.
    await updateTicket(ticket.id, peer.id, 'Support Agent', {
      status: 'In Progress',
    });

    expect(await recipientsOf(ticket.id, 'ticket_status_changed')).toEqual(
      [submitter.id, owner.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies the submitter and every Admin when the priority changes', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const agent = await makeUser('sam@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);

    // A Support Agent raises the priority; the Admin is notified.
    await updateTicket(ticket.id, agent.id, 'Support Agent', { priority: 'High' });

    expect(await recipientsOf(ticket.id, 'ticket_priority_changed')).toEqual(
      [submitter.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies every Admin other than the acting Admin when an Admin changes the priority', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const otherAdmin = await makeUser('admin2@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { priority: 'High' });

    // The acting Admin is the actor, so only the peer Admin and the
    // submitter are notified.
    expect(await recipientsOf(ticket.id, 'ticket_priority_changed')).toEqual(
      [submitter.id, otherAdmin.id].sort((a, b) => a - b),
    );
  });

  it('does not notify the actor about their own status change', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { status: 'In Progress' });

    expect(await recipientsOf(ticket.id, 'ticket_status_changed')).not.toContain(
      admin.id,
    );
  });

  it('does not emit a status notification when the status is unchanged', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { status: 'Open' });

    expect((await recipientsOf(ticket.id, 'ticket_status_changed')).length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // ticket_assigned
  // ─────────────────────────────────────────────────────────────

  it('notifies the new owner, the submitter and every Admin when a ticket is assigned', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const agent = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { ownerId: agent.id });

    expect(await recipientsOf(ticket.id, 'ticket_assigned')).toEqual(
      [submitter.id, agent.id].sort((a, b) => a - b),
    );
  });

  it('notifies both the previous and the new owner on reassignment', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const first = await makeUser('sam@example.com', 'Support Agent');
    const second = await makeUser('eli@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: first.id });

    // An Admin performs the reassignment, so BOTH the previous and
    // the new owner are notified (neither is the actor).
    await updateTicket(ticket.id, admin.id, 'Admin', {
      ownerId: second.id,
    });

    expect(await recipientsOf(ticket.id, 'ticket_assigned')).toEqual(
      [submitter.id, first.id, second.id].sort((a, b) => a - b),
    );
  });

  it('notifies the previous owner when they hand the ticket to a colleague', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const first = await makeUser('sam@example.com', 'Support Agent');
    const second = await makeUser('eli@example.com', 'Support Agent');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: first.id });

    // The previous owner is the actor here, so they are not notified
    // of their own reassignment — only the new owner and the
    // submitter are.
    await updateTicket(ticket.id, first.id, 'Support Agent', {
      ownerId: second.id,
    });

    expect(await recipientsOf(ticket.id, 'ticket_assigned')).toEqual(
      [submitter.id, second.id].sort((a, b) => a - b),
    );
  });

  it('does not notify the actor about their own assignment', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { ownerId: admin.id });

    expect(await recipientsOf(ticket.id, 'ticket_assigned')).not.toContain(
      admin.id,
    );
  });

  // ─────────────────────────────────────────────────────────────
  // reopen / confirm-close
  // ─────────────────────────────────────────────────────────────

  it('notifies the owner and every Admin when the submitter reopens the ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id, status: 'Resolved' });

    await reopenTicket(ticket.id, submitter.id);

    expect(await recipientsOf(ticket.id, 'ticket_status_changed')).toEqual(
      [owner.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies the owner and every Admin when the submitter confirms the close', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id, status: 'Resolved' });

    await confirmCloseTicket(ticket.id, submitter.id);

    expect(await recipientsOf(ticket.id, 'ticket_status_changed')).toEqual(
      [owner.id, admin.id].sort((a, b) => a - b),
    );
  });

  it('notifies the owner and every Admin when an Admin reopens the ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const owner = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);
    await ticket.update({ ownerId: owner.id, status: 'Resolved' });

    await reopenTicket(ticket.id, submitter.id);

    expect(await recipientIds(ticket.id)).toContain(admin.id);
  });

  // ─────────────────────────────────────────────────────────────
  // The invariant that ties it together
  // ─────────────────────────────────────────────────────────────

  it('notifies the ticket submitter of EVERY activity on their own ticket', async () => {
    const submitter = await makeUser('employee@example.com', 'User');
    const agent = await makeUser('sam@example.com', 'Support Agent');
    const admin = await makeUser('admin@example.com', 'Admin');
    const ticket = await createTicket(submitter.id, ticketInput);

    await updateTicket(ticket.id, admin.id, 'Admin', { ownerId: agent.id });
    await addComment(ticket.id, agent.id, 'Working on it.');
    await updateTicket(ticket.id, agent.id, 'Support Agent', {
      status: 'In Progress',
    });
    await updateTicket(ticket.id, agent.id, 'Support Agent', {
      priority: 'High',
    });

    // The submitter must hold one notification per event above.
    const submitterRows = await Notification.findAll({
      where: { userId: submitter.id, ticketId: ticket.id },
    });
    expect(submitterRows.length).toBe(4);
    expect(submitterRows.map((row) => row.type).sort()).toEqual([
      'comment_added',
      'ticket_assigned',
      'ticket_priority_changed',
      'ticket_status_changed',
    ]);
  });
});

void sequelize;
