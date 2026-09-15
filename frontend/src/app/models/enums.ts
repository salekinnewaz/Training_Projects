/**
 * Enum string-literal unions — HD-002.
 *
 * Mirrors the MySQL ENUM columns. Keep these in sync with
 * backend/src/models/*.ts and the matching migrations.
 *
 * Note: the backend stores role as the literal string 'User'.
 * The UI surfaces it as "Employee" — that's a UI concern, not a
 * data shape concern.
 */

export type UserRole = 'User' | 'Support Agent' | 'Admin';

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export type TicketPriority = 'Low' | 'Medium' | 'High';

export type TicketCategory = 'IT' | 'HR' | 'Finance' | 'General';

export type ActivityEventType =
  | 'Created'
  | 'Assigned'
  | 'Reassigned'
  | 'StatusChanged'
  | 'PriorityChanged'
  | 'Reopened'
  | 'ConfirmedClosed'
  | 'CommentAdded';
