/**
 * Comment view shape (frontend) — HD-002.
 *
 * Mirrors backend Comment. Immutable past MVP.
 */

import type { UserPublic } from './user';

export interface Comment {
  id: number;
  ticketId: number;
  author: UserPublic;
  body: string;
  createdAt: string;
}
