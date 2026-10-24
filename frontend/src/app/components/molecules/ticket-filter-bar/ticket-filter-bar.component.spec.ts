/**
 * ticket-filter-bar — molecule spec (WDS-2026 shared ticket table).
 *
 * Pins the reference filter bar's contract:
 *   - the search input's placeholder, verbatim from the reference;
 *   - the five controls: customer, application, priority, assignee
 *     and sort;
 *   - the default labels ("All customers", "All applications",
 *     "All priorities", "All assignees", "Newest first");
 *   - the label mirror: selecting a value changes the visible label;
 *   - the search debounce (200ms) and its trimmed value;
 *   - the purple "More filters" button and its `moreFilters` output.
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  TicketFilterBarComponent,
  type SharedTicketFilterState,
} from './ticket-filter-bar.component';

const DEFAULT: SharedTicketFilterState = {
  search: '',
  customer: 'all',
  application: 'all',
  priority: 'all',
  assignee: 'all',
  sort: 'newest',
  status: 'all',
};

describe('TicketFilterBarComponent', () => {
  let fixture: ComponentFixture<TicketFilterBarComponent>;
  let component: TicketFilterBarComponent;

  async function setup(
    filters: SharedTicketFilterState = DEFAULT,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TicketFilterBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketFilterBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('filters', filters);
    fixture.componentRef.setInput('customerOptions', [
      { value: 'Avery Chen', label: 'Avery Chen' },
    ]);
    fixture.componentRef.setInput('applicationOptions', [
      { value: 'IT', label: 'IT' },
    ]);
    fixture.componentRef.setInput('assigneeOptions', [
      { value: 'Eli Tanaka', label: 'Eli Tanaka' },
      { value: 'unassigned', label: 'Unassigned' },
    ]);
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

  it('renders the reference\'s search placeholder verbatim', async () => {
    await setup();
    const input = q('[data-testid="ticket-filter-search"]');
    expect(input.getAttribute('placeholder')).toBe(
      'Search tickets by ID, title, or keyword...',
    );
  });

  it('renders the five reference controls', async () => {
    await setup();
    expect(host().querySelectorAll('select').length).toBe(5);
    expect(
      host().querySelector('[data-testid="ticket-filter-customer"]'),
    ).toBeTruthy();
    expect(
      host().querySelector('[data-testid="ticket-filter-application"]'),
    ).toBeTruthy();
    expect(
      host().querySelector('[data-testid="ticket-filter-priority"]'),
    ).toBeTruthy();
    expect(
      host().querySelector('[data-testid="ticket-filter-assignee"]'),
    ).toBeTruthy();
    expect(host().querySelector('[data-testid="ticket-filter-sort"]')).toBeTruthy();
  });

  it('renders the purple "More filters" button', async () => {
    await setup();
    const more = q('[data-testid="ticket-filter-more"]');
    expect(more).toBeTruthy();
    expect(more.textContent!.trim()).toBe('More filters');
  });

  it('shows the reference\'s default labels', async () => {
    await setup();
    const labels = Array.from(host().querySelectorAll('.pill-label')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual([
      'All customers',
      'All applications',
      'All priorities',
      'All assignees',
      'Newest first',
    ]);
  });

  it('mirrors the selected priority into the visible label', async () => {
    await setup({ ...DEFAULT, priority: 'High' });
    const labels = Array.from(host().querySelectorAll('.pill-label')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels[2]).toBe('High');
  });

  it('mirrors the selected customer into the visible label', async () => {
    await setup({ ...DEFAULT, customer: 'Avery Chen' });
    const labels = Array.from(host().querySelectorAll('.pill-label')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels[0]).toBe('Avery Chen');
  });

  it('mirrors the selected assignee into the visible label', async () => {
    await setup({ ...DEFAULT, assignee: 'unassigned' });
    const labels = Array.from(host().querySelectorAll('.pill-label')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels[3]).toBe('Unassigned');
  });

  it('emits the full next filter state when a select changes', async () => {
    await setup();
    const emitted: SharedTicketFilterState[] = [];
    component.filtersChange.subscribe((f) => emitted.push(f));

    const select = q(
      '[data-testid="ticket-filter-priority"]',
    ) as HTMLSelectElement;
    select.value = 'High';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].priority).toBe('High');
    // The rest of the state is preserved.
    expect(emitted[0].sort).toBe('newest');
    expect(emitted[0].customer).toBe('all');
  });

  it('emits the sort change', async () => {
    await setup();
    const emitted: SharedTicketFilterState[] = [];
    component.filtersChange.subscribe((f) => emitted.push(f));

    const select = q(
      '[data-testid="ticket-filter-sort"]',
    ) as HTMLSelectElement;
    select.value = 'oldest';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted[0].sort).toBe('oldest');
  });

  it('debounces the search input by 200ms', fakeAsync(() => {
    fixture = TestBed.createComponent(TicketFilterBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('filters', DEFAULT);
    fixture.detectChanges();

    const emitted: SharedTicketFilterState[] = [];
    component.filtersChange.subscribe((f) => emitted.push(f));

    const input = q(
      '[data-testid="ticket-filter-search"]',
    ) as HTMLInputElement;
    input.value = 'vpn';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Not yet — the debounce has not elapsed.
    expect(emitted.length).toBe(0);

    tick(200);
    expect(emitted.length).toBe(1);
    expect(emitted[0].search).toBe('vpn');
  }));

  it('trims the search value', fakeAsync(() => {
    fixture = TestBed.createComponent(TicketFilterBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('filters', DEFAULT);
    fixture.detectChanges();

    const emitted: SharedTicketFilterState[] = [];
    component.filtersChange.subscribe((f) => emitted.push(f));

    const input = q(
      '[data-testid="ticket-filter-search"]',
    ) as HTMLInputElement;
    input.value = '  vpn  ';
    input.dispatchEvent(new Event('input'));
    tick(200);

    expect(emitted[0].search).toBe('vpn');
  }));

  it('syncs the input from the parent\'s filter state', async () => {
    await setup({ ...DEFAULT, search: 'printer' });
    const input = q(
      '[data-testid="ticket-filter-search"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('printer');
  });

  it('emits moreFilters when "More filters" is pressed', async () => {
    await setup();
    let count = 0;
    component.moreFilters.subscribe(() => count++);

    (q('[data-testid="ticket-filter-more"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(count).toBe(1);
  });
});
