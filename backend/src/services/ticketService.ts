/**
 * ticketService — HD-007 + HD-008 + HD-009 + HD-010.
 *
 * Read-side helpers for the Ticket resource. Wraps the consistent
 * `findAll` shape used by every list endpoint so controllers don't
 * have to re-derive the include / order / limit triplet per story.
 *
 * HD-007 uses `listForUser(userId)`. HD-008 (Create Ticket) adds
 * `createTicket(submitterId, input)` — the only write-side helper
 * this file owns right now. HD-009 (Submission Confirmation) adds
 * `getById(id)` for the per-ticket fetch. HD-010 (Ticket Detail)
 * extends this file with `updateTicket`, `addComment`,
 * `reopenTicket`, `confirmCloseTicket`, `listComments`,
 * `listActivity`, and `listActiveAgents` — covering the PATCH /
 * comments / reopen / confirm-close / agents endpoints that
 * the Ticket Detail page drives. HD-012 (Agent Kanban) extends
 * this file with its own queries rather than calling `Ticket.findAll`
 * from controllers directly.
 *
 * No pagination params are exposed yet — out of MVP per spec. The
 * `opts` bag exists as an extension point for HD-015 if/when
 * cursor pagination lands.
 */

import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';

import {
  Ticket,
  User,
  Attachment,
  Comment,
  ActivityLog,
  sequelize,
} from '../models';
import type { CreateTicketInput } from '../utils/validation/ticketValidation';
import { nextTicketNumber } from '../utils/ticketNumber';
import { HttpError } from '../utils/errors';

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
 * Fetch a single ticket by primary key (HD-009, used by HD-010).
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

/**
 * Internal helper — re-fetches a ticket with the eager-load set the
 * controllers' serializeTicket call needs. Wraps in a transaction so
 * callers can use it as the "reload" step of their own tx (HD-010
 * write helpers do exactly that).
 */
async function reloadWithAssociations(
  id: number,
  tx?: Transaction,
): Promise<Ticket | null> {
  return Ticket.findByPk(id, {
    transaction: tx,
    include: [
      { model: User, as: 'submitter' },
      { model: User, as: 'owner' },
      { model: Attachment, as: 'attachment' },
    ],
  });
}

/**
 * The role passed in by the controller — only used to gate which
 * fields of the partial `input` are accepted. The controller does
 * the same gate in its own validation pass; this is defense in
 * depth so a direct service call (HD-012 queue, future scripts)
 * can't sneak a User-edited status past us.
 */
export type ActorRole = 'User' | 'Support Agent' | 'Admin';

export interface UpdateTicketInputPartial {
  status?: import('../models/Ticket').TicketStatus;
  priority?: import('../models/Ticket').TicketPriority;
  category?: import('../models/Ticket').TicketCategory | null;
  ownerId?: number | null;
}

/**
 * Apply a partial update to a ticket (HD-010 PATCH /:id).
 *
 * Wraps a single transaction:
 *   1. Load the ticket inside the tx so concurrent updates serialize
 *      via the row lock Sequelize places during `update()`.
 *   2. Enforce the agent-vs-user role gate (status/priority/ownerId
 *      are agent-only; category can be edited by any role).
 *   3. Enforce the status-transition matrix (Closed is terminal;
 *      see `assertValidTransition` for the full table).
 *   4. Apply the column changes and write the matching
 *      `ActivityLog` row(s) — one per changed field — so the
 *      timeline-entry renderer can describe them.
 *   5. Re-fetch with eager includes for the controller to serialize.
 */
