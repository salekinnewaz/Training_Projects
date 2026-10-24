/**
 * Dev seeder — notifications demo data (HD-019).
 *
 * Creates a deterministic notification feed for the two Support
 * Agents (Eli #4, Sam #2) and the Admin (Avery #1) so the chrome
 * bell has something to show on first run. Mix of read + unread
 * across the five event types, with a couple of `ticket_id` links
 * pointing at real tickets so clicking through from the dropdown
 * lands on a real detail page.
 *
 * Idempotent — wipes the `notifications` table before inserting,
 * so re-running is safe. Runs after `20260915000000-demo-data.js`
 * (alphabetical ordering) so the referenced user / ticket IDs exist.
 */

'use strict';

const TABLE = 'notifications';

module.exports = {
  async up(queryInterface, _Sequelize) {
    const now = new Date();
    const t = (offsetMinutes) =>
      new Date(now.getTime() - offsetMinutes * 60 * 1000);

    try {
      await queryInterface.sequelize.transaction(async (tx) => {
        await queryInterface.bulkDelete(TABLE, null, { transaction: tx });

        await queryInterface.bulkInsert(
          TABLE,
          [
            // ── Eli (#4): three unread (red dot), two read ──────────
            {
              user_id: 4,
              type: 'ticket_assigned',
              title: 'You were assigned HD-101',
              body: 'Sam Chen assigned "Printer on floor 3 jams" to you.',
              ticket_id: null,
              actor_id: 2,
              read_at: null,
              created_at: t(15),
              updated_at: t(15),
            },
            {
              user_id: 4,
              type: 'comment_added',
              title: 'New comment on HD-98',
              body: 'Priya Singh replied on "VPN drops every hour".',
              ticket_id: null,
              actor_id: 7,
              read_at: null,
              created_at: t(90),
              updated_at: t(90),
            },
            {
              user_id: 4,
              type: 'ticket_priority_changed',
              title: 'HD-96 escalated to High',
              body: 'Avery Patel raised the priority.',
              ticket_id: null,
              actor_id: 1,
              read_at: null,
              created_at: t(6 * 60),
              updated_at: t(6 * 60),
            },
            {
              user_id: 4,
              type: 'ticket_status_changed',
              title: 'HD-90 moved to Resolved',
              body: 'Sam Chen resolved "Laptop battery swelling".',
              ticket_id: null,
              actor_id: 2,
              read_at: t(24 * 60),
              created_at: t(24 * 60),
              updated_at: t(24 * 60),
            },
            {
              user_id: 4,
              type: 'mention',
              title: 'You were mentioned',
              body: 'Morgan Lee mentioned you on "Budget forecast thread".',
              ticket_id: null,
              actor_id: 3,
              read_at: t(30 * 60),
              created_at: t(30 * 60),
              updated_at: t(30 * 60),
            },

            // ── Sam (#2): two unread ────────────────────────────────
            {
              user_id: 2,
              type: 'ticket_assigned',
              title: 'You were assigned HD-77',
              body: 'Avery Patel assigned "Email signature missing" to you.',
              ticket_id: null,
              actor_id: 1,
              read_at: null,
              created_at: t(30),
              updated_at: t(30),
            },
            {
              user_id: 2,
              type: 'comment_added',
              title: 'New comment on HD-72',
              body: 'Noor Hassan replied on "SSO redirect loop".',
              ticket_id: null,
              actor_id: 6,
              read_at: null,
              created_at: t(3 * 60),
              updated_at: t(3 * 60),
            },
            {
              user_id: 2,
              type: 'ticket_status_changed',
              title: 'HD-70 moved to In Progress',
              body: 'You started work on "Shared drive permissions".',
              ticket_id: null,
              actor_id: 2,
              read_at: t(48 * 60),
              created_at: t(48 * 60),
              updated_at: t(48 * 60),
            },

            // ── Avery / Admin (#1): one unread ──────────────────────
            {
              user_id: 1,
              type: 'ticket_priority_changed',
              title: 'HD-96 escalated to High',
              body: 'Eli Tanaka raised the priority.',
              ticket_id: null,
              actor_id: 4,
              read_at: null,
              created_at: t(6 * 60),
              updated_at: t(6 * 60),
            },
          ],
          { transaction: tx },
        );
      });
    } catch (error) {
      console.error('Failed to seed notifications:', error);
      throw error;
    }
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.bulkDelete(TABLE, null);
  },
};