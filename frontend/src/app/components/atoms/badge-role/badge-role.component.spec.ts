/**
 * badge-role — atom spec (HD-004).
 *
 * Pins the role-to-variant + role-to-label mapping:
 *
 *   User          → variant "employee", label "Employee"
 *   Support Agent → variant "support-agent", label "Support Agent"
 *   Admin         → variant "admin", label "Admin"
 *
 * Note: the data shape carries the backend's literal "User" but
 * the UI surfaces it as "Employee". This spec pins that UI
 * remap so it doesn't regress.
 */

import { TestBed } from '@angular/core/testing';

import { BadgeRoleComponent } from './badge-role.component';

describe('BadgeRoleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeRoleComponent],
    }).compileComponents();
  });

  it('renders the "employee" variant + label "Employee" for role User', () => {
    const fixture = TestBed.createComponent(BadgeRoleComponent);
    fixture.componentRef.setInput('role', 'User');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('employee')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Employee');
  });

  it('renders the "support-agent" variant + label "Support Agent" for role Support Agent', () => {
    const fixture = TestBed.createComponent(BadgeRoleComponent);
    fixture.componentRef.setInput('role', 'Support Agent');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('support-agent')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Support Agent');
  });

  it('renders the "admin" variant + label "Admin" for role Admin', () => {
    const fixture = TestBed.createComponent(BadgeRoleComponent);
    fixture.componentRef.setInput('role', 'Admin');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('admin')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Admin');
  });
});