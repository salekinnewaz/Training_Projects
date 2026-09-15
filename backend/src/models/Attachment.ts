/**
 * Attachment model — HD-002.
 *
 * Stores file metadata only. The actual upload pipeline (file write,
 * mimetype sniffing, download route) lands in HD-016. HD-002 only
 * seeds two rows pointing at placeholder storage paths.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface AttachmentAttributes {
  id: number;
  filename: string;
  sizeBytes: number;
  mimetype: string;
  storagePath: string;
  uploadedById: number;
  createdAt: Date;
}

export type AttachmentCreationAttributes = Optional<
  AttachmentAttributes,
  'id' | 'createdAt'
>;

export class Attachment
  extends Model<AttachmentAttributes, AttachmentCreationAttributes>
  implements AttachmentAttributes
{
  declare id: number;
  declare filename: string;
  declare sizeBytes: number;
  declare mimetype: string;
  declare storagePath: string;
  declare uploadedById: number;
  declare readonly createdAt: Date;
}

Attachment.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sizeBytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'size_bytes',
    },
    mimetype: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    storagePath: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 'storage_path',
    },
    uploadedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'uploaded_by_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'attachments',
    modelName: 'Attachment',
    underscored: true,
    timestamps: false,
  },
);

export default Attachment;