export async function updateTicket(
  id: number,
  actorId: number,
  actorRole: ActorRole,
  input: UpdateTicketInputPartial,
): Promise<Ticket> {
  return sequelize.transaction(async (tx) => {
    const current = await Ticket.findByPk(id, { transaction: tx });
    if (!current) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }

    const isAgent = actorRole === 'Support Agent' || actorRole === 'Admin';

    // Role gate — even when the field is omitted from the body, a
    // User must not be able to send a status-changing PATCH. We
    // re-check the per-field role gates the controller asserted,
    // but in the service layer so future direct-callers (HD-012)
    // get the same protection.
    if (!isAgent) {
      if (input.status !== undefined) {
        throw new HttpError(
          403,
          'forbidden',
          'Only agents can change ticket status.',
        );
      }
      if (input.priority !== undefined) {
        throw new HttpError(
          403,
          'forbidden',
          'Only agents can change ticket priority.',
        );
      }
      if (input.ownerId !== undefined) {
        throw new HttpError(
          403,
          'forbidden',
          'Only agents can assign tickets.',
        );
      }
    }

    // `status` transition enforcement. Only invoked when status is
    // actually changing; an omitted status means "no change".
    if (input.status !== undefined && input.status !== current.status) {
      assertValidTransition(current.status, input.status, actorRole);
    }

    // Capture the previous values so we can write Reassigned /
    // StatusChanged / PriorityChanged activity rows with the
    // correct {from, to} pairs.
    const previous = {
      status: current.status,
      priority: current.priority,
      ownerId: current.ownerId,
    };

    // Apply the columns. We use `update` on the instance rather than
    // `Ticket.update({where})` so Sequelize touches `updatedAt`.
    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.category !== undefined) patch.category = input.category;
    if (input.ownerId !== undefined) patch.ownerId = input.ownerId;

    if (Object.keys(patch).length > 0) {
      await current.update(patch, { transaction: tx });
    }

    // Activity-log emission — one row per logical change so the
    // timeline-entry renderer can describe each one. Ordering
    // mirrors the column-update order above.
    if (input.status !== undefined && input.status !== previous.status) {
      await ActivityLog.create(
        {
          ticketId: id,
          actorId,
          eventType: 'StatusChanged',
          payload: { from: previous.status, to: input.status },
        },
        { transaction: tx },
      );
    }
    if (
      input.priority !== undefined &&
      input.priority !== previous.priority
    ) {
      await ActivityLog.create(
        {
          ticketId: id,
          actorId,
          eventType: 'PriorityChanged',
          payload: { from: previous.priority, to: input.priority },
        },
        { transaction: tx },
      );
    }
    if (input.ownerId !== undefined && input.ownerId !== previous.ownerId) {
      if (previous.ownerId === null) {
        await ActivityLog.create(
          {
            ticketId: id,
            actorId,
            eventType: 'Assigned',
            payload: { assigneeId: input.ownerId as number },
          },
          { transaction: tx },
        );
      } else {
        await ActivityLog.create(
          {
            ticketId: id,
            actorId,
            eventType: 'Reassigned',
            payload: {
              fromUserId: previous.ownerId,
              toUserId: input.ownerId as number,
            },
          },
          { transaction: tx },
        );
      }
    }

    const reloaded = await reloadWithAssociations(id, tx);
    if (!reloaded) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    return reloaded;
  });
}

/**
 * Enforce the ticket-status transition matrix (HD-010 PATCH /:id +
 * confirm-close / reopen). Mirrors the rules in
 * `EXPERIENCE.md` → "Ticket Status Workflow Controls":
 *
 *   Open         → In Progress / Resolved
 *   In Progress  → Open / Resolved
 *   Resolved     → Open  (reopen by submitter, or by agent)
 *               → Closed (confirm-close by submitter)
 *   Closed       → terminal (no transitions out)
 *
 * `Reopen()` and `confirmCloseTicket()` perform their own
 * context-specific checks; this helper covers the PATCH path.
 */
function assertValidTransition(
  from: import('../models/Ticket').TicketStatus,
  to: import('../models/Ticket').TicketStatus,
  _actorRole: ActorRole,
): void {
  if (from === to) return; // No-op; idempotent.
  if (from === 'Closed') {
    throw new HttpError(
      400,
      'validation_error',
      'Closed is a terminal status; cannot transition.',
      { status: 'Closed is a terminal status; cannot transition.' },
    );
  }
  const allowed: Record<
    import('../models/Ticket').TicketStatus,
    ReadonlyArray<import('../models/Ticket').TicketStatus>
  > = {
    Open: ['In Progress', 'Resolved'],
    'In Progress': ['Open', 'Resolved'],
    Resolved: ['Open', 'Closed'],
    Closed: [],
  };
  if (!allowed[from].includes(to)) {
    throw new HttpError(
      400,
      'validation_error',
      `Invalid status transition: ${from} → ${to}.`,
      { status: `Invalid status transition: ${from} → ${to}.` },
    );
  }
}

/**
 * Add a comment to a ticket (HD-010 POST /:id/comments).
 *
 * Wraps a single transaction:
 *   1. Load the ticket (existence + Closed check).
 *   2. Insert the Comment row.
 *   3. Write the matching ActivityLog `{CommentAdded, commentId}`.
 *
 * The Closed-readonly rule (`status === Closed` → 403) lives
 * here so any future caller (HD-013 admin actions, HD-014
 * scripts) honors the same gate.
 */
export async function addComment(
  ticketId: number,
  authorId: number,
  body: string,
): Promise<Comment> {
  return sequelize.transaction(async (tx) => {
    const ticket = await Ticket.findByPk(ticketId, { transaction: tx });
    if (!ticket) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    if (ticket.status === 'Closed') {
      throw new HttpError(
        403,
        'forbidden',
        'Ticket is closed and cannot accept new comments.',
      );
    }

    const created = await Comment.create(
      { ticketId, authorId, body },
      { transaction: tx },
    );

    await ActivityLog.create(
      {
        ticketId,
        actorId: authorId,
        eventType: 'CommentAdded',
        payload: { commentId: created.id },
      },
      { transaction: tx },
    );

    // Re-fetch the just-inserted comment WITH the author eager-loaded,
    // inside the same transaction. The controller used to do this
    // re-fetch separately via listComments, which (a) cost a second
    // DB round-trip and (b) silently fell back to a bare `comment`
    // instance with no `author` if the list didn't include the new
    // row (read-replica lag, race). Returning the fully-loaded row
    // here means the controller can serialize straight back.
    const full = await Comment.findByPk(created.id, {
      transaction: tx,
      include: [{ model: User, as: 'author' }],
    });
    if (!full) {
      throw new HttpError(
        500,
        'internal_server_error',
        'Comment created but not retrievable.',
      );
    }
    return full;
  });
}

