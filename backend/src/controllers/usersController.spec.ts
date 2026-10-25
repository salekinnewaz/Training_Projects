/**
 * usersController — HD-010 + HD-014 spec.
 *
 * HD-010 (already shipped): `listActiveAgents` happy path + empty
 * list path.
 *
 * HD-014 extends the file with three handlers and a similar
 * matrix for each:
 *
 *   GET  /              — listAllHandler:
 *                          200 happy path (5 users alphabetical,
 *                          serializes the UserPublic wire shape);
 *                          403 for User; 403 for Support Agent.
 *
 *   PUT  /:id/role      — setRoleHandler:
 *                          200 happy path (Admin → Support Agent
 *                          for another user);
 *                          400 self-demote attempt (actor.id ===
 *                          targetId, service not called);
 *                          400 invalid role literal (service not
 *                          called, fields.role set);
 *                          404 missing user (service throws);
 *                          403 for User role.
 *
 *   PUT  /:id/status    — setActiveHandler:
 *                          200 happy path (toggle another user
 *                          off);
 *                          400 self-deactivate attempt;
 *                          400 missing isActive in body;
 *                          404 missing user;
 *                          403 for User role.
 *
 * `authMiddleware` and the `ticketService` are mocked so the
 * controller is exercised in isolation. The default mock user is
 * an Admin (id: 1) so the 200 / 400-self / 404 paths can run
 * without each test re-stubbing the auth middleware.
 *
 * Per-test overrides for the 403 cases set `req.user.role`
 * directly to a non-Admin value to exercise the gate.
 */

import type { NextFunction, Request, Response } from 'express';

import {
  listActiveAgentsHandler,
  listAllHandler,
  setActiveHandler,
  setRoleHandler,
} from './usersController';

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
  listActiveAgents: jest.fn(),
  listAllUsers: jest.fn(),
  countTicketsPerUser: jest.fn(),
  setUserRole: jest.fn(),
  setUserActive: jest.fn(),
  isUserRoleLiteral: jest.fn((v: unknown) =>
    v === 'User' || v === 'Support Agent' || v === 'Admin',
  ),
}));

function makeFakeUser(
  id: number,
  overrides: Partial<{
    email: string;
    displayName: string;
    role: 'User' | 'Support Agent' | 'Admin';
    isActive: boolean;
    lastActiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  const createdAt = overrides.createdAt ?? new Date('2026-09-01T00:00:00.000Z');
  const updatedAt = overrides.updatedAt ?? new Date('2026-09-02T00:00:00.000Z');
  const user = {
    id,
    email: overrides.email ?? `user${id}@example.com`,
    displayName: overrides.displayName ?? `User ${id}`,
    role: overrides.role ?? 'User',
    isActive: overrides.isActive ?? true,
    lastActiveAt: overrides.lastActiveAt ?? null,
    createdAt,
    updatedAt,
    get: function <T>(opts: { plain: true }): T {
      void opts;
      return { ...this } as unknown as T;
    },
  };
  return user;
}

function makeRes() {
  const statusMock = jest.fn();
  const jsonMock = jest.fn();
  const res = {
    status: (n: number) => {
      statusMock(n);
      return { json: (b: unknown) => jsonMock(b) };
    },
  } as unknown as Response;
  return { res, statusMock, jsonMock };
}

// ─── HD-010 (existing) ─────────────────────────────────────────────

describe('usersController.listActiveAgents (HD-010)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.listActiveAgents as jest.Mock).mockReset();
  });

  it('returns 200 with a sorted agents list on the happy path', async () => {
    (ticketService.listActiveAgents as jest.Mock).mockResolvedValueOnce([
      { id: 12, displayName: 'Jordan', role: 'Support Agent' },
      { id: 11, displayName: 'Sam', role: 'Support Agent' },
      { id: 1, displayName: 'Admin', role: 'Admin' },
    ]);

    const req = {} as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await listActiveAgentsHandler(
      req,
      res,
      jest.fn() as unknown as NextFunction,
    );

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      agents: Array<{ id: number; displayName: string; role: string }>;
      count: number;
    };
    expect(body.count).toBe(3);
    expect(body.agents.length).toBe(3);
    expect(body.agents[0].displayName).toBe('Jordan');
    expect(body.agents[2].role).toBe('Admin');
  });

  it('returns 200 with count=0 when no agents exist', async () => {
    (ticketService.listActiveAgents as jest.Mock).mockResolvedValueOnce([]);

    const req = {} as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await listActiveAgentsHandler(
      req,
      res,
      jest.fn() as unknown as NextFunction,
    );

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      agents: unknown[];
      count: number;
    };
    expect(body.count).toBe(0);
    expect(body.agents).toEqual([]);
  });
});

