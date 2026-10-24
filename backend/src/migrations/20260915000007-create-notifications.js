/**
 * Migration: create notifications table — HD-019.
 *
 * Per-user notification feed behind the chrome bell. Each row is a
 * single event addressed to exactly one recipient (`user_id`), with
 * an optional `ticket_id` (deep-link target) and `actor_id` (who
 * triggered it).
 *
 * `read_at` is null while unread — the bell's red dot and the
 * `unreadCount` in `GET /api/notifications` are both derived from
 * `WHERE read_at IS NULL`, so no separate boolean column is needed
 * and marking read is a single UPDATE.
 *
 * `type` is a VARCHAR rather than an ENUM so adding a new event
 * kind later doesn't require a migration — the frontend switches on
 * the string and falls back to a neutral icon for unknown values.
 *
 * Postgres notes: INTEGER (no UNSIGNED). No engine/charset/collate.
 */

'use strict';

const TABLE = 'notifications';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'tickets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      read_at: {
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

    // The bell's unread count and the "mark all read" sweep both
    // scan by (user_id) WHERE read_at IS NULL on every poll, so that
    // exact predicate gets its own index.
    await queryInterface.addIndex(TABLE, ['user_id', 'read_at'], {
      name: 'ix_notifications_user_read',
    });
    // The dropdown's default ordering is `created_at DESC` scoped to
    // one user — this index serves the ORDER BY directly.
    await queryInterface.addIndex(TABLE, ['user_id', 'created_at'], {
      name: 'ix_notifications_user_created',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};