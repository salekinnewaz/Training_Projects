/**
 * ticketsController — smoke spec (HD-007).
 *
 * Verifies GET /api/tickets/mine:
 *   - calls Ticket.findAll filtered by the JWT'd user's id (submitterId)
 *   - returns 200 with `{ tickets: [...], count }`
 *   - serializes createdAt / updatedAt / deletedAt as ISO strings
 *
 * Both `authMiddleware` and `Ticket.findAll` are mocked so the
 * controller is exercised in isolation — no real DB or JWT
 * verification is touched.
 */

import type { NextFunction, Request, Response } from 'express';

import { Ticket } from '../models';
import { listMine } from './ticketsController';

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