// ─── HD-014 listAllHandler ──────────────────────────────────────────

describe('usersController.listAllHandler (HD-014)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.listAllUsers as jest.Mock).mockReset();
    (ticketService.countTicketsPerUser as jest.Mock).mockReset();
    // Default: no tickets for anyone.
    (ticketService.countTicketsPerUser as jest.Mock).mockResolvedValue(
      new Map<number, number>(),
    );
  });

  it('returns 200 with the full user list on the happy path (Admin caller)', async () => {
    (ticketService.listAllUsers as jest.Mock).mockResolvedValueOnce([
      makeFakeUser(1, { displayName: 'Avery', role: 'Admin' }),
      makeFakeUser(7, {
        displayName: 'Eli Chen',
        role: 'User',
        isActive: true,
        lastActiveAt: new Date('2026-10-10T12:00:00.000Z'),
      }),
      makeFakeUser(11, { displayName: 'Jordan', role: 'Support Agent' }),
      makeFakeUser(8, {
        displayName: 'Morgan',
        role: 'User',
        isActive: false,
        lastActiveAt: null,
      }),
      makeFakeUser(2, { displayName: 'Sam Patel', role: 'Support Agent' }),
    ]);

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await listAllHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.listAllUsers).toHaveBeenCalledWith();
    expect(statusMock.mock.calls[0][0]).toBe(200);

    const body = jsonMock.mock.calls[0][0] as {
      users: Array<{
        id: number;
        email: string;
        displayName: string;
        role: string;
        isActive: boolean;
        lastActiveAt: string | null;
        createdAt: string;
        updatedAt: string;
        ticketCount: number;
      }>;
      count: number;
    };
    expect(body.count).toBe(5);
    expect(body.users.length).toBe(5);
    // All 9 UserPublic fields present on every row.
    for (const u of body.users) {
      expect(typeof u.id).toBe('number');
      expect(typeof u.email).toBe('string');
      expect(typeof u.displayName).toBe('string');
      expect(['User', 'Support Agent', 'Admin']).toContain(u.role);
      expect(typeof u.isActive).toBe('boolean');
      // lastActiveAt is either a string or null; either is valid.
      expect(['string', 'object']).toContain(typeof u.lastActiveAt);
      expect(typeof u.createdAt).toBe('string');
      expect(typeof u.updatedAt).toBe('string');
      expect(typeof u.ticketCount).toBe('number');
    }
    // lastActiveAt round-trips as ISO when set, null when never.
    expect(body.users[1].lastActiveAt).toBe('2026-10-10T12:00:00.000Z');
    expect(body.users[3].lastActiveAt).toBeNull();
    // No passwordHash in the wire.
    for (const u of body.users) {
      expect((u as unknown as { passwordHash?: unknown }).passwordHash)
        .toBeUndefined();
    }
  });

  it('merges the per-user ticket counts into the wire', async () => {
    (ticketService.listAllUsers as jest.Mock).mockResolvedValueOnce([
      makeFakeUser(1, { displayName: 'Avery', role: 'Admin' }),
      makeFakeUser(2, { displayName: 'Sam Patel', role: 'Support Agent' }),
      makeFakeUser(3, { displayName: 'Nobody', role: 'User' }),
    ]);
    (ticketService.countTicketsPerUser as jest.Mock).mockResolvedValueOnce(
      new Map<number, number>([
        [1, 12],
        [2, 34],
      ]),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await listAllHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      users: Array<{ id: number; ticketCount: number }>;
    };
    // The counted users carry their real counts...
    expect(body.users[0].ticketCount).toBe(12);
    expect(body.users[1].ticketCount).toBe(34);
    // ...and a user with no tickets falls back to 0, not undefined.
    expect(body.users[2].ticketCount).toBe(0);
  });

  it('returns 403 for a User caller (non-Admin)', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await listAllHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
    expect(ticketService.listAllUsers).not.toHaveBeenCalled();
  });

  it('returns 403 for a Support Agent caller (Admin only)', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 11,
        email: 'jordan@example.com',
        displayName: 'Jordan',
        role: 'Support Agent',
      },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await listAllHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(ticketService.listAllUsers).not.toHaveBeenCalled();
  });
});

// ─── HD-014 setRoleHandler ─────────────────────────────────────────

