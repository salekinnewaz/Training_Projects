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
  // Client-side attachment size cap. Mirrors the backend's
  // `MAX_UPLOAD_BYTES`, which is 4 MB on Vercel: the platform
  // rejects request bodies larger than 4.5 MB before the app
  // ever sees them, so the honest cap has to be lower than
  // that limit or the client gets an opaque platform 413
  // instead of our actionable one.
  maxAttachmentBytes: 4 * 1024 * 1024,
} as const;

export type Environment = typeof environment;
