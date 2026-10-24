/**
 * notificationsController — HD-019 spec.
 *
 *   GET  /          list:  200 returns items + unreadCount
 *                            200 limit clamped to MAX_LIMIT
 *                            (no auth → guarded by authMiddleware upstream)
 *   POST /:id/read  markRead: 200 flips a single row
 *                            400 invalid id (non-integer / <= 0)
 *                            404 wrong owner OR missing (indistinguishable)
 *   POST /read-all  markAllRead: 200 zeros the unread count
 *                                  for the caller only
 *
 * `authMiddleware` is mocked to inject a default test user (id=4,
 * Eli). The Notification model is mocked at module scope so the
 * tests don't need a live database — the intent is the controller's
 * behavior, not the storage layer.
 */

import type { NextFunction, Request, Response } from 'express';

import {
  list,
  markRead,
  markAllRead,
} from './notificationsController';
import { Notification } from '../models';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    (req as Request & { user?: unknown }).user = {
      id: 4,
      email: 'eli@company.com',
      displayName: 'Eli Tanaka',
      role: 'Support Agent',
    };
    next();
  },
}));

function makeResMock(): {
  res: Response;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} {
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

function makeReq(overrides: {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
} = {}): Request {
  return {
    user: {
      id: 4,
      email: 'eli@company.com',
      displayName: 'Eli Tanaka',
      role: 'Support Agent',
    },
    params: overrides.params ?? {},
    query: overrides.query ?? {},
  } as unknown as Request;
}

describe('notificationsController.list', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns items + unreadCount for the caller', async () => {
    const item = {
      id: 1,
      type: 'ticket_assigned',
      title: 't1',
      body: null,
      ticketId: null,
      actorId: 2,
      readAt: null,
      createdAt: new Date('2026-10-21T10:00:00Z'),
      updatedAt: new Date('2026-10-21T10:00:00Z'),
      toJSON() {
        return {
          id: 1,
          type: 'ticket_assigned',
          title: 't1',
          body: null,
          ticketId: null,
          readAt: null,
          actor: { id: 2, displayName: 'Sam' },
        };
      },
    };

    jest
      .spyOn(Notification, 'findAll')
      .mockResolvedValue([item] as unknown as never);
    jest.spyOn(Notification, 'count').mockResolvedValue(2);

    const req = makeReq();
    const { res, statusMock, jsonMock } = makeResMock();

    await list(req, res, jest.fn() as NextFunction);

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const jsonArgs = jsonMock.mock.calls[0][0] as {
      unreadCount: number;
      items: unknown[];
    };
    expect(jsonArgs.unreadCount).toBe(2);
    expect(jsonArgs.items.length).toBe(1);

    // Verify the findAll predicate scopes to the caller (userId=4)
    const findArgs = (Notification.findAll as jest.Mock).mock.calls[0][0];
    expect(findArgs.where).toEqual({ userId: 4 });
    expect(findArgs.order).toEqual([['createdAt', 'DESC']]);
  });

  it('clamps a too-large limit', async () => {
    jest.spyOn(Notification, 'findAll').mockResolvedValue([]);
    jest.spyOn(Notification, 'count').mockResolvedValue(0);

    const req = makeReq({ query: { limit: '99999' } });
    const { res, statusMock } = makeResMock();

    await list(req, res, jest.fn() as NextFunction);

    // MAX_LIMIT is 50 — call should have used a sane limit, not 99999
    const callArgs = (Notification.findAll as jest.Mock).mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(50);
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });
});

describe('notificationsController.markRead', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('marks read for the owner', async () => {
    const updateSpy = jest
      .spyOn(Notification, 'update')
      .mockResolvedValue([1] as never);

    const req = makeReq({ params: { id: '7' } });
    const { res, statusMock } = makeResMock();

    await markRead(req, res, jest.fn() as NextFunction);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [setArg, whereArg] = updateSpy.mock.calls[0] as [
      { readAt: Date },
      { where: { id: number; userId: number } },
    ];
    expect(setArg.readAt).toBeInstanceOf(Date);
    expect(whereArg.where).toEqual({ id: 7, userId: 4 });
    expect(statusMock.mock.calls[0][0]).toBe(200);
  });

  it('rejects non-numeric id with 400', async () => {
    const req = makeReq({ params: { id: 'abc' } });
    const next = jest.fn();

    await markRead(req, makeResMock().res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0] as { status: number };
    expect(err.status).toBe(400);
  });

  it('returns 404 when zero rows match (wrong owner or missing)', async () => {
    jest.spyOn(Notification, 'update').mockResolvedValue([0] as never);

    const req = makeReq({ params: { id: '99' } });
    const next = jest.fn();

    await markRead(req, makeResMock().res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0] as { status: number };
    expect(err.status).toBe(404);
  });
});

describe('notificationsController.markAllRead', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sweeps to the caller only and returns count', async () => {
    const updateSpy = jest
      .spyOn(Notification, 'update')
      .mockResolvedValue([3] as never);

    const req = makeReq();
    const { res, statusMock, jsonMock } = makeResMock();

    await markAllRead(req, res, jest.fn() as NextFunction);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [setArg, whereArg] = updateSpy.mock.calls[0] as [
      { readAt: Date },
      { where: { userId: number; readAt: null } },
    ];
    expect(setArg.readAt).toBeInstanceOf(Date);
    expect(whereArg.where).toEqual({ userId: 4, readAt: null });
    expect(statusMock.mock.calls[0][0]).toBe(200);
    expect((jsonMock.mock.calls[0][0] as { updated: number }).updated).toBe(
      3,
    );
  });
});