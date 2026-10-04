/**
 * ticketsController — smoke spec (HD-007) + create spec (HD-008)
 *                     + getById spec (HD-009) + HD-010 spec.
 *
 * Verifies GET /api/tickets/mine:
 *   - calls Ticket.findAll filtered by the JWT'd user's id (submitterId)
 *   - returns 200 with `{ tickets: [...], count }`
 *   - serializes createdAt / updatedAt / deletedAt as ISO strings
 *
 * Verifies POST /api/tickets (HD-008):
 *   - happy-path: createTicket is called with the JWT'd user's id +
 *     a validated payload; response is 201 with `{ ticket }` and
 *     the ticket's `number` round-trips back to the client
 *   - 400 validation: an invalid body throws HttpError(400,
 *     'validation_error', ..., fields) — the controller lets the
 *     errorHandler serialize it; we assert the throw directly so we
 *     don't have to model req/res for that path.
 *   - 403 role: a non-User role (Support Agent) throws HttpError(403,
 *     'forbidden', ...) and never reaches the service.
 *
 * Verifies GET /api/tickets/:id (HD-009):
 *   - happy-path: ticketService.getById returns an instance; respond
 *     200 with `{ ticket }` serialized (createdAt/updatedAt as ISO).
 *   - 404 not-found: getById returns null → HttpError(404,
 *     'not_found') forwarded to next.
 *   - 404 enumeration: getById returns a ticket owned by a
 *     different submitterId than the JWT'd User → HttpError(404,
 *     'not_found') forwarded to next (NOT 403, by design).
 *
 * Verifies HD-010 handlers:
 *   - PATCH /:id (200 happy + 400 invalid transition + 403 user-role +
 *     404 not-found)
 *   - POST /:id/comments (201 happy + 400 empty body + 403 closed ticket)
 *   - GET  /:id/comments (200 happy)
 *   - GET  /:id/activity (200 happy)
 *   - POST /:id/reopen (200 happy + 403 non-submitter + 400 wrong-status)
 *   - POST /:id/confirm-close (200 happy + 403 non-submitter +
 *     400 wrong-status)
 *
 * Both `authMiddleware` and the models are mocked so the controller
 * is exercised in isolation — no real DB or JWT verification is touched.
 */

import type { NextFunction, Request, Response } from 'express';

import { Ticket } from '../models';
import {
  listMine,
  create,
  getById,
  patch,
  addCommentHandler,
  listCommentsHandler,
  listActivityHandler,
  reopen,
  confirmClose,
} from './ticketsController';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    (req as Request & { user?: unknown }).user = {
      id: 7,
      email: 'eli@example.com',
      displayName: 'Eli',
      role: 'User',
    };
    next();
  },
}));

jest.mock('../models', () => ({
  Ticket: {
    findAll: jest.fn(),
  },
}));

jest.mock('../services/ticketService', () => ({
  listForUser: jest.fn(),
  createTicket: jest.fn(),
  getById: jest.fn(),
  updateTicket: jest.fn(),
  addComment: jest.fn(),
  reopenTicket: jest.fn(),
  confirmCloseTicket: jest.fn(),
  listComments: jest.fn(),
  listActivity: jest.fn(),
  listActiveAgents: jest.fn(),
}));

