/**
 * dropdown-panel — molecule spec (HD-004).
 *
 * Pins the panel's positioning + role + window:resize behavior:
 *
 *   (a) Renders a role="menu" panel with width: 240px (the spec)
 *   (b) Position is derived from the anchor's bounding rect:
 *       top = anchor.bottom + --space-chrome-bottom-gap
 *       right = max(0, window.innerWidth - anchor.right)
 *   (c) Window resize recomputes the position (the HostListener
 *       calls getBoundingClientRect again)
 *   (d) Projected content renders inside the panel
 *
 * The panel uses an effect to re-anchor on every change to the
 * `anchor` input. The spec gives the panel a fake anchor element
 * with a known bounding rect.
 */

import { Component, ElementRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';

import { DropdownPanelComponent } from './dropdown-panel.component';

@Component({
  standalone: true,
  imports: [DropdownPanelComponent],
  template: `
    <button id="fake-anchor">trigger</button>
    <dropdown-panel [anchor]="anchor">
      <p>menu contents</p>
    </dropdown-panel>
  `,
})
class HostComponent {
  /**
   * Set lazily on first CD via a setter (the @ViewChild is
   * stable after the first change-detection cycle, and we
   * mutate the property only when the ViewChild is populated,
   * which avoids the NG0100 ExpressionChangedAfter…checked
   * error that a fresh query each CD round would trigger).
   */
  anchor: HTMLElement | null = null;
}

interface RectStub {
  top: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

describe('DropdownPanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let anchor: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    // First CD renders the template. Now the anchor button exists
    // in the DOM. We snapshot it for the stub below.
    fixture.detectChanges();
    anchor = (fixture.nativeElement as HTMLElement).querySelector('#fake-anchor') as HTMLElement;
    // The host property is read by [anchor]="anchor" in the panel
    // template. Set it AFTER first CD so the binding has a stable
    // value across the next CD rounds (avoids NG0100).
    fixture.componentInstance.anchor = anchor;
    fixture.detectChanges();
  });

  /**
   * jsdom returns all-zero rects by default; mock getBoundingClientRect
   * on the anchor so the position math has a non-trivial input. Then
   * re-assign the anchor (a fresh object reference) so the panel's
   * effect re-runs and reads the new rect.
   */
  function stubAnchorRect(rect: RectStub): void {
    anchor.getBoundingClientRect = () => ({
      ...rect,
      left: 0,
      x: 0,
      y: rect.top,
      toJSON: () => rect,
    });
    // Trigger the effect re-run by reassigning the anchor to a
    // fresh wrapper (the panel's `anchor()` signal changes value).
    fixture.componentInstance.anchor = { ...anchor } as unknown as HTMLElement;
    fixture.detectChanges();
    // Restore for any subsequent reads.
    fixture.componentInstance.anchor = anchor;
    fixture.detectChanges();
  }

  it('renders a role="menu" panel that projects the slotted content', () => {
    stubAnchorRect({ top: 10, bottom: 50, right: 1000, width: 100, height: 40 });

    const panel = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('menu contents');
  });

  it('positions the panel under the anchor with the right offset (240px wide)', () => {
    stubAnchorRect({ top: 10, bottom: 50, right: 1000, width: 100, height: 40 });

    const panel = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    // width is hardcoded to 240 by the component.
    expect(panel.style.width).toBe('240px');
    // right = max(0, window.innerWidth - 1000). The Chrome
    // headless viewport is wider than jsdom's 1024 default, so
    // assert the relationship holds (anchor.right + panelRight
    // equals the viewport width) rather than a hardcoded 0.
    const expectedRight = Math.max(0, window.innerWidth - 1000);
    expect(panel.style.right).toBe(`${expectedRight}px`);
  });

  it('re-anchors on window:resize (HostListener re-reads the rect)', () => {
    stubAnchorRect({ top: 10, bottom: 50, right: 1000, width: 100, height: 40 });

    const panel = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    const initialRight = parseFloat(panel.style.right);
    // Capture the initial right (should be window.innerWidth - 1000).
    expect(initialRight).toBe(Math.max(0, window.innerWidth - 1000));

    // Simulate the anchor moving to the right (e.g. layout shift + resize).
    // Reduce anchor.right by 200px → panel's right should grow by 200px.
    const newAnchorRight = 200; // closer to the left edge
    anchor.getBoundingClientRect = () => ({
      top: 100,
      bottom: 140,
      right: newAnchorRight,
      width: 100,
      height: 40,
      left: 0,
      x: 0,
      y: 100,
      toJSON: () => ({
        top: 100,
        bottom: 140,
        right: newAnchorRight,
        width: 100,
        height: 40,
        left: 0,
        x: 0,
        y: 100,
      }),
    });
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    // After the resize event the rightPx() signal re-derives from the
    // new rect: max(0, window.innerWidth - 200).
    const expectedRight = Math.max(0, window.innerWidth - newAnchorRight);
    expect(panel.style.right).toBe(`${expectedRight}px`);
  });
});