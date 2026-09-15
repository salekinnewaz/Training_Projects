/**
 * Migration: create tickets table — HD-002.
 *
 * Core entity. Soft-delete via deleted_at (paranoid mode in the
 * Sequelize model). `number` is rendered as HD-<n> by the
 * ticketNumber utility and is unique.
 *
 * Owns comments + activity_log via CASCADE on delete.
 * Owner + attachment use SET NULL so removing a user or an
 * attachment row doesn't drop tickets.
 */

'use strict';

const TABLE = 'tickets';

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
        number: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        category: {
          type: Sequelize.ENUM('IT', 'HR', 'Finance', 'General'),
          allowNull: true,
        },
        priority: {
          type: Sequelize.ENUM('Low', 'Medium', 'High'),
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM('Open', 'In Progress', 'Resolved', 'Closed'),
          allowNull: false,
          defaultValue: 'Open',
        },
        submitter_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        owner_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        attachment_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'attachments',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
      },
    );

    await queryInterface.addIndex(TABLE, ['number'], {
      name: 'ux_tickets_number',
      unique: true,
    });
    await queryInterface.addIndex(TABLE, ['status'], { name: 'ix_tickets_status' });
    await queryInterface.addIndex(TABLE, ['priority'], { name: 'ix_tickets_priority' });
    await queryInterface.addIndex(TABLE, ['submitter_id'], { name: 'ix_tickets_submitter' });
    await queryInterface.addIndex(TABLE, ['owner_id'], { name: 'ix_tickets_owner' });
    await queryInterface.addIndex(TABLE, ['attachment_id'], { name: 'ix_tickets_attachment' });
    await queryInterface.addIndex(TABLE, ['deleted_at'], { name: 'ix_tickets_deleted_at' });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
