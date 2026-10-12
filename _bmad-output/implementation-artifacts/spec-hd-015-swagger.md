---
title: 'HD-015 — Swagger / OpenAPI documentation at /api/docs'
---

# HD-015 — Swagger / OpenAPI documentation at /api/docs

## Intent

The HelpDesk Lite backend exposes 21 endpoints across 5 routers
(`/api/health`, `/api/auth`, `/api/tickets`, `/api/users`,
`/api/admin`) but ships with **zero API documentation** — no
Swagger, no OpenAPI yaml, no Postman collection. The only
documentation is inline JSDoc on each handler, which isn't
browsable.

HD-015 adds a browsable, interactive API reference: open
`http://localhost:3000/api/docs` and see every endpoint grouped
by tag, with full request/response schemas and a "Try it out"
button. The OpenAPI JSON is also served at `/api/docs.json` for
tooling (curl, codegen, import into Postman, etc.).

This is a dev-tooling slice, not a product story. The contract
being documented is already locked in (the controllers) — this
story just makes that contract visible.

## Boundaries

### In scope

- Mount Swagger UI at `GET /api/docs` + raw OpenAPI JSON at
  `GET /api/docs.json` under the existing `/api` mount.
- Annotate every existing controller handler with `@openapi`
  JSDoc blocks (21 endpoints).
- Define shared `components.schemas` (wire shapes) +
  `components.responses` (error envelopes) so per-route
  annotations stay short.
- Document the existing `token` HttpOnly cookie as a
  `cookieAuth` security scheme so Swagger UI's "Authorize"
  button can attach it to requests.
- One sanity spec (`openapi.spec.ts`) that asserts the
  generated spec contains all 21 paths + the cookie scheme +
  the key schemas. Catches silent regressions if someone
  removes an annotation.

### Out of scope

- No code generation, no client SDK generation.
- No "Authorize" / RBAC flow on the UI side — the cookie scheme
  is documented, but the backend doesn't grow any new auth path.
- No versioning, no `requestBody.example` per route, no per-route
  `description` prose beyond a one-line `summary`.
- No splitting into "public" vs "internal" surfaces — every
  endpoint is documented.
- No CSRF considerations — the docs UI is GET-only.
- No Postman / Insomnia collection export.
- No changes to the frontend (the docs live entirely in the
  backend).

## I/O matrix (high level)

| User action | System response |
|---|---|
| Visit `http://localhost:3000/api/docs` | Browser loads Swagger UI HTML page with 21 endpoints grouped under 5 tags |
| Visit `http://localhost:3000/api/docs.json` | Browser receives the raw OpenAPI 3.0.3 JSON document |
| Click `Try it out` on `GET /health` | UI issues the request and shows `{ status: "ok", service, timestamp }` |
| Click `Authorize` → paste JWT cookie → click `Try it out` on `GET /api/tickets/mine` | UI issues the request with the cookie and shows the user's tickets |
| `curl -s :3000/api/docs.json \| jq '.paths \| keys' \| length` | Shell prints `21` |

## Test plan

### Unit (Jest)

- `backend/src/docs/openapi.spec.ts` — single `it()` with ~30
  assertions:
  - `getOpenApiSpec()` returns without throwing.
  - `spec.paths` contains all 21 path keys.
  - `spec.components.securitySchemes.cookieAuth` is defined and
    `in: 'cookie'`, `name: 'token'`.
  - `spec.components.schemas` contains `User`, `Ticket`,
    `Comment`, `ActivityLog`, `ErrorBody`, `HealthResponse`,
    `LoginResponse`, `TicketListResponse`, `DashboardResponse`,
    `UserListResponse`.
  - Every operation has a `summary`, at least one
    `responses.<status>`, and a `tags` array.

### Integration (manual browser smoke)

- `cd backend && npm run dev` (already runs on `:3000`).
- Open `http://localhost:3000/api/docs` → Swagger UI loads
  with all 21 endpoints under 5 tags (Health, Auth, Tickets,
  Users, Admin).
- `GET /api/docs.json` returns a valid OpenAPI 3.0.3 JSON
  document with 21 paths.
- `GET /api/health` via the UI's "Try it out" returns 200 with
  the expected body.

## Files

**New:**
- `backend/src/docs/openapi.ts` (~250 lines: spec assembler +
  shared schemas/responses + cookieAuth security scheme)
- `backend/src/docs/openapi.spec.ts` (~35 lines, single `it()`
  with ~30 assertions)
- `_bmad-output/implementation-artifacts/spec-hd-015-swagger.md`
  (this file)
- `_bmad-output/hd015.diff`

