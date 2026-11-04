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
              // The second admin. Riley is INACTIVE so the Users
              // Overview donut reads 7 active / 1 inactive out of
              // 8 users, and he is the only account that never
              // surfaces in the dashboard's five newest-users list.
              email: 'riley@company.com',
              password_hash: passwordHash,
              display_name: 'Riley Costa',
              role: 'Admin',
              is_active: false,
              last_active_at: t(60 * 24 * 14),
              created_at: t(60 * 24 * 80),
              updated_at: t(60 * 24 * 14),
            },
            {
              // Sam is the persona the QA harness, the role audit and
              // the Playwright fixtures log in as, so he stays a
              // Support Agent.
              email: 'sam@company.com',
              password_hash: passwordHash,
              display_name: 'Sam Chen',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(5),
              created_at: t(60 * 24 * 70),
              updated_at: t(5),
            },
            {
              // Eli is the persona the user logs in as when
              // hand-running the app, per the HD-019 visual-verification
              // instructions. Earlier seeds created him as a regular
              // User, but the actual HD-019 work made /tickets (the
              // agent-only Tickets list page) the agent home and gave
              // Eli agent access to support the new flow. The QA
              // fixtures (`roleHomePath`, ROLE_HOME) and
              // `qa/scripts/visual-tickets-check.mjs` already target an
              // agent Eli; promoting him here keeps code + DB + QA in
              // sync.
              email: 'eli@company.com',
              password_hash: passwordHash,
              display_name: 'Eli Tanaka',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(22),
              // Joined yesterday — the newest account, so he heads
              // the Admin dashboard's "Recent Users" list. He and
              // Jess are the only two accounts inside the trailing
              // seven-day window, which is what the "new this week"
              // counter reports.
              created_at: t(60 * 24 * 1),
              updated_at: t(22),
            },
            {
              email: 'jess@company.com',
              password_hash: passwordHash,
              display_name: 'Jess Park',
              role: 'User',
              is_active: true,
              last_active_at: t(3 * 60),
              // Joined two days ago — the second-newest account.
              created_at: t(60 * 24 * 2),
              updated_at: t(3 * 60),
            },
            {
              email: 'morgan@company.com',
              password_hash: passwordHash,
              display_name: 'Morgan Lee',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(60),
              created_at: t(60 * 24 * 8),
              updated_at: t(60),
            },
            {
              email: 'noah@company.com',
              password_hash: passwordHash,
              display_name: 'Noor Hassan',
              role: 'User',
              is_active: true,
              last_active_at: t(4 * 60),
              created_at: t(60 * 24 * 10),
              updated_at: t(4 * 60),
            },
            {
              email: 'priya@company.com',
              password_hash: passwordHash,
              display_name: 'Priya Singh',
              role: 'Support Agent',
              is_active: true,
              last_active_at: t(7 * 60),
              created_at: t(60 * 24 * 12),
              updated_at: t(7 * 60),
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
        // The counter starts above the reference's hand-numbered
        // rows (HD-34 … HD-53) so the generated tickets never
        // collide with them.
        await queryInterface.bulkInsert(
          'counters',
          [{ name: 'ticket_number', value: 60 }],
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

          // ─── The five most recently updated ─────────────────────
          // The Admin dashboard's "Recent Tickets" table is ordered
          // by updatedAt DESC, so these five carry the newest
          // timestamps and are the rows the table shows. They are
          // listed here in the order they should appear, and each
          // carries the reference's ticket number so the "#" column
          // reads HD-53, HD-34, HD-52, HD-40, HD-39.
          {
            title: 'Health check failing on server',
            description:
              'The nightly health check has been failing since the last deploy. Need someone to look at the service status.',
            category: 'IT',
            priority: 'High',
            status: 'Open',
            submitterId: adminId,
            ownerId: null,
            attachmentFilename: null,
            minutesAgo: 16,
            number: 'HD-53',
          },
          {
            title: '2FA reset for new phone',
            description:
              'I replaced my phone and lost access to the authenticator. Could you reset 2FA on my account?',
            category: 'IT',
            priority: 'High',
            status: 'Open',
            submitterId: noahId,
            ownerId: samId,
            attachmentFilename: null,
            minutesAgo: 27,
            number: 'HD-34',
          },
          {
            title: 'Probe v4: Eli connection issue',
            description:
              'The new probe build drops its connection every few minutes on the lab segment.',
            category: 'IT',
            priority: 'Medium',
            status: 'In Progress',
            submitterId: jessId,
            ownerId: morganId,
            attachmentFilename: null,
            minutesAgo: 60,
            number: 'HD-52',
          },
          {
            title: 'Broken disk on server',
            description:
              'One of the server disks is reporting a SMART failure. Replacing it tonight.',
            category: 'IT',
            priority: 'High',
            status: 'Resolved',
            submitterId: noahId,
            ownerId: eliId,
            attachmentFilename: null,
            minutesAgo: 180,
            number: 'HD-40',
          },
          {
            title: 'Reimbursement: team offsite expenses',
            description: 'Submitting the receipts for the team offsite expenses ($268).',
            category: 'Finance',
            priority: 'Low',
            status: 'Open',
            submitterId: eliId,
            ownerId: jessId,
            attachmentFilename: null,
            minutesAgo: 300,
            number: 'HD-39',
          },
        ];

        // The tickets are dated across the LAST SEVEN DAYS so the
        // Admin dashboard's "Ticket Trends" chart (a 7-day window)
        // shows a populated bar per day rather than a single spike.
        //
        // Every day index below is the number of days AGO, so index 0
        // is today and index 6 is the oldest day in the window. The
        // authored specs are dealt out across those days and the
        // generated rows top each day up to its target.
        const TREND_WINDOW_DAYS = 7;
        // The reference's per-day ticket totals, indexed by days ago
        // (0 = today). The chart reads these left to right once the
        // service flips the buckets oldest-first, so the visual order
        // is 16, 26, 20, 21, 34, 28, 15.
        //
        // The tallest bar is 34 so the chart's y-axis rounds up to
        // the reference's "40" ceiling — the axis shows one step of
        // headroom above the tallest bar. The seven days sum to 156,
        // which is the workspace's total ticket count.
        const TREND_DAY_TOTALS = [15, 28, 34, 21, 20, 26, 12];
        // The per-status split of each day's tickets, as
        // [open, inProgress, resolved, closed], also indexed by days
        // ago. The seven days sum to 42 Open / 28 In Progress /
        // 62 Resolved / 24 Closed — the reference's stat strip — and
        // each row sums to that day's total.
        const TREND_DAY_SPLITS = [
          [4, 2, 7, 2],
          [8, 6, 10, 4],
          [8, 6, 15, 5],
          [6, 4, 7, 4],
          [5, 4, 8, 3],
          [7, 5, 10, 4],
          [4, 1, 5, 2],
        ];
        const BULK_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
        const BULK_CATEGORIES = ['IT', 'HR', 'Finance', 'General'];
        const BULK_PRIORITIES = ['Medium', 'Low', 'High'];
        const BULK_SUBMITTERS = [
          adminId,
          samId,
          morganId,
          eliId,
          jessId,
          noahId,
          priyaId,
        ];
        const BULK_OWNERS = [samId, morganId, eliId, null];

        // Deal the authored specs out across the trend days so each
        // day's authored rows never overshoot its target split. The
        // authored pool is walked day by day, status by status, and
        // the first spec of each status wins the slot — that keeps
        // the hand-written narrative (the titles, categories and
        // priorities) spread evenly instead of clumping on one day.
        const authoredByDay = [];
        for (let d = 0; d < TREND_WINDOW_DAYS; d++) {
          authoredByDay.push(BULK_STATUSES.map(() => 0));
        }
        const authoredPlan = [];
        {
          // The five hand-numbered specs are the "Recent Tickets"
          // rows, so they all sit on today.
          const handNumbered = ticketSpecs.filter(
            (s) => typeof s.minutesAgo === 'number',
          );
          for (const spec of handNumbered) {
            const si = BULK_STATUSES.indexOf(spec.status);
            authoredPlan.push({ spec, daysAgo: 0 });
            if (si >= 0) authoredByDay[0][si] += 1;
          }
          // The remaining specs fill the leftover slots, oldest day
          // first so the oldest bar is the fullest.
          const regular = ticketSpecs.filter(
            (s) => typeof s.minutesAgo !== 'number',
          );
          for (const spec of regular) {
            const si = BULK_STATUSES.indexOf(spec.status);
            let placed = false;
            for (let d = TREND_WINDOW_DAYS - 1; d >= 0 && !placed; d--) {
              if (si < 0) {
                placed = true;
                authoredPlan.push({ spec, daysAgo: d });
                break;
              }
              if (authoredByDay[d][si] < TREND_DAY_SPLITS[d][si]) {
                authoredByDay[d][si] += 1;
                authoredPlan.push({ spec, daysAgo: d });
                placed = true;
              }
            }
            if (!placed) {
              // Fall back to the day with the most remaining room.
              let best = 0;
              for (let d = 1; d < TREND_WINDOW_DAYS; d++) {
                if (TREND_DAY_TOTALS[d] > TREND_DAY_TOTALS[best]) best = d;
              }
              authoredPlan.push({ spec, daysAgo: best });
              if (si >= 0) authoredByDay[best][si] += 1;
            }
          }
        }

        // A timestamp INSIDE the calendar day that is `daysAgo` days
        // back. The trend chart buckets by the database's calendar
        // day, so a row must land between that day's local midnight
        // and the next one — a flat 24-hour offset from "now" would
        // spill rows into the neighbouring day.
        const atDay = (daysAgo, hour, minute) => {
          const d = new Date(now);
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - daysAgo);
          d.setHours(hour, minute, 0, 0);
          return d;
        };

        const ticketRows = [];
        for (const { spec, daysAgo } of authoredPlan) {
          // A spec with an explicit number keeps it; everything else
          // draws the next number from the counter.
          const number = spec.number ?? (await nextNumber());
          // Spread the row through the working day it belongs to so
          // the timestamps look organic.
          const createdAt = atDay(
            daysAgo,
            9 + (ticketRows.length % 8),
            (ticketRows.length % 12) * 5,
          );
          // A spec with an explicit `minutesAgo` carries a fixed
          // "updated" timestamp — that is how the five most recently
          // updated tickets land at the top of the "Recent Tickets"
          // table with the reference's relative labels.
          const updatedAt =
            typeof spec.minutesAgo === 'number'
              ? t(spec.minutesAgo)
              : createdAt;
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
            created_at: createdAt,
            updated_at: updatedAt,
            deleted_at: null,
          });
        }

        // ─── BULK TICKETS ──────────────────────────────────────────
        // The reference's workspace carries 156 tickets, split 42
        // Open / 28 In Progress / 62 Resolved / 24 Closed, with the
        // seven-day trend chart showing a bar per day. The authored
        // specs above carry the narrative (and the five rows the
        // "Recent Tickets" table shows); the remaining rows are
        // generated so the counts and the chart's shape match.
        //
        // The day index runs from today backwards, so index 0 is
        // today and index 6 is the oldest day in the window — the
        // same order the chart reads left to right once the service
        // sorts the buckets oldest-first.
        const BULK_TICKET_TOTAL = 156;

        const bulkSpec = {
          title: 'Quarterly access review',
          description:
            'Routine access review for the workspace — please confirm the accounts listed are still needed.',
          category: 'General',
          submitterId: adminId,
          ownerId: null,
          attachmentFilename: null,
        };

        // The priority split the reference's "Priority Distribution"
        // donut shows: High 28 (18%), Medium 72 (46%), Low 34 (22%)
        // and None 22 (14%) — 156 rows in all. The authored specs
        // already carry a priority each, so the generator tops the
        // remaining buckets up to these targets.
        const TARGET_PRIORITY_COUNTS = { High: 28, Medium: 72, Low: 34, None: 22 };
        const PRIORITY_KEYS = ['High', 'Medium', 'Low', 'None'];
        const priorityCounts = { High: 0, Medium: 0, Low: 0, None: 0 };
        for (const spec of ticketSpecs) {
          const key = spec.priority ?? 'None';
          if (key in priorityCounts) priorityCounts[key] += 1;
        }

        let bulkCreated = 0;
        const bulkBudget = BULK_TICKET_TOTAL - ticketRows.length;
        // Which priority the next generated row should carry. The
        // order is fixed so the totals land exactly.
        const priorityQueue = [];
        for (const key of PRIORITY_KEYS) {
          const missing = Math.max(
            0,
            TARGET_PRIORITY_COUNTS[key] - priorityCounts[key],
          );
          for (let k = 0; k < missing; k++) priorityQueue.push(key);
        }

        for (let day = 0; day < TREND_WINDOW_DAYS; day++) {
          const target = TREND_DAY_TOTALS[day];
          const split = TREND_DAY_SPLITS[day];
          // How many rows of each status still need creating for
          // this day.
          const need = BULK_STATUSES.map(
            (_, si) => Math.max(0, split[si] - authoredByDay[day][si]),
          );
          const missing = need.reduce((a, b) => a + b, 0);
          if (bulkCreated + missing > bulkBudget) break;
          let slot = 0;
          for (let si = 0; si < BULK_STATUSES.length; si++) {
            for (let k = 0; k < need[si]; k++) {
              const number = await nextNumber();
              // Spread the day's rows across its working hours so the
              // timestamps look organic — but keep them inside the
              // calendar day, or the chart would credit them to the
              // neighbouring bucket.
              const createdAt = atDay(
                day,
                9 + Math.floor((slot / Math.max(1, target)) * 8),
                (slot % 6) * 10,
              );
              // The bulk rows are "created" across the working day, but
              // their UPDATED stamp has to stay older than the five
              // hand-numbered tickets — those carry the newest
              // timestamps (16, 27, 60, 180 and 300 minutes ago) and
              // are what the "Recent Tickets" table shows.
              //
              // Without this clamp a bulk row created at, say, 14:00
              // today outranks the hand-numbered HD-53 (16 minutes
              // ago) and pushes the narrative rows off the table.
              // The chart reads CREATED_AT, so moving only the
              // updated stamp leaves the trend bars untouched.
              const updatedAt =
                createdAt.getTime() > t(360).getTime()
                  ? t(360)
                  : createdAt;
              const priority = priorityQueue.shift() ?? 'Medium';
              slot += 1;
              ticketRows.push({
                number,
                title: bulkSpec.title,
                description: bulkSpec.description,
                category: BULK_CATEGORIES[slot % BULK_CATEGORIES.length],
                priority: priority === 'None' ? null : priority,
                status: BULK_STATUSES[si],
                submitter_id:
                  BULK_SUBMITTERS[slot % BULK_SUBMITTERS.length],
                owner_id: BULK_OWNERS[slot % BULK_OWNERS.length],
                attachment_id: null,
                created_at: createdAt,
                updated_at: updatedAt,
                deleted_at: null,
              });
              bulkCreated += 1;
            }
          }
        }

        await queryInterface.bulkInsert('tickets', ticketRows, {
          transaction: tx,
        });

        // ─── PREVIOUS-PERIOD TICKETS ───────────────────────────────
        // The workspace reports on the trailing thirty days, and the
        // stat strip's "vs last month" badge compares that window
        // against the thirty days before it. The seed creates 139
        // tickets in days 31..60: 156 against 139 is +12.2%, which
        // rounds to the reference's "+12%".
        //
        // They sit outside the thirty-day window on purpose — the
        // total, the status buckets and the priority donut all count
        // only the recent window, so these rows shift the baseline
        // without moving any of the reference's figures.
        const PREVIOUS_PERIOD_TICKETS = 139;
        const previousRows = [];
        for (let i = 0; i < PREVIOUS_PERIOD_TICKETS; i++) {
          const number = await nextNumber();
          const createdAt = atDay(31 + (i % 29), 9 + (i % 8), (i % 6) * 10);
          previousRows.push({
            number,
            title: 'Quarterly access review',
            description:
              'Routine access review for the workspace — please confirm the accounts listed are still needed.',
            category: BULK_CATEGORIES[i % BULK_CATEGORIES.length],
            priority: BULK_PRIORITIES[i % BULK_PRIORITIES.length],
            status: BULK_STATUSES[i % BULK_STATUSES.length],
            submitter_id: BULK_SUBMITTERS[i % BULK_SUBMITTERS.length],
            owner_id: BULK_OWNERS[i % BULK_OWNERS.length],
            attachment_id: null,
            created_at: createdAt,
            updated_at: createdAt,
            deleted_at: null,
          });
        }
        await queryInterface.bulkInsert('tickets', previousRows, {
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
