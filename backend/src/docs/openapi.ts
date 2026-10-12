/**
 * OpenAPI spec assembler — HD-015.
 *
 * Generates the OpenAPI 3.0.3 document that Swagger UI renders at
 * `GET /api/docs` and that tooling (curl, Postman import,
 * codegen) can fetch at `GET /api/docs.json`.
 *
 * The spec is built from two sources:
 *
 *   1. The hand-written `components` block in `sharedComponents`
 *      below — the wire-shape schemas (User, Ticket, Comment,
 *      ActivityLog, the error envelopes) and the cookieAuth
 *      security scheme. Every per-route `@openapi` block in the
 *      controllers `$ref`s these, so a schema change happens in
 *      one place.
 *
 *   2. The `@openapi` JSDoc blocks above every exported handler
 *      in `src/controllers/*.ts`. swagger-jsdoc scans those
 *      comments at boot and merges them into `paths`.
 *
 * `getOpenApiSpec()` is sync and caches the result, so the
 * swagger-ui-express `setup(spec)` call and the `/api/docs.json`
 * route share the same instance.
 *
 * **Cookie name**: the JWT rides in an HttpOnly cookie named
 * `auth` (see `utils/cookies.ts:16`). The `cookieAuth` security
 * scheme references that name verbatim — Swagger UI's "Authorize"
 * dialog prompts for the cookie value.
 *
 * **Why per-route annotations instead of a yaml file?** Same
 * reason every Express-TS project picks JSDoc: the OpenAPI doc
 * lives next to the code that implements it. Drift gets caught
 * in code review. Hand-written yaml drifts the moment someone
 * adds a route and forgets to update the file.
 */

import swaggerJSDoc from 'swagger-jsdoc';

import packageJson from '../../package.json';

/**
 * Shared OpenAPI `components` block — schemas, responses, and
 * security schemes. Every `@openapi` block in the controllers
 * references these via `$ref`, so a wire-shape change happens
 * in one place and propagates to every endpoint that uses it.
 */
