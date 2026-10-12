/**
 * Auth controller — HD-003.
 *
 * Four handlers:
 *   - login    — POST /api/auth/login
 *   - logout   — POST /api/auth/logout
 *   - register — POST /api/auth/register (501 stub; Admin-managed users per HD-014)
 *   - me       — GET  /api/auth/me (protected; authMiddleware populates req.user)
 *
 * All handlers are wrapped in `asyncHandler` so any thrown error
 * (including HttpError) routes to the central errorHandler.
 */

import type { Request, Response } from 'express';
import { User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import { DUMMY_HASH, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import {
  clearAuthCookie,
  setAuthCookie,
} from '../utils/cookies';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

function validateLoginBody(body: LoginBody): {
  email: string;
  password: string;
} {
  const fields: Record<string, string> = {};
  const email =
    typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    fields.email = 'Enter a valid email address.';
  }
  if (!password) {
    fields.password = 'Enter your password.';
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      fields,
    );
  }

  return { email, password };
}

function toPublic(user: User): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    lastActiveAt: user.lastActiveAt
      ? user.lastActiveAt.toISOString()
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// Public user shape returned by /api/auth/me. Kept local to the
// backend — the frontend defines its own `UserPublic` interface in
// frontend/src/app/models/user.ts which mirrors this shape minus
// passwordHash. These stay in lockstep by hand.
interface AuthUserPayload {
  id: number;
  email: string;
  displayName: string;
  role: 'User' | 'Support Agent' | 'Admin';
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in
 *     description: |
 *       Validates credentials, sets the `auth` HttpOnly cookie, and
 *       returns the public user shape. The cookie is the sole
 *       auth token for every subsequent request.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: |
 *           Login successful. `Set-Cookie: auth=...` attached.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: invalid_credentials
 *               message: Email or password is incorrect. Try again.
 *       403:
 *         description: Account is inactive.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: account_inactive
 *               message: Your account is inactive. Contact your administrator.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = validateLoginBody(
    (req.body ?? {}) as LoginBody,
  );

  const user = await User.scope('withPassword').findOne({
    where: { email },
  });

  // Always run bcrypt.compare — even if the user is missing — to
  // equalize timing and block the email-enumeration side channel.
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCompare);

  if (!user || !passwordOk) {
    throw new HttpError(
      401,
      'invalid_credentials',
      'Email or password is incorrect. Try again.',
    );
  }

  if (!user.isActive) {
    throw new HttpError(
      403,
      'account_inactive',
      'Your account is inactive. Contact your administrator.',
    );
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  });
  setAuthCookie(res, token);

  // Fire-and-forget: don't block the login response on the audit write.
  User.update(
    { lastActiveAt: new Date() },
    { where: { id: user.id } },
  ).catch((err) => {
    console.error('[auth] failed to update lastActiveAt:', err);
  });

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out
 *     description: |
 *       Clears the `auth` cookie. Always returns 204, even if no
 *       cookie was set (idempotent).
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       204:
 *         description: Logged out. No body.
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(204).send();
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register (not implemented)
 *     description: |
 *       Admin-managed users per HD-014 — this endpoint is intentionally
 *       unimplemented in MVP. Returns 501.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       501:
 *         description: Not implemented in this build.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: not_implemented
 *               message: Account registration is not available in this build. Contact your administrator.
 */
export const register = asyncHandler(async (_req: Request, _res: Response) => {
  // Admin-managed users per HD-014; this endpoint is intentionally
  // unimplemented in MVP.
  throw new HttpError(
    501,
    'not_implemented',
    'Account registration is not available in this build. Contact your administrator.',
  );
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Current user
 *     description: |
 *       Returns the full public user shape for the JWT'd user.
 *       Reloads from the database on every call so role / isActive
 *       changes made by an Admin (HD-014) take effect on the
 *       user's next request without forcing a re-login.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Account was deactivated since token issuance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: account_inactive
 *               message: Your account is inactive. Contact your administrator.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  // authMiddleware attached req.user from the JWT. Reload from DB
  // to detect role / isActive changes since token issuance — this
  // is how we catch a user deactivated mid-session on their next /me.
  const user = await User.findByPk(req.user!.id);

  if (!user || !user.isActive) {
    throw new HttpError(
      401,
      'account_inactive',
      'Your account is inactive. Contact your administrator.',
    );
  }

  res.status(200).json({ user: toPublic(user) });
});
