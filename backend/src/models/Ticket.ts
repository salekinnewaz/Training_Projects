/**
 * Ticket model — HD-002.
 *
 * Core entity. Soft-delete via paranoid mode (deletedAt).
 * `number` is rendered as HD-<n> by nextTicketNumber() in
 * utils/ticketNumber.ts. status / priority / category are MySQL ENUMs.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High';
export type TicketCategory = 'IT' | 'HR' | 'Finance' | 'General';

export interface TicketAttributes {
  id: number;
  number: string;
  title: string;
  description: string;
  category: TicketCategory | null;
  priority: TicketPriority;
  status: TicketStatus;
  submitterId: number;
  ownerId: number | null;
  attachmentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type TicketCreationAttributes = Optional<
  TicketAttributes,
  | 'id'
  | 'category'
  | 'status'
  | 'ownerId'
  | 'attachmentId'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
>;

export class Ticket
  extends Model<TicketAttributes, TicketCreationAttributes>
  implements TicketAttributes
{
  declare id: number;
  declare number: string;
  declare title: string;
  declare description: string;
  declare category: TicketCategory | null;
  declare priority: TicketPriority;
  declare status: TicketStatus;
  declare submitterId: number;
  declare ownerId: number | null;
  declare attachmentId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt: Date | null;
}

Ticket.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('IT', 'HR', 'Finance', 'General'),
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Medium', 'High'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('Open', 'In Progress', 'Resolved', 'Closed'),
      allowNull: false,
      defaultValue: 'Open',
    },
    submitterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'submitter_id',
    },
    ownerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'owner_id',
    },
    attachmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'attachment_id',
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    sequelize,
    tableName: 'tickets',
    modelName: 'Ticket',
    underscored: true,
    timestamps: true,
    paranoid: true,
  },
);

export default Ticket;
