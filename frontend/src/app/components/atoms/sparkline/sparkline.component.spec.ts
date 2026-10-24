/**
 * sparkline — atom spec (HD-019).
 *
 * Pins the three edge cases the component's docstring promises
 * (empty series, single point, all-equal series) plus the happy
 * path's monotonic-positioning contract, because a sparkline that
 * silently draws the wrong shape is the kind of bug nobody catches
 * by eye on a 100×32 SVG.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SparklineComponent } from './sparkline.component';

describe('SparklineComponent', () => {
  let fixture: ComponentFixture<SparklineComponent>;

  function render(points: number[]): SparklineComponent {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SparklineComponent],
    }).compileComponents();
  });

  it('renders nothing for an empty series', () => {
    render([]);
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('renders a polyline for a non-empty series', () => {
    render([1, 2, 3, 4]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    expect(polyline).not.toBeNull();
    expect(polyline.getAttribute('points')).toContain(',');
  });

  it('places the highest value at the top of the viewBox', () => {
    render([1, 5]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    const points = polyline.getAttribute('points') as string;
    // "x,y x,y" — first point is the low value, second the high.
    const pairs = points.split(' ').map((p) => p.split(',').map(Number));
    const low = pairs[0][1];
    const high = pairs[1][1];
    // Smaller y = higher on screen.
    expect(high).toBeLessThan(low);
  });

  it('spreads x positions evenly across the width for 4 points', () => {
    render([2, 2, 2, 2]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    const points = polyline.getAttribute('points') as string;
    const xs = points.split(' ').map((p) => Number(p.split(',')[0]));
    expect(xs.length).toBe(4);
    expect(xs[0]).toBe(0);
    expect(xs[3]).toBe(100);
    // Evenly spaced: the middle two gaps should be identical.
    const gap1 = xs[1] - xs[0];
    const gap2 = xs[2] - xs[1];
    const gap3 = xs[3] - xs[2];
    expect(gap1).toBeCloseTo(gap2, 1);
    expect(gap2).toBeCloseTo(gap3, 1);
  });

  it('draws a flat mid-height line for an all-equal series', () => {
    render([5, 5, 5]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    const points = polyline.getAttribute('points') as string;
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]));
    // All three y values identical (no variance branch).
    expect(ys[0]).toBe(ys[1]);
    expect(ys[1]).toBe(ys[2]);
    // Mid-height, not pinned to the bottom edge.
    expect(ys[0]).toBeGreaterThan(0);
    expect(ys[0]).toBeLessThan(32);
  });

  it('renders a single point without dividing by zero', () => {
    render([7]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    expect(polyline).not.toBeNull();
    const points = polyline.getAttribute('points') as string;
    // One coordinate pair, no NaN.
    expect(points).not.toContain('NaN');
  });

  it('never emits NaN coordinates for any input', () => {
    for (const series of [[0], [0, 0], [1, 2, 3], [3, 1, 2], [10, 10, 0, 5]]) {
      render(series);
      const polyline = fixture.nativeElement.querySelector('polyline');
      const points = polyline.getAttribute('points') as string;
      expect(points).not.toContain('NaN');
    }
  });

  it('applies the accent color to both the stroke and the gradient stops', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2]);
    fixture.componentRef.setInput('color', 'rgb(1, 2, 3)');
    fixture.componentRef.setInput('gradientId', 'my-grad');
    fixture.detectChanges();

    const polyline = fixture.nativeElement.querySelector('polyline');
    expect(polyline.getAttribute('stroke')).toBe('rgb(1, 2, 3)');
    const stop = fixture.nativeElement.querySelector('stop');
    expect(stop.getAttribute('stop-color')).toBe('rgb(1, 2, 3)');
  });

  it('renders the gradient id as its VALUE, not the signal debug string', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2, 3]);
    fixture.componentRef.setInput('gradientId', 'my-grad');
    fixture.detectChanges();

    const grad = fixture.nativeElement.querySelector('linearGradient');
    expect(grad.getAttribute('id')).toBe('my-grad');

    // The fill references the gradient by id — if the id were the
    // signal's debug string the url() would resolve to nothing and
    // the area would render as a solid black block.
    const area = fixture.nativeElement.querySelector('path[fill]');
    expect(area.getAttribute('fill')).toBe('url(#my-grad)');
    expect(area.getAttribute('fill')).not.toContain('Input Signal');
  });

  it('closes the area path down to the baseline so the gradient fills', () => {
    render([1, 2, 3, 4]);
    const area = fixture.nativeElement.querySelector('path[fill]');
    const d = area.getAttribute('d') as string;
    // Must close with a line to the bottom edge and back to the left.
    expect(d).toMatch(/L\s+100,32/);
    // The path returns to the left edge with a move, since the
    // baseline is also where the curve starts.
    expect(d).toMatch(/M\s+0,32/);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('renders the stroke at full opacity by default', () => {
    render([1, 2, 3, 4]);
    const polyline = fixture.nativeElement.querySelector('polyline');
    expect(polyline.getAttribute('stroke-opacity')).toBe('1');
  });

  it('honours the strokeOpacity input', () => {
    // The stat strip's sparklines are a pale wash rather than a
    // solid line, so the stroke opacity has to be settable.
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2, 3, 4]);
    fixture.componentRef.setInput('strokeOpacity', 0.34);
    fixture.detectChanges();

    const polyline = fixture.nativeElement.querySelector('polyline');
    expect(polyline.getAttribute('stroke-opacity')).toBe('0.34');
  });

  it('honours the strokeOpacity input on the smooth path too', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2, 3, 4]);
    fixture.componentRef.setInput('smooth', true);
    fixture.componentRef.setInput('strokeOpacity', 0.34);
    fixture.detectChanges();

    const path = fixture.nativeElement.querySelector('path.spark-line');
    expect(path.getAttribute('stroke-opacity')).toBe('0.34');
  });

  it('honours the fillOpacity input on the gradient stops', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2, 3, 4]);
    fixture.componentRef.setInput('fillOpacity', 0.1);
    fixture.detectChanges();

    const stops = Array.from(
      fixture.nativeElement.querySelectorAll('stop') as NodeListOf<Element>,
    );
    expect(stops.length).toBeGreaterThan(0);

    // The TOP stop carries the caller's fill opacity; the BOTTOM
    // stop always fades to 0 so the gradient dies out at the
    // baseline.
    const top = stops[0];
    expect(top.getAttribute('offset')).toBe('0%');
    expect(top.getAttribute('stop-opacity')).toBe('0.1');

    const bottom = stops[stops.length - 1];
    expect(bottom.getAttribute('offset')).toBe('100%');
    expect(bottom.getAttribute('stop-opacity')).toBe('0');
  });

  it('draws a polyline by default and a path when smooth is on', () => {
    render([1, 2, 3, 4]);
    expect(fixture.nativeElement.querySelector('polyline')).not.toBeNull();

    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 2, 3, 4]);
    fixture.componentRef.setInput('smooth', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('polyline')).toBeNull();
    const line = fixture.nativeElement.querySelector('path.spark-line');
    expect(line).not.toBeNull();
    expect(line.getAttribute('d')).toContain('C');
  });

  it('keeps the smooth curve inside the viewBox (no overshoot)', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    // A steep step: the handle maths must not push a control point
    // above y=0 or below y=32, or the curve escapes the card.
    fixture.componentRef.setInput('points', [1, 1, 9, 1, 1, 9, 9]);
    fixture.componentRef.setInput('smooth', true);
    fixture.detectChanges();

    const d = fixture.nativeElement.querySelector('path.spark-line')
      .getAttribute('d') as string;

    const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)]
      .map((m) => Number(m[2]));
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(32);
    }
  });

  it('falls back to the polyline for a 2-point smooth series', () => {
    // Fewer than three points cannot form a cubic segment.
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 5]);
    fixture.componentRef.setInput('smooth', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('polyline')).not.toBeNull();
  });

  it('keeps the smooth area path closed and agreeing with the stroke', () => {
    fixture = TestBed.createComponent(SparklineComponent);
    fixture.componentRef.setInput('points', [1, 4, 2, 8, 3]);
    fixture.componentRef.setInput('smooth', true);
    fixture.detectChanges();

    const paths = fixture.nativeElement.querySelectorAll('path');
    const area = fixture.nativeElement.querySelector('path[fill]');
    const line = fixture.nativeElement.querySelector('path.spark-line');
    const areaD = area.getAttribute('d') as string;
    const lineD = line.getAttribute('d') as string;

    // The area starts with the exact same curve as the stroke, so
    // the fill can never disagree with the line.
    expect(areaD.startsWith(lineD)).toBe(true);
    expect(areaD.trim().endsWith('Z')).toBe(true);
    expect(paths.length).toBe(2);
  });
});