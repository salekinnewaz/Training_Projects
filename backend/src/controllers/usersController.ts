/**
 * Users controller — HD-010 + HD-014.
 *
 * HD-010 ships the first subroute:
 *   GET /api/users/agents — list active Support Agents + Admins.
 *
 * HD-014 (Admin Users tab) extends the file with three more:
 *   GET  /api/users              — full user list (Admin only)
 *   PUT  /api/users/:id/role     — change a user's role (Admin only)
 *   PUT  /api/users/:id/status   — toggle a user's active status
 *                                   (Admin only)
 *
 * The three new handlers each inline a role gate (Admin only,
 * mirroring `adminController.getDashboardHandler`) and the
 * setRole / setActive handlers also enforce self-protection —
 * the Admin viewing the page can never demote or deactivate
 * themselves, even via a direct API call. The frontend is
 * expected to gate the same constraint via the self-row
 * disabled state, but the server is the source of truth.
 *
 * `serializeUser` mirrors the per-controller `serializeTicket`
 * convention (see `adminController.ts` line 21-25 for the
 * rationale on not sharing the helper across files).
 */

import type { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import {
  isUserRoleLiteral,
  listActiveAgents,
  listAllUsers,
  setUserActive,
  setUserRole,
  type UserRoleLiteral,
} from '../services/ticketService';
import type { UserAttributes } from '../models/User';

// ─── HD-010 — Agent list (unchanged) ─────────────────────────────────

/**
 * Wire shape returned by `listActiveAgentsHandler`. The frontend
 * `AgentSummary` interface (services/user.service.ts) declares
 * these three fields.
 */
interface AgentSummaryWire {
  id: number;
  displayName: string;
  role: 'Support Agent' | 'Admin';
}

/**
 * GET /api/users/agents — list active agents (HD-010).
 *
 * Returns Support Agent + Admin users who are active, sorted by
 * displayName ASC. The Ticket Detail page caches it for the page
 * lifetime so subsequent PATCHes don't re-fetch.
 *
 * On 401 (handled by authMiddleware upstream) the frontend silently
 * drops the agent list to an Unassigned-only fallback — the meta
 * load never blocks on this endpoint.
 */
/**
 * @openapi
 * /users/agents:
 *   get:
 *     summary: List active agents
 *     description: |
 *       Returns Support Agents + Admins (active only), sorted by
 *       displayName ASC. Used by the Ticket Detail page's
 *       assignee dropdown. No `User` role is included — Users
 *       can never own a ticket.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Agent list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const listActiveAgentsHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const users = await listActiveAgents();
    const payload: AgentSummaryWire[] = users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role as 'Support Agent' | 'Admin',
    }));
    res.status(200).json({ agents: payload, count: payload.length });
  },
);

// ─── HD-014 — Admin Users tab ───────────────────────────────────────

/**
 * Wire shape for a single user returned by every HD-014 endpoint.
 * Matches the frontend `UserPublic` interface
 * (`frontend/src/app/models/user.ts`).
 */
interface UserPublicWire {
  id: number;
  email: string;
  displayName: string;
  role: UserRoleLiteral;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map a Sequelize User row to the `UserPublic` wire.
 *
 * The default User scope already strips `passwordHash`, so we
 * never serialize it. `lastActiveAt` is a Date in Sequelize but
 * the wire is ISO 8601 (or null when the user has never logged
 * in). `createdAt` / `updatedAt` are auto-stamped by the model
 * and always present.
 */
function serializeUser(u: UserAttributes): UserPublicWire {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as UserRoleLiteral,
    isActive: u.isActive,
    lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/**
 * GET /api/users — full user list (HD-014, Admin only).
 *
 * Returns `{ users: UserPublic[], count: number }` sorted by
 * `displayName ASC`. The controller is the gate: non-Admin
 * roles get a 403 before the service is called.
 *
 * The page does not refetch on every action — it keeps the
 * row list in a local signal and patches it on success. The
 * window-focus refetch (mirrors admin-dashboard) is the only
 * revalidation trigger.
 */
/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users
 *     description: |
 *       Full user list (Admin only), sorted by displayName ASC.
 *       No pagination in MVP (capped at ≤20 users per design doc).
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const listAllHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = req.user!.role;
    if (role !== 'Admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Admin role required to list users.',
      );
    }
    const users = await listAllUsers();
    const payload: UserPublicWire[] = users.map(serializeUser);
    res.status(200).json({ users: payload, count: payload.length });
  },
);

