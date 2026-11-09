/**
 * Admin controller — HD-013.
 *
 * Endpoints exposed:
 *   GET /api/admin/dashboard  → four-bucket ticket summary for the
 *                                Admin Dashboard tab. Admin-only;
 *                                the role gate is inline (same
 *                                defense-in-depth pattern as
 *                                listForQueue in ticketsController).
 *
 * Why this lives in its own controller (not ticketsController):
 *   - HD-013 is the first endpoint under `/api/admin`. HD-014 will
 *     add `GET /api/admin/users` and possibly more; an admin-scoped
 *     file keeps those future endpoints together.
 *   - The role gate ("Admin only") is uniform across the admin
 *     surface; co-locating the assertion makes it easy to add a
 *     helper later if more endpoints share the same predicate.
 *   - It mirrors how `authController` and `ticketsController` are
 *     already split per resource.
 *
 * The `serializeTicket` helper duplicates the one in
 * `ticketsController` rather than being exported from there — the
 * helper is 8 lines and the controllers stay loosely coupled.
 * Extracting it into a shared `serialize/ticket.ts` is a v1.x
 * refactor (the same helper now exists in two places).
 */

import type { Request, Response } from 'express';

import { Ticket } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import {
  getDashboardSummary,
  type DashboardSummary,
} from '../services/ticketService';
import {
  getWorkspaceSummary,
  getRecentTickets,
  getUsersOverview,
  getPriorityDistribution,
  getTicketTrends,
  getRecentUsers,
} from '../services/adminDashboardService';

/**
 * Serialize a Ticket instance (with eager-loaded associations) into
 * the wire shape the frontend `Ticket` interface declares. Mirrors
 * `ticketsController.serializeTicket` — see that file for the
 * rationale on the four-timestamp ISO re-serialization.
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

/**
 * Map the service's `DashboardSummary` (where each bucket is
 * `{ rows, total }`) into the wire shape the spec calls for:
 * `{ open: { rows, total }, inProgress: { rows, total }, resolved: { rows, total }, closed: { rows, total } }`.
 *
 * The bucket key set is fixed (the four status values) so we hand-
 * build the response rather than spreading the service result —
 * keeps the wire shape stable even if `DashboardSummary` grows new
 * fields internally.
 */
function serializeDashboard(
  summary: DashboardSummary,
): Record<string, { rows: Array<Record<string, unknown>>; total: number }> {
  return {
    open: {
      rows: summary.open.rows.map(serializeTicket),
      total: summary.open.total,
    },
    inProgress: {
      rows: summary.inProgress.rows.map(serializeTicket),
      total: summary.inProgress.total,
    },
    resolved: {
      rows: summary.resolved.rows.map(serializeTicket),
      total: summary.resolved.total,
    },
    closed: {
      rows: summary.closed.rows.map(serializeTicket),
      total: summary.closed.total,
    },
  };
}

/**
 * GET /api/admin/dashboard — Admin-only ticket summary (HD-013).
 *
 * The Angular `roleGuard(['Admin'])` on `/admin` already blocks
 * non-Admins client-side; this inline gate is the defense-in-depth
 * mirror so a programmatic client (curl, Postman) that bypasses the
 * SPA still gets 403. Same pattern as `listForQueue` (HD-012) and
 * `create` (HD-008) — the controller is the single source of truth
 * for the role assertion so the route file stays a thin
 * `authMiddleware → handler` chain.
 *
 * Response: 200 with the four-bucket summary object.
 *
 * @openapi
 * /admin/dashboard:
 *   get:
 *     summary: Admin dashboard summary
 *     description: |
 *       Returns a four-bucket summary of every ticket in the
 *       system, grouped by status. Each bucket carries the first
 *       14 tickets (the Admin Dashboard UI cap) plus the total
 *       count so the footer can render "Showing N of M" when
 *       total > 14. Admin only.
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Dashboard summary.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const getDashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = req.user!.role;
    if (role !== 'Admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Admin role required to view the dashboard.',
      );
    }
    const summary = await getDashboardSummary();
    res.status(200).json(serializeDashboard(summary));
  },
);

/**
 * GET /api/admin/workspace — the Admin Workspace dashboard bundle.
 *
 * The WDS-2026 Admin Dashboard renders six independent widgets. They
 * are fetched as ONE response rather than six round-trips because
 * they always render together — a partial render (some widgets
 * present, some absent) would be a worse UX than a single failure
 * state, and the queries are all indexed primary-key lookups or
 * small aggregates.
 *
 * Response shape:
 *   {
 *     summary:      { totalTickets, recentTickets, previousTickets,
 *                     totalUsers, newUsersThisWeek, counts: {...} },
 *     recentTickets: [ ...serialized tickets ],
 *     usersOverview: { total, active, inactive, byRole: {...} },
 *     priorities:   [ { priority, count }, ... ],
 *     trends:       [ { date, open, inProgress, resolved, closed }, ... ],
 *     recentUsers:  [ { id, displayName, email, role, isActive, ... }, ... ]
 *   }
 *
 * Admin only — the same inline gate as `getDashboardHandler`.
 *
 * @openapi
 * /admin/workspace:
 *   get:
 *     summary: Admin Workspace dashboard bundle
 *     description: |
 *       Returns the six widgets of the WDS-2026 Admin Workspace in
 *       ONE response — the summary counters, the Recent Tickets
 *       rows, the Users Overview breakdown, the Priority
 *       distribution, the Ticket Trends series and the Recent
 *       Users. They always render together, so a partial render
 *       would be a worse UX than a single failure state. Admin
 *       only.
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: The Admin Workspace bundle.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminWorkspaceResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const getWorkspaceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = req.user!.role;
    if (role !== 'Admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Admin role required to view the dashboard.',
      );
    }

    const [summary, recentTickets, usersOverview, priorities, trends, recentUsers] =
      await Promise.all([
        getWorkspaceSummary(),
        getRecentTickets(),
        getUsersOverview(),
        getPriorityDistribution(),
        getTicketTrends(),
        getRecentUsers(),
      ]);

    res.status(200).json({
      summary,
      recentTickets: recentTickets.map(serializeTicket),
      usersOverview,
      priorities,
      trends,
      recentUsers,
    });
  },
);
