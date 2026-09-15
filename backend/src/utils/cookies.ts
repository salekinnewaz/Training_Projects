/**
 * Auth cookie helpers — HD-003.
 *
 * The JWT rides in an httpOnly cookie named `auth`. `Secure` is
 * only set in production so dev (http://localhost) still works.
 * `SameSite=Lax` is the right default for an internal SPA — POST
 * navigations from external sites are blocked, but GET top-level
 * navigations still send the cookie.
 *
 * `maxAge` matches the JWT expiry (1h) so the cookie expires in
 * lockstep with the token.
 */

import type { Response, CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'auth';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_HOUR_MS,
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res: Response): void {
  // res.clearCookie sets Expires in the past + value=""; we have to
  // strip maxAge from the options because Express forwards it into
  // the Set-Cookie header (overriding its own intent to invalidate).
  const opts = cookieOptions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (opts as any).maxAge;
  res.clearCookie(AUTH_COOKIE_NAME, opts);
}
