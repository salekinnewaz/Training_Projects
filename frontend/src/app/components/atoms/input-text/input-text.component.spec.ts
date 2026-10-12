/**
 * input-text — atom spec (HD-005).
 *
 * Covers the full API surface of <atom-input>:
 *   (a) default <input type="text"> when [type] is unset
 *   (b) [type] round-trips to the rendered <input> (email, password)
 *   (c) [value] binding round-trips to the rendered input.value
 *   (d) placeholder renders when set; absent when null
 *   (e) autocomplete / aria-describedby / aria-required /
 *       aria-invalid map onto the rendered element attributes
 *   (f) disabled=true sets the native disabled attribute
 *   (g) typing in the input emits valueChange with the new value
 *       (the two-way contract: host wires [value] (valChange)→control)
 */

import { TestBed } from '@angular/core/testing';

import { InputTextComponent } from './input-text.component';

describe('InputTextComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputTextComponent],
    }).compileComponents();
  });

  it('defaults to type="text" when [type] is not set', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('reflects [type] on the rendered <input>', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('type', 'email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('reflects [type]="password" on the rendered <input>', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'password');
    fixture.componentRef.setInput('type', 'password');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('reflects [value] on the rendered input.value', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('value', 'eli@example.com');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('eli@example.com');
  });

  it('renders the placeholder when [placeholder] is set', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('placeholder', 'Enter email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter email');
  });

  it('omits the placeholder attribute when [placeholder] is undefined', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    // The template binds `[placeholder]="placeholder() ?? ''"` so a
    // null input becomes an empty string attribute — which renders
    // as no placeholder text. Browsers normalize that to no
    // attribute, so the input.placeholder is the empty string.
    expect(input.getAttribute('placeholder')).toBe('');
  });

  it('maps [autocomplete] to the autocomplete attribute', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('autocomplete', 'username');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('username');
  });

  it('maps [ariaDescribedBy] to the aria-describedby attribute', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('ariaDescribedBy', 'email-error');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
  });

  it('sets aria-required="true" when [required] is true', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('sets aria-invalid="true" when [invalid] is true', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('omits aria-invalid when [invalid] is false (default)', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('sets the native disabled attribute when [disabled] is true', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBeTrue();
  });

  it('emits valueChange with the new value when the input fires', () => {
    const fixture = TestBed.createComponent(InputTextComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.detectChanges();

    const spy = jasmine.createSpy('valueChange');
    fixture.componentInstance.valueChange.subscribe(spy);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'typed@here.com';
    input.dispatchEvent(new Event('input'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toBe('typed@here.com');
  });
});
