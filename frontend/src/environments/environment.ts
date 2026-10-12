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
  apiBaseUrl: 'http://localhost:3000/api',
} as const;

export type Environment = typeof environment;
