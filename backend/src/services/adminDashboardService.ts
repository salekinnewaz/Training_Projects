/**
 * adminDashboardService — the data behind the Admin Workspace
 * dashboard (the sidebar + hero + widget-grid layout).
 *
 * The WDS-2026 Admin Dashboard surface needs six independent reads,
 * and they all settle independently on the client (a failure in any
 * one of them degrades only its own widget):
 *
 *   1. `getWorkspaceSummary()` — the hero chips and the stat strip:
 *      total tickets, the period-over-period delta, total users,
 *      new users this week, and the four status counts.
 *   2. `getRecentTickets(limit)` — the "Recent Tickets" table.
 *   3. `getUsersOverview()` — the "Users Overview" donut: active /
 *      inactive split plus the per-role breakdown.
 *   4. `getPriorityDistribution()` — the "Priority Distribution"
 *      donut: per-priority counts.
 *   5. `getTicketTrends(days)` — the "Ticket Trends" stacked bar
 *      chart: per-day counts split by status.
 *   6. `getRecentUsers(limit)` — the "Recent Users" list.
 *
 * Every helper is Admin-gated at the CONTROLLER layer (the route's
 * inline role check) — the service trusts its caller, matching the
 * rest of the service layer's convention.
 *
 * Raw SQL is used where a single round-trip is materially cheaper
 * than N Sequelize queries (the trends chart needs a date-bucketed
 * GROUP BY that Sequelize's `fn.date_trunc` cannot express
 * cleanly across dialects).
 */

import { Op, fn, col, literal } from 'sequelize';
import type { WhereOptions } from 'sequelize';

import { Ticket, User, sequelize } from '../models';
import type { TicketPriority, TicketStatus } from '../models/Ticket';

/**
 * The status values the UI knows how to colour. Mirrors the
 * `Ticket.status` Postgres ENUM.
 */
export const STATUSES: TicketStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export interface WorkspaceSummary {
  /** Every live ticket in the system. */
  totalTickets: number;
  /** Tickets created in the trailing 30 days. */
  recentTickets: number;
  /** Tickets created in the 30 days before that window. */
  previousTickets: number;
  /** Every user, active or not. */
  totalUsers: number;
  /** Users created in the trailing 7 days. */
  newUsersThisWeek: number;
  /** Per-status counts, always all four keys present. */
  counts: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
}

export interface UsersOverview {
  total: number;
  active: number;
  inactive: number;
  /** Per-role counts. `User` is the employee bucket. */
  byRole: {
    admins: number;
    supportAgents: number;
    employees: number;
  };
}

export interface PrioritySlice {
  /**
   * The priority bucket. "None" is the bucket for tickets submitted
   * without a priority — it is not a Postgres ENUM value, so it is
   * widened here rather than in the model.
   */
  priority: TicketPriority | 'None';
  count: number;
}

export interface TrendBucket {
  /** ISO date (yyyy-mm-dd) for the day. */
  date: string;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface RecentUserRow {
  id: number;
  displayName: string;
  email: string;
  role: 'User' | 'Support Agent' | 'Admin';
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

/** Rows in the "Recent Tickets" table. */
/**
 * The reference's "Recent Tickets" table shows FIVE rows — the
 * banded header plus five 48px rows fill the card's content box
 * exactly (measured off the reference PNG: separators at y=478,
 * 526, 574 and 623, card bottom at y=671).
 */
export const RECENT_TICKETS_LIMIT = 5;
/** Rows in the "Recent Users" list. */
export const RECENT_USERS_LIMIT = 5;
/** Days in the "Ticket Trends" chart. */
export const TRENDS_DAYS = 7;

/**
 * Counters behind the hero chips and the stat strip.
 *
 * The workspace reports on the TRAILING THIRTY DAYS — that is the
 * window its "vs last month" badge compares against. `totalTickets`
 * counts every ticket created inside it, `recentTickets` counts the
 * same window, and `previousTickets` counts the thirty days before
 * that, so the badge's delta reads
 * (recent - previous) / previous.
 *
 * The per-status counts are grouped over the same window, so the
 * four status buckets always sum to `totalTickets`.
 */
export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [totalTickets, recentTickets, previousTickets, totalUsers, newUsersThisWeek, grouped] =
    await Promise.all([
      Ticket.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      Ticket.count({
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      }),
      Ticket.count({
        where: {
          createdAt: { [Op.gte]: sixtyDaysAgo, [Op.lt]: thirtyDaysAgo },
        },
      }),
      User.count(),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      Ticket.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
        group: ['status'],
        raw: true,
      }),
    ]);

  const counts = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
  for (const row of grouped as unknown as Array<{ status: TicketStatus; count: string }>) {
    const n = Number(row.count);
    switch (row.status) {
      case 'Open':
        counts.open = n;
        break;
      case 'In Progress':
        counts.inProgress = n;
        break;
      case 'Resolved':
        counts.resolved = n;
        break;
      case 'Closed':
        counts.closed = n;
        break;
    }
  }

  return {
    totalTickets,
    recentTickets,
    previousTickets,
    totalUsers,
    newUsersThisWeek,
    counts,
  };
}

/**
 * The most recently updated tickets, for the "Recent Tickets"
 * table. Eager-loads the submitter and owner so the table can
 * render the assignee column without a second round-trip.
 */
export async function getRecentTickets(limit = RECENT_TICKETS_LIMIT): Promise<Ticket[]> {
  return Ticket.findAll({
    order: [['updatedAt', 'DESC']],
    limit,
    include: [
      { model: User, as: 'submitter' },
      { model: User, as: 'owner' },
    ],
  });
}

