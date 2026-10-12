/**
 * dialog-modal — molecule (HD-004 + D7).
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
 *
 * D7 replaced the hand-rolled `.btn` / `.btn-primary` /
 * `.btn-secondary` styles with the existing `<atom-button>`
 * atom (D7 spec: "convergence is deliberate non-goal until
 * dialogs gain a second use case"; three consumers now use
 * the dialog). The atom's `focus()` method preserves the
 * pre-D7 auto-focus UX (`ngAfterViewInit` calls
 * `confirmBtn().focus()` instead of
 * `confirmBtn().nativeElement.focus()`).
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

import { ButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'dialog-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
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
        <atom-button
          variant="secondary"
          [disabled]="confirming()"
          (pressed)="cancel.emit()"
        >{{ cancelLabel() }}</atom-button>
        <atom-button
          #confirmBtn
          variant="primary"
          [disabled]="confirming()"
          (pressed)="confirm.emit()"
        >{{ confirmLabel() }}</atom-button>
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

  // Pre-D7 this was `viewChild<ElementRef<HTMLButtonElement>>('confirmBtn')`
  // pointing at the inline `<button>`. D7 swaps to a
  // `viewChild<ButtonComponent>` against the `<atom-button>` host so
  // `ngAfterViewInit` can call `.focus()` on the component instance
  // — the atom owns the inner button element + the disabled state
  // check (see `ButtonComponent.focus`).
  readonly confirmBtn = viewChild<ButtonComponent>('confirmBtn');

  private readonly appendedToBody = signal(false);

  constructor() {
    // After first render, move the host's children (scrim + modal) to
    // document.body so fixed positioning is independent of any
    // ancestor transform / overflow. No-op on subsequent renders.
    //
    // `allowSignalWrites: true` — the effect mutates `appendedToBody`
    // so the portal never re-runs. Angular 17 disallows signal writes
    // inside effects by default; this is the documented escape hatch
    // for the "fire once" pattern.
    effect(
      () => {
        if (this.appendedToBody()) return;
        const el = this.hostEl.nativeElement;
        // Children live under a `<ng-content>` projection in practice;
        // because we used inline template above, the children of the
        // host element ARE the scrim + modal. Append each to body.
        while (el.firstChild) {
          this.renderer.appendChild(document.body, el.firstChild);
        }
        this.appendedToBody.set(true);
      },
      { allowSignalWrites: true },
    );
  }

  ngAfterViewInit(): void {
    // Initial focus on the confirm button per UX spec. D7 calls
    // the atom's public `focus()` method instead of
    // `nativeElement.focus()` directly. The atom no-ops when
    // disabled, so we don't have to guard on the `[confirming]`
    // flag here.
    queueMicrotask(() => {
      this.confirmBtn()?.focus();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel.emit();
  }
}
