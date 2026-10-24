/**
 * ticket-table-query — shared query logic spec (WDS-2026).
 *
 * Pins the filter → sort → paginate pipeline that all three role
 * dashboards rely on:
 *   - the search matches the number, the title AND the description;
 *   - each dropdown filter narrows by its own dimension;
 *   - the sorts are total and stable;
 *   - the page slice and the page count agree;
 *   - the dropdown options are derived from the data.
 */

import {
  applicationOptionsOf,
  assigneeOptionsOf,
  customerOptionsOf,
  filterTickets,
  pageCountFor,
  pageSlice,
  sortTickets,
  PRIORITY_RANK,
  STATUS_RANK,
} from './ticket-table-query';
import type { SharedTicketFilterState } from '../components/molecules/ticket-filter-bar/ticket-filter-bar.component';
import type { Ticket } from '../models/ticket';
import type { UserPublic } from '../models/user';

function makeUser(name: string, id: number): UserPublic {
  return {
    id,
    email: `${id}@example.com`,
    displayName: name,
    role: 'User',
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    number: 'HD-101',
    title: 'VPN disconnects nightly',
    description: 'The tunnel drops at 02:00.',
    category: 'IT',
    priority: 'High',
    status: 'Open',
    submitter: makeUser('Avery Chen', 1),
    owner: makeUser('Eli Tanaka', 2),
    attachment: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

const FILTERS: SharedTicketFilterState = {
  search: '',
  customer: 'all',
  application: 'all',
  priority: 'all',
  assignee: 'all',
  sort: 'newest',
  status: 'all',
};

describe('ticket-table-query', () => {
  const rows: Ticket[] = [
    makeTicket({
      id: 1,
      number: 'HD-101',
      title: 'VPN disconnects nightly',
      description: 'The tunnel drops at 02:00.',
      category: 'IT',
      priority: 'High',
      status: 'Open',
      createdAt: '2026-10-01T00:00:00.000Z',
    }),
    makeTicket({
      id: 2,
      number: 'HD-102',
      title: 'Printer jam on floor 3',
      description: 'Paper keeps getting stuck.',
      category: 'General',
      priority: 'Low',
      status: 'Closed',
      owner: null,
      createdAt: '2026-10-05T00:00:00.000Z',
    }),
    makeTicket({
      id: 3,
      number: 'HD-103',
      title: 'Payroll question',
      description: 'Question about the November payslip.',
      category: 'Finance',
      priority: 'Medium',
      status: 'In Progress',
      createdAt: '2026-10-10T00:00:00.000Z',
    }),
  ];

  describe('filterTickets', () => {
    it('returns every row when no filter is active', () => {
      expect(filterTickets(rows, FILTERS).length).toBe(3);
    });

    it('matches the search against the ticket number', () => {
      const out = filterTickets(rows, { ...FILTERS, search: 'HD-102' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(2);
    });

    it('matches the search against the title', () => {
      const out = filterTickets(rows, { ...FILTERS, search: 'printer' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(2);
    });

    it('matches the search against the description', () => {
      const out = filterTickets(rows, { ...FILTERS, search: 'payslip' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(3);
    });

    it('is case-insensitive', () => {
      expect(filterTickets(rows, { ...FILTERS, search: 'PRINTER' }).length).toBe(1);
    });

    it('narrows by status', () => {
      const out = filterTickets(rows, { ...FILTERS, status: 'Open' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(1);
    });

    it('narrows by priority', () => {
      const out = filterTickets(rows, { ...FILTERS, priority: 'Low' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(2);
    });

    it('narrows by customer (the submitter)', () => {
      const out = filterTickets(rows, { ...FILTERS, customer: 'Avery Chen' });
      expect(out.length).toBe(3);
      const none = filterTickets(rows, { ...FILTERS, customer: 'Nobody' });
      expect(none.length).toBe(0);
    });

    it('narrows by application (the category)', () => {
      const out = filterTickets(rows, { ...FILTERS, application: 'Finance' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(3);
    });

    it('narrows by assignee', () => {
      // Two of the three fixture tickets are owned by Eli Tanaka;
      // the third is unassigned.
      const out = filterTickets(rows, { ...FILTERS, assignee: 'Eli Tanaka' });
      expect(out.length).toBe(2);
      expect(out.map((r) => r.id)).toEqual([1, 3]);
    });

    it('narrows to the unassigned rows', () => {
      const out = filterTickets(rows, { ...FILTERS, assignee: 'unassigned' });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(2);
    });

    it('combines the filters', () => {
      const out = filterTickets(rows, {
        ...FILTERS,
        status: 'Closed',
        priority: 'Low',
      });
      expect(out.length).toBe(1);
      expect(out[0].id).toBe(2);
    });

    it('does not mutate the input array', () => {
      const before = rows.map((r) => r.id);
      filterTickets(rows, { ...FILTERS, status: 'Open' });
      expect(rows.map((r) => r.id)).toEqual(before);
    });
  });

  describe('sortTickets', () => {
    it('sorts newest-first by default', () => {
      const out = sortTickets(rows, 'newest');
      expect(out.map((r) => r.id)).toEqual([3, 2, 1]);
    });

    it('sorts oldest-first', () => {
      const out = sortTickets(rows, 'oldest');
      expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    it('sorts by priority, High first', () => {
      const out = sortTickets(rows, 'priority');
      expect(out.map((r) => r.id)).toEqual([1, 3, 2]);
    });

    it('sorts by status, in workflow order', () => {
      const out = sortTickets(rows, 'status');
      expect(out.map((r) => r.id)).toEqual([1, 3, 2]);
    });

    it('does not mutate the input array', () => {
      const before = rows.map((r) => r.id);
      sortTickets(rows, 'newest');
      expect(rows.map((r) => r.id)).toEqual(before);
    });

    it('exposes the priority ranking — High before Medium before Low', () => {
      expect(PRIORITY_RANK.High).toBeLessThan(PRIORITY_RANK.Medium);
      expect(PRIORITY_RANK.Medium).toBeLessThan(PRIORITY_RANK.Low);
    });

    it('exposes the status ranking — Open through Closed', () => {
      expect(STATUS_RANK.Open).toBeLessThan(STATUS_RANK['In Progress']);
      expect(STATUS_RANK['In Progress']).toBeLessThan(STATUS_RANK.Resolved);
      expect(STATUS_RANK.Resolved).toBeLessThan(STATUS_RANK.Closed);
    });
  });

  describe('pagination', () => {
    it('counts the pages', () => {
      expect(pageCountFor(156, 10)).toBe(16);
      expect(pageCountFor(10, 10)).toBe(1);
      expect(pageCountFor(11, 10)).toBe(2);
    });

    it('never reports fewer than one page', () => {
      expect(pageCountFor(0, 10)).toBe(1);
    });

    it('slices the first page', () => {
      const many = Array.from({ length: 25 }, (_, i) => makeTicket({ id: i + 1 }));
      expect(pageSlice(many, 1, 10).length).toBe(10);
      expect(pageSlice(many, 1, 10)[0].id).toBe(1);
    });

    it('slices the last page', () => {
      const many = Array.from({ length: 25 }, (_, i) => makeTicket({ id: i + 1 }));
      const last = pageSlice(many, 3, 10);
      expect(last.length).toBe(5);
      expect(last[0].id).toBe(21);
    });

    it('returns an empty slice for a page past the end', () => {
      expect(pageSlice(rows, 99, 10)).toEqual([]);
    });
  });

  describe('dropdown options', () => {
    it('derives the distinct customers, sorted', () => {
      const many = [
        makeTicket({ id: 1, submitter: makeUser('Zoe', 3) }),
        makeTicket({ id: 2, submitter: makeUser('Avery', 1) }),
        makeTicket({ id: 3, submitter: makeUser('Avery', 1) }),
      ];
      expect(customerOptionsOf(many)).toEqual([
        { value: 'Avery', label: 'Avery' },
        { value: 'Zoe', label: 'Zoe' },
      ]);
    });

    it('derives the distinct applications, with a null category counting as General', () => {
      const many = [
        makeTicket({ id: 1, category: 'IT' }),
        makeTicket({ id: 2, category: null }),
        makeTicket({ id: 3, category: 'Finance' }),
      ];
      expect(applicationOptionsOf(many).map((o) => o.value)).toEqual([
        'Finance',
        'General',
        'IT',
      ]);
    });

    it('derives the distinct assignees and always offers Unassigned', () => {
      const many = [
        makeTicket({ id: 1, owner: makeUser('Eli', 2) }),
        makeTicket({ id: 2, owner: null }),
      ];
      expect(assigneeOptionsOf(many).map((o) => o.value)).toEqual([
        'Eli',
        'unassigned',
      ]);
    });
  });
});
