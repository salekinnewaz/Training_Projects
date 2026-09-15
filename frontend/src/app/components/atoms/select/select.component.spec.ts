/**
 * select — atom smoke spec (HD-008).
 *
 * Three narrow assertions:
 *   (a) every option in [options] renders an <option> with the
 *       matching value + label
 *   (b) selecting an option via the native change event emits
 *       valueChange with the chosen value (component contract)
 *   (c) when [placeholderOption] is provided, it renders as the
 *       first <option> with value="" and selecting it emits '' via
 *       valueChange (Category's "Select category…" affordance)
 */

import { TestBed } from '@angular/core/testing';

import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
    }).compileComponents();
  });

  it('renders every option with matching value + label', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'priority');
    fixture.componentRef.setInput('options', [
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
    ]);
    fixture.detectChanges();

    const opts = fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>;
    expect(opts.length).toBe(3);
    expect(opts[0].value).toBe('Low');
    expect(opts[0].textContent?.trim()).toBe('Low');
    expect(opts[2].value).toBe('High');
    expect(opts[2].textContent?.trim()).toBe('High');
  });

  it('emits valueChange with the selected value when the host select changes', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'priority');
    fixture.componentRef.setInput('options', [
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
    ]);
    fixture.detectChanges();

    const spy = jasmine.createSpy('valueChange');
    fixture.componentInstance.valueChange.subscribe(spy);

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'High';
    select.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toBe('High');
  });

  it('renders the placeholderOption as the first option with value=""', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'category');
    fixture.componentRef.setInput('placeholderOption', {
      value: '',
      label: 'Select category…',
    });
    fixture.componentRef.setInput('options', [
      { value: 'IT', label: 'IT' },
      { value: 'HR', label: 'HR' },
    ]);
    fixture.detectChanges();

    const opts = fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>;
    expect(opts.length).toBe(3);
    expect(opts[0].value).toBe('');
    expect(opts[0].textContent?.trim()).toBe('Select category…');

    const spy = jasmine.createSpy('valueChange');
    fixture.componentInstance.valueChange.subscribe(spy);

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(spy.calls.mostRecent().args[0]).toBe('');
  });

  it('binds [value] onto the rendered <select> element', async () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'priority');
    fixture.componentRef.setInput('options', [
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
    ]);
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 'High');
    fixture.detectChanges();
    await fixture.whenStable();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('High');
  });
});