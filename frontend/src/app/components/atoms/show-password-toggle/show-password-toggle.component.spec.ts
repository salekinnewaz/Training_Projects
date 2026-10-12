/**
 * show-password-toggle — atom spec (HD-005).
 *
 * Pins the toggle's a11y contract + the click event payload:
 *
 *   - [pressed]="false" → aria-pressed="false", aria-label="Show password"
 *   - [pressed]="true"  → aria-pressed="true",  aria-label="Hide password"
 *   - click → emits `toggle` (a void signal) and preventDefault's
 *     so the surrounding <form> doesn't submit
 *   - [disabled]="true" → native disabled attribute is set
 */

import { TestBed } from '@angular/core/testing';

import { ShowPasswordToggleComponent } from './show-password-toggle.component';

describe('ShowPasswordToggleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowPasswordToggleComponent],
    }).compileComponents();
  });

  it('sets aria-pressed="false" and aria-label="Show password" when not pressed', () => {
    const fixture = TestBed.createComponent(ShowPasswordToggleComponent);
    fixture.componentRef.setInput('pressed', false);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Show password');
  });

  it('sets aria-pressed="true" and aria-label="Hide password" when pressed', () => {
    const fixture = TestBed.createComponent(ShowPasswordToggleComponent);
    fixture.componentRef.setInput('pressed', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Hide password');
  });

  it('emits toggle on click and preventDefaults the event', () => {
    const fixture = TestBed.createComponent(ShowPasswordToggleComponent);
    fixture.detectChanges();

    const spy = jasmine.createSpy('toggle');
    fixture.componentInstance.toggle.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const clickEvent = new Event('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(clickEvent);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(clickEvent.defaultPrevented).toBeTrue();
  });

  it('sets the native disabled attribute when [disabled] is true', () => {
    const fixture = TestBed.createComponent(ShowPasswordToggleComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBeTrue();
  });
});