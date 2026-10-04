/**
 * Tickets router — HD-007 + HD-008 + HD-009 + HD-010.
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
 *   PATCH /:id   — partial update of status / priority / category
 *                   / ownerId (HD-010). Per-field role gate +
 *                   status-transition rules enforced inline by the
 *                   controller and the service.
 *   POST /:id/comments — add a comment to a ticket (HD-010).
 *                   Closed tickets return 403.
 *   GET  /:id/comments — list comments oldest-first (HD-010).
 *   GET  /:id/activity — list activity events newest-first (HD-010).
 *   POST /:id/reopen — submitter-only, Resolved → Open (HD-010).
 *   POST /:id/confirm-close — submitter-only, Resolved → Closed (HD-010).
 *
 * Later stories append their own handlers:
 *   - HD-012: GET /  (Agent queue view)
 *
 * All routes behind this router that read or write ticket data
 * must call `authMiddleware` first so `req.user` is populated.
 * The create route intentionally does NOT use `roleGuard(['User'])`
 * — the controller asserts the role inline so any future story that
 * wants to allow other roles can swap the assertion without
 * re-wiring the route. The PATCH / comments / activity endpoints
 * similarly defer per-field role enforcement to the controller
 * (the service re-asserts as defense in depth).
 */

import { Router } from 'express';

import {
  listMine,
  create,
  getById,
  patch,
  addCommentHandler,
  listCommentsHandler,
  listActivityHandler,
  reopen,
  confirmClose,
} from '../controllers/ticketsController';
import { authMiddleware } from '../middleware/auth';

const ticketsRouter = Router();

ticketsRouter.get('/mine', authMiddleware, listMine);
ticketsRouter.post('/', authMiddleware, create);
ticketsRouter.get('/:id', authMiddleware, getById);

// HD-010 — Ticket Detail page. Order matters here: Express routes
// are first-match-wins, so the static `/comments` and `/activity`
// sub-resources must be registered BEFORE the bare `/:id` would
// catch them. Because `:id` is matched above, we keep them below
// and rely on Express preferring literal segments over `:id` —
// `/tickets/47/comments` does NOT match `/:id` so there's no
// collision.
ticketsRouter.patch('/:id', authMiddleware, patch);
ticketsRouter.post('/:id/comments', authMiddleware, addCommentHandler);
ticketsRouter.get('/:id/comments', authMiddleware, listCommentsHandler);
ticketsRouter.get('/:id/activity', authMiddleware, listActivityHandler);
ticketsRouter.post('/:id/reopen', authMiddleware, reopen);
ticketsRouter.post('/:id/confirm-close', authMiddleware, confirmClose);

export default ticketsRouter;