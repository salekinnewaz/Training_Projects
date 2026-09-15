/**
 * Central error handler — HD-003.
 *
 * 4-arity Express middleware (err, req, res, next). Maps known error
 * shapes to typed HTTP responses; everything else falls through to
 * a sanitized 500.
 *
 * Detection order:
 *   1. HttpError — controllers throw this to signal a specific
 *      status + body. The body itself never leaks stack traces.
 *   2. Sequelize validation / unique-constraint errors → 400.
 *   3. JWT errors (defense in depth — authMiddleware normally
 *      catches these first) → 401.
 *   4. Fallback → 500 with a sanitized message. The raw error is
 *      logged via console.error for the operator.
 */

import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';

interface SequelizeLikeError {
  name: string;
  errors?: Array<{ path?: string; message?: string }>;
}

interface JwtLikeError {
  name: string;
}

function pickFields(err: SequelizeLikeError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const e of err.errors ?? []) {
    if (e.path && e.message) {
      fields[e.path] = e.message;
    }
  }
  return fields;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Our own typed errors.
  if (err instanceof HttpError) {
    res.status(err.status).json(err.toBody());
    return;
  }

  // 2. Sequelize validation / uniqueness.
  if (
    err.name === 'SequelizeValidationError' ||
    err.name === 'SequelizeUniqueConstraintError'
  ) {
    const fields = pickFields(err as SequelizeLikeError);
    res.status(400).json({
      error: 'validation_error',
      message: 'One or more fields are invalid.',
      fields,
    });
    return;
  }

  // 3. JWT errors (defense in depth).
  const jwtErr = err as JwtLikeError;
  if (
    jwtErr.name === 'JsonWebTokenError' ||
    jwtErr.name === 'TokenExpiredError' ||
    jwtErr.name === 'NotBeforeError'
  ) {
    res.status(401).json({
      error: 'invalid_token',
      message: 'Authentication required.',
    });
    return;
  }

  // 4. Fallback — log full error, respond with sanitized message.
  console.error('[errorHandler] Unhandled error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: 'Something went wrong. Please try again.',
  });
}
