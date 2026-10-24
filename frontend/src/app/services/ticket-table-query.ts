/**
 * ticket-table-query — shared query logic for the WDS-2026 ticket
 * table.
 *
 * The User, Support Agent and Admin dashboards all render the same
 * `<ticket-table>` and the same `<ticket-filter-bar>`. The only
 * things that differ between them are:
 *
 *   - WHICH tickets they see (the User sees only their own — the
 *     scope lives in SQL on the server, never in the client), and
 *   - whether they may act on a row (the User cannot change a
 *     ticket's status; the Agent and Admin can).
 *
 * Everything else — how a filter narrows the set, how a sort
 * orders it, how the page slice is cut — is identical, so it
 * lives here once rather than three times.
 *
 * The functions are pure: they take rows plus filter state and
 * return rows. That makes them trivially unit-testable and lets
 * each page own its own signals.
 */

import type { Ticket } from '../models/ticket';
import type { TicketPriority, TicketStatus } from '../models/enums';
import type {
  SharedTicketFilterState,
  SharedTicketSort,
} from '../components/molecules/ticket-filter-bar/ticket-filter-bar.component';

/** Priority ordering for `sort=priority` — High first. */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/** Status ordering for `sort=status` — workflow order. */
export const STATUS_RANK: Record<TicketStatus, number> = {
  Open: 0,
  'In Progress': 1,
  Resolved: 2,
  Closed: 3,
};

/**
 * Narrow a ticket set by the shared filter state.
 *
 * The search matches the ticket number, the title AND the
 * description, so a user can find a ticket by any of the three.
 * The customer filter matches the submitter; the application
 * filter matches the category (the reference's "applications"
 * column is our "category" — an IT ticket is an application
 * request, an HR ticket is a People request, and so on).
 */
export function filterTickets<T extends Ticket>(
  rows: readonly T[],
  filters: SharedTicketFilterState,
): T[] {
  let out = rows;

  if (filters.search !== '') {
    const q = filters.search.toLowerCase();
    out = out.filter(
      (t) =>
        (t.number ?? '').toLowerCase().includes(q) ||
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    );
  }

  if (filters.status !== 'all') {
    out = out.filter((t) => t.status === filters.status);
  }
  if (filters.priority !== 'all') {
    out = out.filter((t) => t.priority === filters.priority);
  }
  if (filters.customer !== 'all') {
    out = out.filter((t) => t.submitter?.displayName === filters.customer);
  }
  if (filters.application !== 'all') {
    out = out.filter((t) => (t.category ?? 'General') === filters.application);
  }
  if (filters.assignee !== 'all') {
    if (filters.assignee === 'unassigned') {
      out = out.filter((t) => t.owner === null);
    } else {
      out = out.filter((t) => t.owner?.displayName === filters.assignee);
    }
  }

  return [...out];
}

/**
 * Order a ticket set. Always returns a fresh array — `.sort()`
 * mutates its receiver, and the caller's signal should never be
 * reordered in place.
 */
export function sortTickets<T extends Ticket>(
  rows: readonly T[],
  sort: SharedTicketSort,
): T[] {
  const sorted = [...rows];
  sorted.sort((a, b) => compareTickets(a, b, sort));
  return sorted;
}

function compareTickets(
  a: Ticket,
  b: Ticket,
  sort: SharedTicketSort,
): number {
  // The API always sends `createdAt`; a partially-populated row
  // (or a hand-built fixture) sorts to the end rather than
  // throwing mid-render.
  const aCreated = a.createdAt ?? '';
  const bCreated = b.createdAt ?? '';

  switch (sort) {
    case 'oldest':
      return aCreated.localeCompare(bCreated);
    case 'priority': {
      const d = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      // Ties break newest-first so the ordering is total and
      // stable across re-renders.
      return d !== 0 ? d : bCreated.localeCompare(aCreated);
    }
    case 'status': {
      const d = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return d !== 0 ? d : bCreated.localeCompare(aCreated);
    }
    case 'newest':
    default:
      return bCreated.localeCompare(aCreated);
  }
}

/** The number of pages a filtered set spans at the given size. */
export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** The slice of rows for the given 1-based page. */
export function pageSlice<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): T[] {
  const size = Math.max(1, pageSize);
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
}

/**
 * The distinct customers present in a ticket set, as the
 * `{value,label}` pairs the filter bar's select expects. Sorted
 * alphabetically so the dropdown's order doesn't shuffle between
 * renders.
 */
export function customerOptionsOf(
  rows: readonly Ticket[],
): { value: string; label: string }[] {
  const names = new Set<string>();
  for (const t of rows) {
    if (t.submitter?.displayName) names.add(t.submitter.displayName);
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));
}

/**
 * The distinct applications (categories) present in a ticket set.
 * A ticket with no category counts as "General" — the same
 * fallback the category icon uses, so the filter and the icon
 * always agree.
 */
export function applicationOptionsOf(
  rows: readonly Ticket[],
): { value: string; label: string }[] {
  const names = new Set<string>();
  for (const t of rows) {
    names.add(t.category ?? 'General');
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));
}

/** The distinct assignees present in a ticket set. "Unassigned"
 * is always offered, even when every ticket has an owner — the
 * user may still want to see the empty bucket. */
export function assigneeOptionsOf(
  rows: readonly Ticket[],
): { value: string; label: string }[] {
  const names = new Set<string>();
  for (const t of rows) {
    if (t.owner?.displayName) names.add(t.owner.displayName);
  }
  const opts = [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));
  opts.push({ value: 'unassigned', label: 'Unassigned' });
  return opts;
}
