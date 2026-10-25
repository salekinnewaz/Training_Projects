/**
 * UserService — HD-010 + HD-014.
 *
 * Thin wrapper over the `/api/users/*` endpoints. HD-010 ships
 * `listAgents()`; HD-014 (Admin Users tab) extends this file with
 * `listAll()`, `updateRole()`, and `updateActive()`.
 *
 * The Assignee dropdown on the Ticket Detail page is the only
 * consumer of `listAgents()`; the result is cached in a signal
 * at the page level so a re-mount doesn't refetch.
 *
 * The Admin Users tab (HD-014) is the consumer of the three
 * new methods. The page keeps a local signal of `UserPublic[]`
 * and patches it on successful updateRole / updateActive
 * responses rather than refetching the list.
 *
 * Provided as `providedIn: 'root'` so any page can inject it
 * without a module-level import dance — mirrors `TicketService`.
 *
 * Auth: every request goes through the `authInterceptor`, which
 * stamps `withCredentials: true` and converts HttpErrorResponse
 * into a typed `ApiError`. Services never need to think about
 * cookies or CORS preflight.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { UserPublic } from '../models/user';
import type { UserRole } from '../models/enums';
import { apiErrorFrom } from './api-error';

/**
 * The shape of each row returned by GET /api/users/agents.
 * The backend restricts the SELECT to id/displayName/role so the
 * wire is minimal — no email, no isActive flag, no timestamps.
 */
export interface AgentSummary {
  id: number;
  displayName: string;
  role: UserRole;
}

interface ListAgentsResponse {
  agents: AgentSummary[];
  count: number;
}

/**
 * Wire shape returned by GET /api/users (HD-014). The full
 * `UserPublic` is returned per row (email, role, isActive,
 * lastActiveAt, createdAt, updatedAt, ticketCount) — the Users
 * tab page needs every field for its 5 columns.
 */
interface ListAllResponse {
  users: UserPublic[];
  count: number;
}

/**
 * Body sent to `PUT /api/users/:id/role` (HD-014).
 *
 * The backend validator returns 400 `validation_error` with
 * `fields.role` if the role is missing or not a known literal.
 */
export interface UpdateRolePayload {
  role: UserRole;
}

/**
 * Body sent to `PUT /api/users/:id/status` (HD-014).
 *
 * The backend validator returns 400 `validation_error` with
 * `fields.status` if `isActive` is missing or not a boolean.
 */
export interface UpdateStatusPayload {
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  /**
   * GET /api/users/agents — list Support Agents + Admins (active).
   *
   * Sorted server-side by `displayName ASC` so the dropdown is
   * stable across renders. Inactive agents are excluded so a
   * deactivated agent can never be assigned to a new ticket.
   *
   * Throws `ApiError` on any non-2xx response. The Ticket Detail
   * page treats the failure as a graceful degradation — it falls
   * back to an "Unassigned"-only assignee dropdown rather than
   * surfacing an error toast.
   */
  async listAgents(): Promise<AgentSummary[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListAgentsResponse>(
          `${environment.apiBaseUrl}/users/agents`,
          { withCredentials: true },
        ),
      );
      return res.agents;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  // ─── HD-014 — Admin Users tab helpers ─────────────────────────────

  /**
   * GET /api/users — full user list (HD-014, Admin only).
   *
   * Returns every user (active + inactive, all roles) sorted by
   * `displayName ASC`. The Users tab page keeps the result in a
   * local signal so updateRole / updateActive can patch single
   * rows without a full refetch.
   *
   * Throws `ApiError` on any non-2xx response. The page treats
   * 401 as session-expired (per the auth interceptor's mapping)
   * and 5xx as a generic load failure that falls through to the
   * error render state.
   */
  async listAll(): Promise<UserPublic[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListAllResponse>(
          `${environment.apiBaseUrl}/users`,
          { withCredentials: true },
        ),
      );
      return res.users;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * PUT /api/users/:id/role — change a user's role (HD-014, Admin only).
   *
   * Returns the updated user with every UserPublic field. The
   * page patches its local signal with this row to avoid a
   * refetch. Throws `ApiError` on:
   *   - 400 `validation_error` `fields.role` if the role is
   *     missing or not a known literal.
   *   - 400 `validation_error` `fields.actor` if the caller is
   *     trying to change their own role (defense-in-depth).
   *   - 404 if the target user doesn't exist.
   *   - 403 if the caller isn't Admin.
   */
  async updateRole(id: number, role: UserRole): Promise<UserPublic> {
    try {
      const res = await firstValueFrom(
        this.http.put<UserPublic>(
          `${environment.apiBaseUrl}/users/${id}/role`,
          { role } satisfies UpdateRolePayload,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * PUT /api/users/:id/status — toggle a user's active status
   * (HD-014, Admin only).
   *
   * Returns the updated user. Throws `ApiError` on:
   *   - 400 `validation_error` `fields.status` if `isActive` is
   *     missing or not a boolean.
   *   - 400 `validation_error` `fields.actor` if the caller is
   *     trying to deactivate themselves.
   *   - 404 if the target user doesn't exist.
   *   - 403 if the caller isn't Admin.
   */
  async updateActive(id: number, isActive: boolean): Promise<UserPublic> {
    try {
      const res = await firstValueFrom(
        this.http.put<UserPublic>(
          `${environment.apiBaseUrl}/users/${id}/status`,
          { isActive } satisfies UpdateStatusPayload,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }
}