**Modified:**
- `backend/package.json` (add `swagger-jsdoc` + `swagger-ui-express`
  to devDependencies)
- `backend/src/server.ts` (2 imports + 2 mounts)
- `backend/src/controllers/healthController.ts` (1 `@openapi` block)
- `backend/src/controllers/authController.ts` (4 `@openapi` blocks)
- `backend/src/controllers/ticketsController.ts` (10 `@openapi`
  blocks)
- `backend/src/controllers/usersController.ts` (4 `@openapi` blocks)
- `backend/src/controllers/adminController.ts` (1 `@openapi` block)

## Implementation order

1. Add `swagger-jsdoc` + `swagger-ui-express` to
   `backend/package.json`; run `npm install`.
2. Write `backend/src/docs/openapi.ts` with the spec assembler
   + shared `components.schemas` + `components.responses` +
   `cookieAuth` scheme. The function `getOpenApiSpec()` should
   be a no-op throw-away at this point (no annotations yet), so
   the spec assembles with 0 paths but the file compiles.
3. Mount in `server.ts` (so any wiring bug surfaces early,
   before the annotation work).
4. Add `@openapi` blocks to every controller, in this order:
   1. `healthController` (simplest, 1 endpoint).
   2. `authController` (4 endpoints, introduces `LoginRequest`
      + `LoginResponse` + uses cookieAuth).
   3. `usersController` (4 endpoints, introduces `User` +
      `UserListResponse` + `UpdateRoleRequest` +
      `UpdateStatusRequest`).
   4. `ticketsController` (10 endpoints, biggest set,
      introduces `Ticket` + `Comment` + `ActivityLog` +
      `TicketListResponse` + the various request bodies).
   5. `adminController` (1 endpoint, introduces
      `DashboardResponse`).
5. Write `backend/src/docs/openapi.spec.ts` and run `npm test`
   — all 21 paths must be present.
6. Run `npm run typecheck` — exits 0.
7. Manual browser smoke (see Test plan → Integration).
8. Generate diff, commit, push (two-commit pattern).

## Verification

1. `cd backend && npm test` — **74/74 pass** (was 73 + 1 new
   `openapi.spec.ts` with ~30 assertions in a single `it()`).
2. `cd backend && npm run typecheck` — exits 0. (The
   `@openapi` blocks are inside JSDoc so TS doesn't type-check
   them, but the spec config + UI mount must compile.)
3. `cd backend && npm run dev` then:
   - `curl -s :3000/api/docs.json | jq '.paths | keys | length'`
     → `21`.
   - `curl -s :3000/api/docs.json | jq
     '.components.securitySchemes.cookieAuth'` → cookie scheme
     with `name: "token"`.
   - Browser: `http://localhost:3000/api/docs` loads Swagger UI
     with all 21 endpoints under 5 tags.
4. Frontend untouched — `npx ng test` and `npx ng build` both
   unaffected (148/154 baseline holds).

## Reuse (no new patterns)

- `HttpErrorBody` shape in `backend/src/utils/errors.ts:13` →
  `ErrorBody` OpenAPI schema (and the `fields` optional
  property is the `ValidationErrorBody` schema).
- Cookie name `token` in `backend/src/utils/cookies.ts` →
  `cookieAuth` security scheme `name`.
- Existing serializers in each controller (`serializeTicket`,
  `serializeUser`, `serializeComment`, `serializeActivity`) are
  the source of truth for the schemas — the OpenAPI doc just
  mirrors them.
- The frontend's matching `UserPublic` / `Ticket` / `Comment`
  interfaces already stay in lockstep with the backend by
  hand. The OpenAPI doc adds another mirror of the same
  contract — three-way sync is on the human, same as it is
  today.

## Notes for the implementer

- swagger-jsdoc is sync on first call; the spec is built once
  at module load and cached. `getOpenApiSpec()` returns the
  same object every time.
- swagger-ui-express can throw if `setup(spec)` is called with
  a malformed spec. The `openapi.spec.ts` smoke test catches
  the silent case where a path is missing but the UI still
  renders. For malformed cases, the UI will fail loudly on
  first request.
- JSDoc blocks must be **directly above** the exported handler
  (no blank lines, no intermediate comments) for swagger-jsdoc
  to pick them up. The existing controller JSDoc blocks
  describe the handler's intent — keep those, append the
  `@openapi` block as a second paragraph.
- The `*` glob in `apis: ['./src/routes/*.ts',
  './src/controllers/*.ts']` is relative to the project root
  (where `node` is invoked from), not to the openapi.ts file.
  This matches swagger-jsdoc's documented behavior.