const sharedComponents = {
  securitySchemes: {
    /**
     * The `auth` HttpOnly cookie set by `POST /api/auth/login`
     * and read by `authMiddleware`. Swagger UI's "Authorize"
     * button surfaces this; the user pastes the cookie value
     * (copy from browser devtools after logging in) and every
     * subsequent "Try it out" call sends it.
     */
    cookieAuth: {
      type: 'apiKey',
      in: 'cookie',
      name: 'auth',
      description:
        'HttpOnly JWT cookie set by `POST /api/auth/login`. ' +
        'Copy the cookie value from browser devtools — it cannot ' +
        'be set from JavaScript because it is HttpOnly.',
    },
  },
  schemas: {
    // ── User ──────────────────────────────────────────────────────
    User: {
      type: 'object',
      required: [
        'id',
        'email',
        'displayName',
        'role',
        'isActive',
        'lastActiveAt',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: { type: 'integer', example: 7 },
        email: { type: 'string', format: 'email', example: 'user@company.com' },
        displayName: { type: 'string', example: 'Avery Patel' },
        role: {
          type: 'string',
          enum: ['User', 'Support Agent', 'Admin'],
          example: 'User',
        },
        isActive: { type: 'boolean', example: true },
        lastActiveAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2026-10-12T12:00:00.000Z',
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    AgentSummary: {
      type: 'object',
      required: ['id', 'displayName', 'role'],
      properties: {
        id: { type: 'integer', example: 4 },
        displayName: { type: 'string', example: 'Sam Patel' },
        role: {
          type: 'string',
          enum: ['Support Agent', 'Admin'],
          example: 'Support Agent',
        },
      },
    },

    // ── Ticket ────────────────────────────────────────────────────
    Ticket: {
      type: 'object',
      required: [
        'id',
        'number',
        'title',
        'description',
        'status',
        'priority',
        'category',
        'submitterId',
        'ownerId',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ],
      properties: {
        id: { type: 'integer', example: 47 },
        number: { type: 'string', example: 'HD-0047' },
        title: { type: 'string', example: 'VPN disconnects every 5 minutes' },
        description: { type: 'string', example: 'Since this morning, my VPN …' },
        status: {
          type: 'string',
          enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
          example: 'Open',
        },
        priority: {
          type: 'string',
          enum: ['Low', 'Medium', 'High'],
          example: 'Medium',
        },
        category: { type: 'string', nullable: true, example: 'Network' },
        submitterId: { type: 'integer', example: 7 },
        ownerId: { type: 'integer', nullable: true, example: 4 },
        attachmentId: { type: 'integer', nullable: true, example: null },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        deletedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
        },
      },
    },

    // ── Comment ───────────────────────────────────────────────────
    Comment: {
      type: 'object',
      required: ['id', 'ticketId', 'authorId', 'body', 'createdAt', 'author'],
      properties: {
        id: { type: 'integer', example: 12 },
        ticketId: { type: 'integer', example: 47 },
        authorId: { type: 'integer', example: 4 },
        body: { type: 'string', example: "I've reproduced on my machine." },
        createdAt: { type: 'string', format: 'date-time' },
        author: { $ref: '#/components/schemas/AgentSummary' },
      },
    },

    // ── Activity log ──────────────────────────────────────────────
    ActivityLog: {
      type: 'object',
      required: ['id', 'ticketId', 'eventType', 'createdAt'],
      properties: {
        id: { type: 'integer', example: 88 },
        ticketId: { type: 'integer', example: 47 },
        actorId: { type: 'integer', nullable: true, example: 4 },
        eventType: {
          type: 'string',
          enum: [
            'Created',
            'Assigned',
            'Reassigned',
            'StatusChanged',
            'PriorityChanged',
            'Reopened',
            'ConfirmedClosed',
            'CommentAdded',
          ],
          example: 'StatusChanged',
        },
        payload: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
          description:
            'Event-specific JSON. Shape varies by eventType — see ActivityEventPayload in backend/src/models/ActivityLog.ts.',
        },
        createdAt: { type: 'string', format: 'date-time' },
        actor: {
          allOf: [{ $ref: '#/components/schemas/AgentSummary' }],
          nullable: true,
        },
      },
    },

    // ── Dashboard buckets ────────────────────────────────────────
    DashboardBucket: {
      type: 'object',
      required: ['rows', 'total'],
      properties: {
        rows: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } },
        total: { type: 'integer', example: 14 },
      },
    },
    DashboardResponse: {
      type: 'object',
      required: ['open', 'inProgress', 'resolved', 'closed'],
      properties: {
        open: { $ref: '#/components/schemas/DashboardBucket' },
        inProgress: { $ref: '#/components/schemas/DashboardBucket' },
        resolved: { $ref: '#/components/schemas/DashboardBucket' },
        closed: { $ref: '#/components/schemas/DashboardBucket' },
      },
    },

    // ── Response envelopes ────────────────────────────────────────
    HealthResponse: {
      type: 'object',
      required: ['status', 'service', 'timestamp'],
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'helpdesk-lite-backend' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
    LoginResponse: {
      type: 'object',
      required: ['user'],
      properties: {
        user: {
          type: 'object',
          required: ['id', 'email', 'displayName', 'role'],
          properties: {
            id: { type: 'integer', example: 7 },
            email: { type: 'string', format: 'email' },
            displayName: { type: 'string' },
            role: {
              type: 'string',
              enum: ['User', 'Support Agent', 'Admin'],
            },
          },
        },
      },
    },
    MeResponse: {
      type: 'object',
      required: ['user'],
      properties: {
        user: { $ref: '#/components/schemas/User' },
      },
    },
    TicketListResponse: {
      type: 'object',
      required: ['tickets', 'count'],
      properties: {
        tickets: {
          type: 'array',
          items: { $ref: '#/components/schemas/Ticket' },
        },
        count: { type: 'integer', example: 3 },
      },
    },
    TicketResponse: {
      type: 'object',
      required: ['ticket'],
      properties: {
        ticket: { $ref: '#/components/schemas/Ticket' },
      },
    },
    CommentListResponse: {
      type: 'object',
      required: ['comments', 'count'],
      properties: {
        comments: {
          type: 'array',
          items: { $ref: '#/components/schemas/Comment' },
        },
        count: { type: 'integer', example: 4 },
      },
    },
    CommentCreateResponse: {
      type: 'object',
      required: ['comment'],
      properties: {
        comment: { $ref: '#/components/schemas/Comment' },
      },
    },
    ActivityListResponse: {
      type: 'object',
      required: ['events', 'count'],
      properties: {
        events: {
          type: 'array',
          items: { $ref: '#/components/schemas/ActivityLog' },
        },
        count: { type: 'integer', example: 9 },
      },
    },
    AgentListResponse: {
      type: 'object',
      required: ['agents', 'count'],
      properties: {
        agents: {
          type: 'array',
          items: { $ref: '#/components/schemas/AgentSummary' },
        },
        count: { type: 'integer', example: 4 },
      },
    },
    UserListResponse: {
      type: 'object',
      required: ['users', 'count'],
      properties: {
        users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        count: { type: 'integer', example: 6 },
      },
    },

    // ── Request bodies ────────────────────────────────────────────
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@company.com' },
        password: { type: 'string', minLength: 1, example: 'password123' },
      },
    },
    CreateTicketRequest: {
      type: 'object',
      required: ['title', 'description', 'priority'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1 },
        category: { type: 'string', nullable: true },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        attachmentId: { type: 'integer', nullable: true },
      },
    },
    UpdateTicketRequest: {
      type: 'object',
      description:
        'Partial update. Only fields present are applied. Per-field role + transition rules enforced (see controller).',
      properties: {
        status: {
          type: 'string',
          enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        category: { type: 'string', nullable: true },
        ownerId: { type: 'integer', nullable: true },
      },
    },
    AddCommentRequest: {
      type: 'object',
      required: ['body'],
      properties: {
        body: { type: 'string', minLength: 1, maxLength: 5000 },
      },
    },
    UpdateRoleRequest: {
      type: 'object',
      required: ['role'],
      properties: {
        role: { type: 'string', enum: ['User', 'Support Agent', 'Admin'] },
      },
    },
    UpdateStatusRequest: {
      type: 'object',
      required: ['isActive'],
      properties: {
        isActive: { type: 'boolean' },
      },
    },

    // ── Attachment upload response (4-field wire shape) ────────
    AttachmentUploadResponse: {
      type: 'object',
      required: ['id', 'filename', 'sizeBytes', 'mimetype'],
      properties: {
        id: { type: 'integer', example: 47 },
        filename: { type: 'string', example: 'screenshot.png' },
        sizeBytes: { type: 'integer', example: 1048576 },
        mimetype: {
          type: 'string',
          example: 'image/png',
          description: 'One of the values in the upload allowlist.',
        },
      },
    },

    // ── Error envelopes (mirrors HttpErrorBody in utils/errors.ts) ─
    ErrorBody: {
      type: 'object',
      required: ['error', 'message'],
      properties: {
        error: {
          type: 'string',
          example: 'not_found',
          description:
            'Machine-readable error code. Stable across versions; safe to switch on.',
        },
        message: {
          type: 'string',
          example: 'Ticket not found.',
          description: 'Human-readable. Subject to change; not for switch logic.',
        },
      },
    },
    ValidationErrorBody: {
      allOf: [
        { $ref: '#/components/schemas/ErrorBody' },
        {
          type: 'object',
          required: ['fields'],
          properties: {
            error: { type: 'string', enum: ['validation_error'] },
            fields: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Per-field error messages keyed by field name.',
              example: { email: 'Enter a valid email address.' },
            },
          },
        },
      ],
    },
  },
  responses: {
    NotFound: {
      description: 'Resource not found.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
        },
      },
    },
    ValidationError: {
      description: 'Request body failed validation.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidationErrorBody' },
        },
      },
    },
    Unauthorized: {
      description: 'Missing or invalid `auth` cookie.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
          example: { error: 'unauthorized', message: 'Authentication required.' },
        },
      },
    },
    Forbidden: {
      description: "Authenticated but not allowed to perform this action.",
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
          example: { error: 'forbidden', message: 'Admin only.' },
        },
      },
    },
    Conflict: {
      description: 'A uniqueness constraint was violated.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
        },
      },
    },
    UnsupportedMediaType: {
      description: 'Attachment mimetype is not in the allowlist.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
          example: {
            error: 'unsupported_media_type',
            message: 'This file type is not allowed.',
          },
        },
      },
    },
    PayloadTooLarge: {
      description: 'Attachment exceeds the 10 MB cap.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorBody' },
          example: {
            error: 'file_too_large',
            message: 'File is larger than 10 MB. Pick a smaller file.',
          },
        },
      },
    },
  },
};

