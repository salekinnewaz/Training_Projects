/**
 * Frontend environment — HD-004.
 *
 * Single source of truth for backend URLs. The dev backend runs on
 * http://localhost:3000 (per backend/.env `PORT=3000`). CORS is
 * preconfigured in `backend/src/server.ts` to accept credentials
 * from this origin.
 *
 * Production swap: `environment.prod.ts` (relative `/api`,
 * D3). Wired via `fileReplacements` in `angular.json` so
 * `ng build --configuration=production` uses the prod env and
 * the dev build keeps using this file.
 */

export const environment = {
  production: false,
  // `localhost` (not `127.0.0.1`) so the page origin and the API
  // origin match — same-origin (same scheme + hostname + port)
  // is the only way the browser will echo the HttpOnly auth cookie
  // back on cross-port requests with `SameSite=Lax`. Mismatching
  // them (`localhost:4200` page → `127.0.0.1:3000` API) makes the
  // browser treat the calls as cross-site and withhold the cookie.
  apiBaseUrl: 'http://localhost:3000/api',
} as const;

export type Environment = typeof environment;
