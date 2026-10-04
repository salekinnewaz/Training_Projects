/**
 * UserService — HD-010.
 *
 * Thin wrapper over the `/api/users/*` endpoints. HD-010 ships
 * `listAgents()`; HD-014 (Admin Users tab) will extend this file
 * with admin-specific helpers.
 *
 * The Assignee dropdown on the Ticket Detail page is the only
 * consumer today; the result is cached in a signal at the page
 * level so a re-mount doesn't refetch.
 *
 * Provided as `providedIn: 'root'` so any page can inject it
 * without a module-level import dance — mirrors `TicketService`.
 *
 * Auth: every request goes through the `authInterceptor`, which
 * stamps `withCredentials: true` and converts HttpErrorResponse
 * into a typed `ApiError`.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
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
}