/**
 * Tickets controller — HD-007.
 *
 * Single endpoint exposed for HD-007:
 *   GET /api/tickets/mine  → list tickets the JWT'd user submitted
 *
 * The submitterId filter comes from the JWT (never the query string),
 * so a user can only ever see their own tickets through this route.
 *
 * Later stories (HD-010 ticket detail, HD-012 queue, HD-013 admin)
 * register their own handlers in this controller file.
 */

import type { Request, Response } from 'express';

import { Ticket } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { listForUser } from '../services/ticketService';

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