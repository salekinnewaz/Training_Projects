/**
 * Tickets router — HD-007.
 *
 * Mounted at `/api/tickets` by `routes/index.ts`. HD-007 exposes only
 * `GET /mine` (the JWT'd user's own submitted tickets). Later
 * stories append their own handlers:
 *   - HD-010: GET /:id
 *   - HD-012: GET / (Agent queue view)
 *   - HD-008+: POST / (Create Ticket, Submit endpoint)
 *
 * All routes behind this router that read ticket data must call
 * `authMiddleware` first so `req.user` is populated.
 */

import { Router } from 'express';

import { listMine } from '../controllers/ticketsController';
import { authMiddleware } from '../middleware/auth';

const ticketsRouter = Router();

ticketsRouter.get('/mine', authMiddleware, listMine);

export default ticketsRouter;