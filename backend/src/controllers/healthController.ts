import { Request, Response } from 'express';

/**
 * Health endpoint — confirms the API is up and returns metadata
 * useful for smoke tests. Mounted at GET /api/health.
 *
 * HD-001 ships this as the only API route; every subsequent story
 * (HD-002+) registers its routes under /api in routes/index.ts.
 */
export function healthController(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'helpdesk-lite-backend',
    timestamp: new Date().toISOString(),
  });
}

export default healthController;
