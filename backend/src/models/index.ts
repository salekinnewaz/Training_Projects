/**
 * Models registry — HD-002.
 *
 * Imports every model so its `init()` runs against the shared
 * Sequelize instance from src/config/database.ts, then wires up
 * associations. This file is imported as a side-effect by
 * src/config/database.ts so the runtime instance has all model
 * metadata attached.
 *
 * Re-exports the models so callers can do:
 *   import { User, Ticket } from '../models';
 */

import sequelize from '../config/database';

import User from './User';
import Ticket from './Ticket';
import Comment from './Comment';
import ActivityLog from './ActivityLog';
import Attachment from './Attachment';
import Counter from './Counter';

export type ActivityEventPayload =
  | { eventType: 'Created' }
  | { eventType: 'Assigned'; assigneeId: number }
  | { eventType: 'Reassigned'; fromUserId: number | null; toUserId: number }
  | { eventType: 'StatusChanged'; from: string; to: string }
  | { eventType: 'PriorityChanged'; from: string; to: string }
  | { eventType: 'Reopened'; reopenedBy: number }
  | { eventType: 'ConfirmedClosed'; closedBy: number }
  | { eventType: 'CommentAdded'; commentId: number };

function defineAssociations(): void {
  // User → Tickets (as submitter / owner)
  User.hasMany(Ticket, {
    as: 'submittedTickets',
    foreignKey: 'submitterId',
  });
  User.hasMany(Ticket, {
    as: 'ownedTickets',
    foreignKey: 'ownerId',
  });

  // User → Comments
  User.hasMany(Comment, {
    as: 'comments',
    foreignKey: 'authorId',
  });

  // User → ActivityLog (as actor)
  User.hasMany(ActivityLog, {
    as: 'actorEvents',
    foreignKey: 'actorId',
  });

  // User → Attachments (as uploader)
  User.hasMany(Attachment, {
    as: 'uploads',
    foreignKey: 'uploadedById',
  });

  // Ticket ← User (submitter / owner)
  Ticket.belongsTo(User, {
    as: 'submitter',
    foreignKey: 'submitterId',
  });
  Ticket.belongsTo(User, {
    as: 'owner',
    foreignKey: 'ownerId',
  });

  // Ticket ← Attachment (1:1, optional)
  Ticket.belongsTo(Attachment, {
    as: 'attachment',
    foreignKey: 'attachmentId',
  });

  // Ticket → Comments
  Ticket.hasMany(Comment, {
    as: 'comments',
    foreignKey: 'ticketId',
    onDelete: 'CASCADE',
  });

  // Ticket → ActivityLog
  Ticket.hasMany(ActivityLog, {
    as: 'activityLog',
    foreignKey: 'ticketId',
    onDelete: 'CASCADE',
  });

  // Comment → Ticket / Author
  Comment.belongsTo(Ticket, {
    as: 'ticket',
    foreignKey: 'ticketId',
  });
  Comment.belongsTo(User, {
    as: 'author',
    foreignKey: 'authorId',
  });

  // ActivityLog → Ticket / Actor
  ActivityLog.belongsTo(Ticket, {
    as: 'ticket',
    foreignKey: 'ticketId',
  });
  ActivityLog.belongsTo(User, {
    as: 'actor',
    foreignKey: 'actorId',
  });

  // Attachment → Uploader
  Attachment.belongsTo(User, {
    as: 'uploadedBy',
    foreignKey: 'uploadedById',
  });
}

defineAssociations();

export {
  sequelize,
  User,
  Ticket,
  Comment,
  ActivityLog,
  Attachment,
  Counter,
};
