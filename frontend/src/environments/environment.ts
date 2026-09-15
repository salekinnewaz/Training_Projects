/**
 * Frontend environment — HD-004.
 *
 * Single source of truth for backend URLs. The dev backend runs on
 * http://localhost:3000 (per backend/.env `PORT=3000`). CORS is
 * preconfigured in `backend/src/server.ts` to accept credentials
 * from this origin.
 *
 * Production swap (environment.prod.ts) is out of MVP scope.
 */

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
} as const;

export type Environment = typeof environment;
