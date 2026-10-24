/**
 * Notifications router — HD-019.
 *
 * Mounted at `/api/notifications` by `routes/index.ts`. Routes:
 *
 *   GET  /              — the caller's feed + unread count
 *   POST /read-all      — mark every unread read in one sweep
 *   POST /:id/read      — mark one notification read
 *
 * Every route runs `authMiddleware` first so `req.user` is
 * populated; the controller scopes every query to `req.user.id`.
 */

import { Router } from 'express';

import { list, markRead, markAllRead } from '../controllers/notificationsController';
import { authMiddleware } from '../middleware/auth';

const notificationsRouter = Router();

notificationsRouter.get('/', authMiddleware, list);

// `/read-all` is registered before `/:id/read`. Express matches
// literal segments ahead of params, so this ordering is belt-and-
// braces — but it also means `/read-all` can never be swallowed by
// a future `/:something` route added above it.
notificationsRouter.post('/read-all', authMiddleware, markAllRead);

notificationsRouter.post('/:id/read', authMiddleware, markRead);

export default notificationsRouter;