/**
 * Active / inactive split plus the per-role breakdown, for the
 * "Users Overview" donut and its legend.
 *
 * The role counts are computed in ONE query with conditional
 * aggregation rather than three separate `count` calls — the table
 * is small, but keeping it to a single round-trip matters because
 * this widget is one of six parallel reads.
 */
export async function getUsersOverview(): Promise<UsersOverview> {
  // `sequelize.query` on a raw SELECT resolves to a
  // `[rows, metadata]` tuple — the same shape `countTicketsPerUser`
  // destructures in ticketService.ts. The rows themselves are
  // Postgres's snake_case aliases, so they are mapped to camelCase
  // here.
  const [rows] = (await sequelize.query(`
    SELECT
      COUNT(*)::int                                                  AS total,
      COUNT(*) FILTER (WHERE is_active = true)::int                  AS active,
      COUNT(*) FILTER (WHERE is_active = false)::int                 AS inactive,
      COUNT(*) FILTER (WHERE role = 'Admin')::int                    AS admins,
      COUNT(*) FILTER (WHERE role = 'Support Agent')::int            AS support_agents,
      COUNT(*) FILTER (WHERE role = 'User')::int                     AS employees
    FROM users
  `)) as unknown as [
    Array<{
      total: number;
      active: number;
      inactive: number;
      admins: number;
      support_agents: number;
      employees: number;
    }>,
    unknown,
  ];

  const row = rows[0] ?? {
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    support_agents: 0,
    employees: 0,
  };

  return {
    total: Number(row.total),
    active: Number(row.active),
    inactive: Number(row.inactive),
    byRole: {
      admins: Number(row.admins),
      supportAgents: Number(row.support_agents),
      employees: Number(row.employees),
    },
  };
}

/**
 * Ticket counts per priority, for the "Priority Distribution"
 * donut. Always returns all four buckets — High, Medium, Low and
 * None — so the donut's legend has a stable shape (a zero slice
 * still renders a legend row, matching the reference).
 *
 * "None" is the bucket for tickets filed without a priority. The
 * `priority` column is nullable, so those rows arrive as a NULL
 * group and are counted under "None".
 */
export async function getPriorityDistribution(): Promise<PrioritySlice[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const grouped = await Ticket.findAll({
    attributes: ['priority', [fn('COUNT', col('id')), 'count']],
    where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
    group: ['priority'],
    raw: true,
  });

  const byPriority = new Map<TicketPriority | 'None', number>();
  for (const row of grouped as unknown as Array<{
    priority: TicketPriority | null;
    count: string;
  }>) {
    const key: TicketPriority | 'None' = row.priority ?? 'None';
    byPriority.set(key, (byPriority.get(key) ?? 0) + Number(row.count));
  }

  const buckets: Array<TicketPriority | 'None'> = ['High', 'Medium', 'Low', 'None'];
  return buckets.map((priority) => ({
    priority,
    count: byPriority.get(priority) ?? 0,
  }));
}

/**
 * Per-day ticket counts split by status, for the "Ticket Trends"
 * stacked bar chart.
 *
 * Returns exactly `days` buckets, oldest-first, with zero-filled
 * gaps — a day with no tickets is an explicit `0` rather than a
 * missing entry, so the chart can plot positionally.
 *
 * The day boundary is computed in Postgres (`date_trunc`) so the
 * grouping matches the database's own timezone handling rather
 * than the Node process's.
 */
export async function getTicketTrends(days = TRENDS_DAYS): Promise<TrendBucket[]> {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [rows] = (await sequelize.query(
    `
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE status = 'Open')::int        AS open,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int    AS resolved,
        COUNT(*) FILTER (WHERE status = 'Closed')::int      AS closed
      FROM tickets
      WHERE created_at >= :since
      GROUP BY date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at) ASC
    `,
    { replacements: { since } },
  )) as unknown as [
    Array<{
      day: string;
      open: number;
      in_progress: number;
      resolved: number;
      closed: number;
    }>,
    unknown,
  ];

  // Zero-fill the calendar so the chart always draws `days` bars.
  const byDay = new Map<string, TrendBucket>();
  for (const row of rows) {
    byDay.set(row.day, {
      date: row.day,
      open: Number(row.open),
      inProgress: Number(row.in_progress),
      resolved: Number(row.resolved),
      closed: Number(row.closed),
    });
  }

  const buckets: TrendBucket[] = [];
  // `since` is the OLDEST day in the window, so the buckets are
  // walked ascending from it — the chart plots them left to right,
  // oldest first.
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = toIsoDate(d);
    buckets.push(
      byDay.get(key) ?? { date: key, open: 0, inProgress: 0, resolved: 0, closed: 0 },
    );
  }
  return buckets;
}

/**
 * The most recently created users, for the "Recent Users" list.
 * Ordered by `createdAt DESC` (newest joiners first) — the
 * reference's "22m ago / 3h ago" labels are relative to
 * `lastActiveAt`, which the frontend derives.
 */
export async function getRecentUsers(limit = RECENT_USERS_LIMIT): Promise<RecentUserRow[]> {
  const users = await User.findAll({
    order: [['createdAt', 'DESC']],
    limit,
    attributes: [
      'id',
      'displayName',
      'email',
      'role',
      'isActive',
      'createdAt',
      'lastActiveAt',
    ],
  });

  return users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
  }));
}

/** Format a Date as `yyyy-mm-dd` in LOCAL time (matches to_char). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Unused re-export kept for the controller's WhereOptions import. */
export type { WhereOptions };
export { literal };
