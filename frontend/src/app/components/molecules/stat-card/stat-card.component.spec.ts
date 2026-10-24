/**
 * stat-card — molecule spec (HD-019).
 *
 * Pins the four things a stat card must render correctly: the
 * label, the formatted value (with thousands separator), the
 * optional delta pill (with up/down coloring), and the embedded
 * sparkline (delegated, so a spot-check via data-testid is enough
 * here — the sparkline's contract is covered by its own spec).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
    }).compileComponents();
  });

  function setInputs(overrides: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('label', 'Total tickets');
    fixture.componentRef.setInput('value', 42);
    for (const [k, v] of Object.entries(overrides)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
  }

  it('renders the label and the formatted value', () => {
    setInputs();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.stat-label')?.textContent?.trim()).toBe('Total tickets');
    expect(host.querySelector('.stat-value')?.textContent).toContain('42');
  });

  it('formats large values with a thousands separator', () => {
    setInputs({ value: 1234 });
    const value = fixture.nativeElement.querySelector('.stat-value');
    // en-US thousands comma.
    expect(value.textContent?.trim()).toBe('1,234');
  });

  it('hides the delta pill when delta is null', () => {
    setInputs({ delta: null });
    expect(fixture.nativeElement.querySelector('.stat-delta')).toBeNull();
  });

  it('renders the delta pill with the "up" class when delta > 0', () => {
    setInputs({ delta: 12, deltaLabel: '+12%' });
    const pill = fixture.nativeElement.querySelector('.stat-delta');
    expect(pill).not.toBeNull();
    expect(pill.classList.contains('is-up')).toBeTrue();
    expect(pill.textContent).toContain('+12%');
  });

  it('renders the delta pill with the "down" class when delta < 0', () => {
    setInputs({ delta: -3, deltaLabel: '−3' });
    const pill = fixture.nativeElement.querySelector('.stat-delta');
    expect(pill.classList.contains('is-down')).toBeTrue();
  });

  it('does not apply up/down classes for a zero delta', () => {
    setInputs({ delta: 0, deltaLabel: '0' });
    const pill = fixture.nativeElement.querySelector('.stat-delta');
    expect(pill.classList.contains('is-up')).toBeFalse();
    expect(pill.classList.contains('is-down')).toBeFalse();
  });

  it('passes the series into the embedded sparkline', () => {
    setInputs({ series: [1, 2, 3] });
    const spark = fixture.nativeElement.querySelector('atom-sparkline');
    expect(spark).not.toBeNull();
  });

  it('sets the data-accent attribute from the input', () => {
    setInputs({ accent: 'inProgress' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.stat')?.getAttribute('data-accent')).toBe('inProgress');
    // The accent also drives a custom property on the inner tile, so
    // the icon + sparkline read from the same family.
    const tile = host.querySelector('.stat-tile') as HTMLElement;
    expect(tile).not.toBeNull();
  });
});