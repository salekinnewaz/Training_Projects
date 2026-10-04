/**
 * Ticket view shape (frontend) — HD-002 + HD-010.
 *
 * Mirrors backend Ticket. Includes the nested submitter / owner /
 * attachment that the API will return when the ticket is fetched
 * with its associations.
 *
 * HD-010 (Ticket Detail) also references the nested Comment and
 * ActivityLog types — they live in their own model files and are
 * re-exported here for ergonomic imports from the page component.
 */

import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './enums';
import type { Attachment } from './attachment';
import type { Comment } from './comment';
import type { ActivityLog } from './activity-log';
import type { UserPublic } from './user';

export interface Ticket {
  id: number;
  number: string; // "HD-21"
  title: string;
  description: string;
  category: TicketCategory | null;
  priority: TicketPriority;
  status: TicketStatus;
  submitter: UserPublic;
  owner: UserPublic | null; // null = Unassigned
  attachment: Attachment | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type { Comment, ActivityLog };
