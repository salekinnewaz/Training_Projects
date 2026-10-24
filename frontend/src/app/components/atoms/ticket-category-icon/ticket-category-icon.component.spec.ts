/**
 * ticket-category-icon — atom spec (WDS-2026 shared ticket table).
 *
 * Pins the reference's category glyphs: a distinct colour AND a
 * distinct shape per category, so the column is readable without
 * relying on hue alone (WCAG 1.4.1).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketCategoryIconComponent } from './ticket-category-icon.component';

describe('TicketCategoryIconComponent', () => {
  let fixture: ComponentFixture<TicketCategoryIconComponent>;

  async function setup(category: 'IT' | 'HR' | 'Finance' | 'General' | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TicketCategoryIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketCategoryIconComponent);
    fixture.componentRef.setInput('category', category);
    fixture.detectChanges();
  }

  function tile(): HTMLElement {
    return fixture.nativeElement.querySelector('.cat-tile') as HTMLElement;
  }

  it('renders the IT glyph in blue', async () => {
    await setup('IT');
    expect(tile().classList.contains('it')).toBe(true);
    expect(tile().querySelector('svg')).toBeTruthy();
  });

  it('renders the HR glyph in red', async () => {
    await setup('HR');
    expect(tile().classList.contains('hr')).toBe(true);
  });

  it('renders the Finance glyph in purple', async () => {
    await setup('Finance');
    expect(tile().classList.contains('finance')).toBe(true);
  });

  it('renders the General glyph in slate', async () => {
    await setup('General');
    expect(tile().classList.contains('general')).toBe(true);
  });

  it('falls back to the General glyph when the category is null', async () => {
    await setup(null);
    expect(tile().classList.contains('general')).toBe(true);
  });

  it('hides the glyph from assistive technology — the row\'s text carries the meaning', async () => {
    await setup('IT');
    expect(tile().getAttribute('aria-hidden')).toBe('true');
  });
});
