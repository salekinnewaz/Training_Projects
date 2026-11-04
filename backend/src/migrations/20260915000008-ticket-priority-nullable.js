'use strict';

/**
 * Makes `tickets.priority` nullable.
 *
 * The Admin dashboard's "Priority Distribution" donut has a fourth
 * bucket — "None" — for tickets filed without a priority. The
 * service already emits that bucket; until now the column was
 * NOT NULL so it could only ever be zero.
 *
 * Tickets created through the API still require a priority (the
 * validation layer rejects a missing one), so this only widens the
 * column for rows written outside the request path.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('tickets', 'priority', {
      type: 'enum_tickets_priority',
      allowNull: true,
    });
  },

  async down(queryInterface) {
    // Any row left without a priority would violate the restored
    // constraint, so give it the lowest non-null bucket first.
    await queryInterface.sequelize.query(
      "UPDATE tickets SET priority = 'Low' WHERE priority IS NULL",
    );
    await queryInterface.changeColumn('tickets', 'priority', {
      type: 'enum_tickets_priority',
      allowNull: false,
    });
  },
};
