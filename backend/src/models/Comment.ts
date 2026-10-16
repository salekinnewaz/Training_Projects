/**
 * Comment model — HD-002.
 *
 * Discussion entry on a ticket. Immutable past MVP — no updatedAt.
 * Comments cascade-delete with their ticket.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface CommentAttributes {
  id: number;
  ticketId: number;
  authorId: number;
  body: string;
  createdAt: Date;
}

export type CommentCreationAttributes = Optional<
  CommentAttributes,
  'id' | 'createdAt'
>;

export class Comment
  extends Model<CommentAttributes, CommentCreationAttributes>
  implements CommentAttributes
{
  declare id: number;
  declare ticketId: number;
  declare authorId: number;
  declare body: string;
  declare readonly createdAt: Date;
}

Comment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ticket_id',
    },
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'author_id',
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'comments',
    modelName: 'Comment',
    underscored: true,
    // Auto-stamp createdAt on insert. Comments are immutable past
    // MVP — no updatedAt column on the table.
    timestamps: true,
    updatedAt: false,
  },
);

export default Comment;
