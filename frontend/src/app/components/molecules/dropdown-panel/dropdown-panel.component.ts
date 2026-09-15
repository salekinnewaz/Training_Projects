/**
 * dropdown-panel — molecule (HD-004).
 *
 * Anchored, right-aligned menu panel used for the profile dropdown.
 * Positioned in absolute coordinates relative to its anchor element
 * (the trigger button). Re-anchors on `window:resize` so it stays
 * glued to the trigger's right edge.
 *
 * No Angular CDK dependency — we only need a single menu for the
 * MVP. If a second anchored menu appears, swap to CDK Overlay.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'dropdown-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="panel"
      role="menu"
      [style.top.px]="topPx()"
      [style.right.px]="rightPx()"
      [style.width.px]="widthPx()"
      #panel
    >
      <ng-content />
    </div>
  `,
  styles: [`
    .panel {
      position: absolute;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: var(--shadow-dropdown);
      padding: 12px 0;
      z-index: var(--z-dropdown);
    }
  `],
})
export class DropdownPanelComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly anchor = input.required<HTMLElement>();
  readonly close = output<void>();
  readonly logout = output<void>();

  // Signals re-derive positioning whenever the host element's
  // bounding rect changes (e.g. after a re-layout). Resize events
  // recompute via the explicit effect below.
  private readonly rect = signal<{ top: number; bottom: number; right: number } | null>(
    null,
  );

  readonly topPx = computed(() => {
    const r = this.rect();
    if (!r) return 0;
    return r.bottom + window.scrollY + this.bottomGap();
  });

  readonly rightPx = computed(() => {
    const r = this.rect();
    if (!r) return 0;
    return Math.max(0, window.innerWidth - r.right);
  });

  readonly widthPx = computed(() => 240);

  private bottomGap(): number {
    // Read the CSS var so designers can override without code changes.
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--space-chrome-bottom-gap')
      .trim();
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 16;
  }

  constructor() {
    effect(() => {
      const el = this.anchor();
      if (!el) return;
      const b = el.getBoundingClientRect();
      this.rect.set({ top: b.top, bottom: b.bottom, right: b.right });
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    const el = this.anchor();
    if (!el) return;
    const b = el.getBoundingClientRect();
    this.rect.set({ top: b.top, bottom: b.bottom, right: b.right });
  }
}
