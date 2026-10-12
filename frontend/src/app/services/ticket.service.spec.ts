/**
 * TicketService — service spec.
 *
 * Pins the read + write contract for the comment-related
 * methods (HD-010 / HD-017) and the activity-log refetch
 * (HD-017). Also covers the most-trafficked other methods
 * (`getById`, `listComments`) so the spec acts as a working
 * documentation of the wire shape.
 *
 * Methods covered:
 *   - addComment:  POST /api/tickets/:id/comments
 *   - listComments: GET /api/tickets/:id/comments
 *   - listActivity: GET /api/tickets/:id/activity
 *   - getById:     GET /api/tickets/:id
 *
 * HttpClient is exercised through HttpTestingController. The
 * `authInterceptor` is NOT registered here — this spec tests
 * the service's wire contract (URL, method, body, response
 * unwrap, ApiError conversion), not the interceptor itself.
 * The interceptor has its own coverage in `auth.interceptor`'s
 * callers (login page, ticket detail). The `withCredentials`
 * stamp is asserted via the captured request.
 *
 * This mirrors `user.service.spec.ts` (HD-014), which uses
 * the same `provideHttpClient(withInterceptorsFromDi())` +
 * `provideHttpClientTesting` setup.
 */

import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { TicketService } from './ticket.service';
import { ApiError } from './api-error';
import { environment } from '../../environments/environment';
import type { Comment } from '../models/comment';
import type { ActivityLog } from '../models/activity-log';
import type { Ticket } from '../models/ticket';
import type { UserPublic } from '../models/user';

const baseUser = (overrides: Partial<UserPublic> = {}): UserPublic => ({
  id: 1,
  email: 'sam@example.com',
  displayName: 'Sam',
  role: 'User',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const baseComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 99,
  ticketId: 47,
  author: baseUser(),
  body: 'Restarting the laptop now.',
  createdAt: '2026-09-15T10:00:00.000Z',
  ...overrides,
});

const baseTicket = (overrides: Partial<Ticket> = {}): Ticket => {
  // Ticket shape is large; we only need a minimal stub for the
  // tests that exercise getById's wire contract.
  const base: Ticket = {
    id: 47,
    number: 'HD-47',
    title: 'VPN drops hourly',
    description: 'since the office wifi swap',
    category: 'IT',
    priority: 'High',
    status: 'Open',
    submitter: baseUser(),
    owner: null,
    attachment: null,
    createdAt: '2026-09-15T09:00:00.000Z',
    updatedAt: '2026-09-15T09:00:00.000Z',
    deletedAt: null,
  };
  return { ...base, ...overrides };
};

const baseActivity = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 7,
  ticketId: 47,
  eventType: 'CommentAdded',
  actor: baseUser(),
  payload: { eventType: 'CommentAdded', commentId: 99 },
  createdAt: '2026-09-15T10:00:00.000Z',
  ...overrides,
});

describe('TicketService', () => {
  let service: TicketService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        TicketService,
      ],
    });
    service = TestBed.inject(TicketService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('addComment (HD-017 pin)', () => {
    it('POSTs /api/tickets/:id/comments with { body } and unwraps { comment } on 201', async () => {
      const created = baseComment({ id: 123, body: 'hello' });
      const p = service.addComment(47, 'hello');

      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/comments`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({ body: 'hello' });

      req.flush({ comment: created });
      const result = await p;
      expect(result).toEqual(created);
    });

    it('throws ApiError(400, validation_error) with fields.body for an empty body', async () => {
      const p = service.addComment(47, '');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/comments`,
      );
      req.flush(
        {
          error: 'validation_error',
          message: 'Please correct the highlighted fields.',
          fields: { body: 'Comment body is required.' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).errorCode).toBe('validation_error');
        expect((err as ApiError).fields).toEqual({
          body: 'Comment body is required.',
        });
      }
    });

    it('throws ApiError(403) when the ticket is Closed (read-only)', async () => {
      const p = service.addComment(47, 'any body');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/comments`,
      );
      req.flush(
        { error: 'forbidden', message: 'This ticket is closed.' },
        { status: 403, statusText: 'Forbidden' },
      );
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
        expect((err as ApiError).errorCode).toBe('forbidden');
      }
    });

    it('throws ApiError(404) for a missing ticket', async () => {
      const p = service.addComment(9999, 'any body');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/9999/comments`,
      );
      req.flush(
        { error: 'not_found', message: 'Ticket not found.' },
        { status: 404, statusText: 'Not Found' },
      );
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('throws ApiError(401) on an unauthenticated request', async () => {
      const p = service.addComment(47, 'hello');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/comments`,
      );
      req.flush(
        { error: 'unauthenticated', message: 'No session.' },
        { status: 401, statusText: 'Unauthorized' },
      );
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });
  });

  describe('listComments', () => {
    it('GETs /api/tickets/:id/comments and unwraps { comments, count }', async () => {
      const comments = [baseComment({ id: 1 }), baseComment({ id: 2, body: 'second' })];
      const p = service.listComments(47);

      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/comments`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ comments, count: comments.length });

      const result = await p;
      expect(result).toEqual(comments);
    });
  });

  describe('listActivity (HD-017 refetch target)', () => {
    it('GETs /api/tickets/:id/activity and unwraps { activity, count }', async () => {
      const activity = [
        baseActivity({ id: 1, eventType: 'Created' }),
        baseActivity({ id: 2, eventType: 'CommentAdded' }),
      ];
      const p = service.listActivity(47);

      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/activity`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ activity, count: activity.length });

      const result = await p;
      expect(result).toEqual(activity);
    });

    it('returns an empty array when the ticket has no activity', async () => {
      const p = service.listActivity(47);
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/tickets/47/activity`,
      );
      req.flush({ activity: [], count: 0 });

      const result = await p;
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('GETs /api/tickets/:id and unwraps { ticket }', async () => {
      const ticket = baseTicket({ status: 'In Progress' });
      const p = service.getById(47);

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/tickets/47`);
      expect(req.request.method).toBe('GET');
      req.flush({ ticket });

      const result = await p;
      expect(result).toEqual(ticket);
    });
  });
});
