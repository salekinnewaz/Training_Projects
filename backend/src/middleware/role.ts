/**
 * Role middleware — HD-003.
 *
 * Factory that returns an Express middleware enforcing that the
 * authenticated user's role is in `allowedRoles`. Should be mounted
 * behind `authMiddleware` so `req.user` is populated.
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../models/User';
import { HttpError } from '../utils/errors';

export function roleMiddleware(
  allowedRoles: UserRole[],
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (!req.user) {
      // Defense in depth — should not happen behind authMiddleware.
      return next(
        new HttpError(
          401,
          'unauthenticated',
          'Authentication required.',
        ),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          'forbidden',
          'You do not have permission to access this resource.',
        ),
      );
    }

    return next();
  };
}
