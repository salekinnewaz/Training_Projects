/**
 * adminController — smoke spec (HD-013).
 *
 * Verifies GET /api/admin/dashboard:
 *   - 200 happy path: getDashboardSummary service helper is called;
 *     response is the four-bucket shape with per-bucket
 *     `{ rows, total }`. Newest-first ordering and per-bucket cap
 *     are owned by the service (covered in ticketService.spec);
 *     the controller is verified here to relay that shape verbatim
 *     after running each row through `serializeTicket` (so
 *     `createdAt` is an ISO string).
 *   - 403 role: a non-Admin role throws HttpError(403, 'forbidden',
 *     ...) and never reaches the service.
 *
 * `authMiddleware` and the models are mocked so the controller is
 * exercised in isolation — no real DB or JWT verification is touched.
 */

import type { NextFunction, Request, Response } from 'express';

import { getDashboardHandler } from './adminController';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    (req as Request & { user?: unknown }).user = {
      id: 1,
      email: 'admin@example.com',
      displayName: 'Avery',
      role: 'Admin',
    };
    next();
  },
}));

jest.mock('../services/ticketService', () => ({
  getDashboardSummary: jest.fn(),
}));

function makeFakeTicket(
  id: number,
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed',
  createdAt: Date,
): {
  id: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: null;
  toJSON: () => Record<string, unknown>;
} {
  return {
    id,
    status,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    toJSON: () => ({
      id,
      status,
      submitter: {
        id: 1,
        email: 'avery@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      owner: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    }),
  };
}

describe('adminController.getDashboardHandler (HD-013)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.getDashboardSummary as jest.Mock).mockReset();
  });

  it('returns 200 with the four-bucket summary when the caller is an Admin', async () => {
    const t1 = makeFakeTicket(1, 'Open', new Date('2026-09-15T12:00:00.000Z'));
    const t2 = makeFakeTicket(2, 'In Progress', new Date('2026-09-14T12:00:00.000Z'));
    const t3 = makeFakeTicket(3, 'Resolved', new Date('2026-09-13T12:00:00.000Z'));
    const t4 = makeFakeTicket(4, 'Closed', new Date('2026-09-12T12:00:00.000Z'));

    (ticketService.getDashboardSummary as jest.Mock).mockResolvedValueOnce({
      open: { rows: [t1], total: 11 },
      inProgress: { rows: [t2], total: 5 },
      resolved: { rows: [t3], total: 4 },
      closed: { rows: [t4], total: 3 },
    });

    const req = {
      user: {
        id: 1,
        email: 'avery@example.com',
        displayName: 'Avery',
        role: 'Admin',
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

    await getDashboardHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.getDashboardSummary).toHaveBeenCalledWith();
    expect(statusMock.mock.calls[0][0]).toBe(200);

    const body = jsonMock.mock.calls[0][0] as {
      open: { rows: Array<{ id: number; createdAt: string }>; total: number };
      inProgress: { rows: Array<{ id: number; createdAt: string }>; total: number };
      resolved: { rows: Array<{ id: number; createdAt: string }>; total: number };
      closed: { rows: Array<{ id: number; createdAt: string }>; total: number };
    };

    // Each bucket present, with both rows and total.
    expect(body.open.total).toBe(11);
    expect(body.open.rows.length).toBe(1);
    expect(body.open.rows[0].id).toBe(1);
    expect(typeof body.open.rows[0].createdAt).toBe('string');
    expect(new Date(body.open.rows[0].createdAt).toISOString()).toBe(
      body.open.rows[0].createdAt,
    );

    expect(body.inProgress.total).toBe(5);
    expect(body.inProgress.rows[0].id).toBe(2);

    expect(body.resolved.total).toBe(4);
    expect(body.resolved.rows[0].id).toBe(3);

    expect(body.closed.total).toBe(3);
    expect(body.closed.rows[0].id).toBe(4);
  });

  it('returns 403 forbidden when the caller is a User (not an Admin)', async () => {
    const { HttpError } = require('../utils/errors');

    const req = {
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

    await getDashboardHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
    expect(ticketService.getDashboardSummary).not.toHaveBeenCalled();
  });

  it('returns 403 forbidden when the caller is a Support Agent (Admin only)', async () => {
    const { HttpError } = require('../utils/errors');

    const req = {
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

    await getDashboardHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
    expect(ticketService.getDashboardSummary).not.toHaveBeenCalled();
  });
});
