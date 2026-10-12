/**
 * Tickets controller — HD-007 + HD-008 + HD-009 + HD-010 + HD-012.
 *
 * Endpoints exposed:
 *   GET  /api/tickets/mine           → list tickets the JWT'd user submitted
 *   GET  /api/tickets/queue          → list every ticket in the system
 *                                       (HD-012, Support Agent only)
 *   POST /api/tickets                → create a ticket on behalf of the
 *                                       JWT'd user (HD-008)
 *   GET  /api/tickets/:id            → fetch a single ticket by primary key
 *                                       (HD-009). User role sees own only;
 *                                       Support Agent / Admin see any.
 *   PATCH /api/tickets/:id           → partial update of status / priority
 *                                       / category / ownerId (HD-010).
 *                                       Per-field role + transition rules
 *                                       enforced inline.
 *   POST /api/tickets/:id/comments   → add a comment to a ticket (HD-010).
 *                                       Closed tickets return 403.
 *   GET  /api/tickets/:id/comments   → list comments oldest-first (HD-010).
 *   GET  /api/tickets/:id/activity   → list activity events newest-first (HD-010).
 *   POST /api/tickets/:id/reopen     → submitter-only, Resolved → Open (HD-010).
 *   POST /api/tickets/:id/confirm-close → submitter-only, Resolved → Closed (HD-010).
 *
 * The submitterId filter / create-input come from the JWT (never
 * the request body), so a user can only ever see / create their own
 * tickets through these routes.
 *
 * Later stories (HD-013 admin) register their own handlers in this
 * controller file.
 */

import type { Request, Response } from 'express';

import { Ticket } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import {
  listForUser,
  listForQueue,
  createTicket,
  getById as getByIdService,
  updateTicket,
  addComment,
  reopenTicket,
  confirmCloseTicket,
  listComments,
  listActivity,
  type ActorRole,
} from '../services/ticketService';

import {
  validateCreateTicketBody,
  validateUpdateTicketBody,
  validateAddCommentBody,
} from '../utils/validation/ticketValidation';

/**
 * Serialize a Ticket instance (with eager-loaded associations) into
 * the wire shape the frontend `Ticket` interface declares.
 *
 * - `toJSON()` flattens Sequelize instances and converts the
 *   nested User/Attachment associations into plain objects.
 * - Date fields stay as `Date` after toJSON; the frontend expects
 *   ISO strings, so we re-serialize the four timestamp fields.
 * - The optional `attachment` association is pre-loaded by
 *   `services/ticketService.getById` (HD-002 wired the
 *   association; HD-016 uses it). The nested `uploadedBy`
 *   User is flattened by toJSON; we strip `passwordHash` via
 *   the default User scope and normalize `createdAt` to ISO.
 */
function serializeTicket(ticket: Ticket): Record<string, unknown> {
  const json = ticket.toJSON() as unknown as Record<string, unknown>;
  json.createdAt = ticket.createdAt.toISOString();
  json.updatedAt = ticket.updatedAt.toISOString();
  json.deletedAt = ticket.deletedAt
    ? ticket.deletedAt.toISOString()
    : null;
  // The `attachment` field is a Sequelize instance (or null)
  // after toJSON. Normalize to the wire shape.
  const att = json.attachment as Record<string, unknown> | null;
  if (att !== null && typeof att === 'object') {
    json.attachment = serializeAttachment(att);
  } else {
    json.attachment = null;
  }
  return json;
}

/**
 * Serialize an Attachment row (or its toJSON()ed plain object)
 * to the public wire shape the frontend `Attachment` interface
 * declares. `createdAt` is coerced to an ISO string; the
 * `uploadedBy` User is flattened by toJSON and only carries
 * public fields (passwordHash is stripped by the default
 * User scope).
 */
function serializeAttachment(
  att: Record<string, unknown>,
): Record<string, unknown> {
  const created = att.createdAt;
  return {
    id: att.id,
    filename: att.filename,
    sizeBytes: att.sizeBytes,
    mimetype: att.mimetype,
    storagePath: att.storagePath,
    uploadedBy: att.uploadedBy ?? null,
    createdAt: created instanceof Date ? created.toISOString() : String(created),
  };
}

