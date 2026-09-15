/**
 * link — atom (HD-005).
 *
 * RouterLink-driven `<a>` for SPA navigation. Renders an `<a>`
 * with `[routerLink]="href"` so the Angular Router intercepts
 * the click and avoids a full-page reload.
 *
 * When `disabled=true`, the link renders a plain `<a>` without
 * router binding and with `aria-disabled`. Callers can still
 * listen for clicks on the host; the host does NOT prevent
 * navigation. The "disabled" state is purely visual/a11y here —
 * the host decides whether to actually navigate.
 *
 * Color + hover underline match the global `<a>` styling in
 * styles.css.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'atom-link',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (disabled()) {
      <a
        [attr.aria-disabled]="true"
        class="disabled"
        (click)="$event.preventDefault()"
      ><ng-content /></a>
    } @else {
      <a [routerLink]="href()" (click)="onClick($event)"><ng-content /></a>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    a {
      color: var(--color-primary);
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
    }
    a:hover {
      text-decoration: underline;
    }
    a.disabled {
      color: var(--color-disabled);
      cursor: not-allowed;
    }
    a.disabled:hover {
      text-decoration: none;
    }
  `],
})
export class LinkComponent {
  readonly href = input.required<string>();
  readonly disabled = input<boolean>(false);

  @Output() readonly navigate = new EventEmitter<void>();

  onClick(event: MouseEvent): void {
    // RouterLink already handles the navigation. We emit so callers
    // can run side effects (analytics, etc.) — but we do NOT
    // preventDefault; default RouterLink behaviour wins.
    void event;
    this.navigate.emit();
  }
}
