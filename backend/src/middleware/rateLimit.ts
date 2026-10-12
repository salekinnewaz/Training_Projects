/**
 * Login rate limiter — D4.
 *
 * `express-rate-limit` v7 wrapper for `POST /api/auth/login`.
 * Per-IP sliding window: 10 attempts per 15 minutes, but successful
 * logins don't burn budget (`skipSuccessfulRequests: true` so a
 * user who successfully signs in doesn't lock themselves out).
 *
 * On limit exceed the rate limiter calls `handler` which throws
 * an `HttpError(429, 'rate_limited', 'Too many attempts. Please
 * wait a moment.')`. The central `errorHandler` middleware
 * (HD-003) serializes that into the standard envelope
 * `{ error: 'rate_limited', message: '…' }` so the frontend can
 * switch on `errorCode` exactly like every other 4xx.
 *
 * In-memory store (the express-rate-limit default) is fine for
 * single-container MVP. Multi-instance prod will need a shared
 * store (Redis) — see the "Follow-up" section in
 * `spec-d4-rate-limited.md`. The store is intentionally not
 * abstracted here; a single file change to `new
 * RedisStore({…})` covers the multi-instance case.
 *
 * Why a separate middleware file (and not a one-liner in
 * `routes/auth.ts`): the `handler` needs to throw an `HttpError`
 * to keep the wire shape consistent, and the test
 * (`rateLimit.spec.ts`) needs to construct a bare Express
 * request/response pair to assert the 429 + envelope. A factory
 * function with the request/response pair in scope is cleaner
 * than wiring a one-off at the route.
 *
 * `windowMs` and `max` are exported so the test can override
 * them for a fast 3-call → 1-reject run (vs waiting 15 minutes).
 */

import rateLimit from 'express-rate-limit';

import { HttpError } from '../utils/errors';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_MAX = 10;

export function loginRateLimiter(
  overrides: { windowMs?: number; max?: number } = {},
): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: overrides.windowMs ?? LOGIN_WINDOW_MS,
    max: overrides.max ?? LOGIN_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, _res, next) => {
      // Throwing an HttpError keeps the wire shape identical to
      // every other 4xx in the app — the central errorHandler
      // middleware serializes it into
      //   { error: 'rate_limited', message: 'Too many attempts…' }
      // and the frontend can switch on `errorCode` directly.
      next(
        new HttpError(
          429,
          'rate_limited',
          'Too many attempts. Please wait a moment.',
        ),
      );
    },
  });
}
