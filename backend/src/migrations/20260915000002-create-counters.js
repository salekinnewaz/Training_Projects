/**
 * Migration: create counters table — HD-002.
 *
 * Internal monotonic counters. Today only one row exists:
 * ('ticket_number', <next>) — used by nextTicketNumber() to generate
 * HD-1, HD-2, ... in a transactionally-safe way.
 *
 * Postgres notes: BIGINT (not UNSIGNED) — Postgres has no UNSIGNED.
 * No engine/charset/collate; Postgres uses UTF-8 cluster-wide.
 *
 * Not surfaced via any API in MVP.
 */

'use strict';

const TABLE = 'counters';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      name: {
        type: Sequelize.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      value: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};
