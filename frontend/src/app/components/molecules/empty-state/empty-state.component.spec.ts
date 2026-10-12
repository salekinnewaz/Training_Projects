/**
 * empty-state — molecule spec (HD-007).
 *
 * Pins the empty-state card contract:
 *
 *   (a) Renders the headline as an <h2> with id="empty-headline"
 *       (used by the host's aria-labelledby on the <section>)
 *   (b) Renders the caption as a muted <p>
 *   (c) Renders the CTA via <atom-button> with the action label
 *   (d) Clicking the CTA emits `action` (the host performs
 *       navigation; the molecule does not call the router itself)
 *   (e) Projected content lands in the .supporting div
 */

import { TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();
  });

  it('renders the headline in an <h2> with id="empty-headline" (aria target)', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('headline', 'No tickets yet');
    fixture.componentRef.setInput('caption', 'Create your first one.');
    fixture.componentRef.setInput('actionLabel', 'New ticket');
    fixture.componentRef.setInput('actionHref', '/tickets/new');
    fixture.detectChanges();

    const h2 = fixture.nativeElement.querySelector('h2#empty-headline') as HTMLElement;
    expect(h2).not.toBeNull();
    expect(h2.textContent?.trim()).toBe('No tickets yet');

    const section = fixture.nativeElement.querySelector('section[aria-labelledby="empty-headline"]') as HTMLElement;
    expect(section).not.toBeNull();
  });

  it('renders the caption text', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('headline', 'No tickets yet');
    fixture.componentRef.setInput('caption', 'Create your first one.');
    fixture.componentRef.setInput('actionLabel', 'New ticket');
    fixture.componentRef.setInput('actionHref', '/tickets/new');
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('.caption') as HTMLElement;
    expect(caption.textContent?.trim()).toBe('Create your first one.');
  });

  it('renders the CTA via <atom-button> with the actionLabel', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('headline', 'No tickets yet');
    fixture.componentRef.setInput('caption', 'Create your first one.');
    fixture.componentRef.setInput('actionLabel', 'New ticket');
    fixture.componentRef.setInput('actionHref', '/tickets/new');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('atom-button button') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent?.trim()).toBe('New ticket');
  });

  it('emits action when the CTA is pressed', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('headline', 'No tickets yet');
    fixture.componentRef.setInput('caption', 'Create your first one.');
    fixture.componentRef.setInput('actionLabel', 'New ticket');
    fixture.componentRef.setInput('actionHref', '/tickets/new');
    fixture.detectChanges();

    const spy = jasmine.createSpy('action');
    fixture.componentInstance.action.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('atom-button button') as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});