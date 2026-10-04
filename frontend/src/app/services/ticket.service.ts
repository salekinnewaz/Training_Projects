/**
 * TicketService — HD-007 + HD-008 + HD-009.
 *
 * Thin wrapper over the `/api/tickets/*` endpoints. HD-007 ships
 * `listMine()`; HD-008 adds `create()`; HD-009 adds `getById()`.
 * HD-010 (Ticket Detail) extends this file.
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
import type {
  TicketCategory,
  TicketPriority,
} from '../models/enums';
import { apiErrorFrom } from './api-error';

interface ListMineResponse {
  tickets: Ticket[];
  count: number;
}

interface CreateResponse {
  ticket: Ticket;
}

interface GetByIdResponse {
  ticket: Ticket;
}

/**
 * The body sent to POST /api/tickets.
 *
 * Mirrors the backend validator (HD-008). `category` is optional —
 * omitted or empty string means "Uncategorized" (the DB column
 * allows null). `attachmentId` is optional and only meaningful once
 * the attachments upload endpoint lands (HD-011). HD-008 ships with
 * the drop zone disabled so this field is always omitted today.
 */
export interface CreateTicketPayload {
  title: string;
  description: string;
  category?: TicketCategory | '';
  priority: TicketPriority;
  attachmentId?: number;
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

  /**
   * POST /api/tickets — file a new ticket (HD-008).
   *
   * The endpoint is restricted to the `User` role on the backend;
   * the frontend only exposes this from the Create Ticket page,
   * which is `roleGuard(['User'])`-ed in `app.routes.ts`.
   *
   * Sends `{ title, description, category, priority, attachmentId? }`.
   * Empty-string category is stripped before send so the backend
   * validator sees an absent field (it normalizes absent + null +
   * empty to null on the ticket row).
   *
   * Throws `ApiError` on any non-2xx response. The Create Ticket
   * page switches on:
   *   - status 400 + fields → maps to per-field error UX
   *   - status 401 → session-expired stash + redirect to /login
   *   - other    → generic "Couldn't submit your ticket" message
   */
  async create(payload: CreateTicketPayload): Promise<Ticket> {
    const body: Record<string, unknown> = {
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
    };
    if (payload.category && (payload.category as string) !== '') {
      body['category'] = payload.category;
    }
    if (payload.attachmentId !== undefined) {
      body['attachmentId'] = payload.attachmentId;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<CreateResponse>(
          `${environment.apiBaseUrl}/tickets`,
          body,
          { withCredentials: true },
        ),
      );
      return res.ticket;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * GET /api/tickets/:id — fetch a single ticket (HD-009).
   *
   * The `:id` is the numeric primary key, NOT the HD-<n> number.
   * Used by the Submission Confirmation page (HD-009) and the
   * Ticket Detail page (HD-010).
   *
   * Throws `ApiError` on any non-2xx response. Backend returns:
   *   - 404 with errorCode 'not_found' for missing tickets
   *   - 404 (NOT 403) for tickets the JWT'd User doesn't own —
   *     enumeration protection so a User can't probe other users'
   *     ticket IDs by status code
   *
   * Mirrors the `listMine()` shape: HttpClient → firstValueFrom →
   * response unwrap → error mapping via apiErrorFrom.
   */
  async getById(id: number): Promise<Ticket> {
    try {
      const res = await firstValueFrom(
        this.http.get<GetByIdResponse>(
          `${environment.apiBaseUrl}/tickets/${id}`,
          { withCredentials: true },
        ),
      );
      return res.ticket;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }
}