/**
 * Dev seeder — HD-002.
 *
 * Creates a deterministic demo dataset:
 *   8 users (1 Admin, 2 Support Agents, 5 Employees — 1 inactive)
 *   1 counter row (ticket_number = 20)
 *   2 attachment rows (placeholder files)
 *   20 tickets distributed 8 Open / 5 In Progress / 4 Resolved / 3 Closed
 *   ~6 comments
 *   ~25 activity log entries (Created for every ticket + extras for
 *     assignments and status transitions)
 *
 * Idempotent — wipes demo data from every table (reverse dependency
 * order) inside a transaction before inserting. Safe to re-run.
 *
 * Note: sequelize-cli runs seeders as plain CommonJS — no TS.
 */

'use strict';

const bcrypt = require('bcrypt');

const BCRYPT_COST = 10;
const DEV_PASSWORD = 'password123';

async function wipe(queryInterface, transaction, tables) {
  // Order: leaf tables first to satisfy FKs even if SET CHECKS is on.
  for (const t of tables) {
    await queryInterface.bulkDelete(t, null, { transaction });
  }
}

module.exports = {
  async up(queryInterface, _Sequelize) {
    const now = new Date();
    const t = (offsetMinutes) =>
      new Date(now.getTime() - offsetMinutes * 60 * 1000);

    try {
      await queryInterface.sequelize.transaction(async (tx) => {
        // ─── WIPE in reverse dependency order ──────────────────────
        await wipe(queryInterface, tx, [
          'activity_logs',
          'comments',
          'tickets',
          'attachments',
          'counters',
          'users',
        ]);

        // ─── USERS ──────────────────────────────────────────────────
        const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);

        await queryInterface.bulkInsert(
          'users',
          [
            {
              email: 'admin@company.com',
              password_hash: passwordHash,
              display_name: 'Avery Patel',
              role: 'Admin',
              is_active: true,
              last_active_at: t(2),
              created_at: t(60 * 24 * 90),
              updated_at: t(2),
            },
            {
              email: 'sam@company.com',
              password_hash: passwordHash,
              display_name: 'Sam Chen',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(5),
              created_at: t(60 * 24 * 80),
              updated_at: t(5),
            },
            {
              email: 'morgan@company.com',
              password_hash: passwordHash,
              display_name: 'Morgan Lee',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(45),
              created_at: t(60 * 24 * 70),
              updated_at: t(45),
            },
            {
              email: 'eli@company.com',
              password_hash: passwordHash,
              display_name: 'Eli Tanaka',
              role: 'User',
              is_active: true,
              last_active_at: t(30),
              created_at: t(60 * 24 * 60),
              updated_at: t(30),
            },
            {
              email: 'jess@company.com',
              password_hash: passwordHash,
              display_name: 'Jess Park',
              role: 'User',
              is_active: true,
              last_active_at: t(120),
              created_at: t(60 * 24 * 50),
              updated_at: t(120),
            },
            {
              email: 'noah@company.com',
              password_hash: passwordHash,
              display_name: 'Noor Hassan',
              role: 'User',
              is_active: true,
              last_active_at: t(180),
              created_at: t(60 * 24 * 40),
              updated_at: t(180),
            },
            {
              email: 'priya@company.com',
              password_hash: passwordHash,
              display_name: 'Priya Singh',
              role: 'User',
              is_active: true,
              last_active_at: t(360),
              created_at: t(60 * 24 * 30),
              updated_at: t(360),
            },
            {
              email: 'tomas@company.com',
              password_hash: passwordHash,
              display_name: 'Tomas Rivera',
              role: 'User',
              is_active: false,
              last_active_at: t(60 * 24 * 14),
              created_at: t(60 * 24 * 20),
              updated_at: t(60 * 24 * 14),
            },
          ],
          { transaction: tx },
        );

        // Fetch user IDs (deterministic by insertion order).
        const [userRows] = await queryInterface.sequelize.query(
          'SELECT id, email FROM users ORDER BY id',
          { transaction: tx },
        );
        const userIdByEmail = Object.fromEntries(
          userRows.map((u) => [u.email, u.id]),
        );

        const adminId = userIdByEmail['admin@company.com'];
        const samId = userIdByEmail['sam@company.com'];
        const morganId = userIdByEmail['morgan@company.com'];
        const eliId = userIdByEmail['eli@company.com'];
        const jessId = userIdByEmail['jess@company.com'];
        const noahId = userIdByEmail['noah@company.com'];
        const priyaId = userIdByEmail['priya@company.com'];
        // tomas intentionally not used — he's inactive

        // ─── COUNTER ───────────────────────────────────────────────
        await queryInterface.bulkInsert(
          'counters',
          [{ name: 'ticket_number', value: 20 }],
          { transaction: tx },
        );

        // ─── ATTACHMENTS ───────────────────────────────────────────
        await queryInterface.bulkInsert(
          'attachments',
          [
            {
              filename: 'vpn-error-screenshot.png',
              size_bytes: 184320,
              mimetype: 'image/png',
              storage_path: 'uploads/seed/vpn-error-screenshot.png',
              uploaded_by_id: eliId,
              created_at: t(60 * 24 * 5),
            },
            {
              filename: 'expense-report-q3.pdf',
              size_bytes: 524288,
              mimetype: 'application/pdf',
              storage_path: 'uploads/seed/expense-report-q3.pdf',
              uploaded_by_id: jessId,
              created_at: t(60 * 24 * 2),
            },
          ],
          { transaction: tx },
        );

        const [attachmentRows] = await queryInterface.sequelize.query(
          'SELECT id, filename FROM attachments ORDER BY id',
          { transaction: tx },
        );
        const attachmentIdByName = Object.fromEntries(
          attachmentRows.map((a) => [a.filename, a.id]),
        );

        // ─── TICKETS ───────────────────────────────────────────────
        // Helper to assign a ticket number from the counter.
        async function nextNumber() {
          const [[row]] = await queryInterface.sequelize.query(
            "SELECT value FROM counters WHERE name = 'ticket_number' FOR UPDATE",
            { transaction: tx },
          );
          const next = Number(row.value) + 1;
          await queryInterface.sequelize.query(
            "UPDATE counters SET value = :v WHERE name = 'ticket_number'",
            { replacements: { v: next }, transaction: tx },
          );
          return `HD-${next}`;
        }

        const ticketSpecs = [
          // 8 Open
          {
            title: 'VPN keeps disconnecting on home network',
            description:
              'Every 10–15 minutes the VPN client drops. Happens only when I work from home. Office Wi-Fi is fine.',
            category: 'IT',
            priority: 'High',
            status: 'Open',
            submitterId: eliId,
            ownerId: null,
            attachmentFilename: 'vpn-error-screenshot.png',
          },
          {
            title: 'Need access to Figma',
            description: 'Joining the design crit next week — can someone grant Figma access?',
            category: 'IT',
            priority: 'Medium',
            status: 'Open',
            submitterId: jessId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Pay stub missing for last pay period',
            description:
              "I don't see the most recent pay stub in the portal. Can HR reissue?",
            category: 'HR',
            priority: 'Medium',
            status: 'Open',
            submitterId: noahId,
            ownerId: null,
            attachmentFilename: null,
          },
          {
            title: 'Reimbursement for client lunch',
            description: 'Need to be reimbursed for the client lunch on Tuesday ($84).',
            category: 'Finance',
            priority: 'Low',
            status: 'Open',
            submitterId: priyaId,
            ownerId: morganId,
            attachmentFilename: null,
          },
          {
            title: 'Monitor flicker on second display',
            description: 'Second monitor flickers black every few minutes. Cable reseated, no change.',
            category: 'IT',
            priority: 'Medium',
            status: 'Open',
            submitterId: eliId,
            ownerId: null,
            attachmentFilename: null,
          },
          {
            title: 'Request for standing desk converter',
            description: 'Back pain from sitting. Requesting a standing desk converter for my workstation.',
            category: 'General',
            priority: 'Low',
            status: 'Open',
            submitterId: jessId,
            ownerId: morganId,
            attachmentFilename: null,
          },
          {
            title: 'Slack notifications missing on mobile',
            description: 'I stopped getting Slack notifications on iOS after the last app update.',
            category: 'IT',
            priority: 'Low',
            status: 'Open',
            submitterId: noahId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Update direct deposit bank info',
            description: 'Changed banks — need to update direct deposit info on file.',
            category: 'Finance',
            priority: 'Medium',
            status: 'Open',
            submitterId: priyaId,
            ownerId: null,
            attachmentFilename: null,
          },

          // 5 In Progress
          {
            title: 'Office Wi-Fi keeps dropping in 4F',
            description:
              'Conference room Wi-Fi drops every ~30 minutes for 10–15 seconds. Meetings keep stalling.',
            category: 'IT',
            priority: 'High',
            status: 'In Progress',
            submitterId: eliId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Expense report submission failing',
            description:
              'Clicking submit on the Q3 expense report throws an error and clears the form.',
            category: 'Finance',
            priority: 'High',
            status: 'In Progress',
            submitterId: jessId,
            ownerId: morganId,
            attachmentFilename: 'expense-report-q3.pdf',
          },
          {
            title: 'New hire laptop provisioning',
            description: 'Need a MacBook Pro 14" set up for the new starter on Monday.',
            category: 'IT',
            priority: 'Medium',
            status: 'In Progress',
            submitterId: adminId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Annual leave balance looks wrong',
            description: 'Portal says I have 3 days left but I should have 8. Can HR check?',
            category: 'HR',
            priority: 'Medium',
            status: 'In Progress',
            submitterId: noahId,
            ownerId: morganId,
            attachmentFilename: null,
          },
          {
            title: 'Printer on 3F out of toner',
            description: 'The 3F printer shows "toner low" and prints faded. Needs a replacement cartridge.',
            category: 'General',
            priority: 'Low',
            status: 'In Progress',
            submitterId: priyaId,
            ownerId: samId,
            attachmentFilename: null,
          },

          // 4 Resolved
          {
            title: '2FA reset for new phone',
            description: 'Got a new phone — need to re-register 2FA for Okta.',
            category: 'IT',
            priority: 'High',
            status: 'Resolved',
            submitterId: eliId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Conference room A/V not working',
            description: 'HDMI handshake failing in the large conference room. Projector shows "no signal".',
            category: 'IT',
            priority: 'Medium',
            status: 'Resolved',
            submitterId: jessId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Tax form missing on file',
            description: 'Need a copy of my W-2 for the mortgage application.',
            category: 'Finance',
            priority: 'Medium',
            status: 'Resolved',
            submitterId: noahId,
            ownerId: morganId,
            attachmentFilename: null,
          },
          {
            title: 'Badges not opening 2F lab door',
            description: 'My badge stopped opening the 2F hardware lab door as of Monday.',
            category: 'General',
            priority: 'Medium',
            status: 'Resolved',
            submitterId: priyaId,
            ownerId: morganId,
            attachmentFilename: null,
          },

          // 3 Closed
          {
            title: 'Set up GitHub access for new contractor',
            description: 'Contractor starting next week — needs a GitHub seat.',
            category: 'IT',
            priority: 'Medium',
            status: 'Closed',
            submitterId: adminId,
            ownerId: samId,
            attachmentFilename: null,
          },
          {
            title: 'Reimbursement: team offsite dinner',
            description: 'Submitting receipts for the team offsite dinner ($412).',
            category: 'Finance',
            priority: 'Low',
            status: 'Closed',
            submitterId: eliId,
            ownerId: morganId,
            attachmentFilename: null,
          },
          {
            title: 'Broken desk chair (wheel)',
            description: 'The right wheel on my desk chair snapped off. Replacement requested.',
            category: 'General',
            priority: 'Low',
            status: 'Closed',
            submitterId: jessId,
            ownerId: morganId,
            attachmentFilename: null,
          },
        ];

        const ticketRows = [];
        for (const spec of ticketSpecs) {
          const number = await nextNumber();
          ticketRows.push({
            number,
            title: spec.title,
            description: spec.description,
            category: spec.category,
            priority: spec.priority,
            status: spec.status,
            submitter_id: spec.submitterId,
            owner_id: spec.ownerId,
            attachment_id: spec.attachmentFilename
              ? attachmentIdByName[spec.attachmentFilename] ?? null
              : null,
            created_at: t(60 * 24 * 14 - ticketSpecs.indexOf(spec) * 60 * 6),
            updated_at: t(60 * 24 * 14 - ticketSpecs.indexOf(spec) * 60 * 6),
            deleted_at: null,
          });
        }

        await queryInterface.bulkInsert('tickets', ticketRows, {
          transaction: tx,
        });

        const [createdTickets] = await queryInterface.sequelize.query(
          'SELECT id, number, status, owner_id, submitter_id FROM tickets ORDER BY id',
          { transaction: tx },
        );
        const ticketIdByNumber = Object.fromEntries(
          createdTickets.map((t2) => [t2.number, t2.id]),
        );
        // 1-based ticket-spec position → id. Lets comment/activity
        // specs target the i-th ticket without depending on the
        // current value of the ticket_number counter.
        const ticketIdByPosition = (pos) => createdTickets[pos - 1]?.id;

        // ─── COMMENTS (~6) ─────────────────────────────────────────
        // ticketPosition is 1-based — it refers to the i-th entry in
        // ticketSpecs above.
        const commentSpecs = [
          {
            ticketPosition: 9, // Office Wi-Fi
            authorId: samId,
            body:
              'Looking into the AP config now. Can you tell me the exact time of the last dropout?',
          },
          {
            ticketPosition: 10, // Expense report
            authorId: jessId,
            body: 'Tried again — same error. Form clears every time I hit submit.',
          },
          {
            ticketPosition: 10,
            authorId: morganId,
            body: 'I can repro. Rolling back the form service to last known good.',
          },
          {
            ticketPosition: 16, // 2FA reset
            authorId: samId,
            body:
              'Reset complete. New TOTP secret is in your authenticator app — please confirm.',
          },
          {
            ticketPosition: 17, // A/V
            authorId: jessId,
            body: 'Confirmed working — thanks for the quick turnaround!',
          },
          {
            ticketPosition: 19, // Badges
            authorId: priyaId,
            body: 'Tested again this morning and it works. Thanks!',
          },
        ];

        await queryInterface.bulkInsert(
          'comments',
          commentSpecs.map((c) => ({
            ticket_id: ticketIdByPosition(c.ticketPosition),
            author_id: c.authorId,
            body: c.body,
            created_at: t(60 * 24 * 2),
          })),
          { transaction: tx },
        );

        // ─── ACTIVITY LOGS ─────────────────────────────────────────
        // Every ticket gets a Created entry. In Progress / Resolved /
        // Closed tickets get additional Assigned + StatusChanged where
        // appropriate, plus a few CommentAdded events.
        const activityRows = [];
        let createdAt = 0;
        for (const tk of createdTickets) {
          activityRows.push({
            ticket_id: tk.id,
            actor_id: tk.submitter_id,
            event_type: 'Created',
            payload: JSON.stringify({ eventType: 'Created' }),
            created_at: t(60 * 24 * 14 - createdAt++ * 6),
          });
        }

        for (const tk of createdTickets) {
          if (tk.owner_id && tk.status !== 'Open') {
            activityRows.push({
              ticket_id: tk.id,
              actor_id: tk.owner_id,
              event_type: 'Assigned',
              payload: JSON.stringify({
                eventType: 'Assigned',
                assigneeId: tk.owner_id,
              }),
              created_at: t(60 * 24 * 12),
            });
          }
          if (tk.status === 'In Progress') {
            activityRows.push({
              ticket_id: tk.id,
              actor_id: tk.owner_id,
              event_type: 'StatusChanged',
              payload: JSON.stringify({
                eventType: 'StatusChanged',
                from: 'Open',
                to: 'In Progress',
              }),
              created_at: t(60 * 24 * 10),
            });
          }
          if (tk.status === 'Resolved') {
            activityRows.push({
              ticket_id: tk.id,
              actor_id: tk.owner_id,
              event_type: 'StatusChanged',
              payload: JSON.stringify({
                eventType: 'StatusChanged',
                from: 'In Progress',
                to: 'Resolved',
              }),
              created_at: t(60 * 24 * 4),
            });
            activityRows.push({
              ticket_id: tk.id,
              actor_id: tk.submitter_id,
              event_type: 'ConfirmedClosed',
              payload: JSON.stringify({
                eventType: 'ConfirmedClosed',
                closedBy: tk.submitter_id,
              }),
              created_at: t(60 * 24 * 3),
            });
          }
          if (tk.status === 'Closed') {
            activityRows.push({
              ticket_id: tk.id,
              actor_id: tk.owner_id,
              event_type: 'StatusChanged',
              payload: JSON.stringify({
                eventType: 'StatusChanged',
                from: 'Resolved',
                to: 'Closed',
              }),
              created_at: t(60 * 24 * 5),
            });
          }
        }

        // A couple of CommentAdded events for the tickets we commented on
        const commentTicketPositions = [9, 10, 10, 16, 17, 19];
        for (const pos of commentTicketPositions) {
          activityRows.push({
            ticket_id: ticketIdByPosition(pos),
            actor_id: null,
            event_type: 'CommentAdded',
            payload: JSON.stringify({
              eventType: 'CommentAdded',
              commentId: 0, // demo data only — comment id not wired
            }),
            created_at: t(60 * 24 * 2),
          });
        }

        await queryInterface.bulkInsert('activity_logs', activityRows, {
          transaction: tx,
        });

        // Summary (returned to sequelize-cli stdout)
        const [userCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM users',
          { transaction: tx },
        );
        const [ticketCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM tickets',
          { transaction: tx },
        );
        const [commentCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM comments',
          { transaction: tx },
        );
        const [activityCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM activity_logs',
          { transaction: tx },
        );
        const [attachmentCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM attachments',
          { transaction: tx },
        );
        const [counterCount] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS c FROM counters',
          { transaction: tx },
        );

        console.log(
          `✔ users (${userCount[0].c}) · counters (${counterCount[0].c}) · attachments (${attachmentCount[0].c}) · tickets (${ticketCount[0].c}) · comments (${commentCount[0].c}) · activity_logs (${activityCount[0].c})`,
        );
      });
    } catch (err) {
      console.error('Seeder failed:', err);
      throw err;
    }
  },

  async down(queryInterface, _Sequelize) {
    // Idempotent — if a table doesn't exist (e.g. we already undid
    // migrations), skip it instead of throwing.
    const tables = [
      'activity_logs',
      'comments',
      'tickets',
      'attachments',
      'counters',
      'users',
    ];
    for (const tbl of tables) {
      try {
        await queryInterface.bulkDelete(tbl, null, {});
      } catch (err) {
        if (err?.original?.code === 'ER_NO_SUCH_TABLE') continue;
        throw err;
      }
    }
  },
};
