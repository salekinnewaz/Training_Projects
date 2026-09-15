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
}
