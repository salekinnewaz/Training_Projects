/**
 * caret-down — atom spec (HD-004).
 *
 * The atom is an aria-hidden decorative chevron. No inputs or
 * outputs — it's a static visual contract:
 *     - Renders an <svg width="8" height="8"> with the
 *       fill="currentColor" chevron polyline path
 *     - aria-hidden="true" so the trigger's aria-label carries
 *       the meaning
 *
 * This spec just pins the rendered SVG shape so future style
 * refactors don't accidentally remove the path data or the
 * aria-hidden attribute.
 */

import { TestBed } from '@angular/core/testing';

import { CaretDownComponent } from './caret-down.component';

describe('CaretDownComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaretDownComponent],
    }).compileComponents();
  });

  it('renders an 8×8 aria-hidden SVG with a chevron path', () => {
    const fixture = TestBed.createComponent(CaretDownComponent);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('8');
    expect(svg.getAttribute('height')).toBe('8');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('fill')).toBe('currentColor');

    const path = svg.querySelector('path') as SVGPathElement;
    expect(path).not.toBeNull();
    expect(path.getAttribute('d')).toBe('M0 2 L4 6 L8 2 Z');
  });
});