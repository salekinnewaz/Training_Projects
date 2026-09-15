/**
 * ticketService — HD-007.
 *
 * Read-side helpers for the Ticket resource. Wraps the consistent
 * `findAll` shape used by every list endpoint so controllers don't
 * have to re-derive the include / order / limit triplet per story.
 *
 * HD-007 uses only `listForUser(userId)`. HD-010 (Ticket Detail) and
 * HD-012 (Agent Kanban) extend this file with their own queries
 * rather than calling `Ticket.findAll` from controllers directly.
 *
 * No pagination params are exposed yet — out of MVP per spec. The
 * `opts` bag exists as an extension point for HD-015 if/when
 * cursor pagination lands.
 */

import { Ticket, User, Attachment } from '../models';

export interface ListForUserOptions {
  /** Override the default 100-row cap. */
  limit?: number;
  /** Override the default newest-first sort. */
  order?: 'newest' | 'oldest';
}

export async function listForUser(
  userId: number,
  opts: ListForUserOptions = {},
): Promise<Ticket[]> {
  const limit = opts.limit ?? 100;
  const order: [string, 'DESC' | 'ASC'][] =
    opts.order === 'oldest'
      ? [['updatedAt', 'ASC']]
      : [['updatedAt', 'DESC']];

  // `paranoid: true` on the Ticket model (HD-002) already excludes
  // soft-deleted rows — no explicit `deletedAt` filter needed.
  // Eager-load the nested associations the frontend's Ticket view
  // model declares (submitter / owner / attachment).
  return Ticket.findAll({
    where: { submitterId: userId },
    order,
    limit,
    include: [
      { model: User, as: 'submitter' },
      { model: User, as: 'owner' },
      { model: Attachment, as: 'attachment' },
    ],
  });
}