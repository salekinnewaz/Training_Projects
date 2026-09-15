/**
 * Migration: create activity_logs table — HD-002.
 *
 * Append-only event stream for every state transition. actor_id
 * is nullable so system-generated events (auto-reopen, etc.) can
 * be logged without a human author.
 *
 * `payload` is JSON whose shape depends on event_type (see the
 * TypeScript ActivityEventPayload union in models/index.ts).
 * No updated_at — entries are immutable.
 */

'use strict';

const TABLE = 'activity_logs';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      TABLE,
      {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        ticket_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'tickets',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        actor_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        event_type: {
          type: Sequelize.ENUM(
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
        },
        payload: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
      },
    );

    await queryInterface.addIndex(TABLE, ['ticket_id', 'created_at'], {
      name: 'ix_activity_logs_ticket_created',
    });
    await queryInterface.addIndex(TABLE, ['actor_id'], { name: 'ix_activity_logs_actor' });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
