import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root shell. Renders only a `<router-outlet>` — every screen's
 * chrome (header, footer, etc.) is composed by the routed page or
 * by app-chrome patterns introduced in HD-004.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
