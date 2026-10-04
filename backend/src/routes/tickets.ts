/**
 * Tickets router — HD-007 + HD-008 + HD-009.
 *
 * Mounted at `/api/tickets` by `routes/index.ts`. Routes:
 *
 *   GET  /mine   — list tickets the JWT'd user submitted (HD-007)
 *   POST /        — create a new ticket on behalf of the JWT'd
 *                   user (HD-008). Body: {title, description,
 *                   category?, priority, attachmentId?}.
 *                   Responds 201 with `{ ticket }`.
 *   GET  /:id    — fetch a single ticket by primary key (HD-009).
 *                   The `:id` is the numeric PK, not the HD-<n>
 *                   number. User sees only own; Support Agent /
 *                   Admin see any. Responds 200 with `{ ticket }`,
 *                   404 when missing or non-owner.
 *
 * Later stories append their own handlers:
 *   - HD-010: PATCH /:id, POST /:id/comments, POST /:id/reopen,
 *             POST /:id/confirm-close
 *   - HD-012: GET /  (Agent queue view)
 *
 * All routes behind this router that read or write ticket data
 * must call `authMiddleware` first so `req.user` is populated.
 * The create route intentionally does NOT use `roleGuard(['User'])`
 * — the controller asserts the role inline so any future story that
 * wants to allow other roles can swap the assertion without
 * re-wiring the route.
 */

import { Router } from 'express';

import {
  listMine,
  create,
  getById,
} from '../controllers/ticketsController';
import { authMiddleware } from '../middleware/auth';

const ticketsRouter = Router();

ticketsRouter.get('/mine', authMiddleware, listMine);
ticketsRouter.post('/', authMiddleware, create);
ticketsRouter.get('/:id', authMiddleware, getById);

export default ticketsRouter;