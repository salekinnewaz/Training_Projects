/**
 * User model — HD-002.
 *
 * Represents an authenticated human (Employee / Support Agent / Admin).
 * The `role` column uses a MySQL ENUM. The default scope strips
 * `passwordHash` so callers don't accidentally ship hashes through
 * APIs; use the `withPassword` scope (or include attribute) when
 * the auth flow needs the hash (HD-003).
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type UserRole = 'User' | 'Support Agent' | 'Admin';

export interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'isActive' | 'lastActiveAt' | 'createdAt' | 'updatedAt'
>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare displayName: string;
  declare role: UserRole;
  declare isActive: boolean;
  declare lastActiveAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    displayName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'display_name',
    },
    role: {
      type: DataTypes.ENUM('User', 'Support Agent', 'Admin'),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active_at',
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
    tableName: 'users',
    modelName: 'User',
    underscored: true,
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['passwordHash'] },
      },
    },
  },
);

export default User;