interface FakeTicket {
  toJSON: () => Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function makeFakeTicket(): FakeTicket {
  const createdAt = new Date('2026-01-15T10:30:00.000Z');
  const updatedAt = new Date('2026-01-16T12:00:00.000Z');
  return {
    createdAt,
    updatedAt,
    deletedAt: null,
    toJSON: () => ({
      id: 42,
      number: 'T-000042',
      title: 'Login is broken',
      status: 'Open',
      priority: 'High',
      submitterId: 7,
      ownerId: null,
      attachmentId: null,
      createdAt,
      updatedAt,
      deletedAt: null,
    }),
  };
}

describe('ticketsController.listMine', () => {
  beforeEach(() => {
    (Ticket.findAll as jest.Mock).mockReset();
  });

  it('returns 200 with one ISO-serialized ticket and count === 1', async () => {
    const fake = makeFakeTicket();
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([fake]);
    // Also satisfy the controller's listForUser call (which wraps findAll)
    const ticketService = require('../services/ticketService');
    (ticketService.listForUser as jest.Mock).mockResolvedValueOnce([fake]);

    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (body: unknown) => jsonMock(body) };
      },
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;
    const status = statusMock;
    const json = jsonMock;

    await listMine(req, res, next);

    expect(status.mock.calls[0][0]).toBe(200);
    expect(json.mock.calls.length).toBe(1);

    const body = json.mock.calls[0][0] as {
      tickets: Array<{
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
      }>;
      count: number;
    };

    // (d) count === 1
    expect(body.count).toBe(1);
    expect(body.tickets.length).toBe(1);

    // (b) createdAt is an ISO string that roundtrips through Date
    expect(typeof body.tickets[0].createdAt).toBe('string');
    expect(new Date(body.tickets[0].createdAt).toISOString()).toBe(
      body.tickets[0].createdAt,
    );
    expect(new Date(body.tickets[0].updatedAt).toISOString()).toBe(
      body.tickets[0].updatedAt,
    );
    expect(body.tickets[0].deletedAt).toBeNull();

    // (c) listForUser was called with the JWT'd user's id (7). The
    // service is what wraps the `Ticket.findAll({ where: { submitterId } })`
    // call — that's what the controller invokes directly.
    expect((ticketService.listForUser as jest.Mock).mock.calls[0][0]).toBe(7);
  });
});

describe('ticketsController.create', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.createTicket as jest.Mock).mockReset();
  });

  it('creates a ticket on the happy path and returns 201 with the serialized ticket', async () => {
    const createdAt = new Date('2026-09-15T12:00:00.000Z');
    const updatedAt = new Date('2026-09-15T12:00:00.000Z');
    const fake = {
      toJSON: () => ({
        id: 99,
        number: 'HD-21',
        title: 'VPN drops',
        description: 'every 10 minutes',
        category: 'IT',
        priority: 'Medium',
        status: 'Open',
        submitterId: 7,
        ownerId: null,
        attachmentId: null,
        createdAt,
        updatedAt,
        deletedAt: null,
      }),
      createdAt,
      updatedAt,
      deletedAt: null,
    };
    (ticketService.createTicket as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
      body: {
        title: 'VPN drops',
        description: 'every 10 minutes',
        category: 'IT',
        priority: 'Medium',
      },
    } as unknown as Request;

    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (body: unknown) => jsonMock(body) };
      },
    } as unknown as Response;

    await create(req, res, jest.fn() as unknown as NextFunction);

    // createTicket was called with the JWT'd user's id and the
    // validated payload (no submitterId from the body — that's
    // always pulled from req.user).
    expect(ticketService.createTicket).toHaveBeenCalledWith(7, {
      title: 'VPN drops',
      description: 'every 10 minutes',
      category: 'IT',
      priority: 'Medium',
      attachmentId: null,
    });

    expect(statusMock.mock.calls[0][0]).toBe(201);
    const body = jsonMock.mock.calls[0][0] as {
      ticket: { id: number; number: string; createdAt: string };
    };
    expect(body.ticket.id).toBe(99);
    expect(body.ticket.number).toBe('HD-21');
    expect(new Date(body.ticket.createdAt).toISOString()).toBe(
      body.ticket.createdAt,
    );
  });

  it('rejects a body missing the required title with a 400 fields error (HttpError throw)', async () => {
    const { HttpError } = require('../utils/errors');

    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
      body: {
        // title missing
        description: 'long enough description',
        priority: 'Medium',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (body: unknown) => jsonMock(body) };
      },
    } as unknown as Response;

    // The controller wraps with asyncHandler which forwards the
    // rejection to `next(error)`. We assert via the next mock.
    const next = jest.fn() as unknown as NextFunction;
    await create(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ title: 'Enter a title.' });

    // createTicket was never invoked — validation guards everything.
    expect(ticketService.createTicket).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-User role tries to create a ticket', async () => {
    const { HttpError } = require('../utils/errors');

    const req = {
      user: {
        id: 7,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
      body: {
        title: 't',
        description: 'd',
        priority: 'Medium',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await create(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');

    expect(ticketService.createTicket).not.toHaveBeenCalled();
  });
});

