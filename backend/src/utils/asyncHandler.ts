/**
 * Async route-handler wrapper — HD-003.
 *
 * Express 4 doesn't auto-catch rejected promises in async handlers,
 * so an unhandled rejection inside an async controller would crash
 * the process. Wrapping with `asyncHandler` forwards any thrown
 * error / rejection to `next()`, which routes it to the central
 * errorHandler middleware.
 */

import type { Request, Response, NextFunction } from 'express';

type AsyncHandlerFn = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
  fn: AsyncHandlerFn,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
