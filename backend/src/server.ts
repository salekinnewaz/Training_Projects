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
import { getOpenApiSpec } from './docs/openapi';
import { mountSwaggerUI } from './docs/swaggerUI';
import { errorHandler } from './middleware/errorHandler';
import { resolveStorageBackend } from './utils/attachmentStorage';

dotenv.config();

// ── Boot guard ─────────────────────────────────────────────────────
// On Vercel the serverless filesystem is read-only except /tmp, and
// /tmp is ephemeral per function instance — so attachment bytes
// cannot be written there at all. The `fs` storage backend would
// fail every upload with a 500 `storage_failed`.
//
// Refuse to boot rather than serve a broken upload endpoint: a
// missing `ATTACHMENT_STORAGE_BACKEND` env var then surfaces in
// the deploy log immediately, instead of as a mysterious 500
// days later.
if (process.env.VERCEL === '1' && resolveStorageBackend() === 'fs') {
  throw new Error(
    '[boot] ATTACHMENT_STORAGE_BACKEND must be "blob" on Vercel — ' +
      'the serverless filesystem is read-only and /tmp is ephemeral.',
  );
}

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';

// The set of browser origins allowed to call the API with credentials.
//
// Two devs often run the frontend at the same time (one per IDE), so
// the dev ports are not a single value. `FRONTEND_ORIGINS` (plural,
// comma-separated) is the override; `FRONTEND_ORIGIN` stays
// supported as the single-origin form.
//
// Accept both `localhost` and `127.0.0.1` for each port so dev users
// don't have to match the exact host they type into the address bar.
// In prod on Vercel the env var still pins a single origin.
const DEV_FRONTEND_PORTS = (process.env.FRONTEND_PORTS || '4200,4300')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set([
    FRONTEND_ORIGIN,
    ...(process.env.FRONTEND_ORIGINS
      ? process.env.FRONTEND_ORIGINS.split(',').map((o) => o.trim())
      : []
    ).filter(Boolean),
    ...DEV_FRONTEND_PORTS.flatMap((port) => [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
    ]),
  ])
);

// On Vercel (or any reverse-proxied deploy) trust the first proxy
// hop so express-rate-limit and req.ip see the real client IP, not
// the edge. Safe in local dev too (no proxy is still no-op).
app.set('trust proxy', 1);

// ── Middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin requests (no Origin header, e.g. curl) are fine.
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
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

// ── API documentation (HD-015) ──────────────────────────────────────
// Raw OpenAPI JSON for tooling (Postman import, codegen, curl).
// Mounted under /api so it sits on the same origin as the rest of
// the API — no CORS gymnastics needed. Pass `req` so the spec's
// `servers` array includes the host this request was served from
// — Swagger UI uses it as the "Try it out" base URL, and tooling
// (Postman, codegen) can pick the right host automatically.
app.get('/api/docs.json', (req: Request, res: Response) => {
  res.json(getOpenApiSpec(req));
});
// Swagger UI HTML. Browse to http://localhost:<port>/api/docs.
// Uses the Vercel-friendly custom handler in ./docs/swaggerUI
// instead of `swagger-ui-express` — see swaggerUI.ts for why.
// The callback receives `req` so the inlined spec also gets the
// right `servers[0].url` (the same one /api/docs.json returns).
mountSwaggerUI(app, '/api/docs/', (req) => getOpenApiSpec(req));

// ── 404 fallback (JSON, not HTML) ───────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found.' });
});

// ── Error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ── Listen ──────────────────────────────────────────────────────────
// Vercel Functions invoke the export directly, not as a
// port-listening server. Guard the listen() so we only bind in
// local dev / traditional Node hosts.
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(
      `[helpdesk-lite-backend] Listening on http://localhost:${PORT} ` +
        `(cors origins: ${ALLOWED_ORIGINS.join(', ')}, env: ${process.env.NODE_ENV ?? 'development'})`
    );
  });
}

export default app;
