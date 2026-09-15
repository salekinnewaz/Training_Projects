/**
 * dialog-modal — molecule (HD-004).
 *
 * Centered confirmation dialog with a scrim overlay. Rendered via a
 * Renderer2 portal-to-body so the `position: fixed` modal escapes any
 * local stacking/overflow context (the chrome's `position: sticky`
 * header, in particular).
 *
 * Dismissal:
 *   - Esc key → cancel.emit()
 *   - Scrim click → cancel.emit()
 *   - Confirm button click → confirm.emit()
 *   - Cancel button click → cancel.emit()
 *
 * Initial focus lands on the confirm button per the UX spec.
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Renderer2,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'dialog-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="cancel.emit()"></div>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="headline()"
      tabindex="-1"
    >
      <h2 class="modal-headline">{{ headline() }}</h2>
      @if (error(); as e) {
        <p class="modal-error" role="alert">{{ e }}</p>
      }
      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="cancel.emit()"
        >{{ cancelLabel() }}</button>
        <button
          #confirmBtn
          type="button"
          class="btn btn-primary"
          (click)="confirm.emit()"
        >{{ confirmLabel() }}</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
    .scrim {
      position: fixed;
      inset: 0;
      background: var(--color-scrim);
      z-index: var(--z-modal-scrim);
    }
    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--color-surface);
      border-radius: 8px;
      padding: var(--space-modal-pad);
      width: var(--size-modal-width);
      max-width: calc(100vw - 32px);
      z-index: var(--z-modal);
      box-shadow: 0 8px 24px rgba(33, 37, 41, 0.2);
    }
    .modal-headline {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0 0 16px;
    }
    .modal-error {
      color: var(--color-error);
      font-size: 14px;
      margin: 0 0 12px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }
    .btn {
      height: var(--button-height);
      padding: 0 20px;
      border-radius: var(--button-radius);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-secondary {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-label);
    }
    .btn-secondary:hover {
      background: var(--color-surface-subtle);
    }
    .btn-primary {
      background: var(--color-primary);
      border: 1px solid var(--color-primary);
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #000000;
    }
  `],
})
export class DialogModalComponent implements AfterViewInit {
  private readonly renderer = inject(Renderer2);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly headline = input.required<string>();
  readonly cancelLabel = input<string>('Cancel');
  readonly confirmLabel = input<string>('Confirm');
  readonly error = input<string | null>(null);
  readonly confirming = input<boolean>(false);

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  readonly confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  private readonly appendedToBody = signal(false);

  constructor() {
    // After first render, move the host's children (scrim + modal) to
    // document.body so fixed positioning is independent of any
    // ancestor transform / overflow. No-op on subsequent renders.
    effect(() => {
      if (this.appendedToBody()) return;
      const el = this.hostEl.nativeElement;
      // Children live under a `<ng-content>` projection in practice;
      // because we used inline template above, the children of the
      // host element ARE the scrim + modal. Append each to body.
      while (el.firstChild) {
        this.renderer.appendChild(document.body, el.firstChild);
      }
      this.appendedToBody.set(true);
    });
  }

  ngAfterViewInit(): void {
    // Initial focus on the confirm button per UX spec.
    queueMicrotask(() => {
      this.confirmBtn()?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel.emit();
  }
}
