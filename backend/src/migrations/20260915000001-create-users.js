/**
 * Migration: create users table — HD-002.
 *
 * Authenticated humans (Employees / Support Agents / Admins).
 * Stores bcrypt password hashes; HD-003 wires the actual auth flow.
 *
 * Postgres notes:
 *   - No UNSIGNED in Postgres; we use plain INTEGER.
 *   - No engine/charset/collate table options (Postgres uses UTF-8
 *     cluster-wide; collation is per-column if needed).
 *   - ENUM is supported natively; Sequelize emits CREATE TYPE … AS ENUM.
 *
 * Note: sequelize-cli runs migration files as plain CommonJS — no
 * TypeScript transpilation. Parameter names must be valid JS identifiers.
 */

'use strict';

const TABLE = 'users';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('User', 'Support Agent', 'Admin'),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_active_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(TABLE, ['email'], {
      name: 'ux_users_email',
      unique: true,
    });
    await queryInterface.addIndex(TABLE, ['role'], { name: 'ix_users_role' });
    await queryInterface.addIndex(TABLE, ['is_active'], { name: 'ix_users_is_active' });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
