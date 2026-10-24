/**
 * ticket-table — molecule spec (WDS-2026 shared ticket table).
 *
 * Pins the reference layout's contract:
 *   - the ten columns, in the reference's order;
 *   - the category glyph, the number, the title + description;
 *   - the status / priority pills, the customer, the assignee
 *     (avatar + name, or "Unassigned"), the relative timestamp;
 *   - the footer: "Showing 1–10 of 156 tickets", the numbered
 *     pagination, and the "10 / page" size picker;
 *   - the select-all tri-state and the per-row selection;
 *   - the kebab menu's open/close and its actions;
 *   - the horizontal-scroll contract: the table keeps its column
 *     widths on a narrow screen and scrolls INSIDE its wrapper
 *     rather than widening the page.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TicketTableComponent, type TicketTableRow } from './ticket-table.component';
import type { Ticket } from '../../../models/ticket';
import type { UserPublic } from '../../../models/user';

function makeUser(name = 'Eli Tanaka', role: UserPublic['role'] = 'User'): UserPublic {
  return {
    id: 7,
    email: 'eli@company.com',
    displayName: name,
    role,
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeRow(overrides: Partial<Ticket> = {}): TicketTableRow {
  const t: Ticket = {
    id: 1,
    number: 'HD-101',
    title: 'VPN disconnects nightly',
    description: 'Every night around 02:00 the tunnel drops.',
    category: 'IT',
    priority: 'High',
    status: 'Open',
    submitter: makeUser('Avery Chen'),
    owner: makeUser('Eli Tanaka', 'Support Agent'),
    attachment: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
  return { ...t, __id: String(t.id) };
}

describe('TicketTableComponent', () => {
  let fixture: ComponentFixture<TicketTableComponent>;
  let component: TicketTableComponent;

  async function setup(
    rows: TicketTableRow[] = [makeRow()],
    overrides: Partial<{
      page: number;
      pageCount: number;
      totalItems: number;
      pageSize: number;
      selectable: boolean;
      selectedIds: ReadonlySet<string | number>;
    }> = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TicketTableComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketTableComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('page', overrides.page ?? 1);
    fixture.componentRef.setInput('pageCount', overrides.pageCount ?? 1);
    fixture.componentRef.setInput('totalItems', overrides.totalItems ?? rows.length);
    fixture.componentRef.setInput('pageSize', overrides.pageSize ?? 10);
    fixture.componentRef.setInput('selectable', overrides.selectable ?? true);
    fixture.componentRef.setInput(
      'selectedIds',
      overrides.selectedIds ?? new Set<string | number>(),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** querySelector that throws rather than returning null — a
   * missing element is a test failure, not a null dereference. */
  function q(selector: string, scope: ParentNode = host()): HTMLElement {
    const el = scope.querySelector(selector) as HTMLElement | null;
    if (!el) throw new Error(`No element matched "${selector}"`);
    return el;
  }

  it('renders the reference\'s ten columns in order', async () => {
    await setup();
    const headers = Array.from(host().querySelectorAll('thead th')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(headers.length).toBe(10);
    // 0 checkbox · 1 category · 2 ID · 3 Title · 4 Status ·
    // 5 Priority · 6 Customer · 7 Assignee · 8 Updated · 9 actions.
    expect(headers[2]).toBe('ID');
    expect(headers[3]).toBe('Title');
    expect(headers[4]).toBe('Status');
    expect(headers[5]).toBe('Priority');
    expect(headers[6]).toBe('Customer');
    expect(headers[7]).toBe('Assignee');
    expect(headers[8]).toBe('Updated');
  });

  it('renders the category icon, the number, the title and the description', async () => {
    await setup();
    const row = q('tbody tr');
    expect(row.querySelector('ticket-category-icon')).toBeTruthy();
    expect(q('.number', row).textContent!.trim()).toBe('HD-101');
    expect(q('.title', row).textContent!.trim()).toBe('VPN disconnects nightly');
    expect(q('.desc', row).textContent!.trim()).toBe(
      'Every night around 02:00 the tunnel drops.',
    );
  });

  it('renders the status and priority pills', async () => {
    await setup();
    const row = q('tbody tr');
    expect(q('badge-status', row).textContent!.trim()).toBe('Open');
    expect(q('badge-priority', row).textContent!.trim()).toBe('High');
  });

  it('renders the customer with an avatar', async () => {
    await setup();
    const cell = q('tbody tr .col-customer');
    expect(cell.querySelector('chrome-avatar')).toBeTruthy();
    expect(q('.person-name', cell).textContent!.trim()).toBe('Avery Chen');
  });

  it('renders the assignee with an avatar when there is one', async () => {
    await setup();
    const cell = q('tbody tr .col-assignee');
    expect(cell.querySelector('chrome-avatar')).toBeTruthy();
    expect(q('.person-name', cell).textContent!.trim()).toBe('Eli Tanaka');
  });

  it('renders "Unassigned" when the ticket has no owner', async () => {
    await setup([makeRow({ owner: null })]);
    const cell = q('tbody tr .col-assignee');
    expect(q('.person-empty', cell).textContent!.trim()).toBe('Unassigned');
  });

  it('renders the relative timestamp', async () => {
    await setup([makeRow({ updatedAt: new Date(Date.now() - 4 * 86400000).toISOString() })]);
    const cell = q('tbody tr .col-updated');
    expect(cell.textContent!.trim()).toBe('4d ago');
  });

  it('renders the footer with the reference\'s summary copy', async () => {
    await setup([makeRow()], { totalItems: 156, pageCount: 16, pageSize: 10 });
    const summary = q('[data-testid="ticket-table-summary"]');
    expect(summary.textContent!.trim()).toBe('Showing 1–10 of 156 tickets');
  });

  it('renders the page-size picker with the reference\'s "N / page" options', async () => {
    await setup();
    const size = q('[data-testid="ticket-table-page-size"]');
    const options = Array.from(size.querySelectorAll('option')).map((o) =>
      (o as HTMLOptionElement).textContent?.trim(),
    );
    expect(options).toEqual(['10 / page', '25 / page', '50 / page']);
  });

  it('emits the new page when a page button is clicked', async () => {
    const pages: number[] = [];
    await setup([makeRow()], { pageCount: 3, totalItems: 30 });
    component.pageChange.subscribe((p) => pages.push(p));

    const btn = q('.pager-num[aria-label="Page 2"]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(pages).toEqual([2]);
  });

  it('emits the new page size when the picker changes', async () => {
    const sizes: number[] = [];
    await setup();
    component.pageSizeChange.subscribe((s) => sizes.push(s));

    const select = q('[data-testid="ticket-table-page-size"]') as HTMLSelectElement;
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(sizes).toEqual([25]);
  });

  it('emits the selected row when a row is clicked', async () => {
    const clicked: TicketTableRow[] = [];
    await setup();
    component.rowClick.subscribe((r) => clicked.push(r));

    (host().querySelector('tbody tr') as HTMLElement).click();
    fixture.detectChanges();

    expect(clicked.length).toBe(1);
    expect(clicked[0].id).toBe(1);
  });

  it('tracks the selection and emits it on change', async () => {
    const selections: ReadonlySet<string | number>[] = [];
    await setup();
    component.selectionChange.subscribe((s) => selections.push(s));

    const box = q('tbody tr atom-checkbox input') as HTMLInputElement;
    box.click();
    fixture.detectChanges();

    expect(selections.length).toBe(1);
    expect(selections[0].has('1')).toBe(true);
  });

  it('marks the header checkbox indeterminate when some — but not all — rows are selected', async () => {
    await setup([makeRow({ id: 1 }), makeRow({ id: 2 })], {
      selectedIds: new Set<string | number>(['1']),
    });
    const box = q('thead atom-checkbox input') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.checked).toBe(false);
  });

  it('checks the header checkbox when every row is selected', async () => {
    await setup([makeRow({ id: 1 }), makeRow({ id: 2 })], {
      selectedIds: new Set<string | number>(['1', '2']),
    });
    const box = q('thead atom-checkbox input') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.indeterminate).toBe(false);
  });

  it('hides the checkbox column when selectable is false', async () => {
    await setup([makeRow()], { selectable: false });
    expect(host().querySelector('thead th.col-select')).toBeNull();
    expect(host().querySelector('tbody td.col-select')).toBeNull();
  });

  it('renders the empty message when there are no rows', async () => {
    await setup([], { totalItems: 0 });
    const empty = q('.empty-text');
    expect(empty).toBeTruthy();
    expect(empty.textContent!.trim()).toBe('No tickets found');
  });

  it('uses the caller\'s empty message', async () => {
    await setup([], { totalItems: 0 });
    fixture.componentRef.setInput('emptyMessage', 'No tickets match your filters');
    fixture.detectChanges();
    expect(q('.empty-text').textContent!.trim()).toBe(
      'No tickets match your filters',
    );
  });

  it('opens the kebab menu and emits the row actions', async () => {
    await setup();
    const kebab = q('tbody tr .kebab') as HTMLButtonElement;
    kebab.click();
    fixture.detectChanges();

    const menu = q('.kebab-menu');
    expect(menu).toBeTruthy();
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(items).toEqual(['Open ticket', 'Mark resolved', 'Mark closed']);
  });

  it('omits "Mark resolved" for an already-resolved ticket', async () => {
    await setup([makeRow({ status: 'Resolved' })]);
    (host().querySelector('tbody tr .kebab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = Array.from(
      host().querySelectorAll('.kebab-menu [role="menuitem"]'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(items).not.toContain('Mark resolved');
    expect(items).toContain('Mark closed');
  });

  it('emits resolveTicket and closeTicket from the kebab', async () => {
    const resolved: TicketTableRow[] = [];
    const closed: TicketTableRow[] = [];
    await setup();
    component.resolveTicket.subscribe((r) => resolved.push(r));
    component.closeTicket.subscribe((r) => closed.push(r));

    (host().querySelector('tbody tr .kebab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = Array.from(
      host().querySelectorAll('.kebab-menu [role="menuitem"]'),
    ) as HTMLButtonElement[];
    // items[0] = "Open ticket", [1] = "Mark resolved", [2] = "Mark closed".
    items[1].click();
    fixture.detectChanges();

    expect(resolved.length).toBe(1);
    expect(resolved[0].id).toBe(1);
    expect(closed.length).toBe(0);
  });

  describe('the horizontal-scroll contract', () => {
    it('gives the table a floor so its columns are not squeezed to nothing', async () => {
      await setup();
      const table = q('[data-testid="ticket-table"]');
      const minWidth = getComputedStyle(table).minWidth;
      // A fixed layout with no floor squeezes the title column to
      // zero on a narrow screen instead of letting the wrapper
      // scroll. Parse the px value — jsdom reports "auto" for
      // unresolved percentages.
      expect(minWidth).not.toBe('auto');
      expect(parseFloat(minWidth)).toBeGreaterThan(0);
    });

    it('makes the wrapper the scroll container and the positioned ancestor', async () => {
      // The .sr-only cells inside the table are absolutely
      // positioned. Without a positioned ancestor inside the scroll
      // container they resolve against the viewport, and the hidden
      // "Actions" label at the far right of the wide table widened
      // the WHOLE PAGE sideways. The wrapper must therefore be both
      // the scroller and a containing block.
      await setup();
      const wrap = q('.table-wrap');
      const cs = getComputedStyle(wrap);
      expect(cs.overflowX).toBe('auto');
      expect(cs.position).toBe('relative');
    });

    it('cuts the host\'s automatic minimum size so it cannot widen its page', async () => {
      // As a grid item the host's automatic minimum size is its
      // min-content width — the table's 1040px. Without a zero
      // minimum the host drags the page's grid column out to that
      // width and the page overflows sideways.
      await setup();
      const hostEl = host();
      // The host's own inline/computed min-width must not be auto.
      const cs = getComputedStyle(hostEl);
      expect(cs.minWidth).not.toBe('auto');
    });
  });
});
