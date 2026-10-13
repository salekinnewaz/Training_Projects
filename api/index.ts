/**
 * Vercel Function entry-point — HelpDesk Lite backend.
 *
 * Vercel detects files at /api/<name>.ts in the project root and
 * deploys each as a serverless function. The rewrite in
 * `vercel.json` maps any /api/* request to this function, so the
 * same Express app that runs on `npm run dev` runs here too.
 *
 * The Express app at `backend/src/server.ts` is already
 * Vercel-safe:
 *   - `app.listen()` is guarded against `process.env.VERCEL === '1'`
 *   - `app.set('trust proxy', 1)` so req.ip is correct behind the edge
 *
 * Vercel invokes the default export as `(req, res) => Promise<void>`.
 * Express's app is a function with that signature, so a passthrough
 * default export is all that's required.
 *
 * Postgres connection (Neon free tier) is configured in
 * `backend/src/config/database.ts` to read POSTGRES_URL /
 * POSTGRES_URL_DIRECT from env — set them in the Vercel project
 * Settings → Environment Variables.
 */

export { default } from '../backend/src/server';