/**
 * Serialize a Comment instance for the wire. The frontend `Comment`
 * model nests `author` (UserPublic minus passwordHash). The Comment
 * model's toJSON() flattens the eager-loaded author for us.
 *
 * `createdAt` is the only timestamp field on Comment; we coerce it
 * to an ISO string for symmetry with the rest of the API.
 */
function serializeComment(comment: import('../models').Comment): Record<string, unknown> {
  const json = comment.toJSON() as unknown as Record<string, unknown>;
  json.createdAt = comment.createdAt.toISOString();
  return json;
}

/**
 * Serialize an ActivityLog row for the wire. `payload` is the raw
 * JSON object the model stored (Sequelize JSON columns round-trip
 * cleanly). `createdAt` is coerced to ISO. The eager-loaded `actor`
 * is flattened by toJSON().
 */
function serializeActivity(
  entry: import('../models').ActivityLog,
): Record<string, unknown> {
  const json = entry.toJSON() as unknown as Record<string, unknown>;
  json.createdAt = entry.createdAt.toISOString();
  return json;
}

/**
 * Enumeration + ticket-status gate for any HD-010 handler that
 * reads a ticket by `:id`. A User who isn't the submitter gets the
 * same 404 envelope as a missing ticket — mirrors HD-009's
 * enumeration protection. Support Agent / Admin see any ticket.
 *
 * Returns the eager-loaded Ticket instance so callers can serialize
 * without a second round-trip.
 */
async function loadTicketForUser(
  ticketId: number,
  userId: number,
  role: ActorRole,
): Promise<Ticket> {
  const ticket = await getByIdService(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'not_found', 'Ticket not found.');
  }
  if (role === 'User' && ticket.submitterId !== userId) {
    throw new HttpError(404, 'not_found', 'Ticket not found.');
  }
  return ticket;
}

/**
 * Parse the `:id` path param to a positive integer. Number.isInteger
 * rejects NaN, non-numeric strings, and fractional values. The
 * frontend's `/tickets/abc` redirect handles the non-numeric case
 * before we get here, but the controller stays defensive.
 */
function parseTicketId(rawId: string): number {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Ticket id must be a positive integer.',
    );
  }
  return parsed;
}

/**
 * @openapi
 * /tickets/mine:
 *   get:
 *     summary: List the caller's tickets
 *     description: |
 *       Returns every ticket submitted by the JWT'd user, newest
 *       first. Used by the Employee Dashboard
 *       (`frontend/src/app/pages/employee-dashboard-page`).
 *     tags: [Tickets]
 *     responses:
 *       200:
 *         description: Caller's tickets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const listMine = asyncHandler(async (req: Request, res: Response) => {
  // authMiddleware ran before us and populated req.user.
  const userId = req.user!.id;

  const tickets = await listForUser(userId);
  const payload = tickets.map(serializeTicket);

  res.status(200).json({ tickets: payload, count: payload.length });
});

/**
 * GET /api/tickets/queue — list every ticket in the system
 * (HD-012 Agent Kanban).
 *
 * Support Agent only. The route is also `roleGuard(['Support Agent'])`
 * on the Angular side, so an Admin who somehow reaches this endpoint
 * (programmatic client, curl) gets 403 from this controller — same
 * defense-in-depth pattern as `create` (HD-008).
 *
 * Returns `{ tickets, count }` matching the `listMine` envelope so
 * the frontend's `listForQueue()` call mirrors `listMine()` exactly.
 *
 * No filter / search params are honored in HD-012 — the page applies
 * those client-side over the returned set. HD-015 will lift them
 * server-side and add cursor pagination.
 *
 * @openapi
 * /tickets/queue:
 *   get:
 *     summary: List every ticket (Support Agent / Admin)
 *     description: |
 *       Returns every ticket in the system, newest first. Used by
 *       the Agent Kanban board (HD-012). Support Agent or Admin
 *       only; Users get 403.
 *     tags: [Tickets]
 *     responses:
 *       200:
 *         description: All tickets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const listForQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = req.user!.role;
    if (role !== 'Support Agent') {
      throw new HttpError(
        403,
        'forbidden',
        'Support Agent role required to view the queue.',
      );
    }
    const tickets = await listForQueue();
    const payload = tickets.map(serializeTicket);
    res.status(200).json({ tickets: payload, count: payload.length });
  },
);

/**
 * POST /api/tickets — Create a new ticket (HD-008).
 *
 * Flow:
 *   1. authMiddleware has already populated req.user.
 *   2. Assert the role is `User` — only employees file tickets.
 *      A role mismatch returns 403 (matches the roleGuard pattern
 *      but lives inline because routeGuard(['User']) was
 *      deliberately omitted from `routes/tickets.ts` so the
 *      controller stays the single gate).
 *   3. validateCreateTicketBody throws HttpError(400, ...) on any
 *      field-level problem (the central errorHandler emits the
 *      400 + fields body).
 *   4. ticketService.createTicket opens a tx, reserves the next
 *      HD-<n>, inserts the row, and returns the eager-loaded
 *      instance.
 *   5. respond 201 with `{ ticket: serializeTicket(...) }`.
 */
