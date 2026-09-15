/**
 * ticketsController — smoke spec (HD-007) + create spec (HD-008).
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
 * Both `authMiddleware` and the models are mocked so the controller
 * is exercised in isolation — no real DB or JWT verification is touched.
 */

import type { NextFunction, Request, Response } from 'express';

import { Ticket } from '../models';
import { listMine, create } from './ticketsController';

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