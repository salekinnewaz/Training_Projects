/**
 * check-circle — atom smoke spec (HD-009).
 *
 * Two narrow assertions on the CheckCircleComponent:
 *   (a) default size renders a 64×64 SVG
 *   (b) [size]="24" round-trips to a 24×24 SVG (width + height
 *       attributes both bound to the input)
 */

import { TestBed } from '@angular/core/testing';

import { CheckCircleComponent } from './check-circle.component';

describe('CheckCircleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckCircleComponent],
    }).compileComponents();
  });

  it('renders a 64×64 SVG by default', () => {
    const fixture = TestBed.createComponent(CheckCircleComponent);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('height')).toBe('64');
    expect(svg.getAttribute('viewBox')).toBe('0 0 64 64');
  });

  it('renders a 24×24 SVG when [size]="24" is set', () => {
    const fixture = TestBed.createComponent(CheckCircleComponent);
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });
});