/**
 * app-chrome — pattern (HD-004).
 *
 * Persistent header shell + page outlet. Two modes:
 *
 *   1. Standalone wrap: `<app-chrome />` inside a page template
 *      projects the page body into the `<main>` slot while also
 *      rendering the chrome strip above it. Used by the smoke-test
 *      scaffold (chrome-preview-page).
 *
 *   2. Parent-route layout: in HD-006 the parent route component
 *      renders `<app-chrome><router-outlet /></app-chrome>` so every
 *      child page is wrapped automatically. The router-outlet sits
 *      alongside the projected content — Angular renders both into
 *      the same `<div class="page-content">`.
 *
 * For HD-004 mode 1 is wired; mode 2 is documented for HD-006.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HeaderChromeComponent } from '../../molecules/header-chrome/header-chrome.component';

@Component({
  selector: 'app-chrome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderChromeComponent, RouterOutlet],
  template: `
    <header-chrome />
    <main id="main-content" class="page-shell">
      <div class="page-content">
        <ng-content />
        <router-outlet />
      </div>
    </main>
  `,
})
export class AppChromeComponent {}
