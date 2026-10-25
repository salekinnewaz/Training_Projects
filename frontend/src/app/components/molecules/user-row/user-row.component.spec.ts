/**
 * UserRowComponent — HD-014 spec (Option A "Command Center" layout).
 *
 * Verifies the per-row markup + interaction wiring:
 *   - non-self row: avatar + identity (name + email stacked) +
 *     role select + status toggle + tickets + last-active all
 *     rendered.
 *   - self row: 3px left border class, disabled atom-select,
 *     disabled status toggle, micro-label visible.
 *   - isUpdating row: greys controls + adds `user-row--updating`
 *     class.
 *   - errorMessage renders below the row.
 *   - role select change emits `roleChange` with the new role.
 *   - status toggle click emits `activeToggle`.
 *   - role select id is stable per user id (so test selectors
 *     work in the page spec).
 *   - lastActiveAt=null renders "Never" instead of a relative
 *     time.
 *   - active toggle aria-label flips between "Deactivate <name>"
 *     and "Activate <name>" based on `user.isActive`.
 *   - ticketCount renders in its own column; a missing count
 *     falls back to 0 (never blank).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserRowComponent } from './user-row.component';
import type { UserPublic } from '../../../models/user';

const baseUser: UserPublic = {
  id: 7,
  email: 'eli@example.com',
  displayName: 'Eli Chen',
  role: 'User',
  isActive: true,
  // lastActiveAt is set to 2 days before "now" at test setup
  // time so the relative-time formatter renders "2d ago"
  // regardless of when the suite runs (a hard-coded ISO
  // string here would drift as wall-clock time advances
  // and silently start failing the assertion).
  lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ticketCount: 12,
};

describe('UserRowComponent (HD-014)', () => {
  let fixture: ComponentFixture<UserRowComponent>;
  let component: UserRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserRowComponent);
    component = fixture.componentInstance;
  });

  it('renders the row markup for a non-self, active user', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.user-row')).toBeTruthy();
    expect(el.querySelector('.user-row--self')).toBeNull();
    expect(el.querySelector('.user-row__display-name')?.textContent?.trim())
      .toBe('Eli Chen');
    expect(el.querySelector('.user-row__email')?.textContent?.trim())
      .toBe('eli@example.com');
    expect(el.querySelector('atom-select')).toBeTruthy();
    const select = el.querySelector('atom-select select') as HTMLSelectElement;
    expect(select.value).toBe('User');
    expect(select.disabled).toBe(false);
    const toggle = el.querySelector('.user-row__active-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(false);
    expect(toggle.classList.contains('is-active')).toBe(true);
    expect(el.querySelector('.user-row__active-text')?.textContent?.trim())
      .toBe('Active');
    expect(el.querySelector('.user-row__last-active time')?.textContent?.trim())
      .toBe('2d ago');
    expect(el.querySelector('.user-row__self-micro-label')).toBeNull();
  });

  it('renders the inactive indicator + label for an inactive user', () => {
    fixture.componentRef.setInput(
      'user',
      { ...baseUser, isActive: false },
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('.user-row__active-toggle') as HTMLButtonElement;
    expect(toggle.classList.contains('is-inactive')).toBe(true);
    expect(toggle.classList.contains('is-active')).toBe(false);
    expect(el.querySelector('.user-row__active-text')?.textContent?.trim())
      .toBe('Inactive');
  });

  it('renders the self-row styling + disabled controls + micro-label when isSelf=true', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.componentRef.setInput('isSelf', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('.user-row') as HTMLElement;
    expect(row.classList.contains('user-row--self')).toBe(true);
    const select = el.querySelector('atom-select select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    const toggle = el.querySelector('.user-row__active-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    const label = el.querySelector('.user-row__self-micro-label');
    expect(label?.textContent?.trim()).toBe('You cannot change your own role.');
  });

  it('renders the updating class + disables controls when isUpdating=true', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.componentRef.setInput('isUpdating', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('.user-row') as HTMLElement;
    expect(row.classList.contains('user-row--updating')).toBe(true);
    const select = el.querySelector('atom-select select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    const toggle = el.querySelector('.user-row__active-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
  });

  it('renders an inline row error when errorMessage is set', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.componentRef.setInput('errorMessage', "Couldn't update. Try again.");
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const err = el.querySelector('.user-row__error');
    expect(err?.textContent?.trim()).toBe("Couldn't update. Try again.");
    expect(err?.getAttribute('role')).toBe('alert');
  });

  it('emits roleChange when the role select changes', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();
    const spy = spyOn(component.roleChange, 'emit');
    const select = fixture.nativeElement.querySelector(
      'atom-select select',
    ) as HTMLSelectElement;
    select.value = 'Support Agent';
    select.dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalledWith('Support Agent');
  });

  it('emits activeToggle when the status toggle is clicked', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();
    const spy = spyOn(component.activeToggle, 'emit');
    const toggle = fixture.nativeElement.querySelector(
      '.user-row__active-toggle',
    ) as HTMLButtonElement;
    toggle.click();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit roleChange when the select value is unchanged', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();
    const spy = spyOn(component.roleChange, 'emit');
    const select = fixture.nativeElement.querySelector(
      'atom-select select',
    ) as HTMLSelectElement;
    select.value = 'User'; // unchanged
    select.dispatchEvent(new Event('change'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses a stable role select id derived from the user id', () => {
    fixture.componentRef.setInput('user', { ...baseUser, id: 42 });
    expect(component.roleSelectId()).toBe('user-row-role-42');
  });

  it('renders "Never" when lastActiveAt is null', () => {
    fixture.componentRef.setInput(
      'user',
      { ...baseUser, lastActiveAt: null },
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.user-row__last-active time')).toBeNull();
    expect(el.querySelector('.user-row__never')?.textContent?.trim()).toBe('Never');
  });

  it('flips the active toggle aria-label based on isActive', () => {
    fixture.componentRef.setInput('user', baseUser);
    expect(component.activeAriaLabel()).toBe('Deactivate Eli Chen');
    fixture.componentRef.setInput(
      'user',
      { ...baseUser, isActive: false },
    );
    expect(component.activeAriaLabel()).toBe('Activate Eli Chen');
  });

  it('ignores bogus role values from the select (defensive)', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();
    const spy = spyOn(component.roleChange, 'emit');
    // Simulate an attacker / a future enum value landing here.
    const select = fixture.nativeElement.querySelector(
      'atom-select select',
    ) as HTMLSelectElement;
    select.value = 'Wizard';
    select.dispatchEvent(new Event('change'));
    expect(spy).not.toHaveBeenCalled();
  });

  // ─── Option A: identity cell + tickets column ──────────────────

  it('groups the name and email into a single identity cell', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const identity = el.querySelector('.user-row__identity');
    expect(identity).toBeTruthy();
    // Both the name AND the email live inside the identity cell.
    expect(identity?.querySelector('.user-row__display-name')?.textContent?.trim())
      .toBe('Eli Chen');
    expect(identity?.querySelector('.user-row__email')?.textContent?.trim())
      .toBe('eli@example.com');
    // The email must NOT be a separate top-level column any more.
    expect(el.querySelector('.user-row > .user-row__email')).toBeNull();
  });

  it('renders the ticket count in its own column', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const tickets = el.querySelector('.user-row__tickets');
    expect(tickets?.textContent?.trim()).toBe('12');
  });

  it('falls back to 0 when the ticket count is missing', () => {
    const { ticketCount: _omitted, ...withoutCount } = baseUser;
    fixture.componentRef.setInput('user', withoutCount as UserPublic);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Never blank — a missing count must not leave a ragged gap.
    expect(el.querySelector('.user-row__tickets')?.textContent?.trim()).toBe('0');
  });

  it('renders an actions cell that is present in the DOM', () => {
    fixture.componentRef.setInput('user', baseUser);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // The action cell is always in the DOM (so keyboard focus can
    // reach it) — CSS reveals it on hover / focus-within.
    expect(el.querySelector('.user-row__actions')).toBeTruthy();
  });
});