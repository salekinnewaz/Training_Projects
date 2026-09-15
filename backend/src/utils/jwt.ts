/**
 * JWT helpers — HD-003.
 *
 * Thin wrappers over `jsonwebtoken` so the rest of the codebase
 * doesn't deal with the library directly. Secret + expiry are read
 * from `process.env` on every call (no boot-time memoization) so
 * rotation doesn't require a restart.
 */

import jwt from 'jsonwebtoken';
import type { UserRole } from '../models/User';

export interface JwtPayload {
  sub: number; // user id (standard JWT convention)
  email: string;
  role: UserRole;
  displayName: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add it to backend/.env (see .env.example).',
    );
  }
  return secret;
}

function getExpiresIn(): string | number {
  return process.env.JWT_EXPIRES_IN || '1h';
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: getExpiresIn() as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  // jwt.verify returns string | JwtPayload from the lib; route
  // through unknown to satisfy TS's structural check against our
  // custom JwtPayload shape.
  const decoded: unknown = jwt.verify(token, getSecret());
  if (typeof decoded === 'string' || decoded === null) {
    throw new Error('Invalid token payload shape.');
  }
  const payload = decoded as Record<string, unknown>;
  if (
    typeof payload.sub !== 'number' ||
    typeof payload.email !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.displayName !== 'string'
  ) {
    throw new Error('Invalid token payload shape.');
  }
  return payload as unknown as JwtPayload;
}
