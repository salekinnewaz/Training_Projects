/**
 * tickets-filter-bar — molecule spec (HD-019).
 *
 * Pins the filter bar's controlled-view contract:
 *   - Each filter button shows the active label when narrowed,
 *     the "All X" placeholder when not.
 *   - Selecting an option emits the full next filter state (the
 *     parent owns one signal, the bar never patches in place).
 *   - "Clear filters" resets every filter but preserves the
 *     user's sort choice (sort isn't a filter).
 *   - Clicking outside the host closes an open dropdown.
 *   - Search is debounced 200ms — one emit per burst of typing,
 *     not one per keystroke.
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  TicketsFilterBarComponent,
  type TicketFilterState,
} from './tickets-filter-bar.component';

const DEFAULTS: TicketFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  customer: 'all',
  sort: 'newest',
};

describe('TicketsFilterBarComponent', () => {
  let fixture: ComponentFixture<TicketsFilterBarComponent>;
  let component: TicketsFilterBarComponent;
  let emitted: TicketFilterState[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketsFilterBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsFilterBarComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.filtersChange.subscribe((s) => emitted.push(s));
    fixture.componentRef.setInput('filters', { ...DEFAULTS });
    fixture.detectChanges();
  });

  function query<T extends HTMLElement>(sel: string): T {
    return fixture.nativeElement.querySelector(sel) as T;
  }

  it('shows the "All X" placeholder when no filter is narrowed', () => {
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.filter-label'),
    ).map((el) => el.textContent?.trim());
    expect(labels).toContain('All statuses');
    expect(labels).toContain('All priorities');
  });

  it('shows the active label when a filter is narrowed', () => {
    fixture.componentRef.setInput('filters', { ...DEFAULTS, status: 'Open' });
    fixture.detectChanges();

    const statusBtn = query<HTMLButtonElement>('[data-testid="filter-status"]');
    expect(statusBtn.textContent?.trim()).toContain('Open');
    expect(statusBtn.classList.contains('is-active')).toBeTrue();
  });

  it('emits the full next filter state when an option is picked', () => {
    query<HTMLButtonElement>('[data-testid="filter-status"]').click();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.filter-option');
    const openOption = Array.from(options).find((o) => o.textContent?.trim() === 'Open') as HTMLElement;
    openOption.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].status).toBe('Open');
    // Everything else is preserved.
    expect(emitted[0].priority).toBe('all');
    expect(emitted[0].sort).toBe('newest');
  });

  it('closes the dropdown after picking an option', () => {
    query<HTMLButtonElement>('[data-testid="filter-status"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-menu')).not.toBeNull();

    const opts = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.filter-option');
    opts[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-menu')).toBeNull();
  });

  it('toggles a dropdown closed when the same filter button is clicked twice', () => {
    const btn = query<HTMLButtonElement>('[data-testid="filter-priority"]');
    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-menu')).not.toBeNull();

    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-menu')).toBeNull();
  });

  it('shows the "Clear filters" action only when a filter is active', () => {
    expect(query('.clear-btn')).toBeNull();

    fixture.componentRef.setInput('filters', { ...DEFAULTS, status: 'Open' });
    fixture.detectChanges();
    expect(query('[data-testid="filter-clear"]')).not.toBeNull();
  });

  it('resets every filter but preserves the sort choice on clear', () => {
    fixture.componentRef.setInput('filters', {
      ...DEFAULTS,
      status: 'Open',
      priority: 'High',
      search: 'vpn',
      sort: 'priority',
    });
    fixture.detectChanges();

    query('[data-testid="filter-clear"]').click();

    expect(emitted[emitted.length - 1].status).toBe('all');
    expect(emitted[emitted.length - 1].priority).toBe('all');
    expect(emitted[emitted.length - 1].search).toBe('');
    expect(emitted[emitted.length - 1].sort).toBe('priority');
  });

  it('debounces search input into a single emit', fakeAsync(() => {
    const input = query<HTMLInputElement>('[data-testid="filter-search"]');
    input.value = 'v';
    input.dispatchEvent(new Event('input'));
    input.value = 'vp';
    input.dispatchEvent(new Event('input'));
    input.value = 'vpn';
    input.dispatchEvent(new Event('input'));

    // Nothing emitted yet — still inside the debounce window.
    expect(emitted.length).toBe(0);

    tick(250);

    expect(emitted.length).toBe(1);
    expect(emitted[0].search).toBe('vpn');
  }));

  it('closes an open dropdown when the click lands outside the host', () => {
    query<HTMLButtonElement>('[data-testid="filter-status"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-menu')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-menu')).toBeNull();
  });
});