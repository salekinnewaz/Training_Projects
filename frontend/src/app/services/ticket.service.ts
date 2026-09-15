/**
 * TicketService — HD-007.
 *
 * Thin wrapper over the `/api/tickets/*` endpoints. HD-007 ships
 * one method (`listMine()`); HD-010 (Ticket Detail) and HD-008
 * (Create) extend this file.
 *
 * Provided as `providedIn: 'root'` so any page can inject it
 * without a module-level import dance — mirrors `AuthService`.
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
import type { Ticket } from '../models/ticket';
import { apiErrorFrom } from './api-error';

interface ListMineResponse {
  tickets: Ticket[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);

  /**
   * GET /api/tickets/mine — newest-first by `updatedAt`, max 100,
   * filtered server-side by the JWT'd user's `submitterId`.
   *
   * Throws `ApiError` on any non-2xx response (auth interceptor does
   * the HttpErrorResponse → ApiError conversion). Returns `[]`
   * when the employee has zero tickets.
   */
  async listMine(): Promise<Ticket[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListMineResponse>(
          `${environment.apiBaseUrl}/tickets/mine`,
          { withCredentials: true },
        ),
      );
      return res.tickets;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }
}