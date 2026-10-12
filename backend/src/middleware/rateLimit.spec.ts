/**
 * rateLimit — D4 spec.
 *
 * Pins the `loginRateLimiter` contract end-to-end via a real
 * Express app + supertest (no in-memory mock req/res — the
 * `express-rate-limit` library v7 internally treats `res` as
 * an EventEmitter and reads `res.on('finish', …)` for the
 * `skipSuccessfulRequests` decision, which is hard to mock
 * by hand and brittle to library internals).
 *
 * Why a "fake" login route returns 401 (not 200):
 * `skipSuccessfulRequests: true` is the production
 * configuration — a user who successfully signs in doesn't
 * burn budget. The limiter only counts non-successful
 * responses (statusCode >= 400). A 200 response never
 * increments the counter, so the test fixture deliberately
 * returns 401 to simulate "wrong password" attempts and
 * exercise the production counting path.
 *
 * Contract:
 *
 *   (a) The first N requests (where N = `max`) pass through to
 *       the next middleware. The fixture returns 401 (a real
 *       wrong-password result); the limiter counts them as
 *       failed attempts.
 *   (b) The (N+1)th request is short-circuited with a 429
 *       envelope: `{ error: 'rate_limited', message: 'Too many
 *       attempts. Please wait a moment.' }`.
 *   (c) The 429 response carries the IETF draft-7 `RateLimit-*`
 *       standard headers (`standardHeaders: 'draft-7'` in the
 *       limiter config).
 *   (d) Default `max` is 10 (per the D4 plan: 10 attempts per
 *       15 minutes, with `skipSuccessfulRequests: true`).
 *
 * `windowMs` and `max` are passed via the `overrides` arg so
 * the 3-call → 1-reject test runs in milliseconds, not 15
 * minutes. The override path is exported for tests; production
 * uses the default (see `routes/auth.ts`).
 */

import express, { type Request, type Response } from 'express';
import request from 'supertest';

import { errorHandler } from './errorHandler';
import { LOGIN_MAX, loginRateLimiter } from './rateLimit';

function makeApp(max: number): express.Express {
  const app = express();
  // Returns 401 to simulate "wrong password" so the
  // `skipSuccessfulRequests: true` config counts it. A 200
  // response would NOT count and the test would never reach
  // the rate limit.
  app.post(
    '/login',
    loginRateLimiter({ windowMs: 60_000, max }),
    (_req: Request, res: Response) => res.status(401).json({ error: 'invalid_credentials' }),
  );
  // The custom `handler` in `loginRateLimiter` calls
  // `next(new HttpError(429, 'rate_limited', …))`. Without
  // an error middleware, Express's `finalhandler` swallows
  // the error and writes a generic 429 with no body. Wire
  // the same errorHandler the production app uses
  // (`backend/src/server.ts`) so the body assertions
  // exercise the real envelope.
  app.use(errorHandler);
  return app;
}

describe('loginRateLimiter (D4)', () => {
  it('passes the first N requests through (401) and rejects the (N+1)th (429)', async () => {
    const app = makeApp(2);

    const r1 = await request(app).post('/login');
    const r2 = await request(app).post('/login');
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);

    const r3 = await request(app).post('/login');
    expect(r3.status).toBe(429);
  });

  it('rejects the (N+1)th request with the rate_limited envelope', async () => {
    const app = makeApp(2);

    await request(app).post('/login');
    await request(app).post('/login');
    const rejected = await request(app).post('/login');

    expect(rejected.status).toBe(429);
    const body = rejected.body as { error?: string; message?: string };
    expect(body.error).toBe('rate_limited');
    expect(body.message).toBe('Too many attempts. Please wait a moment.');
  });

  it('sets the IETF draft-7 RateLimit-* standard headers on the 429 response', async () => {
    const app = makeApp(2);
    await request(app).post('/login');
    await request(app).post('/login');

    const rejected = await request(app).post('/login');
    expect(rejected.status).toBe(429);
    // `standardHeaders: 'draft-7'` in the limiter config emits
    // the IETF draft-7 rate-limit headers. express-rate-limit
    // v7 surfaces them as a single `RateLimit` header plus
    // `RateLimit-Policy` and `Retry-After` (the v7 default
    // naming). The exact format is the IETF spec, not our
    // contract — we just assert they're set.
    expect(rejected.headers['ratelimit']).toBeDefined();
    expect(rejected.headers['ratelimit-policy']).toBeDefined();
    expect(rejected.headers['retry-after']).toBeDefined();
  });

  it('default max is 10 (per the D4 plan: 10 attempts per 15 minutes)', () => {
    expect(LOGIN_MAX).toBe(10);
  });
});