/**
 * PUT /api/users/:id/role — change a user's role
 * (HD-014, Admin only).
 *
 * Body shape: `{ role: 'User' | 'Support Agent' | 'Admin' }`.
 *
 * Errors (in order of check):
 *   - 403 if the caller is not Admin.
 *   - 400 with `fields.role` if the body's `role` is missing or
 *     not a known role literal.
 *   - 400 with `fields.actor` if the caller is trying to change
 *     their own role (mirrors the UI's self-row protection —
 *     defense-in-depth so a direct API call can't bypass it).
 *   - 404 if the target user doesn't exist (raised by the service).
 *
 * On success, returns 200 with the updated user wire (single
 * object, not wrapped) so the page can patch its local signal.
 */
/**
 * @openapi
 * /users/{id}/role:
 *   put:
 *     summary: Change a user's role
 *     description: |
 *       Admin only. Self-protection: returns 400 if `id` matches
 *       the caller's own user id (mirrors the UI's self-row
 *       protection — defense-in-depth).
 *     tags: [Users]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Target user id.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *     responses:
 *       200:
 *         description: Updated user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error, invalid id, or self-role-change attempt.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const setRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = req.user!;
    if (actor.role !== 'Admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Admin role required to change roles.',
      );
    }
    const targetId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId)) {
      throw new HttpError(
        400,
        'validation_error',
        'User id must be a number.',
      );
    }
    if (targetId === actor.id) {
      throw new HttpError(
        400,
        'validation_error',
        'You cannot change your own role.',
        { actor: 'self-role-change-not-allowed' },
      );
    }
    const body = (req.body ?? {}) as { role?: unknown };
    if (!isUserRoleLiteral(body.role)) {
      throw new HttpError(
        400,
        'validation_error',
        'role must be one of: User, Support Agent, Admin.',
        { role: 'invalid-role' },
      );
    }
    const updated = await setUserRole(targetId, body.role);
    res.status(200).json(serializeUser(updated.get({ plain: true })));
  },
);

/**
 * PUT /api/users/:id/status — toggle a user's active status
 * (HD-014, Admin only).
 *
 * Body shape: `{ isActive: boolean }`.
 *
 * Errors (in order of check):
 *   - 403 if the caller is not Admin.
 *   - 400 with `fields.status` if `isActive` is missing or not a
 *     boolean.
 *   - 400 with `fields.actor` if the caller is trying to
 *     deactivate themselves.
 *   - 404 if the target user doesn't exist.
 *
 * On success, returns 200 with the updated user wire.
 */
/**
 * @openapi
 * /users/{id}/status:
 *   put:
 *     summary: Toggle a user's active status
 *     description: |
 *       Admin only. Self-protection: returns 400 if `id` matches
 *       the caller's own user id (an Admin cannot deactivate
 *       themselves). Setting `isActive: false` invalidates the
 *       target's session on their next `/me` call.
 *     tags: [Users]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Target user id.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStatusRequest'
 *     responses:
 *       200:
 *         description: Updated user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or self-deactivation attempt.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const setActiveHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = req.user!;
    if (actor.role !== 'Admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Admin role required to change status.',
      );
    }
    const targetId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId)) {
      throw new HttpError(
        400,
        'validation_error',
        'User id must be a number.',
      );
    }
    if (targetId === actor.id && (req.body as { isActive?: unknown })?.isActive === false) {
      throw new HttpError(
        400,
        'validation_error',
        'You cannot deactivate yourself.',
        { actor: 'self-deactivate-not-allowed' },
      );
    }
    const body = (req.body ?? {}) as { isActive?: unknown };
    if (typeof body.isActive !== 'boolean') {
      throw new HttpError(
        400,
        'validation_error',
        'isActive must be a boolean.',
        { status: 'invalid-isActive' },
      );
    }
    const updated = await setUserActive(targetId, body.isActive);
    res.status(200).json(serializeUser(updated.get({ plain: true })));
  },
);
