/**
 * Users controller — HD-010 + HD-014.
 *
 * HD-010 ships the first subroute:
 *   GET /api/users/agents — list active Support Agents + Admins.
 *
 * Later stories (HD-014 admin tab) append their own (CRUD on users,
 * role assignment, deactivate, etc.) to the same file.
 *
 * No `roleGuard` on the route — the agent list is needed by every
 * authenticated viewer of a Ticket Detail page (User / Support
 * Agent / Admin all see the assignee dropdown). authMiddleware is
 * the only gate.
 */

import type { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { listActiveAgents } from '../services/ticketService';

/**
 * Wire shape returned to the frontend. The frontend `AgentSummary`
 * interface (services/user.service.ts) declares these three fields.
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