/**
 * Express type augmentation — HD-003.
 *
 * Adds an optional `user` field on `Request` so route handlers and
 * middleware behind `authMiddleware` can read `req.user` with full
 * type information, no `any`.
 *
 * Uses inline string-literal unions (not `import type`) because
 * declaration files can be finicky about importing from relative
 * paths through tsc — these values match `UserRole` in
 * backend/src/models/User.ts.
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        displayName: string;
        role: 'User' | 'Support Agent' | 'Admin';
      };
    }
  }
}

export {};
