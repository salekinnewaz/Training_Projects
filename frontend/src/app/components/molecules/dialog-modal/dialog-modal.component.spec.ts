/**
 * dialog-modal — molecule spec (HD-004).
 *
 * Pins the dialog's interaction contract:
 *
 *   (a) Renders a scrim + modal with role="dialog" + aria-modal="true"
 *   (b) The scrim click + Esc keydown both emit `cancel`
 *   (c) The confirm + cancel buttons emit their respective events
 *   (d) [error] renders an inline .modal-error with role="alert"
 *   (e) [confirming] disables both action buttons (loading state)
 *   (f) Children are portaled to document.body on mount so the
 *       modal escapes any ancestor stacking context
 *
 * The host can verify (f) by inspecting document.body after
 * detectChanges; the scrim + modal are appended there rather
 * than living under the host element.
 */

import { Component, ViewChild } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';

import { DialogModalComponent } from './dialog-modal.component';

@Component({
  standalone: true,
  imports: [DialogModalComponent],
  template: `
    <dialog-modal
      [headline]="headline"
      [cancelLabel]="cancelLabel"
      [confirmLabel]="confirmLabel"
      [error]="error"
      [confirming]="confirming"
      (cancel)="onCancel()"
      (confirm)="onConfirm()"
    />
  `,
})
class HostComponent {
  @ViewChild(DialogModalComponent) modal!: DialogModalComponent;
  cancelCount = 0;
  confirmCount = 0;
  headline = 'Are you sure?';
  cancelLabel = 'Cancel';
  confirmLabel = 'Confirm';
  error: string | null = null;
  confirming = false;
  onCancel(): void { this.cancelCount++; }
  onConfirm(): void { this.confirmCount++; }
}

describe('DialogModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    // Clear any stragglers left in document.body by other suites
    // (users-tab-page opens a dialog modal too) so the dialog-modal
    // tests don't pick up a foreign modal here.
    document.body.innerHTML = '';
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    // The portal effect runs on the next change-detection cycle;
    // pump a stable frame to let the scrim + modal land in body.
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    // The modal's constructor moved children to document.body. Reset
    // between tests so the next test's portal append starts clean.
    document.body.innerHTML = '';
  });

  it('renders a scrim and a role="dialog" aria-modal="true" element', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Are you sure?');

    const scrim = document.body.querySelector('.scrim') as HTMLElement;
    expect(scrim).not.toBeNull();
  });

  it('renders the headline text', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const headline = document.body.querySelector('.modal-headline') as HTMLElement;
    expect(headline.textContent?.trim()).toBe('Are you sure?');
  });

  it('uses the cancelLabel + confirmLabel inputs for the action buttons', async () => {
    host.cancelLabel = 'No';
    host.confirmLabel = 'Yes, log out';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = document.body.querySelectorAll('.modal-actions button');
    expect(buttons[0]?.textContent?.trim()).toBe('No');
    expect(buttons[1]?.textContent?.trim()).toBe('Yes, log out');
  });

  it('emits cancel when the scrim is clicked', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const scrim = document.body.querySelector('.scrim') as HTMLElement;
    scrim.click();
    expect(host.cancelCount).toBe(1);
    expect(host.confirmCount).toBe(0);
  });

  it('emits cancel when the cancel button is clicked', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = document.body.querySelectorAll('.modal-actions button');
    (buttons[0] as HTMLButtonElement).click();
    expect(host.cancelCount).toBe(1);
  });

  it('emits confirm when the confirm button is clicked', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = document.body.querySelectorAll('.modal-actions button');
    (buttons[1] as HTMLButtonElement).click();
    expect(host.confirmCount).toBe(1);
    expect(host.cancelCount).toBe(0);
  });

  it('emits cancel when Escape is pressed (HostListener on document)', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.cancelCount).toBe(1);
  });

  it('does NOT render the inline error when [error] is null', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.body.querySelector('.modal-error')).toBeNull();
  });

  it('renders the inline error with role="alert" when [error] is set', async () => {
    host.error = "Couldn't reach the server.";
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const err = document.body.querySelector('.modal-error') as HTMLElement;
    expect(err).not.toBeNull();
    expect(err.textContent?.trim()).toBe("Couldn't reach the server.");
    expect(err.getAttribute('role')).toBe('alert');
  });

  it('disables both action buttons when [confirming] is true', async () => {
    host.confirming = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = document.body.querySelectorAll(
      '.modal-actions button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons[0]?.disabled).toBeTrue();
    expect(buttons[1]?.disabled).toBeTrue();
  });
});
