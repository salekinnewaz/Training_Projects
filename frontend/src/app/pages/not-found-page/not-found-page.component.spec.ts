/**
 * NotFoundPageComponent — D110.
 *
 * Pins the public contract of the 404 page:
 *
 *   (a) Renders the 404 status code + headline
 *   (b) Primary CTA calls auth.roleHomePath() and navigates there
 *   (c) "Go back" link renders only when history.length > 1
 *   (d) "Go back" link is not rendered on a cold load (history.length === 1)
 *   (e) Router navigation lands on roleHomePath() (not on /login)
 *
 * The page is mounted directly without any authGuard so it can
 * render for both authenticated and unauthenticated users. The
 * router.navigateByUrl spy is installed against the real Router
 * (via `provideRouter([])`) because the page doesn't transitively
 * render header-chrome, but staying consistent with the rest of
 * the spec suite is cheap insurance.
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { NotFoundPageComponent } from './not-found-page.component';

describe('NotFoundPageComponent (D110)', () => {
  let authService: {
    userSnapshot: jasmine.Spy<() => unknown>;
    roleHomePath: jasmine.Spy<() => string>;
  };
  let routerNavigateByUrlSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = {
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(null),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/login'),
    };

    await TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('renders the 404 status code and the headline', () => {
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.error-code')?.textContent?.trim()).toBe('404');
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      "We couldn't find that page",
    );
  });

  it('primary CTA navigates to auth.roleHomePath()', () => {
    authService.roleHomePath.and.returnValue('/dashboard');
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'atom-button button',
    ) as HTMLButtonElement;
    button.click();

    expect(authService.roleHomePath).toHaveBeenCalled();
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('hides the "Go back" link when history.length === 1 (cold load)', () => {
    // Stub history.length to 1 to simulate a cold load. The
    // "renders when history.length > 1" test below bumps it; this
    // restores the cold-load value explicitly so the two tests
    // don't depend on shared jsdom state.
    const originalLength = history.length;
    Object.defineProperty(history, 'length', {
      configurable: true,
      value: 1,
    });
    try {
      const fixture = TestBed.createComponent(NotFoundPageComponent);
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('[data-testid="go-back"]');
      expect(link).toBeNull();
    } finally {
      Object.defineProperty(history, 'length', {
        configurable: true,
        value: originalLength,
      });
    }
  });

  it('renders the "Go back" link when history.length > 1', () => {
    // Stub history.length to simulate an authenticated user who
    // deep-linked from somewhere inside the app.
    const originalLength = history.length;
    Object.defineProperty(history, 'length', {
      configurable: true,
      value: 3,
    });
    try {
      const fixture = TestBed.createComponent(NotFoundPageComponent);
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('[data-testid="go-back"]');
      expect(link).not.toBeNull();
    } finally {
      Object.defineProperty(history, 'length', {
        configurable: true,
        value: originalLength,
      });
    }
  });
});