/**
 * Users router — HD-010 + HD-014.
 *
 * Mounted at `/api/users` by `routes/index.ts`. Routes:
 *
 *   GET /agents   — list active Support Agents + Admins (HD-010).
 *                   Used by the Ticket Detail page's assignee
 *                   dropdown.
 *
 * Later stories (HD-014) append:
 *   - GET /        — full user list (Admin only)
 *   - GET /:id     — single-user view
 *   - PATCH /:id   — role / active toggle
 *   - etc.
 */

import { Router } from 'express';

import { listActiveAgentsHandler } from '../controllers/usersController';
import { authMiddleware } from '../middleware/auth';

const usersRouter = Router();

usersRouter.get('/agents', authMiddleware, listActiveAgentsHandler);

export default usersRouter;