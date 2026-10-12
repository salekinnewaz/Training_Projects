/**
 * divider-hr — atom spec (HD-004).
 *
 * The atom is a static visual: a 1px horizontal rule in
 * --color-border. No inputs or outputs. The spec just pins the
 * rendered tag so a future refactor doesn't accidentally swap
 * <hr> for a <div> (which would break the document outline
 * semantics).
 */

import { TestBed } from '@angular/core/testing';

import { DividerHrComponent } from './divider-hr.component';

describe('DividerHrComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DividerHrComponent],
    }).compileComponents();
  });

  it('renders an <hr> element with the .hr class', () => {
    const fixture = TestBed.createComponent(DividerHrComponent);
    fixture.detectChanges();

    const hr = fixture.nativeElement.querySelector('hr.hr') as HTMLHRElement;
    expect(hr).not.toBeNull();
  });
});