/**
 * app-chrome — pattern (HD-004, HD-006).
 *
 * Persistent header shell + page outlet. Two modes:
 *
 *   1. Standalone wrap: `<app-chrome />` inside a page template
 *      projects the page body into the `<main>` slot while also
 *      rendering the chrome strip above it. Used during smoke-tests
 *      and by any page that wants to opt-in to the chrome itself.
 *
 *   2. Parent-route layout: a parent route component renders
 *      `<app-chrome><router-outlet /></app-chrome>` so every child
 *      page is wrapped automatically. The router-outlet sits
 *      alongside the projected content — Angular renders both into
 *      the same `<div class="page-content">`.
 *
 * HD-006 adds a skip-to-main-content link as the first focusable
 * element so keyboard users can jump past the header chrome. The
 * link is off-screen until focused (see `.skip-link` in styles.css).
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
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header-chrome />
    <main id="main-content" class="page-shell" tabindex="-1">
      <div class="page-content">
        <ng-content />
        <router-outlet />
      </div>
    </main>
  `,
})
export class AppChromeComponent {}