describe('usersController.setRoleHandler (HD-014)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.setUserRole as jest.Mock).mockReset();
  });

  it('returns 200 + updated user when an Admin changes another user\'s role', async () => {
    (ticketService.setUserRole as jest.Mock).mockResolvedValueOnce(
      makeFakeUser(7, { displayName: 'Eli Chen', role: 'Support Agent' }),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: { role: 'Support Agent' },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await setRoleHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.setUserRole).toHaveBeenCalledWith(7, 'Support Agent');
    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      id: number;
      role: string;
      displayName: string;
    };
    expect(body.id).toBe(7);
    expect(body.role).toBe('Support Agent');
    expect(body.displayName).toBe('Eli Chen');
  });

  it('returns 400 + fields.actor when the Admin tries to change their own role', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '1' },
      body: { role: 'Support Agent' },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setRoleHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ actor: 'self-role-change-not-allowed' });
    expect(ticketService.setUserRole).not.toHaveBeenCalled();
  });

  it('returns 400 + fields.role when the role is missing or not a known literal', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: { role: 'Wizard' },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setRoleHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ role: 'invalid-role' });
    expect(ticketService.setUserRole).not.toHaveBeenCalled();
  });

  it('returns 400 when role is missing from body', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: {},
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setRoleHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ role: 'invalid-role' });
  });

  it('returns 404 when the target user does not exist', async () => {
    const { HttpError } = require('../utils/errors');
    (ticketService.setUserRole as jest.Mock).mockRejectedValueOnce(
      new HttpError(404, 'not_found', 'User 9999 not found.'),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '9999' },
      body: { role: 'Support Agent' },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setRoleHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
  });

  it('returns 403 for a User caller (Admin only)', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
      params: { id: '11' },
      body: { role: 'Support Agent' },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setRoleHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(ticketService.setUserRole).not.toHaveBeenCalled();
  });
});

// ─── HD-014 setActiveHandler ───────────────────────────────────────

describe('usersController.setActiveHandler (HD-014)', () => {
  const ticketService = require('../services/ticketService');

  beforeEach(() => {
    (ticketService.setUserActive as jest.Mock).mockReset();
  });

  it('returns 200 + updated user when an Admin toggles another user to inactive', async () => {
    (ticketService.setUserActive as jest.Mock).mockResolvedValueOnce(
      makeFakeUser(7, { displayName: 'Eli Chen', isActive: false }),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: { isActive: false },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await setActiveHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.setUserActive).toHaveBeenCalledWith(7, false);
    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as {
      id: number;
      isActive: boolean;
    };
    expect(body.id).toBe(7);
    expect(body.isActive).toBe(false);
  });

  it('returns 200 + updated user when an Admin re-activates an inactive user', async () => {
    (ticketService.setUserActive as jest.Mock).mockResolvedValueOnce(
      makeFakeUser(8, { displayName: 'Morgan', isActive: true }),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '8' },
      body: { isActive: true },
    } as unknown as Request;
    const { res, statusMock, jsonMock } = makeRes();

    await setActiveHandler(req, res, jest.fn() as unknown as NextFunction);

    expect(ticketService.setUserActive).toHaveBeenCalledWith(8, true);
    expect(statusMock.mock.calls[0][0]).toBe(200);
    const body = jsonMock.mock.calls[0][0] as { isActive: boolean };
    expect(body.isActive).toBe(true);
  });

  it('returns 400 + fields.actor when the Admin tries to deactivate themselves', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '1' },
      body: { isActive: false },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setActiveHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ actor: 'self-deactivate-not-allowed' });
    expect(ticketService.setUserActive).not.toHaveBeenCalled();
  });

  it('returns 400 when isActive is missing from body', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: {},
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setActiveHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields).toEqual({ status: 'invalid-isActive' });
  });

  it('returns 400 when isActive is a non-boolean value', async () => {
    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '7' },
      body: { isActive: 'no' },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setActiveHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.fields).toEqual({ status: 'invalid-isActive' });
  });

  it('returns 404 when the target user does not exist', async () => {
    const { HttpError } = require('../utils/errors');
    (ticketService.setUserActive as jest.Mock).mockRejectedValueOnce(
      new HttpError(404, 'not_found', 'User 9999 not found.'),
    );

    const req = {
      user: {
        id: 1,
        email: 'admin@example.com',
        displayName: 'Avery',
        role: 'Admin',
      },
      params: { id: '9999' },
      body: { isActive: false },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setActiveHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
  });

  it('returns 403 for a User caller (Admin only)', async () => {
    const { HttpError } = require('../utils/errors');
    const req = {
      user: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
      },
      params: { id: '11' },
      body: { isActive: false },
    } as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await setActiveHandler(req, res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(ticketService.setUserActive).not.toHaveBeenCalled();
  });
});
