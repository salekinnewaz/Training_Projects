/**
 * checkbox — atom spec (HD-019).
 *
 * Pins the three behaviors the table relies on:
 *   - Renders a checked visual when the `checked` input is true.
 *   - Updates the underlying DOM `indeterminate` property (NOT
 *     attribute) when the `indeterminate` input flips — that's
 *     the property a select-all checkbox reads, and Angular's
 *     attribute bindings don't touch it.
 *   - Emits the new checked state via `checkedChange` and stops
 *     emitting when `disabled`.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckboxComponent } from './checkbox.component';

describe('CheckboxComponent', () => {
  let fixture: ComponentFixture<CheckboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxComponent],
    }).compileComponents();
  });

  function render(overrides: Record<string, unknown> = {}): CheckboxComponent {
    fixture = TestBed.createComponent(CheckboxComponent);
    for (const [k, v] of Object.entries(overrides)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('renders an unchecked box by default', () => {
    render();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBeFalse();
  });

  it('renders a checked box when `checked` is true', () => {
    render({ checked: true });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBeTrue();
  });

  it('sets the DOM `indeterminate` property when `indeterminate` is true', () => {
    render({ indeterminate: true });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    // The DOM property, not the attribute.
    expect(input.indeterminate).toBeTrue();
  });

  it('clears the DOM `indeterminate` property when `indeterminate` flips back', () => {
    const instance = render({ indeterminate: true });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.indeterminate).toBeTrue();
    fixture.componentRef.setInput('indeterminate', false);
    fixture.detectChanges();
    expect(input.indeterminate).toBeFalse();
  });

  it('emits `checkedChange` when the underlying input changes', () => {
    const instance = render();
    const spy = jasmine.createSpy('checkedChange');
    instance.checkedChange.subscribe(spy);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith(true);
  });

  it('blocks click events when disabled', () => {
    const instance = render({ disabled: true });
    const spy = jasmine.createSpy('checkedChange');
    instance.checkedChange.subscribe(spy);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));

    // The DOM blocks `change` events on a disabled input, so the
    // output never fires.
    expect(spy).not.toHaveBeenCalled();
  });
});