/**
 * @openapi
 * /tickets:
 *   post:
 *     summary: Create a ticket
 *     description: |
 *       Creates a new ticket on behalf of the JWT'd user. The
 *       submitter is taken from the JWT, never the body. Only
 *       `User` role may create — Support Agents and Admins are
 *       403'd.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTicketRequest'
 *     responses:
 *       201:
 *         description: Ticket created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a `User`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: forbidden
 *               message: Only the User role may create tickets.
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  // Role gate. Per spec, no roleGuard(['User']) on the route — the
  // controller owns the assertion so the route file reads as a
  // simple `authMiddleware, create` chain. Other roles (Support
  // Agent / Admin) must not be allowed to file tickets through this
  // endpoint.
  if (!req.user || req.user.role !== 'User') {
    throw new HttpError(
      403,
      'forbidden',
      'Only employees can file tickets.',
    );
  }

  const input = validateCreateTicketBody(req.body);
  const ticket = await createTicket(req.user.id, input);

  res.status(201).json({ ticket: serializeTicket(ticket) });
});

/**
 * GET /api/tickets/:id — Fetch a single ticket (HD-009).
 *
 * Flow:
 *   1. authMiddleware has already populated req.user.
 *   2. Parse the `:id` path param to a number. Number.isInteger
 *      rejects NaN, non-numeric strings, and fractional values
 *      (e.g. `/tickets/47.5/created`) — MySQL would otherwise
 *      silently coerce 47.5 to int 47, fetching the wrong row.
 *   3. ticketService.getById eager-loads submitter/owner/attachment
 *      and returns null when the row doesn't exist (or is soft-
 *      deleted).
 *   4. Role gate — a User who isn't the submitter gets the same
 *      404 as a genuinely missing ticket. This is intentional
 *      enumeration protection: a User must not be able to probe
 *      other users' ticket IDs by status code. Support Agent /
 *      Admin see any ticket.
 *   5. respond 200 with `{ ticket: serializeTicket(...) }`.
 *
 * @openapi
 * /tickets/{id}:
 *   get:
 *     summary: Get a ticket by id
 *     description: |
 *       Users see their own tickets only. Support Agents and
 *       Admins see any ticket. A User probing another user's
 *       ticket id receives the same 404 as a missing ticket
 *       (enumeration protection).
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const parsedId = Number(req.params.id);
  if (!Number.isInteger(parsedId)) {
    throw new HttpError(
      400,
      'validation_error',
      'Ticket id must be numeric.',
    );
  }

  const ticket = await getByIdService(parsedId);
  if (!ticket) {
    throw new HttpError(404, 'not_found', 'Ticket not found.');
  }

  // Enumeration protection: a User who isn't the submitter sees the
  // same 404 envelope as a missing ticket. Support Agent / Admin
  // see any ticket.
  if (req.user!.role === 'User' && ticket.submitterId !== req.user!.id) {
    throw new HttpError(404, 'not_found', 'Ticket not found.');
  }

  res.status(200).json({ ticket: serializeTicket(ticket) });
});

// ─── HD-010 handlers ──────────────────────────────────────────────────

/**
 * PATCH /api/tickets/:id — partial update (HD-010).
 *
 * Body shape: any subset of {status, priority, category, ownerId}.
 * At least one field required (validator-enforced).
 *
 * Per-field role gate (inline, repeated in the service layer for
 * defense in depth):
 *   - Support Agent / Admin: any of the four fields.
 *   - User:                 category only.
 *
 * `status` transitions are enforced by the service via the matrix
 * documented in EXPERIENCE.md "Ticket Status Workflow Controls".
 * `Closed` is terminal — any PATCH that would change Closed's
 * status returns 400 validation_error.
 *
 * On success: 200 `{ ticket }`. On any validation failure: 400
 * `validation_error` with `fields` (HD-008 envelope).
 *
 * @openapi
 * /tickets/{id}:
 *   patch:
 *     summary: Update a ticket
 *     description: |
 *       Partial update of `status`, `priority`, `category`, or
 *       `ownerId`. Per-field role + transition rules enforced —
 *       see controller JSDoc for the matrix. Closed tickets
 *       cannot transition out of Closed (returns 400).
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTicketRequest'
 *     responses:
 *       200:
 *         description: Updated ticket.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const patch = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = parseTicketId(req.params.id);
  const role = req.user!.role as ActorRole;

  // Existence + enumeration — same shape as `getById`. Doing this
  // first means a User who tries to PATCH someone else's ticket
  // sees the same 404 envelope they'd see on GET.
  await loadTicketForUser(ticketId, req.user!.id, role);

  const input = validateUpdateTicketBody(req.body);

  // Re-check the role gate on the (now-validated) fields. The
  // service also gates; we surface a cleaner 403 here with a
  // field-shape message instead of the service's bare-string 403.
  const isAgent = role === 'Support Agent' || role === 'Admin';
  if (!isAgent) {
    if (input.status !== undefined) {
      throw new HttpError(
        400,
        'validation_error',
        'Only agents can change ticket status.',
        { status: 'Only agents can change ticket status.' },
      );
    }
    if (input.priority !== undefined) {
      throw new HttpError(
        400,
        'validation_error',
        'Only agents can change ticket priority.',
        { priority: 'Only agents can change ticket priority.' },
      );
    }
    if (input.ownerId !== undefined) {
      throw new HttpError(
        400,
        'validation_error',
        'Only agents can assign tickets.',
        { ownerId: 'Only agents can assign tickets.' },
      );
    }
  }

  const updated = await updateTicket(
    ticketId,
    req.user!.id,
    role,
    input,
  );

  res.status(200).json({ ticket: serializeTicket(updated) });
});

/**
 * POST /api/tickets/:id/comments — add a comment (HD-010).
 *
 * Body: `{ body: string }`, 1..5000 chars after trim.
 *
 * Closed read-only: when `ticket.status === Closed`, returns 403
 * `forbidden` with "Ticket is closed and cannot accept new
 * comments" — same defense-in-depth pattern as the role gate.
 *
 * On success: 201 `{ comment }`. The comment's `author`
 * association is eager-loaded by the service so the controller
 * can serialize straight back without a second round-trip.
 *
 * @openapi
 * /tickets/{id}/comments:
 *   post:
 *     summary: Add a comment
 *     description: |
 *       Adds a comment to a ticket. Closed tickets return 403.
 *       The comment's `author` is the JWT'd user.
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddCommentRequest'
 *     responses:
 *       201:
 *         description: Comment created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentCreateResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Ticket is closed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const addCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketId = parseTicketId(req.params.id);
    const role = req.user!.role as ActorRole;

    await loadTicketForUser(ticketId, req.user!.id, role);

    const input = validateAddCommentBody(req.body);
    // The service re-fetches the just-inserted row with the author
    // eager-loaded inside the same transaction, so `full` is always
    // a fully-shaped Comment instance ready for serializeComment.
    const full = await addComment(ticketId, req.user!.id, input.body);

    res.status(201).json({ comment: serializeComment(full) });
  },
);

/**
 * GET /api/tickets/:id/comments — list comments oldest-first (HD-010).
 *
 * Same enumeration protection as `getById`. Returns 200
 * `{ comments: [...], count }`.
 *
 * @openapi
 * /tickets/{id}/comments:
 *   get:
 *     summary: List ticket comments
 *     description: Returns every comment on the ticket, oldest first.
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const listCommentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketId = parseTicketId(req.params.id);
    const role = req.user!.role as ActorRole;

    await loadTicketForUser(ticketId, req.user!.id, role);

    const comments = await listComments(ticketId);
    const payload = comments.map(serializeComment);
    res.status(200).json({ comments: payload, count: payload.length });
  },
);

/**
 * GET /api/tickets/:id/activity — list activity events newest-first (HD-010).
 *
 * Same enumeration protection as `getById`. Returns 200
 * `{ activity: [...], count }`. The timeline-entry renderer uses
 * `eventType` + `payload` to derive the per-event description.
 *
 * @openapi
 * /tickets/{id}/activity:
 *   get:
 *     summary: List ticket activity
 *     description: Returns every activity event for the ticket, newest first.
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Activity list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivityListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const listActivityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketId = parseTicketId(req.params.id);
    const role = req.user!.role as ActorRole;

    await loadTicketForUser(ticketId, req.user!.id, role);

    const rows = await listActivity(ticketId);
    const payload = rows.map(serializeActivity);
    res.status(200).json({ activity: payload, count: payload.length });
  },
);

/**
 * POST /api/tickets/:id/reopen — Resolved → Open (HD-010).
 *
 * Submitter-only. The service re-asserts this; the controller
 * surfaces a cleaner 403 message before reaching it. Only valid
 * when `ticket.status === Resolved`; any other status → 400.
 *
 * On success: 200 `{ ticket }`.
 *
 * @openapi
 * /tickets/{id}/reopen:
 *   post:
 *     summary: Reopen a ticket
 *     description: |
 *       Submitter-only. Transitions `Resolved` → `Open`. Any
 *       other current status returns 400.
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket reopened.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
 *       400:
 *         description: Ticket is not in Resolved state.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not the submitter.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const reopen = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = parseTicketId(req.params.id);
  const role = req.user!.role as ActorRole;
  const actorId = req.user!.id;

  const ticket = await loadTicketForUser(ticketId, actorId, role);

  // Defense-in-depth gate — the service also asserts these, but
  // surfacing a precise 403 / 400 here keeps the wire envelope
  // consistent with the PATCH endpoint.
  if (ticket.submitterId !== actorId) {
    throw new HttpError(
      403,
      'forbidden',
      'Only the ticket submitter can reopen it.',
    );
  }
  if (ticket.status !== 'Resolved') {
    throw new HttpError(
      400,
      'validation_error',
      'Only Resolved tickets can be reopened.',
      { status: 'Only Resolved tickets can be reopened.' },
    );
  }

  const updated = await reopenTicket(ticketId, actorId);
  res.status(200).json({ ticket: serializeTicket(updated) });
});

/**
 * POST /api/tickets/:id/confirm-close — Resolved → Closed (HD-010).
 *
 * Submitter-only. Closed is terminal: once here, the ticket is
 * read-only (no edits, no comments, no reopen).
 *
 * On success: 200 `{ ticket }`.
 *
 * @openapi
 * /tickets/{id}/confirm-close:
 *   post:
 *     summary: Confirm close
 *     description: |
 *       Submitter-only. Transitions `Resolved` → `Closed`. Closed
 *       is terminal — once here, the ticket is read-only.
 *     tags: [Tickets]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket closed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
 *       400:
 *         description: Ticket is not in Resolved state.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not the submitter.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const confirmClose = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketId = parseTicketId(req.params.id);
    const role = req.user!.role as ActorRole;
    const actorId = req.user!.id;

    const ticket = await loadTicketForUser(ticketId, actorId, role);

    if (ticket.submitterId !== actorId) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the ticket submitter can confirm-close it.',
      );
    }
    if (ticket.status !== 'Resolved') {
      throw new HttpError(
        400,
        'validation_error',
        'Only Resolved tickets can be confirmed closed.',
        { status: 'Only Resolved tickets can be confirmed closed.' },
      );
    }

    const updated = await confirmCloseTicket(ticketId, actorId);
    res.status(200).json({ ticket: serializeTicket(updated) });
  },
);