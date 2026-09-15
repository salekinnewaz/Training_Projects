/**
 * Attachment view shape (frontend) — HD-002.
 *
 * Mirrors backend Attachment. The download endpoint that
 * streams the bytes lands in HD-016.
 */

import type { UserPublic } from './user';

export interface Attachment {
  id: number;
  filename: string;
  sizeBytes: number;
  mimetype: string;
  storagePath: string;
  uploadedBy: UserPublic;
  createdAt: string;
}
