/**
 * Migration: create comments table — HD-002.
 *
 * Comments are immutable past MVP — no updated_at. They cascade-
 * delete with their ticket.
 */

'use strict';

const TABLE = 'comments';

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
        author_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        body: {
          type: Sequelize.TEXT,
          allowNull: false,
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

    await queryInterface.addIndex(TABLE, ['ticket_id'], { name: 'ix_comments_ticket' });
    await queryInterface.addIndex(TABLE, ['author_id'], { name: 'ix_comments_author' });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
