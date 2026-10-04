/**
 * ticketService — HD-007 + HD-008 + HD-009.
 *
 * Read-side helpers for the Ticket resource. Wraps the consistent
 * `findAll` shape used by every list endpoint so controllers don't
 * have to re-derive the include / order / limit triplet per story.
 *
 * HD-007 uses `listForUser(userId)`. HD-008 (Create Ticket) adds
 * `createTicket(submitterId, input)` — the only write-side helper
 * this file owns right now. HD-009 (Submission Confirmation) adds
 * `getById(id)` for the per-ticket fetch. HD-010 (Ticket Detail)
 * and HD-012 (Agent Kanban) extend this file with their own queries
 * rather than calling `Ticket.findAll` from controllers directly.
 *
 * No pagination params are exposed yet — out of MVP per spec. The
 * `opts` bag exists as an extension point for HD-015 if/when
 * cursor pagination lands.
 */

import { Ticket, User, Attachment, sequelize } from '../models';
import type { CreateTicketInput } from '../utils/validation/ticketValidation';
import { nextTicketNumber } from '../utils/ticketNumber';

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

/**
 * Create a new ticket on behalf of `submitterId` (HD-008).
 *
 * Wraps a single transaction:
 *   1. `nextTicketNumber(tx)` — atomically increments the counter
 *      inside the same tx so concurrent inserts can't collide.
 *   2. `Ticket.create({...}, {transaction})` — inserts with the
 *      freshly-reserved HD-<n> number, status='Open', and the
 *      submitter pulled from `submitterId` (NOT request body).
 *   3. Re-fetch the row with eager-loaded submitter/owner/attachment
 *      so the controller can serialize without a second roundtrip.
 *
 * On any error the transaction is rolled back and the error
 * re-thrown — the central errorHandler maps Sequelize errors to 400
 * and other errors to 500.
 *
 * Returns the freshly-created Sequelize instance with associations
 * eager-loaded (the controller does NOT need to call `reload()`).
 */
export async function createTicket(
  submitterId: number,
  input: CreateTicketInput,
): Promise<Ticket> {
  return sequelize.transaction(async (tx) => {
    // nextTicketNumber must share the same tx as the insert so the
    // FOR UPDATE on the counter row spans both the increment and
    // the downstream insert. Two parallel POSTs serialize on the
    // counter row and each get a unique HD-<n>.
    const number = await nextTicketNumber(tx);

    const created = await Ticket.create(
      {
        number,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: 'Open',
        submitterId,
        ownerId: null,
        attachmentId: input.attachmentId,
      },
      { transaction: tx },
    );

    // Reload with eager includes so serializeTicket can hand the
    // shape straight back to the frontend without a second query.
    const reloaded = await Ticket.findByPk(created.id, {
      transaction: tx,
      include: [
        { model: User, as: 'submitter' },
        { model: User, as: 'owner' },
        { model: Attachment, as: 'attachment' },
      ],
    });

    // Defensive: a hard delete between the insert and the reload
    // would yield null. Surface as an error rather than handing the
    // caller a falsy ticket.
    if (!reloaded) {
      throw new Error(
        `Ticket ${String(created.id)} disappeared immediately after insert.`,
      );
    }

    return reloaded;
  });
}

/**
 * Fetch a single ticket by primary key (HD-009).
 *
 * Eager-loads submitter / owner / attachment so the controller can
 * pass the instance straight to `serializeTicket` without a second
 * round-trip. Same include shape as `createTicket`'s reload.
 *
 * Returns `null` when the row does not exist (or has been soft-
 * deleted — `paranoid: true` on the model excludes those). The
 * controller maps null → HttpError(404, 'not_found'); the role gate
 * (User non-owner → 404) lives in the controller, not here.
 */
export async function getById(id: number): Promise<Ticket | null> {
  return Ticket.findByPk(id, {
    include: [
      { model: User, as: 'submitter' },
      { model: User, as: 'owner' },
      { model: Attachment, as: 'attachment' },
    ],
  });
}