/**
 * notificationService — the recipient-resolution rules behind the
 * chrome bell.
 *
 * Every ticket event that a human cares about lands here, and this
 * file owns ONE job: deciding *who* should see it. The rules come
 * from the Role-Aware Action Matrix and the notification matrix the
 * three roles agreed on:
 *
 *   ┌──────────────────┬───────────────────────────────────────────┐
 *   │ Event            │ Recipients                                │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ ticket_created   │ every active Support Agent + every        │
 *   │                  │ active Admin                              │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ comment_added    │ author is a User  → ticket owner (if any)  │
 *   │                  │                  + all active Agents/Admins│
 *   │                  │ author is staff → ticket submitter         │
 *   │                  │                  + ticket owner (if any)   │
 *   │                  │                  + all active Admins      │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ status/priority  │ ticket submitter + ticket owner (if any)  │
 *   │ changed          │ + all active Admins                       │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ assigned         │ new owner + previous owner (if any)        │
 *   │                  │ + ticket submitter + all active Admins     │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ reopened         │ ticket owner (if any) + all active Admins │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ confirmed_closed │ ticket owner (if any) + all active Admins │
 *   └──────────────────┴───────────────────────────────────────────┘
 *
 * Two invariants hold across every rule:
 *
 *   1. **The actor never notifies themselves.** You don't get a
 *      notification for something you did.
 *   2. **The ticket submitter is notified of every activity on
 *      their own ticket.** They are the owner of the conversation
 *      even when an agent holds the assignment.
 *
 * Admins are included everywhere because the Admin dashboard
 * aggregates every ticket in the system — an Admin who is not told
 * about new tickets, comments or status changes cannot act on them.
 */

import type { Transaction } from 'sequelize';

import { Notification, User } from '../models';
import type { NotificationType } from '../models/Notification';

/** The payload every notification row is built from. */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string | null;
  ticketId: number | null;
  actorId: number | null;
}

/** Roles that hold tickets and therefore need to hear about them. */
export type StaffRole = 'Support Agent' | 'Admin';

/**
 * Insert one notification row per recipient.
 *
 * Recipients are de-duplicated and the actor is filtered out — a
 * user never receives a notification for their own action. An empty
 * recipient set short-circuits (no query issued).
 *
 * The insert joins the caller's transaction so a notification can
 * never outlive the ticket change that caused it.
 */
export async function notifyUsers(
  recipientIds: readonly number[],
  notification: NotificationPayload,
  tx: Transaction,
): Promise<void> {
  const recipients = [...new Set(recipientIds)].filter(
    (userId) => userId !== notification.actorId,
  );
  if (recipients.length === 0) return;

  await Notification.bulkCreate(
    recipients.map((userId) => ({
      userId,
      ...notification,
      readAt: null,
    })),
    { transaction: tx },
  );
}

/**
 * Every active Support Agent and Admin in the system.
 *
 * Admins are included: the Admin dashboard spans the whole ticket
 * estate, so an Admin who is not notified of a new ticket, comment
 * or status change cannot act on it. `isActive` is honoured — a
 * deactivated account must not accumulate notifications it will
 * never read.
 */
export async function activeStaffIds(tx: Transaction): Promise<number[]> {
  const staff = await User.findAll({
    attributes: ['id'],
    where: {
      role: ['Support Agent', 'Admin'],
      isActive: true,
    },
    transaction: tx,
  });
  return staff.map((member) => member.id);
}

/** Every active Admin in the system. */
export async function activeAdminIds(tx: Transaction): Promise<number[]> {
  const admins = await User.findAll({
    attributes: ['id'],
    where: { role: 'Admin', isActive: true },
    transaction: tx,
  });
  return admins.map((admin) => admin.id);
}

/**
 * Resolve the ticket's owner (the assigned agent) to a recipient id,
 * or `null` when the ticket is unassigned or the owner is not an
 * active staff member.
 *
 * A deactivated owner must not be notified — the ticket is
 * effectively unowned and the standing staff list covers it.
 */
export async function activeOwnerId(
  ownerId: number | null,
  tx: Transaction,
): Promise<number | null> {
  if (ownerId === null) return null;

  const owner = await User.findByPk(ownerId, {
    attributes: ['id', 'role', 'isActive'],
    transaction: tx,
  });
  if (!owner || !owner.isActive) return null;
  if (owner.role !== 'Support Agent' && owner.role !== 'Admin') return null;

  return owner.id;
}
