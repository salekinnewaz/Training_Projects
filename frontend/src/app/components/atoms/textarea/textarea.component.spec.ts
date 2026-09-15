/**
 * textarea — atom smoke spec (HD-008).
 *
 * Mirrors the atom-input test pattern. Three narrow assertions:
 *   (a) [value] binding round-trips through to the rendered
 *       <textarea> value
 *   (b) required + invalid map to aria-required + aria-invalid
 *       attributes on the rendered element
 *   (c) typing in the host <textarea> emits valueChange with the
 *       new value (component contract — same shape as atom-input)
 */

import { TestBed } from '@angular/core/testing';

import { TextareaComponent } from './textarea.component';

describe('TextareaComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextareaComponent],
    }).compileComponents();
  });

  it('reflects [value] on the rendered <textarea>', () => {
    const fixture = TestBed.createComponent(TextareaComponent);
    fixture.componentRef.setInput('id', 'description');
    fixture.componentRef.setInput('value', 'hello\nworld');
    fixture.detectChanges();

    const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('hello\nworld');
  });

  it('maps [required] and [invalid] to aria-* attributes', () => {
    const fixture = TestBed.createComponent(TextareaComponent);
    fixture.componentRef.setInput('id', 'description');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();

    const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-required')).toBe('true');
    expect(ta.getAttribute('aria-invalid')).toBe('true');
  });

  it('emits valueChange with the new value when the textarea input fires', () => {
    const fixture = TestBed.createComponent(TextareaComponent);
    fixture.componentRef.setInput('id', 'description');
    fixture.detectChanges();

    const spy = jasmine.createSpy('valueChange');
    fixture.componentInstance.valueChange.subscribe(spy);

    const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = 'typed text';
    ta.dispatchEvent(new Event('input'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toBe('typed text');
  });
});