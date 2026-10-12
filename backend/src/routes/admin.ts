/**
 * Admin router — HD-013.
 *
 * Mounted at `/api/admin` by `routes/index.ts`. Routes:
 *
 *   GET /dashboard  — Admin-only ticket summary (HD-013 Admin
 *                     Dashboard tab). Returns the four-bucket
 *                     `{ rows, total }` per status shape the
 *                     `AdminDashboardPageComponent` renders.
 *                     Inline role gate in the controller (Admin
 *                     only) — same pattern as
 *                     `routes/tickets.ts` GET /queue (HD-012).
 *
 * HD-014 will extend this file with `GET /users` (and possibly
 * user-management actions) once the Users tab lands. Until then
 * this router only carries the dashboard subroute.
 *
 * Every route in this file is `authMiddleware`-first so `req.user`
 * is populated before the controller's role gate runs.
 */

import { Router } from 'express';

import { getDashboardHandler } from '../controllers/adminController';
import { authMiddleware } from '../middleware/auth';

const adminRouter = Router();

// HD-013 — Admin Dashboard. The literal `/dashboard` segment is
// registered before any future `/:id`-style route so a future
// "admin id" can never be confused with the dashboard endpoint.
// Express prefers literal segments over `:id` so the order is
// technically moot, but the placement is the convention every
// reader expects.
adminRouter.get('/dashboard', authMiddleware, getDashboardHandler);

export default adminRouter;
