/**
 * pagination — molecule spec (HD-019).
 *
 * Pins the three behaviors the Tickets page relies on:
 *   - Page window: first + last always present; middle slides
 *     with the current page; gaps of ≥2 collapse to an ellipsis.
 *   - Prev/next arrows disable at the edges so the user can't
 *     emit an out-of-range `pageChange`.
 *   - "Showing X–Y of Z" summary copy, including the "No
 *     results" branch when total is zero.
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();
  });

  function setup(page: number, total: number, pageSize = 10): PaginationComponent {
    fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageCount', total);
    fixture.componentRef.setInput('totalItems', pageSize * total);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('hides the numeric buttons when there is only one page', () => {
    setup(1, 1);
    expect(fixture.nativeElement.querySelector('.pager')).toBeNull();
    expect(fixture.nativeElement.querySelector('.pager-summary')?.textContent).toContain('Showing');
  });

  it('shows page 1, page N, and the current page in the middle', () => {
    setup(5, 10);
    const nums = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.pager-num'),
    ).map((b) => b.textContent?.trim());
    expect(nums).toContain('1');
    expect(nums).toContain('5');
    expect(nums).toContain('10');
  });

  it('collapses a wide left gap to a single ellipsis', () => {
    setup(8, 10);
    const gaps = fixture.nativeElement.querySelectorAll('.pager-gap');
    expect(gaps.length).toBeGreaterThanOrEqual(1);
  });

  it('disables the prev arrow on page 1', () => {
    setup(1, 5);
    const arrows = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.pager-arrow');
    expect(arrows[0].disabled).toBeTrue();
    expect(arrows[1].disabled).toBeFalse();
  });

  it('disables the next arrow on the last page', () => {
    setup(5, 5);
    const arrows = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.pager-arrow');
    expect(arrows[0].disabled).toBeFalse();
    expect(arrows[1].disabled).toBeTrue();
  });

  it('marks the current page with the "is-current" class and aria-current', () => {
    setup(3, 10);
    const current = fixture.nativeElement.querySelector('.pager-num.is-current') as HTMLButtonElement;
    expect(current.textContent?.trim()).toBe('3');
    expect(current.getAttribute('aria-current')).toBe('page');
  });

  it('emits the clicked page through pageChange', () => {
    const instance = setup(2, 5);
    const spy = jasmine.createSpy('pageChange');
    instance.pageChange.subscribe(spy);

    const buttons = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.pager-num');
    const buttonsArr = Array.from(buttons) as HTMLButtonElement[];
    const target = buttonsArr.find((b) => b.textContent?.trim() === '5') as HTMLButtonElement;
    target.click();

    expect(spy).toHaveBeenCalledWith(5);
  });

  it('clamps out-of-range goto targets silently', () => {
    const instance = setup(3, 5);
    const spy = jasmine.createSpy('pageChange');
    instance.pageChange.subscribe(spy);

    instance['go'](0);
    instance['go'](99);
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to "No results" when totalItems is zero', () => {
    setup(1, 1, 0);
    const summary = fixture.nativeElement.querySelector('.pager-summary');
    expect(summary?.textContent?.trim()).toBe('No results');
  });

  it('shows "Showing X–Y of Z" for a non-empty set', () => {
    setup(2, 10, 10); // page 2 of 10 → rows 11-20 of 100
    const summary = fixture.nativeElement.querySelector('.pager-summary');
    expect(summary?.textContent).toContain('11');
    expect(summary?.textContent).toContain('20');
    expect(summary?.textContent).toContain('100');
  });
});