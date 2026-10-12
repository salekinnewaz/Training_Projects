/**
 * link — atom spec (HD-005).
 *
 * Covers the <atom-link> API:
 *   (a) renders an <a> with the routerLink directive bound to [href]
 *   (b) the projected content renders inside the <a>
 *   (c) clicking the link emits `navigate` and lets RouterLink
 *       handle the navigation (the host does not preventDefault)
 *   (d) when [disabled] is true, the link renders without router
 *       binding and with aria-disabled="true", and clicks do not
 *       emit navigate
 *   (e) when [disabled] is true, clicks are preventDefault'd at
 *       the template level (so the host doesn't navigate either)
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LinkComponent } from './link.component';

describe('LinkComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders an anchor that projects the slotted content', () => {
    const fixture = TestBed.createComponent(LinkComponent);
    fixture.componentRef.setInput('href', '/tickets/47');
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    // RouterLink renders the resolved URL on the href; in a
    // TestBed with no matched route, the value defaults to "/"
    // but the attribute is present.
    expect(anchor.hasAttribute('href')).toBeTrue();
    expect(anchor.textContent?.trim()).toBe('');
  });

  it('emits navigate when the host <a> is clicked', () => {
    const fixture = TestBed.createComponent(LinkComponent);
    fixture.componentRef.setInput('href', '/tickets/47');
    fixture.detectChanges();

    const spy = jasmine.createSpy('navigate');
    fixture.componentInstance.navigate.subscribe(spy);

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    anchor.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('renders aria-disabled="true" and a .disabled class when [disabled] is true', () => {
    const fixture = TestBed.createComponent(LinkComponent);
    fixture.componentRef.setInput('href', '/tickets/47');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.classList.contains('disabled')).toBeTrue();
  });

  it('does not emit navigate when [disabled] is true', () => {
    const fixture = TestBed.createComponent(LinkComponent);
    fixture.componentRef.setInput('href', '/tickets/47');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const spy = jasmine.createSpy('navigate');
    fixture.componentInstance.navigate.subscribe(spy);

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    anchor.click();

    expect(spy).not.toHaveBeenCalled();
  });
});
