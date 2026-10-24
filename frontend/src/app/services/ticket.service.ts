/**
 * TicketService — HD-007 + HD-008 + HD-009 + HD-010 + HD-012 + HD-013.
 *
 * Thin wrapper over the `/api/tickets/*` endpoints. HD-007 ships
 * `listMine()`; HD-008 adds `create()`; HD-009 adds `getById()`;
 * HD-010 (Ticket Detail) adds `patch()`, `addComment()`, `reopen()`,
 * `confirmClose()`, `listComments()`, `listActivity()`; HD-012 (Agent
 * Kanban) adds `listForQueue()`; HD-013 (Admin Dashboard) adds
 * `adminDashboard()` for the `/api/admin/dashboard` endpoint.
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
import type { ActivityLog } from '../models/activity-log';
import type { Comment } from '../models/comment';
import type { Ticket } from '../models/ticket';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../models/enums';
import { apiErrorFrom } from './api-error';

interface ListMineResponse {
  tickets: Ticket[];
  count: number;
}

interface ListForQueueResponse {
  tickets: Ticket[];
  count: number;
}

/**
 * Wire shape returned by GET /api/tickets/stats (HD-019).
 *
 * `counts` carries the five stat-strip numbers (total plus one
 * bucket per status). `dailyCreated` is a fixed-length 60-element
 * series of tickets-created-per-day, oldest-first, **zero-filled** —
 * days with no tickets are explicit `0`s rather than gaps, so the
 * sparkline can plot the series positionally without first
 * normalizing lengths.
 *
 * The 60-day window exists so the summary card's delta can compare
 * the most recent 30 days against the 30 before them ("vs last
 * month"). `previousPeriod` carries that older half's sum.
 */
export interface TicketStats {
  counts: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  dailyCreated: number[];
  /**
   * Tickets created in the 30 days before the most recent 30
   * (HD-021). The stat strip's summary card shows a
   * period-over-period delta computed from this. Optional because
   * an older backend response won't carry it.
   */
  previousPeriod?: number;
}

interface CreateResponse {
  ticket: Ticket;
}

interface GetByIdResponse {
  ticket: Ticket;
}

interface PatchResponse {
  ticket: Ticket;
}

interface AddCommentResponse {
  comment: Comment;
}

interface ListCommentsResponse {
  comments: Comment[];
  count: number;
}

interface ListActivityResponse {
  activity: ActivityLog[];
  count: number;
}

/**
 * Per-bucket shape returned by GET /api/admin/dashboard (HD-013).
 *
 * `rows` is the most-recent N tickets in this status (capped
 * server-side at 14). `total` is the count of every ticket in
 * this status (may exceed rows.length when the queue is larger
 * than the cap). The Admin Dashboard's "Showing N of M" footer
 * is derived from `rows.length` vs `total`.
 */
export interface AdminDashboardBucket {
  rows: Ticket[];
  total: number;
}

/**
 * Wire shape returned by GET /api/admin/dashboard (HD-013).
 *
 * The four status buckets are always present (empty status =
 * `{ rows: [], total: 0 }`). The page never sees a 5th status;
 * a status enum change would have to bump the type signature
 * here AND the backend service in lockstep.
 */
