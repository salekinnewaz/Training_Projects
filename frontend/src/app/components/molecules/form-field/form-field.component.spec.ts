/**
 * form-field — molecule spec (HD-005).
 *
 * Pins the three-part wrapper contract:
 *
 *   1. <label [for]="id"> renders with the label text
 *      - When [required]="true", a red " *" indicator renders
 *        after the label text (aria-hidden so SR doesn't read it)
 *      - When [hideLabel]="true", the label is NOT rendered
 *   2. Projected content (the <atom-input>) renders inside the
 *      .control div
 *   3. The error message renders ONLY when [error] is truthy;
 *      it carries role="alert" + the [id]-error id
 *
 * The id wiring (label[for] ↔ input[id], input[aria-describedby] ↔
 * error[id]) is the page's responsibility — the molecule just
 * exposes the id back to the page via the "id"-error suffix.
 */

import { TestBed } from '@angular/core/testing';

import { InputTextComponent } from '../../atoms/input-text/input-text.component';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormFieldComponent, InputTextComponent],
    }).compileComponents();
  });

  it('renders a <label> with the label text + a `for` matching the id', () => {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label).not.toBeNull();
    expect(label.getAttribute('for')).toBe('email');
    expect(label.textContent?.trim()).toBe('Email');
  });

  it('renders a " *" indicator (aria-hidden) when [required] is true', () => {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.textContent).toContain('*');
    const indicator = label.querySelector('.req');
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not render the <label> when [hideLabel] is true', () => {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('hideLabel', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeNull();
  });

  it('does not render the error when [error] is null', () => {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    // error default is null
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.form-field-error')).toBeNull();
  });

  it('renders the error message + role="alert" + id="<id>-error" when [error] is set', () => {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('error', 'Enter a valid email.');
    fixture.detectChanges();

    const err = fixture.nativeElement.querySelector('.form-field-error') as HTMLElement;
    expect(err).not.toBeNull();
    expect(err.textContent?.trim()).toBe('Enter a valid email.');
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.getAttribute('id')).toBe('email-error');
  });

  it('renders projected content inside the .control div', () => {
    // We project <atom-input> with id="email" inside <form-field id="email">.
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('id', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.detectChanges();

    const control = fixture.nativeElement.querySelector('.control') as HTMLElement;
    expect(control).not.toBeNull();

    // Render a <atom-input id="email"> into the projected slot.
    const inputFixture = TestBed.createComponent(InputTextComponent);
    inputFixture.componentRef.setInput('id', 'email');
    inputFixture.detectChanges();
    control.appendChild(inputFixture.nativeElement);

    const input = control.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.id).toBe('email');
  });
});