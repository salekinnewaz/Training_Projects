/**
 * forbidden-page — smoke spec (HD-006).
 *
 * Seeds the testing convention per kickoff DoD: a narrow test that
 * the page renders, the breadcrumb shows the decoded `denied_from`
 * path with a single leading slash, and the "Go to your dashboard"
 * button triggers `router.navigateByUrl(roleHomePath())`.
 *
 * The page uses `<atom-link>` which wraps `RouterLink` and
 * needs the real Router (the `events` Observable that
 * `RouterLink` subscribes to in its constructor). A stub
 * Router via `useValue` breaks this. Fix: provide a real
 * Router via `provideRouter([])` and spy on `Router.navigateByUrl`
 * for the assertion.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ForbiddenPageComponent } from './forbidden-page.component';

describe('ForbiddenPageComponent', () => {
  let router: Router;
  let routerNavigateByUrlSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForbiddenPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ denied_from: '/admin' }),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            user$: { subscribe: () => ({ unsubscribe: () => undefined }) },
            userSnapshot: () => null,
            roleHomePath: () => '/login',
            refreshUser: () => Promise.resolve(),
            logout: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('renders the headline and breadcrumb', () => {
    const fixture = TestBed.createComponent(ForbiddenPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain(
      "You don't have access to this page",
    );
    const breadcrumb = compiled.querySelector('.denied-from');
    expect(breadcrumb).not.toBeNull();
    // Breadcrumb is rendered as "/admin" — one leading slash, not "//admin".
    expect(breadcrumb?.textContent?.trim()).toBe('/admin');
  });

  it('hides the breadcrumb when denied_from is absent', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForbiddenPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            user$: { subscribe: () => ({ unsubscribe: () => undefined }) },
            userSnapshot: () => null,
            roleHomePath: () => '/login',
            refreshUser: () => Promise.resolve(),
            logout: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ForbiddenPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.denied-from')).toBeNull();
  });

  it('routes to roleHomePath when the dashboard button is clicked', () => {
    const fixture = TestBed.createComponent(ForbiddenPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const button = compiled.querySelector('atom-button');
    (button as HTMLElement)?.dispatchEvent(new Event('click', { bubbles: true }));
    fixture.detectChanges();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/login');
  });
});