export interface AdminDashboardSummary {
  open: AdminDashboardBucket;
  inProgress: AdminDashboardBucket;
  resolved: AdminDashboardBucket;
  closed: AdminDashboardBucket;
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

/**
 * The body sent to PATCH /api/tickets/:id (HD-010).
 *
 * All fields are optional — at least one must be supplied per the
 * backend validator. The page builds this object from whichever
 * dropdown the agent touched, never sending more than one field
 * per request.
 *
 * Role gating happens server-side: a User submitting `status` /
 * `priority` / `ownerId` gets a 400 `validation_error` envelope.
 * The frontend gates only for UX.
 */
export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory | null;
  ownerId?: number | null;
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
   * GET /api/tickets/queue — every ticket in the system, newest-first
   * (HD-012 Agent Kanban).
   *
   * Support Agent only. The Angular `roleGuard(['Support Agent'])` is
   * the primary gate; if a programmatic client somehow reaches the
   * endpoint, the backend returns 403 and the page falls through to
   * the error render state with a generic message.
   *
   * Mirrors `listMine()` exactly: HttpClient → `firstValueFrom` →
   * response unwrap → `apiErrorFrom` on non-2xx. The page treats a
   * 401 as session-expired (per the auth interceptor's mapping) and
   * 5xx as a generic load failure.
   */
  async listForQueue(): Promise<Ticket[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListForQueueResponse>(
          `${environment.apiBaseUrl}/tickets/queue`,
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

  // ─── HD-010 — Ticket Detail write/read helpers ──────────────────

  /**
   * PATCH /api/tickets/:id — partial update of one or more of
   * status / priority / category / ownerId (HD-010).
   *
   * Returns the updated ticket (with eager-loaded associations).
   * Backend enforces role gates + status-transition rules + writes
   * the matching ActivityLog rows in the same transaction.
   *
   * Throws `ApiError` on:
   *   - 400 + fields for invalid transitions / unknown fields
   *   - 403 if the JWT'd User attempts to change status/priority/ownerId
   *   - 404 for missing or non-visible tickets
   */
  async patch(id: number, payload: UpdateTicketPayload): Promise<Ticket> {
    try {
      const res = await firstValueFrom(
        this.http.patch<PatchResponse>(
          `${environment.apiBaseUrl}/tickets/${id}`,
          payload,
          { withCredentials: true },
        ),
      );
      return res.ticket;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * POST /api/tickets/:id/comments — add a comment (HD-010).
   *
   * Returns the inserted comment with author eager-loaded. Backend
   * also writes a CommentAdded ActivityLog row inside the same tx.
   *
   * Throws `ApiError` on:
   *   - 400 validation_error for empty / too-long body
   *   - 403 if the ticket status is Closed (read-only)
   *   - 404 for missing or non-visible tickets
   */
  async addComment(ticketId: number, body: string): Promise<Comment> {
    try {
      const res = await firstValueFrom(
        this.http.post<AddCommentResponse>(
          `${environment.apiBaseUrl}/tickets/${ticketId}/comments`,
          { body },
          { withCredentials: true },
        ),
      );
      return res.comment;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * POST /api/tickets/:id/reopen — submitter-only Resolved → Open
   * (HD-010).
   *
   * Returns the updated ticket. Throws `ApiError` on:
   *   - 400 if status !== Resolved
   *   - 403 if the JWT'd user isn't the submitter
   *   - 404 for missing or non-visible tickets
   */
  async reopen(id: number): Promise<Ticket> {
    try {
      const res = await firstValueFrom(
        this.http.post<PatchResponse>(
          `${environment.apiBaseUrl}/tickets/${id}/reopen`,
          {},
          { withCredentials: true },
        ),
      );
      return res.ticket;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * POST /api/tickets/:id/confirm-close — submitter-only
   * Resolved → Closed (HD-010).
   *
   * Closed is terminal — once here, the ticket is read-only. The
   * page disables all controls after a successful call.
   *
   * Returns the updated ticket. Throws `ApiError` with the same
   * codes as `reopen`.
   */
  async confirmClose(id: number): Promise<Ticket> {
    try {
      const res = await firstValueFrom(
        this.http.post<PatchResponse>(
          `${environment.apiBaseUrl}/tickets/${id}/confirm-close`,
          {},
          { withCredentials: true },
        ),
      );
      return res.ticket;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * GET /api/tickets/:id/comments — list comments oldest-first
   * (HD-010).
   *
   * The page loads this on init alongside the ticket itself;
   * mutations (addComment) append to the local signal so no
   * refetch is needed.
   *
   * Throws `ApiError` with the same 404 envelope as getById.
   */
  async listComments(ticketId: number): Promise<Comment[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListCommentsResponse>(
          `${environment.apiBaseUrl}/tickets/${ticketId}/comments`,
          { withCredentials: true },
        ),
      );
      return res.comments;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * GET /api/tickets/:id/activity — list activity events
   * newest-first (HD-010).
   *
   * Same load-on-init pattern as `listComments`. The page does NOT
   * refetch this after a mutation; the backend writes the activity
   * row in the same tx as the mutation, but the client trusts the
   * local signal until the user reloads. This keeps the UX simple
   * and matches the spec's "no realtime updates" rule.
   *
   * Throws `ApiError` with the same 404 envelope as getById.
   */
  async listActivity(ticketId: number): Promise<ActivityLog[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListActivityResponse>(
          `${environment.apiBaseUrl}/tickets/${ticketId}/activity`,
          { withCredentials: true },
        ),
      );
      return res.activity;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  // ─── HD-013 — Admin Dashboard summary ───────────────────────────

  /**
   * GET /api/admin/dashboard — Admin-only four-bucket ticket
   * summary (HD-013).
   *
   * Returns `{ open, inProgress, resolved, closed }`, each bucket
   * shaped `{ rows, total }`. The Angular `roleGuard(['Admin'])`
   * is the primary gate; if a programmatic client somehow reaches
   * the endpoint, the backend returns 403 and the page falls through
   * to the error render state.
   *
   * Why a separate endpoint (not reuse listForQueue): the
   * `/api/tickets/queue` endpoint is Support-Agent-only; even if
   * that gate were relaxed, the data shape differs (queue returns
   * a flat list; dashboard returns partitioned + capped). See
   * spec-hd-013-admin-dashboard.md "Why a new endpoint" for
   * the full rationale.
   *
   * Throws `ApiError` on any non-2xx response. Mirrors the
   * `listForQueue()` shape exactly: HttpClient → firstValueFrom →
   * response unwrap → apiErrorFrom on non-2xx.
   */
  async adminDashboard(): Promise<AdminDashboardSummary> {
    try {
      const res = await firstValueFrom(
        this.http.get<AdminDashboardSummary>(
          `${environment.apiBaseUrl}/admin/dashboard`,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  // ─── HD-019 — Tickets list page ──────────────────────────────

  /**
   * GET /api/tickets/list — every ticket, Support Agent + Admin
   * (HD-019 Tickets list page).
   *
   * Returns the same `{ tickets, count }` envelope as
   * `listForQueue()`. The Tickets list page applies search, filter,
   * sort, and pagination client-side; HD-015 will lift that to
   * server-side query params.
   *
   * The backend clamps the payload at 500 tickets; pass `limit`
   * only when a tighter cap is wanted (e.g. initial render before
   * filters narrow the set).
   *
   * Throws `ApiError` on non-2xx. 401 → session-expired (handled
   * by auth interceptor + roleGuard redirect); 403 → caller is not
   * an agent/admin (page should never reach this — `roleGuard` is
   * the primary gate).
   */
  async listAll(limit = 500): Promise<Ticket[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ListForQueueResponse>(
          `${environment.apiBaseUrl}/tickets/list?limit=${encodeURIComponent(String(limit))}`,
          { withCredentials: true },
        ),
      );
      return res.tickets;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * GET /api/tickets/stats — five-bucket counts + a 14-day
   * tickets-created series for the Tickets stat strip
   * (HD-019). Support Agent + Admin only; the controller
   * mirrors `roleGuard(['Support Agent', 'Admin'])` inline as
   * defense in depth.
   *
   * Throws `ApiError` on non-2xx. See `listAll()` for the same
   * error-mapping rationale.
   */
  async stats(): Promise<TicketStats> {
    try {
      const res = await firstValueFrom(
        this.http.get<TicketStats>(
          `${environment.apiBaseUrl}/tickets/stats`,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * GET /api/tickets/stats/mine — the caller's OWN ticket summary
   * (HD-020): the same five counters + 14-day series as `stats()`,
   * but scoped server-side to tickets the JWT'd user submitted.
   *
   * Used by the Employee Dashboard's stat strip. The distinction
   * from `stats()` matters: `stats()` is team-wide and 403s for the
   * User role, whereas this one can never leak another user's
   * tickets because the filter lives in the SQL, not the client.
   *
   * Shares the `TicketStats` type with `stats()` so the `stat-card`
   * and `sparkline` components consume both without branching.
   *
   * Throws `ApiError` on non-2xx — same mapping as `stats()`.
   */
  async statsMine(): Promise<TicketStats> {
    try {
      const res = await firstValueFrom(
        this.http.get<TicketStats>(
          `${environment.apiBaseUrl}/tickets/stats/mine`,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }
}