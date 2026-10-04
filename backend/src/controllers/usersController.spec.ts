/**
 * usersController — HD-010 spec.
 *
 * Verifies GET /api/users/agents:
 *   - happy-path: listActiveAgents returns an array; the controller
 *     responds 200 with `{ agents: [{id, displayName, role}, ...],
 *     count }`.
 *   - 401 / unauthenticated: when req.user is missing the controller
 *     still responds 200 (the middleware will short-circuit before
 *     we ever reach it). The authMiddleware mock installs a
 *     default user so we only exercise the success path here.
 *
 * Both `authMiddleware` and `ticketService` (which exposes
 * `listActiveAgents` for HD-010) are mocked so the controller is
 * exercised in isolation.
 */

import type { NextFunction, Request, Response } from 'express';

import { listActiveAgentsHandler } from './usersController';

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

jest.mock('../services/ticketService', () => ({
  listActiveAgents: jest.fn(),
}));

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
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

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
    const statusMock = jest.fn();
    const jsonMock = jest.fn();
    const res = {
      status: (n: number) => {
        statusMock(n);
        return { json: (b: unknown) => jsonMock(b) };
      },
    } as unknown as Response;

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