/**
 * Users router — HD-010 + HD-014.
 *
 * Mounted at `/api/users` by `routes/index.ts`. Routes:
 *
 *   GET  /agents   — list active Support Agents + Admins (HD-010).
 *                    Used by the Ticket Detail page's assignee
 *                    dropdown.
 *
 * HD-014 (Admin Users tab) extends the file with:
 *   GET  /         — full user list (Admin only)
 *   PUT  /:id/role — change a user's role (Admin only)
 *   PUT  /:id/status — toggle a user's active status (Admin only)
 *
 * The three HD-014 routes are gated inline by the controller
 * (Admin only). There is no shared `adminOnly` middleware — the
 * pattern across the codebase is to throw `HttpError(403, ...)`
 * inside the handler, matching the adminController approach.
 */

import { Router } from 'express';

import {
  listActiveAgentsHandler,
  listAllHandler,
  setActiveHandler,
  setRoleHandler,
} from '../controllers/usersController';
import { authMiddleware } from '../middleware/auth';

const usersRouter = Router();

usersRouter.get('/agents', authMiddleware, listActiveAgentsHandler);
usersRouter.get('/', authMiddleware, listAllHandler);
usersRouter.put('/:id/role', authMiddleware, setRoleHandler);
usersRouter.put('/:id/status', authMiddleware, setActiveHandler);

export default usersRouter;