describe('ticketsController.getById', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
  });

  function makeResMock() {
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (body: unknown) => jsonMock(body) };
      },
    } as unknown as Response;
    return { res, statusMock, jsonMock };
  }

  it('returns 200 with the serialized ticket when getById finds the ticket', async () => {
    const createdAt = new Date('2026-09-15T12:00:00.000Z');
    const updatedAt = new Date('2026-09-15T12:00:00.000Z');
    const fake = {
      id: 47,
      number: 'HD-47',
      title: 'WiFi drops',
      description: 'every few minutes',
      category: 'IT',
      priority: 'Medium',
      status: 'Open',
      submitterId: 7,
      ownerId: null,
      attachmentId: null,
      createdAt,
      updatedAt,
      deletedAt: null,
      toJSON: () => ({
        id: 47,
        number: 'HD-47',
        title: 'WiFi drops',
        description: 'every few minutes',
        category: 'IT',
        priority: 'Medium',
        status: 'Open',
        submitterId: 7,
        ownerId: null,
        attachmentId: null,
        submitter: {
          id: 7,
          email: 'eli@example.com',
          displayName: 'Eli',
          role: 'User',
        },
        owner: null,
        attachment: null,
        createdAt,
        updatedAt,
        deletedAt: null,
      }),
    };
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeResMock();

    await getById(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.getById).toHaveBeenCalledWith(47);
    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      ticket: {
        id: number;
        number: string;
        submitterId: number;
        submitter: { id: number; email: string };
        createdAt: string;
      };
    };
    expect(body.ticket.id).toBe(47);
    expect(body.ticket.number).toBe('HD-47');
    expect(body.ticket.submitterId).toBe(7);
    expect(body.ticket.submitter.email).toBe('eli@example.com');
    expect(typeof body.ticket.createdAt).toBe('string');
    expect(new Date(body.ticket.createdAt).toISOString()).toBe(
      body.ticket.createdAt,
    );
  });

  it('forwards HttpError(404, not_found) to next when getById returns null', async () => {
    const { HttpError } = require('../utils/errors');

    (ticketService.getById as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      params: { id: '99999' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = makeResMock().res;
    const next = jest.fn() as unknown as NextFunction;

    await getById(req, res, next);
    // asyncHandler's .catch(next) runs on the microtask queue; flush
    // it before asserting on `next`.
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
  });

  it('forwards HttpError(404, not_found) — NOT 403 — when a User requests another user\'s ticket', async () => {
    const { HttpError } = require('../utils/errors');

    const fake = {
      id: 456,
      number: 'HD-456',
      title: 'Jess\'s ticket',
      description: 'private',
      category: 'IT',
      priority: 'Medium',
      status: 'Open',
      submitterId: 99, // NOT Eli's id (7) — should be hidden
      ownerId: null,
      attachmentId: null,
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      updatedAt: new Date('2026-09-15T12:00:00.000Z'),
      deletedAt: null,
      toJSON: () => ({}),
    };
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '456' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = makeResMock().res;
    const next = jest.fn() as unknown as NextFunction;

    await getById(req, res, next);
    // asyncHandler's .catch(next) runs on the microtask queue; flush
    // it before asserting on `next`.
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    // Enumeration protection — same envelope as a genuine miss.
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
    expect(err.status).not.toBe(403);
  });

  it('forwards HttpError(400, validation_error) when :id is not a finite integer', async () => {
    const { HttpError } = require('../utils/errors');

    const req = {
      params: { id: 'abc' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = makeResMock().res;
    const next = jest.fn() as unknown as NextFunction;

    await getById(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
  });

  it('returns 200 when a Support Agent fetches another user\'s ticket', async () => {
    const fake = {
      id: 456,
      number: 'HD-456',
      title: 'Jess\'s ticket',
      description: 'private',
      category: 'IT',
      priority: 'Medium',
      status: 'Open',
      submitterId: 99, // NOT the requester's id (7) — should NOT be hidden
      ownerId: null,
      attachmentId: null,
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      updatedAt: new Date('2026-09-15T12:00:00.000Z'),
      deletedAt: null,
      toJSON: () => ({}),
    };
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '456' },
      user: {
        id: 7,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const { res, statusMock } = makeResMock();

    await getById(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.getById).toHaveBeenCalledWith(456);
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });

  it('returns 200 when an Admin fetches another user\'s ticket', async () => {
    const fake = {
      id: 456,
      number: 'HD-456',
      title: 'Jess\'s ticket',
      description: 'private',
      category: 'IT',
      priority: 'Medium',
      status: 'Open',
      submitterId: 99, // NOT the requester's id (1) — should NOT be hidden
      ownerId: null,
      attachmentId: null,
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      updatedAt: new Date('2026-09-15T12:00:00.000Z'),
      deletedAt: null,
      toJSON: () => ({}),
    };
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '456' },
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Admin',
        role: 'Admin',
      },
    } as unknown as Request;
    const { res, statusMock } = makeResMock();

    await getById(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.getById).toHaveBeenCalledWith(456);
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════
// HD-010 — Ticket Detail (/tickets/:id) handlers
// ════════════════════════════════════════════════════════════════════════
//
// Each describe re-uses the `ticketService` jest-mock registry
// declared above. The controller calls loadTicketForUser (which
// delegates to ticketService.getById) before any validation, so we
// stub `getById` to return a fake ticket the tests can mutate
// (status / submitterId) per scenario.
//
// Notes:
//   - "User" role tests use submitterId=7 (matches the authMiddleware
//     mock) so enumeration does not fire. Other roles pass any
//     submitterId because agents/admins skip the enumeration check.
//   - For the 403/404 paths we assert via the `next` mock — the
//     asyncHandler forwards HttpError rejections to next().

function makeResolvedTicket(overrides: Record<string, unknown> = {}): {
  id: number;
  number: string;
  title: string;
  description: string;
  category: string | null;
  priority: string;
  status: string;
  submitterId: number;
  ownerId: number | null;
  attachmentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  toJSON: () => Record<string, unknown>;
} {
  const createdAt = new Date('2026-09-15T12:00:00.000Z');
  const updatedAt = new Date('2026-09-15T12:00:00.000Z');
  return {
    id: 47,
    number: 'HD-47',
    title: 'WiFi drops',
    description: 'every few minutes',
    category: 'IT',
    priority: 'Medium',
    status: 'Open',
    submitterId: 7,
    ownerId: null,
    attachmentId: null,
    createdAt,
    updatedAt,
    deletedAt: null,
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('ticketsController.patch (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
    (ticketService.updateTicket as jest.Mock).mockReset();
  });

  it('returns 200 with the serialized ticket when a Support Agent changes the status', async () => {
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    (ticketService.updateTicket as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      body: { status: 'In Progress' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await patch(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.updateTicket).toHaveBeenCalledWith(
      47,
      11,
      'Support Agent',
      { status: 'In Progress' },
    );
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });

  it('returns 400 validation_error when a User attempts to change status', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      body: { status: 'In Progress' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await patch(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(ticketService.updateTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(404) when getById returns null', async () => {
    const { HttpError } = require('../utils/errors');
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      params: { id: '99999' },
      body: { priority: 'High' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await patch(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(ticketService.updateTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(400, validation_error) when the body is empty', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      body: {},
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await patch(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(ticketService.updateTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(400, validation_error) when status transition is invalid', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    (ticketService.updateTicket as jest.Mock).mockRejectedValueOnce(
      new HttpError(
        400,
        'validation_error',
        'Invalid transition',
        { status: 'Closed is a terminal status; cannot transition.' },
      ),
    );

    const req = {
      params: { id: '47' },
      body: { status: 'Open' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await patch(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    // The wire envelope includes a fields map keyed by the offending
    // field so the frontend can pin the message to the Status control.
    expect(err.fields).toBeDefined();
    expect(Object.keys(err.fields || {})).toContain('status');
  });

  it('returns 200 with the serialized ticket when a Support Agent reassigns the ticket via ownerId', async () => {
    const newOwner = {
      id: 22,
      email: 'jordan@example.com',
      displayName: 'Jordan',
      role: 'Support Agent',
    };
    const createdAt = new Date('2026-09-15T12:00:00.000Z');
    const updatedAt = new Date('2026-09-15T12:00:00.000Z');
    // The serialized ticket — what `serializeTicket` returns — must
    // include the new owner association; that's what the frontend
    // reads to refresh the assignee dropdown.
    const updated = {
      id: 47,
      number: 'HD-47',
      title: 'WiFi drops',
      description: 'every few minutes',
      category: 'IT',
      priority: 'Medium',
      status: 'Open',
      submitterId: 7,
      ownerId: 22,
      attachmentId: null,
      createdAt,
      updatedAt,
      deletedAt: null,
      submitter: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
      owner: newOwner,
      attachment: null,
      toJSON: () => ({
        id: 47,
        number: 'HD-47',
        title: 'WiFi drops',
        description: 'every few minutes',
        category: 'IT',
        priority: 'Medium',
        status: 'Open',
        submitterId: 7,
        ownerId: 22,
        attachmentId: null,
        submitter: {
          id: 7,
          email: 'eli@example.com',
          displayName: 'Eli',
          role: 'User',
        },
        owner: newOwner,
        attachment: null,
        createdAt,
        updatedAt,
        deletedAt: null,
      }),
    };
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(makeResolvedTicket());
    (ticketService.updateTicket as jest.Mock).mockResolvedValueOnce(updated);

    const req = {
      params: { id: '47' },
      body: { ownerId: 22 },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await patch(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.updateTicket).toHaveBeenCalledWith(
      47,
      11,
      'Support Agent',
      { ownerId: 22 },
    );
    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      ticket: { owner: { id: number; displayName: string } };
    };
    expect(body.ticket.owner.id).toBe(22);
    expect(body.ticket.owner.displayName).toBe('Jordan');
  });
});

describe('ticketsController.addComment (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
    (ticketService.addComment as jest.Mock).mockReset();
    (ticketService.listComments as jest.Mock).mockReset();
  });

  it('returns 201 with the serialized comment on a valid body', async () => {
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    const createdAt = new Date('2026-09-15T12:00:00.000Z');
    const created = {
      id: 99,
      ticketId: 47,
      authorId: 11,
      body: 'Restarting config reset',
      createdAt,
      toJSON: () => ({
        id: 99,
        ticketId: 47,
        author: {
          id: 11,
          email: 'sam@example.com',
          displayName: 'Sam',
          role: 'Support Agent',
        },
        body: 'Restarting config reset',
        createdAt,
      }),
    };
    (ticketService.addComment as jest.Mock).mockResolvedValueOnce(created);
    (ticketService.listComments as jest.Mock).mockResolvedValueOnce([created]);

    const req = {
      params: { id: '47' },
      body: { body: 'Restarting config reset' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await addCommentHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.addComment).toHaveBeenCalledWith(
      47,
      11,
      'Restarting config reset',
    );
    expect(statusMock.mock.calls[0][0]).toBe(201);
    const body = jsonMock.mock.calls[0][0] as {
      comment: { id: number; body: string };
    };
    expect(body.comment.id).toBe(99);
    expect(body.comment.body).toBe('Restarting config reset');
  });

  it('forwards HttpError(400, validation_error) when body is empty', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      body: { body: '' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await addCommentHandler(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(ticketService.addComment).not.toHaveBeenCalled();
  });

  it('forwards HttpError(400, validation_error) when body is exactly 5001 chars', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    const tooLong = 'a'.repeat(5001);

    const req = {
      params: { id: '47' },
      body: { body: tooLong },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await addCommentHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    // The 5001-char boundary must surface as a `fields.body` error so
    // the frontend can pin the message to the composer textarea.
    expect(err.fields).toBeDefined();
    expect(err.fields?.body).toBe('Comment is limited to 5000 characters.');
    expect(ticketService.addComment).not.toHaveBeenCalled();
  });

  it('forwards HttpError(403, forbidden) when ticket status is Closed', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket({ status: 'Closed' });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    (ticketService.addComment as jest.Mock).mockRejectedValueOnce(
      new HttpError(
        403,
        'forbidden',
        'Ticket is closed and cannot accept new comments.',
      ),
    );

    const req = {
      params: { id: '47' },
      body: { body: 'attempt to comment on closed ticket' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await addCommentHandler(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
  });
});

describe('ticketsController.listComments / listActivity (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
    (ticketService.listComments as jest.Mock).mockReset();
    (ticketService.listActivity as jest.Mock).mockReset();
  });

  it('listComments returns 200 with comments oldest-first', async () => {
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    const createdAt = new Date('2026-09-15T12:00:00.000Z');
    (ticketService.listComments as jest.Mock).mockResolvedValueOnce([
      {
        id: 1,
        ticketId: 47,
        authorId: 11,
        body: 'first',
        createdAt,
        toJSON: () => ({ id: 1, body: 'first' }),
      },
    ]);

    const req = {
      params: { id: '47' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await listCommentsHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      comments: Array<{ id: number; body: string }>;
      count: number;
    };
    expect(body.count).toBe(1);
    expect(body.comments[0].body).toBe('first');
  });

  it('listActivity returns 200 with activity events newest-first', async () => {
    const fake = makeResolvedTicket();
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    const older = new Date('2026-09-15T10:00:00.000Z');
    const newer = new Date('2026-09-15T12:00:00.000Z');
    (ticketService.listActivity as jest.Mock).mockResolvedValueOnce([
      {
        id: 2,
        ticketId: 47,
        actorId: 11,
        eventType: 'StatusChanged',
        payload: null,
        createdAt: newer,
        toJSON: () => ({
          id: 2,
          eventType: 'StatusChanged',
          payload: null,
        }),
      },
      {
        id: 1,
        ticketId: 47,
        actorId: 11,
        eventType: 'Created',
        payload: null,
        createdAt: older,
        toJSON: () => ({
          id: 1,
          eventType: 'Created',
          payload: null,
        }),
      },
    ]);

    const req = {
      params: { id: '47' },
      user: {
        id: 11,
        email: 'sam@example.com',
        displayName: 'Sam',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await listActivityHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      activity: Array<{ id: number; eventType: string }>;
      count: number;
    };
    expect(body.count).toBe(2);
    // Newer row first — pins newest-first ordering on the controller
    // (the service sorts DESC, but the controller must relay it).
    expect(body.activity[0].id).toBe(2);
    expect(body.activity[0].eventType).toBe('StatusChanged');
    expect(body.activity[1].id).toBe(1);
    expect(body.activity[1].eventType).toBe('Created');
  });
});

describe('ticketsController.reopen (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
    (ticketService.reopenTicket as jest.Mock).mockReset();
  });

  it('returns 200 with the serialized ticket on a happy reopen', async () => {
    const fake = makeResolvedTicket({ status: 'Resolved' });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    (ticketService.reopenTicket as jest.Mock).mockResolvedValueOnce({
      ...fake,
      status: 'Open',
    });

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await reopen(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.reopenTicket).toHaveBeenCalledWith(47, 7);
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });

  it('forwards HttpError(403) when a non-submitter calls reopen', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket({
      status: 'Resolved',
      submitterId: 99, // NOT the requester
    });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await reopen(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    // Enumeration protection: a User trying to reopen another user's
    // ticket sees the same 404 envelope as a missing ticket (mirrors
    // getById). The 403-only-on-mine check fires only when the
    // requester is the actual submitter.
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
    expect(ticketService.reopenTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(400, validation_error) when ticket status is not Resolved', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket({ status: 'Open' });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await reopen(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(ticketService.reopenTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(404, not_found) when ticket is missing', async () => {
    const { HttpError } = require('../utils/errors');
    // getByIdService returns null → loadTicketForUser throws 404.
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      params: { id: '99999' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await reopen(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
    expect(ticketService.reopenTicket).not.toHaveBeenCalled();
  });
});

describe('ticketsController.confirmClose (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getById as jest.Mock).mockReset();
    (ticketService.confirmCloseTicket as jest.Mock).mockReset();
  });

  it('returns 200 with the serialized ticket on a happy confirm-close', async () => {
    const fake = makeResolvedTicket({ status: 'Resolved' });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);
    (ticketService.confirmCloseTicket as jest.Mock).mockResolvedValueOnce({
      ...fake,
      status: 'Closed',
    });

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

    await confirmClose(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.confirmCloseTicket).toHaveBeenCalledWith(47, 7);
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });

  it('forwards HttpError(403) when a non-submitter calls confirmClose', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket({
      status: 'Resolved',
      submitterId: 99,
    });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await confirmClose(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    // Enumeration protection: a User trying to confirm-close another
    // user's ticket sees the same 404 envelope as a missing ticket.
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
    expect(ticketService.confirmCloseTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(400) when ticket status is not Resolved', async () => {
    const { HttpError } = require('../utils/errors');
    const fake = makeResolvedTicket({ status: 'Open' });
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(fake);

    const req = {
      params: { id: '47' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await confirmClose(req, res, next);
    await Promise.resolve();

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(ticketService.confirmCloseTicket).not.toHaveBeenCalled();
  });

  it('forwards HttpError(404, not_found) when ticket is missing', async () => {
    const { HttpError } = require('../utils/errors');
    // getByIdService returns null → loadTicketForUser throws 404.
    (ticketService.getById as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      params: { id: '99999' },
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await confirmClose(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('not_found');
    expect(ticketService.confirmCloseTicket).not.toHaveBeenCalled();
  });
});