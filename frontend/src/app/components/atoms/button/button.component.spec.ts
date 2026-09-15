/**
 * button — atom smoke spec (HD-005/HD-007).
 *
 * Three narrow assertions on the ButtonComponent:
 *   (a) clicking the rendered <button> causes pressed.emit to fire
 *       with a MouseEvent payload (host clicks bubble up via the
 *       atom-button's native button element)
 *   (b) the `size` input signal defaults to 'md'
 *   (c) setting [size]="'lg'" results in the rendered <button>
 *       carrying the `lg` class
 */

import { TestBed } from '@angular/core/testing';

import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();
  });

  it('emits pressed with a MouseEvent when the host <button> is clicked', () => {
    const fixture = TestBed.createComponent(ButtonComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const spy = jasmine.createSpy('pressed');
    component.pressed.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(jasmine.any(MouseEvent));
  });

  it('defaults the size signal to "md"', () => {
    const fixture = TestBed.createComponent(ButtonComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.size()).toBe('md');
  });

  it('applies the "lg" class to the rendered <button> when size is set to "lg"', () => {
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList.contains('lg')).toBeTrue();
  });
});
