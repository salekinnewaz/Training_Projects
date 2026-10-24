/**
 * Notifications controller — HD-019.
 *
 * Backs the chrome bell. Endpoints:
 *   GET  /api/notifications            → the caller's feed + unread
 *                                       count, newest first. The
 *                                       `limit` query param caps
 *                                       the page (default 20, max
 *                                       50).
 *   POST /api/notifications/:id/read   → mark one notification read
 *   POST /api/notifications/read-all   → mark every unread of the
 *                                       caller read in one sweep
 *
 * Every query is scoped to `req.user.id` taken from the JWT —
 * there is no request-body or query-param user id, so a caller can
 * never read or mutate someone else's feed (IDOR defence).
 *
 * The bell polls `GET /` on a timer; `unreadCount` drives the red
 * dot, `items` drives the dropdown. Both come from the same query
 * so the dot can never disagree with the list.
 */

import type { Request, Response } from 'express';

import { Notification, User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

/** Upper bound on `?limit=` so a caller can't ask for the whole
 * table in one round-trip and blow up the payload. */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * Coerce `?limit=` to a positive integer within [1, MAX_LIMIT].
 * A missing / unparseable / out-of-range value falls back to
 * DEFAULT_LIMIT rather than 400-ing — the bell polls this endpoint
 * on a timer and a malformed query shouldn't surface as an error
 * toast in the UI.
 */
function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/**
 * Parse the `:id` path param to a positive integer. Number.isInteger
 * rejects NaN, non-numeric strings, and fractional values so a
 * malformed id can never be silently coerced by Postgres.
 */
function parseNotificationId(rawId: string): number {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Notification id must be a positive integer.',
    );
  }
  return parsed;
}

/**
 * Serialize a Notification instance for the wire. The `actor` and
 * `ticket` associations are eager-loaded by the service so the
 * controller can serialize straight back without a second round-trip.
 *
 * `readAt` / `createdAt` are coerced to ISO strings. `unread` is a
 * convenience boolean the frontend uses directly instead of
 * re-deriving it from a possibly-null `readAt`.
 */
function serializeNotification(
  notification: Notification,
): Record<string, unknown> {
  const json = notification.toJSON() as unknown as Record<string, unknown>;
  return {
    id: json.id,
    type: json.type,
    title: json.title,
    body: json.body ?? null,
    ticketId: json.ticketId ?? null,
    actor: json.actor
      ? {
          id: (json.actor as Record<string, unknown>).id,
          displayName: (json.actor as Record<string, unknown>).displayName,
        }
      : null,
    unread: json.readAt === null,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
  };
}

/**
 * GET /api/notifications — the caller's feed + unread count.
 *
 * Auth via `authMiddleware` (populated `req.user`). Only rows with
 * `user_id = req.user.id` are returned — the filter is not
 * user-controllable.
 *
 * The unread count is computed in the same round-trip as the page
 * (a second `COUNT(*) WHERE read_at IS NULL` query) so the red dot
 * and the list can't disagree.
 *
 * @openapi
 * /notifications:
 *   get:
 *     summary: List the caller's notifications
 *     description: |
 *       Returns the caller's notification feed newest-first along
 *       with the unread count that drives the bell's red dot.
 *       `limit` is clamped to 1..50 (default 20).
 *     tags: [Notifications]
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notification feed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const limit = parseLimit(req.query.limit);

  // The feed page (newest first) and the unread tally in one go.
  const [items, unreadCount] = await Promise.all([
    Notification.findAll({
      where: { userId },
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'displayName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    }),
    Notification.count({ where: { userId, readAt: null } }),
  ]);

  res.status(200).json({
    items: items.map(serializeNotification),
    unreadCount,
  });
});

/**
 * POST /api/notifications/:id/read — mark one read.
 *
 * Scoped to `user_id = req.user.id` in the UPDATE's WHERE clause —
 * a caller who guesses another user's notification id matches zero
 * rows and gets 404 (not 403, to avoid confirming the row exists).
 *
 * Idempotent: re-marking an already-read notification is a no-op
 * that still returns 200, so the dropdown can fire the call on every
 * open without tracking read state locally.
 *
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark a notification read
 *     tags: [Notifications]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Marked read (idempotent).
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notificationId = parseNotificationId(req.params.id);
  const userId = req.user!.id;

  // The `userId` predicate is the IDOR guard — matching zero rows
  // (wrong owner OR missing row) both yield count 0 → 404.
  const [affected] = await Notification.update(
    { readAt: new Date() },
    { where: { id: notificationId, userId } },
  );

  if (affected === 0) {
    throw new HttpError(404, 'not_found', 'Notification not found.');
  }

  res.status(200).json({ id: notificationId, read: true });
});

/**
 * POST /api/notifications/read-all — mark every unread read.
 *
 * One UPDATE scoped to `userId` — the bell's "Mark all as read"
 * action. Responds with the number of rows flipped so the frontend
 * can zero the dot optimistically and reconcile.
 *
 * @openapi
 * /notifications/read-all:
 *   post:
 *     summary: Mark all the caller's notifications read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Sweep complete.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const [affected] = await Notification.update(
    { readAt: new Date() },
    { where: { userId, readAt: null } },
  );

  res.status(200).json({ updated: affected });
});