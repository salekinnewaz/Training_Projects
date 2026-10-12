/**
 * Frontend environment — production (D3).
 *
 * Mirrors the dev `environment.ts` shape (same keys, same types) so
 * the swap in `angular.json` (`fileReplacements`) is the only thing
 * the production build changes. The relative `/api` path matches
 * the standard reverse-proxy pattern: the production frontend is
 * served behind the same origin as the backend, and `/api/*` is
 * proxied to the backend service. If the deploy target decides on
 * a different layout (e.g. a CDN-fronted static site that calls a
 * cross-origin API), the only file that needs to change is this
 * one — change `apiBaseUrl` to the absolute URL.
 *
 * Why a relative URL (and not an absolute one): the spec at
 * `spec-d3-prod-env.md` notes the deploy target isn't decided, and
 * the deferred-work D3 row's "Notes" column says "Add when
 * production deploy story lands." This file IS the contract that
 * downstream deploy work hangs off — the deploy story can change
 * `apiBaseUrl` without touching any other source file.
 */

export const environment = {
  production: true,
  apiBaseUrl: '/api',
} as const;

export type Environment = typeof environment;
