/**
 * Migration: create counters table — HD-002.
 *
 * Internal monotonic counters. Today only one row exists:
 * ('ticket_number', <next>) — used by nextTicketNumber() to generate
 * HD-1, HD-2, ... in a transactionally-safe way.
 *
 * Not surfaced via any API in MVP.
 */

'use strict';

const TABLE = 'counters';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      TABLE,
      {
        name: {
          type: Sequelize.STRING(64),
          allowNull: false,
          primaryKey: true,
        },
        value: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
      },
    );
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
