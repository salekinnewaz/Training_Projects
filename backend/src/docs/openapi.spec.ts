/**
 * openapi.spec.ts — HD-015.
 *
 * Sanity test that the assembled OpenAPI document contains every
 * endpoint, every shared schema, and the cookieAuth security
 * scheme. Catches silent regressions if someone removes an
 * `@openapi` block from a controller handler.
 *
 * One `it()` with a flat list of `expect()`s so the test report
 * is a single roll-up. Individual expectations can fail with
 * precise names (`Expected spec.paths to have property '/auth/me'`).
 */

import { describe, it, expect } from '@jest/globals';

import { getOpenApiSpec } from './openapi';

describe('OpenAPI spec (HD-015)', () => {
  const spec = getOpenApiSpec() as {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, Record<string, unknown>>;
    components: {
      securitySchemes: Record<string, { type: string; in: string; name: string }>;
      schemas: Record<string, unknown>;
      responses: Record<string, unknown>;
    };
  };

  it('contains every endpoint + the cookie auth scheme + key schemas', () => {
    // ── Top-level metadata ────────────────────────────────────────
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('HelpDesk Lite API');
    expect(typeof spec.info.version).toBe('string');

    // ── All 18 paths (covering 20 HTTP methods across 5 routers) ──
    // Note: GET and PATCH on /tickets/{id} share one path entry,
    // so 18 paths × 20 methods. The list below is the union of
    // every documented operation.
    const expectedPaths = [
      '/health',
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/auth/register',
      '/tickets',
      '/tickets/mine',
      '/tickets/queue',
      '/tickets/{id}',
      '/tickets/{id}/activity',
      '/tickets/{id}/comments',
      '/tickets/{id}/confirm-close',
      '/tickets/{id}/reopen',
      '/users',
      '/users/agents',
      '/users/{id}/role',
      '/users/{id}/status',
      '/admin/dashboard',
    ];
    for (const p of expectedPaths) {
      expect(spec.paths).toHaveProperty(p);
    }
    // Belt-and-braces: confirm the path count.
    expect(Object.keys(spec.paths).length).toBe(expectedPaths.length);

    // ── Security: cookieAuth with the right cookie name ───────────
    expect(spec.components.securitySchemes).toHaveProperty('cookieAuth');
    expect(spec.components.securitySchemes.cookieAuth).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'auth',
      description: expect.stringContaining('HttpOnly JWT cookie'),
    });

    // ── Schemas: every wire shape the controllers emit ────────────
    const expectedSchemas = [
      'User',
      'AgentSummary',
      'Ticket',
      'Comment',
      'ActivityLog',
      'DashboardBucket',
      'DashboardResponse',
      'HealthResponse',
      'LoginResponse',
      'MeResponse',
      'TicketListResponse',
      'TicketResponse',
      'CommentListResponse',
      'CommentCreateResponse',
      'ActivityListResponse',
      'AgentListResponse',
      'UserListResponse',
      'LoginRequest',
      'CreateTicketRequest',
      'UpdateTicketRequest',
      'AddCommentRequest',
      'UpdateRoleRequest',
      'UpdateStatusRequest',
      'ErrorBody',
      'ValidationErrorBody',
    ];
    for (const s of expectedSchemas) {
      expect(spec.components.schemas).toHaveProperty(s);
    }

    // ── Responses: the shared error envelopes ─────────────────────
    for (const r of [
      'NotFound',
      'ValidationError',
      'Unauthorized',
      'Forbidden',
      'Conflict',
    ]) {
      expect(spec.components.responses).toHaveProperty(r);
    }

    // ── Every operation has a summary + tags + at least one
    //    response (catches a handler whose @openapi block was
    //    truncated mid-YAML). ─────────────────────────────────────
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [verb, op] of Object.entries(methods)) {
        if (verb.startsWith('x-')) continue;
        expect((op as { summary?: string }).summary).toBeTruthy();
        expect((op as { tags?: string[] }).tags).toBeTruthy();
        expect((op as { responses?: unknown }).responses).toBeTruthy();
        // Tag is a non-empty array of strings.
        const tags = (op as { tags: string[] }).tags;
        expect(Array.isArray(tags)).toBe(true);
        expect(tags.length).toBeGreaterThan(0);
        // Unused arg so the path / verb show in failure messages.
        expect(typeof path).toBe('string');
        expect(typeof verb).toBe('string');
      }
    }
  });
});