/**
 * swagger-jsdoc configuration. The `apis` glob is resolved
 * relative to the project root (where `node` is invoked),
 * which matches the swagger-jsdoc documented behavior.
 *
 * The first call to `swaggerJSDoc(...)` parses every JSDoc
 * block in the matched files and assembles the full spec.
 * The result is cached at module load so every subsequent
 * `getOpenApiSpec()` call returns the same object.
 */
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'HelpDesk Lite API',
      version: packageJson.version,
      description:
        'Internal helpdesk — tickets, comments, user management. ' +
        'All endpoints under `/api`. Most require an `auth` HttpOnly ' +
        'cookie (set by `POST /api/auth/login`). Click "Authorize" in ' +
        'the UI to attach the cookie to subsequent requests.',
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Local development',
      },
    ],
    components: sharedComponents,
    tags: [
      { name: 'Health', description: 'Liveness / metadata.' },
      { name: 'Auth', description: 'Login, logout, current user.' },
      { name: 'Tickets', description: 'Ticket lifecycle (HD-007 to HD-012).' },
      { name: 'Users', description: 'User listing + admin role / status management (HD-010, HD-014).' },
      { name: 'Admin', description: 'Admin-only surfaces (HD-013).' },
      { name: 'Attachments', description: 'File upload + download (HD-016).' },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

const cachedSpec = swaggerJSDoc(swaggerOptions);

/**
 * Return the assembled OpenAPI document. Sync, cached at module
 * load. `swagger-ui-express` accepts the result directly; the
 * `/api/docs.json` route also serves it raw.
 */
export function getOpenApiSpec(): object {
  return cachedSpec;
}
