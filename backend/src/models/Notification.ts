/**
 * Notification model — HD-019.
 *
 * Per-user notification feed rows behind the chrome bell. The wire
 * shape is intentionally narrow — the dropdown only needs id, type,
 * title, body, ticket link, actor display name, createdAt and the
 * read flag. Associations are eager-loaded in the controller's
 * `list` handler.
 *
 * `userId` is the recipient. `actorId` is who triggered the event
 * (nullable for system events like "Your ticket was auto-closed").
 * `ticketId` is the deep-link target — also nullable for non-ticket
 * notifications.
 *
 * The `type` field is a STRING rather than ENUM so the seeder /
 * service can introduce new event kinds without a migration.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/** Stable string keys for the kinds of notifications we emit. The
 * frontend `Notification` model switches on these. New values are
 * additive; the dropdown falls back to a neutral icon for unknown
 * types. */
export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_priority_changed'
  | 'comment_added'
  | 'mention';

export interface NotificationAttributes {
  id: number;
  userId: number;
  type: NotificationType | string;
  title: string;
  body: string | null;
  ticketId: number | null;
  actorId: number | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  | 'id'
  | 'body'
  | 'ticketId'
  | 'actorId'
  | 'readAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare id: number;
  declare userId: number;
  declare type: NotificationType | string;
  declare title: string;
  declare body: string | null;
  declare ticketId: number | null;
  declare actorId: number | null;
  declare readAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'ticket_id',
    },
    actorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'actor_id',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    modelName: 'Notification',
    underscored: true,
    timestamps: true,
  },
);

export default Notification;