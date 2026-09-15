/**
 * Ticket view shape (frontend) — HD-002.
 *
 * Mirrors backend Ticket. Includes the nested submitter / owner /
 * attachment that the API will return when the ticket is fetched
 * with its associations.
 */

import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './enums';
import type { Attachment } from './attachment';
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
