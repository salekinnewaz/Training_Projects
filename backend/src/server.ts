/**
 * HelpDesk Lite backend entry-point.
 *
 * Responsibilities:
 *  - Loads env via dotenv
 *  - Applies CORS (allowlist FRONTEND_ORIGIN, credentials enabled)
 *  - Applies helmet + morgan + JSON body parser
 *  - Mounts cookie-parser (HD-003) — must precede route handlers
 *    that read req.cookies
 *  - Mounts /api/* routes
 *  - Central error handler maps HttpError / Sequelize / JWT errors
 *    to typed HTTP responses; unknown errors fall through to a
 *    sanitized 500
 *  - Listens on PORT (default 3000)
 *
 * Later stories add:
 *  - Resource routers (HD-007+)
 *  - CSRF middleware (HD-004/005)
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';

// ── Middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 fallback (JSON, not HTML) ───────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found.' });
});

// ── Error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ── Listen ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `[helpdesk-lite-backend] Listening on http://localhost:${PORT} ` +
      `(cors origin: ${FRONTEND_ORIGIN}, env: ${process.env.NODE_ENV ?? 'development'})`
  );
});

export default app;
