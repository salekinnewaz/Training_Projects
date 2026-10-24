/**
 * ticketsController.listAllHandler + stats — HD-019.
 *
 * Pins the two endpoints the Tickets list page depends on:
 *
 *   1. **GET /api/tickets/list** — the row source. Wider role gate
 *      than `/queue` (Support Agent *or* Admin) so both roles can
 *      land on the new page, while `User` is still 403'd.
 *      Also pins the `limit` clamp.
 *
 *   2. **GET /api/tickets/stats** — the stat-strip source. Same
 *      role gate; returns the five-bucket counts plus a
 *      zero-filled 60-day series (two 30-day halves, so the
 *      summary card can show a month-over-month delta).
 *
 *   3. **GET /api/tickets/stats/mine** — the HD-020 User-role
 *      counterpart to (2). Returns the same envelope but scoped to
 *      the caller's own tickets, so the Employee Dashboard's stat
 *      strip can never leak team-wide queue state.
 *
 * Uses the same `makeResMock` shape as the rest of the repo's
 * controller specs, and the Jasmine-style matchers the project's
 * Jest setup provides (`toBe`, `toEqual`, `.length`) — NOT
 * `expect.objectContaining` / `toHaveLength`, which aren't
 * available here.
 */

import type { NextFunction, Request, Response } from 'express';

jest.mock('../services/ticketService', () => ({
  listForQueue: jest.fn(),
}));

jest.mock('../models', () => ({
  Ticket: {
    findAll: jest.fn(),
  },
  sequelize: {
    fn: jest.fn(),
    col: jest.fn(),
    query: jest.fn(),
  },
}));

import { HttpError } from '../utils/errors';
import { listAllHandler, stats, statsMine } from './ticketsController';

const ticketService = require('../services/ticketService');
const { Ticket, sequelize } = require('../models');

/**
 * Minimal `Response` double. Returns the mock fns so a spec can
 * assert on `status` / `json` without reaching into the object
 * literal.
 */
function makeResMock() {
  const statusMock = jest.fn().mockReturnThis();
  const jsonMock = jest.fn().mockReturnThis();
  const res = { status: statusMock, json: jsonMock } as unknown as Response;
  return { res, statusMock, jsonMock };
}

function makeReq(user: unknown, query: Record<string, unknown> = {}) {
  return { user, query } as unknown as Request;
}

/**
 * Build a `toJSON()` return value for a fake ticket. The fake
 * ticket objects passed to `serializeTicket` carry their fields
 * at the top level (so `serializeTicket` can read
 * `ticket.createdAt.toISOString()` directly); `toJSON()` is
 * invoked for the JSON output shape.
 */
function fakeTicketJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 47,
    number: 'HD-47',
    title: 'WiFi drops',
    description: 'every few minutes',
    category: 'IT',
    priority: 'Medium',
    status: 'Open',
    submitter: {
      id: 7,
      email: 'eli@company.com',
      displayName: 'Eli',
      role: 'User',
    },
    owner: null,
    attachment: null,
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
    updatedAt: new Date('2026-09-15T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

const AGENT = { id: 4, role: 'Support Agent' };
const ADMIN = { id: 1, role: 'Admin' };
const EMPLOYEE = { id: 9, role: 'User' };

// ── listAllHandler ────────────────────────────────────────────

describe('ticketsController.listAllHandler (HD-019)', () => {
  beforeEach(() => {
    (ticketService.listForQueue as jest.Mock).mockReset();
  });

  it('returns 200 with a { tickets, count } envelope for a Support Agent', async () => {
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
      submitter: {
        id: 7,
        email: 'eli@company.com',
        displayName: 'Eli',
        role: 'User',
      },
      owner: null,
      attachment: null,
      createdAt,
      updatedAt,
      deletedAt: null,
      toJSON: () => fakeTicketJson({
        submitter: {
          id: 7,
          email: 'eli@company.com',
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
    (ticketService.listForQueue as jest.Mock).mockResolvedValueOnce([fake]);
    const { res, statusMock, jsonMock } = makeResMock();
    const next = jest.fn();

    await listAllHandler(makeReq(AGENT), res, next as unknown as NextFunction);
    // Surface any error the controller forwarded to `next` —
    // asyncHandler swallows thrown HttpError into next() so check.
    if (next.mock.calls.length > 0) throw next.mock.calls[0][0];

    expect(statusMock).toHaveBeenCalledWith(200);
    const body = jsonMock.mock.calls[0][0];
    expect(body.count).toBe(1);
    expect(Array.isArray(body.tickets)).toBe(true);
  });

  it('returns 200 for an Admin too (wider gate than /queue)', async () => {
    (ticketService.listForQueue as jest.Mock).mockResolvedValueOnce([]);
    const { res, statusMock } = makeResMock();

    await listAllHandler(makeReq(ADMIN), res, jest.fn() as unknown as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('returns 403 for the User role and never calls the service', async () => {
    const { res, statusMock, jsonMock } = makeResMock();
    const next = jest.fn();

    await listAllHandler(makeReq(EMPLOYEE), res, next as unknown as NextFunction);
    await Promise.resolve();

    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
    expect(ticketService.listForQueue).not.toHaveBeenCalled();
  });

  it('clamps ?limit to at most 500', async () => {
    (ticketService.listForQueue as jest.Mock).mockResolvedValueOnce([]);
    const { res } = makeResMock();

    await listAllHandler(
      makeReq(AGENT, { limit: '9999' }),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const opts = (ticketService.listForQueue as jest.Mock).mock.calls[0][0];
    expect(opts.limit).toBe(500);
  });

  it('parses a numeric ?limit and forwards it', async () => {
    (ticketService.listForQueue as jest.Mock).mockResolvedValueOnce([]);
    const { res } = makeResMock();

    await listAllHandler(
      makeReq(AGENT, { limit: '25' }),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const opts = (ticketService.listForQueue as jest.Mock).mock.calls[0][0];
    expect(opts.limit).toBe(25);
  });

  it('falls back to the 500 default when ?limit is absent or non-numeric', async () => {
    (ticketService.listForQueue as jest.Mock).mockResolvedValue([]);
    const { res } = makeResMock();

    await listAllHandler(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);
    await listAllHandler(
      makeReq(AGENT, { limit: 'abc' }),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const firstOpts = (ticketService.listForQueue as jest.Mock).mock.calls[0][0];
    const secondOpts = (ticketService.listForQueue as jest.Mock).mock.calls[1][0];
    expect(firstOpts.limit).toBe(500);
    expect(secondOpts.limit).toBe(500);
  });
});

// ── stats ─────────────────────────────────────────────────────

describe('ticketsController.stats (HD-019)', () => {
  beforeEach(() => {
    (Ticket.findAll as jest.Mock).mockReset();
    (sequelize.query as jest.Mock).mockReset();
  });

  it('returns 200 with five-bucket counts + a 60-day series for a Support Agent', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([
      { status: 'Open', count: '3' },
      { status: 'In Progress', count: 1 },
      { status: 'Resolved', count: '2' },
      { status: 'Closed', count: 4 },
    ]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ day: `2026-09-${i + 1}`, count: i })),
    );

    const { res, statusMock, jsonMock } = makeResMock();
    await stats(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    const body = jsonMock.mock.calls[0][0];
    expect(body.counts.total).toBe(10);
    expect(body.counts.open).toBe(3);
    expect(body.counts.inProgress).toBe(1);
    expect(body.counts.resolved).toBe(2);
    expect(body.counts.closed).toBe(4);
    expect(body.dailyCreated.length).toBe(60);
  });

  it('sums the older 30 days into previousPeriod so the delta can compare halves', async () => {
    // HD-021: the summary card shows "vs last month", so the series
    // is a 60-day window — the first 30 days are the previous
    // period, the last 30 are the recent one.
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ day: `2026-09-${i + 1}`, count: 2 })),
    );

    const { res, jsonMock } = makeResMock();
    await stats(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    const body = jsonMock.mock.calls[0][0];
    // 30 older days × 2 = 60.
    expect(body.previousPeriod).toBe(60);
  });

  it('reports previousPeriod as 0 when there is no earlier activity', async () => {
    // The frontend hides the delta pill when previousPeriod is 0 —
    // a misleading "+100%" is worse than no pill.
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ day: `2026-09-${i + 1}`, count: 0 })),
    );

    const { res, jsonMock } = makeResMock();
    await stats(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    expect(jsonMock.mock.calls[0][0].previousPeriod).toBe(0);
  });

  it('queries a 60-day window so both delta halves are available', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res } = makeResMock();
    await stats(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    const sql = (sequelize.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain("INTERVAL '59 days'");
  });

  it('sums unknown status buckets into total without leaking them', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([
      { status: 'Open', count: '2' },
      { status: 'Archived', count: '5' },
    ]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res, jsonMock } = makeResMock();
    await stats(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    const body = jsonMock.mock.calls[0][0];
    expect(body.counts.total).toBe(7);
    expect(body.counts.open).toBe(2);
    expect(body.counts.closed).toBe(0);
    expect(body.dailyCreated).toEqual([]);
  });

  it('returns 403 for the User role and never queries the DB', async () => {
    const { res, statusMock } = makeResMock();
    const next = jest.fn();

    await stats(makeReq(EMPLOYEE), res, next as unknown as NextFunction);
    await Promise.resolve();

    expect(statusMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('forbidden');
    expect(Ticket.findAll).not.toHaveBeenCalled();
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('returns 200 for an Admin', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res, statusMock } = makeResMock();
    await stats(makeReq(ADMIN), res, jest.fn() as unknown as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
  });
});

// ── statsMine ─────────────────────────────────────────────────

/**
 * `statsMine` (HD-020) — the User-role counterpart to `stats`.
 *
 * The critical property is the scoping: every query must be
 * filtered to the caller's own ticket id, and the endpoint must be
 * reachable by the `User` role (unlike `stats`, which 403s them).
 */
describe('ticketsController.statsMine (HD-020)', () => {
  beforeEach(() => {
    (Ticket.findAll as jest.Mock).mockReset();
    (sequelize.query as jest.Mock).mockReset();
  });

  it('returns 200 with five-bucket counts for the User role', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([
      { status: 'Open', count: '2' },
      { status: 'In Progress', count: 1 },
      { status: 'Resolved', count: '1' },
      { status: 'Closed', count: 1 },
    ]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ day: `2026-10-${i + 1}`, count: i })),
    );

    const { res, statusMock, jsonMock } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    const body = jsonMock.mock.calls[0][0];
    expect(body.counts.total).toBe(5);
    expect(body.counts.open).toBe(2);
    expect(body.counts.inProgress).toBe(1);
    expect(body.counts.resolved).toBe(1);
    expect(body.counts.closed).toBe(1);
    expect(body.dailyCreated.length).toBe(60);
  });

  it('sums the older 30 days into previousPeriod for the month-over-month delta', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ day: `2026-10-${i + 1}`, count: 3 })),
    );

    const { res, jsonMock } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    // 30 older days × 3 = 90.
    expect(jsonMock.mock.calls[0][0].previousPeriod).toBe(90);
  });

  it('scopes the status-bucket query to the caller\'s own tickets', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    // The `where` clause must pin the query to the caller's id —
    // this is what stops the endpoint leaking team-wide counts.
    const opts = (Ticket.findAll as jest.Mock).mock.calls[0][0];
    expect(opts.where).toEqual({ submitterId: EMPLOYEE.id });
  });

  it('scopes the 60-day series query to the caller\'s own tickets', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const queryArg = (sequelize.query as jest.Mock).mock.calls[0][0];
    // The SQL must filter on submitter_id, and the value must be
    // bound as a replacement parameter (not interpolated) so it
    // can't be tampered with.
    expect(queryArg).toContain('t.submitter_id = :userId');
    const opts = (sequelize.query as jest.Mock).mock.calls[0][1];
    expect(opts.replacements).toEqual({ userId: EMPLOYEE.id });
  });

  it('never returns team-wide counts — the totals come from the scoped query only', async () => {
    // A User with 2 tickets must see total === 2 even if the
    // database holds dozens of other tickets.
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([
      { status: 'Open', count: '2' },
    ]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res, jsonMock } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.counts.total).toBe(2);
  });

  it('allows a Support Agent to read their own submitted tickets', async () => {
    // The scope is the caller, not the role — an Agent calling this
    // gets their own submitted tickets, never the team's queue.
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res, statusMock } = makeResMock();
    await statsMine(makeReq(AGENT), res, jest.fn() as unknown as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    const opts = (Ticket.findAll as jest.Mock).mock.calls[0][0];
    expect(opts.where).toEqual({ submitterId: AGENT.id });
  });

  it('sums unknown status buckets into total without leaking them', async () => {
    (Ticket.findAll as jest.Mock).mockResolvedValueOnce([
      { status: 'Open', count: '2' },
      { status: 'Archived', count: '5' },
    ]);
    (sequelize.query as jest.Mock).mockResolvedValueOnce([]);

    const { res, jsonMock } = makeResMock();
    await statsMine(
      makeReq(EMPLOYEE),
      res,
      jest.fn() as unknown as NextFunction,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.counts.total).toBe(7);
    expect(body.counts.open).toBe(2);
    expect(body.counts.closed).toBe(0);
  });
});