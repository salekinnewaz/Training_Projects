/**
 * ActivityLog view shape (frontend) — HD-002.
 *
 * Mirrors backend ActivityLog. The `payload` field is a
 * discriminated union keyed on `eventType` so consumers can
 * switch exhaustively without ever falling back to `any`.
 */

import type { ActivityEventType } from './enums';
import type { UserPublic } from './user';

export type ActivityEventPayload =
  | { eventType: 'Created' }
  | { eventType: 'Assigned'; assigneeId: number }
  | {
      eventType: 'Reassigned';
      fromUserId: number | null;
      toUserId: number;
    }
  | { eventType: 'StatusChanged'; from: string; to: string }
  | { eventType: 'PriorityChanged'; from: string; to: string }
  | { eventType: 'Reopened'; reopenedBy: number }
  | { eventType: 'ConfirmedClosed'; closedBy: number }
  | { eventType: 'CommentAdded'; commentId: number };

export interface ActivityLog {
  id: number;
  ticketId: number;
  actor: UserPublic | null; // null = system event
  eventType: ActivityEventType;
  payload: ActivityEventPayload | null;
  createdAt: string;
}
