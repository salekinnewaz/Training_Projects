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

        // Resolve the users by EMAIL rather than by hard-coded id.
        // The demo-data seeder recreates the `users` table from
        // scratch, so its row ids move every time it runs; the
        // notifications' foreign keys then point at rows that no
        // longer exist and the insert fails. Looking the ids up by
        // email keeps this seeder independent of the other seeder's
        // insertion order.
        const [userRows] = await queryInterface.sequelize.query(
          'SELECT id, email FROM users',
          { transaction: tx },
        );
        const idByEmail = Object.fromEntries(
          userRows.map((u) => [u.email, u.id]),
        );
        const idOf = (email) => {
          const id = idByEmail[email];
          if (!id) {
            throw new Error(
              `notifications seeder: no user with email ${email}`,
            );
          }
          return id;
        };

        const AVERY = idOf('admin@company.com');
        const SAM = idOf('sam@company.com');
        const MORGAN = idOf('morgan@company.com');
        const ELI = idOf('eli@company.com');
        const NOAH = idOf('noah@company.com');
        const PRIYA = idOf('priya@company.com');

        await queryInterface.bulkInsert(
          TABLE,
          [
            // ── Eli: three unread (red dot), two read ───────────────
            {
              user_id: ELI,
              type: 'ticket_assigned',
              title: 'You were assigned HD-101',
              body: 'Sam Chen assigned "Printer on floor 3 jams" to you.',
              ticket_id: null,
              actor_id: SAM,
              read_at: null,
              created_at: t(15),
              updated_at: t(15),
            },
            {
              user_id: ELI,
              type: 'comment_added',
              title: 'New comment on HD-98',
              body: 'Priya Singh replied on "VPN drops every hour".',
              ticket_id: null,
              actor_id: PRIYA,
              read_at: null,
              created_at: t(90),
              updated_at: t(90),
            },
            {
              user_id: ELI,
              type: 'ticket_priority_changed',
              title: 'HD-96 escalated to High',
              body: 'Avery Patel raised the priority.',
              ticket_id: null,
              actor_id: AVERY,
              read_at: null,
              created_at: t(6 * 60),
              updated_at: t(6 * 60),
            },
            {
              user_id: ELI,
              type: 'ticket_status_changed',
              title: 'HD-90 moved to Resolved',
              body: 'Sam Chen resolved "Laptop battery swelling".',
              ticket_id: null,
              actor_id: SAM,
              read_at: t(24 * 60),
              created_at: t(24 * 60),
              updated_at: t(24 * 60),
            },
            {
              user_id: ELI,
              type: 'mention',
              title: 'You were mentioned',
              body: 'Morgan Lee mentioned you on "Budget forecast thread".',
              ticket_id: null,
              actor_id: MORGAN,
              read_at: t(30 * 60),
              created_at: t(30 * 60),
              updated_at: t(30 * 60),
            },

            // ── Sam: two unread ──────────────────────────────────────
            {
              user_id: SAM,
              type: 'ticket_assigned',
              title: 'You were assigned HD-77',
              body: 'Avery Patel assigned "Email signature missing" to you.',
              ticket_id: null,
              actor_id: AVERY,
              read_at: null,
              created_at: t(30),
              updated_at: t(30),
            },
            {
              user_id: SAM,
              type: 'comment_added',
              title: 'New comment on HD-72',
              body: 'Noor Hassan replied on "SSO redirect loop".',
              ticket_id: null,
              actor_id: NOAH,
              read_at: null,
              created_at: t(3 * 60),
              updated_at: t(3 * 60),
            },
            {
              user_id: SAM,
              type: 'ticket_status_changed',
              title: 'HD-70 moved to In Progress',
              body: 'You started work on "Shared drive permissions".',
              ticket_id: null,
              actor_id: SAM,
              read_at: t(48 * 60),
              created_at: t(48 * 60),
              updated_at: t(48 * 60),
            },

            // ── Avery / Admin: one unread ────────────────────────────
            {
              user_id: AVERY,
              type: 'ticket_priority_changed',
              title: 'HD-96 escalated to High',
              body: 'Eli Tanaka raised the priority.',
              ticket_id: null,
              actor_id: ELI,
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