/**
 * kanban-card — smoke spec (HD-012).
 *
 * Verifies the molecule renders the Unassigned badge (and skips
 * the avatar+name branch) when a ticket has no owner and the
 * page has flagged it as an orphan. All other branches (title
 * clamp, mono number, priority pill, owner avatar+name) are
 * covered indirectly by the page-level tests — the molecule is
 * presentational and the page is the integration point.
 */

import { TestBed } from '@angular/core/testing';

import type { Ticket } from '../../../models/ticket';
import { KanbanCardComponent } from './kanban-card.component';

describe('KanbanCardComponent', () => {
  it('renders "Unassigned" instead of an avatar+name when the ticket has no owner and isOrphan is true', async () => {
    const ticket: Ticket = {
      id: 47,
      number: 'HD-47',
      title: 'WiFi drops',
      description: 'every few minutes',
      category: 'IT',
      priority: 'High',
      status: 'Open',
      submitter: {
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
        isActive: true,
        lastActiveAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      owner: null,
      attachment: null,
      createdAt: '2026-01-15T10:30:00.000Z',
      updatedAt: '2026-01-15T10:30:00.000Z',
      deletedAt: null,
    };

    await TestBed.configureTestingModule({
      imports: [KanbanCardComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(KanbanCardComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.componentRef.setInput('isOrphan', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const badge = compiled.querySelector('[data-testid="unassigned-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('Unassigned');

    // The owner avatar/name branch is the @else — the avatar must
    // not render when the owner is null. The chrome-avatar
    // element is identifiable by its selector.
    expect(compiled.querySelector('chrome-avatar')).toBeNull();
    expect(compiled.querySelector('.owner')).toBeNull();

    // Orphan tint class is on the card root.
    const card = compiled.querySelector('.card');
    expect(card?.classList.contains('orphan')).toBe(true);
  });
});
