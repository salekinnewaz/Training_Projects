/**
 * User view shape (frontend) — HD-002.
 *
 * Mirrors the backend User model minus `passwordHash`, which is
 * never sent over the wire. The Angular services will populate
 * `passwordHash` only on a dedicated login DTO (HD-003), not via
 * the standard user payload.
 */

import type { UserRole } from './enums';

export interface UserPublic {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  lastActiveAt: string | null; // ISO 8601; null = never logged in
  createdAt: string;
  updatedAt: string;
  /**
   * How many live tickets this user is connected to (as submitter
   * or owner). Powers the Users page's "Tickets" column.
   *
   * OPTIONAL because `UserPublic` mirrors two different wire
   * shapes: `/api/auth/me` (the logged-in user — no ticket count
   * there) and `GET /api/users` (the full list — which DOES
   * carry it). Consumers must treat `undefined` as "not known" and
   * render 0 / skip the column.
   *
   * The single-user endpoints (PUT role / PUT status) do not return
   * it either — they send `0` — so the page preserves the count it
   * already had when it patches a row.
   */
  ticketCount?: number;
}
