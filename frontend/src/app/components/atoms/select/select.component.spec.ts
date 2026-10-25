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

  it('displays the option matching the bound [value], not the first option', async () => {
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
    // The DISPLAYED option is what matters. A native `<select>`
    // shows the option whose `selected` flag is true — not the one
    // whose value merely equals the select's value property. If
    // only `select.value` were asserted, a regression that marks
    // NO option as selected would still pass this test while the
    // UI showed "Low" to the user.
    expect(select.selectedIndex).toBe(2);
    const opts = select.options;
    expect(opts[0].selected).toBe(false);
    expect(opts[1].selected).toBe(false);
    expect(opts[2].selected).toBe(true);
    expect(opts[select.selectedIndex].value).toBe('High');
  });

  it('marks the bound option as selected when the value is set BEFORE the options render', async () => {
    // Regression guard for the "value arrives first, options land
    // later" ordering — e.g. an assignee dropdown whose bound
    // `ownerId` is known before the agent list resolves. The
    // displayed option must still end up on the bound value.
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'assignee');
    fixture.componentRef.setInput('value', '7');
    fixture.detectChanges();
    await fixture.whenStable();

    // Options arrive after the value was bound.
    fixture.componentRef.setInput('options', [
      { value: '2', label: 'Sam Chen' },
      { value: '7', label: 'Avery Patel' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('7');
    expect(select.selectedIndex).toBe(1);
    expect(select.options[1].selected).toBe(true);
  });

  it('re-selects the bound option when the value changes after first render', async () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'role');
    fixture.componentRef.setInput('options', [
      { value: 'User', label: 'User' },
      { value: 'Support Agent', label: 'Support Agent' },
      { value: 'Admin', label: 'Admin' },
    ]);
    fixture.componentRef.setInput('value', 'User');
    fixture.detectChanges();
    await fixture.whenStable();

    let select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('User');

    // Simulate the server echoing back the new role after a
    // successful PUT — the parent patches the row, the bound
    // value changes, and the dropdown must follow.
    fixture.componentRef.setInput('value', 'Admin');
    fixture.detectChanges();
    await fixture.whenStable();

    select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Admin');
    expect(select.selectedIndex).toBe(2);
  });

  it('renders a compact closed-state overlay without altering the select value', async () => {
    // In compact mode the trigger paints its OWN label (e.g.
    // "Change") over a transparent native <select>. The control
    // must keep its real value and options — the overlay is purely
    // visual.
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'role');
    fixture.componentRef.setInput('options', [
      { value: 'User', label: 'Employee' },
      { value: 'Admin', label: 'Admin' },
    ]);
    fixture.componentRef.setInput('value', 'Admin');
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('displayLabel', 'Change');
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = fixture.nativeElement.querySelector(
      '.select-wrap__overlay',
    ) as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.textContent?.trim()).toBe('Change');

    // The underlying control is untouched.
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Admin');
    expect(select.selectedIndex).toBe(1);
    expect(select.options.length).toBe(2);
  });

  it('renders no overlay when compact mode is off', async () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('id', 'priority');
    fixture.componentRef.setInput('options', [{ value: 'High', label: 'High' }]);
    fixture.componentRef.setInput('value', 'High');
    fixture.componentRef.setInput('displayLabel', 'Change');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.select-wrap__overlay')).toBeNull();
  });
});