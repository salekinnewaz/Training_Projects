/**
 * badge-role — atom (HD-004).
 *
 * Role pill rendered inside the dropdown panel. Variants:
 *   User          → transparent bg, --role-employee-border, label "Employee"
 *   Support Agent → --role-support-agent-bg, --role-support-agent-border
 *   Admin         → transparent bg, --role-admin-border
 *
 * The UI surfaces 'User' as "Employee"; the data shape carries the
 * backend's literal 'User' (see models/enums.ts comment).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { UserRole } from '../../../models/enums';

type BadgeVariant = 'employee' | 'support-agent' | 'admin';

@Component({
  selector: 'badge-role',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="variantClass()">{{ label() }}</span>`,
  styles: [`
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid transparent;
    }
    .employee {
      background: transparent;
      border-color: var(--role-employee-border);
      color: var(--color-label);
    }
    .support-agent {
      background: var(--role-support-agent-bg);
      border-color: var(--role-support-agent-border);
      color: var(--role-support-agent-border);
    }
    .admin {
      background: transparent;
      border-color: var(--role-admin-border);
      color: var(--role-admin-border);
    }
  `],
})
export class BadgeRoleComponent {
  readonly role = input.required<UserRole>();

  readonly variant = computed<BadgeVariant>(() => {
    const r = this.role();
    if (r === 'User') return 'employee';
    if (r === 'Support Agent') return 'support-agent';
    return 'admin';
  });

  readonly variantClass = computed(() => this.variant());

  readonly label = computed(() => {
    const r = this.role();
    if (r === 'User') return 'Employee';
    return r;
  });
}
