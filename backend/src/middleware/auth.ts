/**
 * Auth middleware — HD-003.
 *
 * Verifies the JWT carried in the `auth` httpOnly cookie and attaches
 * the decoded payload to `req.user`. On any failure (missing cookie,
 * malformed token, expired token), responds with 401 + a generic
 * message — never leaks the specific JWT failure mode to a probe.
 */

import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME } from '../utils/cookies';
import { verifyToken } from '../utils/jwt';
import { HttpError } from '../utils/errors';

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== 'string') {
    return next(
      new HttpError(
        401,
        'unauthenticated',
        'Authentication required.',
      ),
    );
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
    };
    return next();
  } catch {
    // Generic message; never differentiate malformed vs expired to clients.
    return next(
      new HttpError(
        401,
        'invalid_token',
        'Authentication required.',
      ),
    );
  }
}
