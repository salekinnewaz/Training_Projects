/**
 * Tickets controller — HD-007 + HD-008.
 *
 * Endpoints exposed:
 *   GET  /api/tickets/mine   → list tickets the JWT'd user submitted
 *   POST /api/tickets        → create a ticket on behalf of the
 *                              JWT'd user (HD-008)
 *
 * The submitterId filter / create-input come from the JWT (never
 * the request body), so a user can only ever see / create their own
 * tickets through these routes.
 *
 * Later stories (HD-010 ticket detail, HD-012 queue, HD-013 admin)
 * register their own handlers in this controller file.
 */

import type { Request, Response } from 'express';

import { Ticket } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import { listForUser, createTicket } from '../services/ticketService';
import { validateCreateTicketBody } from '../utils/validation/ticketValidation';

/**
 * Serialize a Ticket instance (with eager-loaded associations) into
 * the wire shape the frontend `Ticket` interface declares.
 *
 * - `toJSON()` flattens Sequelize instances and converts the
 *   nested User/Attachment associations into plain objects.
 * - Date fields stay as `Date` after toJSON; the frontend expects
 *   ISO strings, so we re-serialize the four timestamp fields.
 */
function serializeTicket(ticket: Ticket): Record<string, unknown> {
  const json = ticket.toJSON() as unknown as Record<string, unknown>;
  json.createdAt = ticket.createdAt.toISOString();
  json.updatedAt = ticket.updatedAt.toISOString();
  json.deletedAt = ticket.deletedAt
    ? ticket.deletedAt.toISOString()
    : null;
  return json;
}

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  // authMiddleware ran before us and populated req.user.
  const userId = req.user!.id;

  const tickets = await listForUser(userId);
  const payload = tickets.map(serializeTicket);

  res.status(200).json({ tickets: payload, count: payload.length });
});

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