/**
 * Reopen a Resolved ticket back to Open (HD-010 POST /:id/reopen).
 *
 * Authorization: actorId MUST equal ticket.submitterId (the spec
 * narrows "Reopen" to the submitter regardless of role — see
 * EXPERIENCE.md "Reopen Control"). The controller re-asserts this
 * inline, but the service enforces it as well for defense in depth.
 *
 * Returns the updated ticket with eager-loaded associations.
 */
export async function reopenTicket(
  id: number,
  actorId: number,
): Promise<Ticket> {
  return sequelize.transaction(async (tx) => {
    const current = await Ticket.findByPk(id, { transaction: tx });
    if (!current) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    if (current.submitterId !== actorId) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the ticket submitter can reopen it.',
      );
    }
    if (current.status !== 'Resolved') {
      throw new HttpError(
        400,
        'validation_error',
        'Only Resolved tickets can be reopened.',
        { status: 'Only Resolved tickets can be reopened.' },
      );
    }

    await current.update({ status: 'Open' }, { transaction: tx });
    await ActivityLog.create(
      {
        ticketId: id,
        actorId,
        eventType: 'Reopened',
        payload: { reopenedBy: actorId },
      },
      { transaction: tx },
    );

    const reloaded = await reloadWithAssociations(id, tx);
    if (!reloaded) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    return reloaded;
  });
}

/**
 * Confirm-close a Resolved ticket into the terminal Closed status
 * (HD-010 POST /:id/confirm-close).
 *
 * Same authorization rule as reopen: actorId MUST equal
 * ticket.submitterId. Closed is terminal — once here, the ticket
 * is read-only (no comments, no edits, no reopen).
 */
export async function confirmCloseTicket(
  id: number,
  actorId: number,
): Promise<Ticket> {
  return sequelize.transaction(async (tx) => {
    const current = await Ticket.findByPk(id, { transaction: tx });
    if (!current) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    if (current.submitterId !== actorId) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the ticket submitter can confirm-close it.',
      );
    }
    if (current.status !== 'Resolved') {
      throw new HttpError(
        400,
        'validation_error',
        'Only Resolved tickets can be confirmed closed.',
        { status: 'Only Resolved tickets can be confirmed closed.' },
      );
    }

    await current.update({ status: 'Closed' }, { transaction: tx });
    await ActivityLog.create(
      {
        ticketId: id,
        actorId,
        eventType: 'ConfirmedClosed',
        payload: { closedBy: actorId },
      },
      { transaction: tx },
    );

    const reloaded = await reloadWithAssociations(id, tx);
    if (!reloaded) {
      throw new HttpError(404, 'not_found', 'Ticket not found.');
    }
    return reloaded;
  });
}

/**
 * List the comments on a ticket, oldest-first (HD-010 GET /:id/comments).
 *
 * Eager-loads the `author` association so the comment-header
 * avatars + role badges render without N+1 round-trips.
 *
 * Limit: 100 — out-of-MVP pagination. HD-015 will introduce a
 * cursor if real ticket threads grow past that.
 */
export async function listComments(ticketId: number): Promise<Comment[]> {
  return Comment.findAll({
    where: { ticketId },
    order: [['createdAt', 'ASC']],
    limit: 100,
    include: [{ model: User, as: 'author' }],
  });
}

/**
 * List the activity timeline for a ticket, newest-first
 * (HD-010 GET /:id/activity).
 *
 * Eager-loads the `actor` association. The timeline-entry
 * renderer uses `actor.displayName` (or "System" when actor is
 * null) and the relative timestamp.
 */
export async function listActivity(
  ticketId: number,
): Promise<ActivityLog[]> {
  return ActivityLog.findAll({
    where: { ticketId },
    order: [['createdAt', 'DESC']],
    limit: 100,
    include: [{ model: User, as: 'actor' }],
  });
}

/**
 * Active agents available for the Assignee dropdown
 * (HD-010 GET /api/users/agents).
 *
 * Returns Support Agent + Admin users who are active. Both
 * groups can own / be assigned a ticket. Sorted by displayName ASC
 * so the dropdown is stable across renders.
 *
 * The default User scope strips `passwordHash`; we don't need it
 * here so no `.scope('withPassword')` call.
 */
export async function listActiveAgents(): Promise<User[]> {
  return User.findAll({
    where: {
      role: { [Op.in]: ['Support Agent', 'Admin'] },
      isActive: true,
    },
    order: [['displayName', 'ASC']],
    attributes: ['id', 'displayName', 'role'],
  });
}