/**
 * ActivityLog model — HD-002.
 *
 * Append-only event stream for every state transition on a ticket.
 * actorId is nullable so system-generated events (auto-reopen, etc.)
 * can be logged without a human author.
 *
 * `payload` is JSON whose shape depends on eventType — see the
 * ActivityEventPayload union in models/index.ts.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ActivityEventType =
  | 'Created'
  | 'Assigned'
  | 'Reassigned'
  | 'StatusChanged'
  | 'PriorityChanged'
  | 'Reopened'
  | 'ConfirmedClosed'
  | 'CommentAdded';

export interface ActivityLogAttributes {
  id: number;
  ticketId: number;
  actorId: number | null;
  eventType: ActivityEventType;
  payload: unknown | null; // narrowed per eventType via ActivityEventPayload
  createdAt: Date;
}

export type ActivityLogCreationAttributes = Optional<
  ActivityLogAttributes,
  'id' | 'actorId' | 'payload' | 'createdAt'
>;

export class ActivityLog
  extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>
  implements ActivityLogAttributes
{
  declare id: number;
  declare ticketId: number;
  declare actorId: number | null;
  declare eventType: ActivityEventType;
  declare payload: unknown | null;
  declare readonly createdAt: Date;
}

ActivityLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'ticket_id',
    },
    actorId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'actor_id',
    },
    eventType: {
      type: DataTypes.ENUM(
        'Created',
        'Assigned',
        'Reassigned',
        'StatusChanged',
        'PriorityChanged',
        'Reopened',
        'ConfirmedClosed',
        'CommentAdded',
      ),
      allowNull: false,
      field: 'event_type',
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'activity_logs',
    modelName: 'ActivityLog',
    underscored: true,
    timestamps: false,
  },
);

export default ActivityLog;
