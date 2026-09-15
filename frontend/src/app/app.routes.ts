import { Routes } from '@angular/router';

/**
 * Top-level routes. Every Phase 4 page is stubbed here as a lazy-loaded
 * placeholder in HD-001; later stories (HD-005+) replace each
 * placeholder with the real page component while preserving the path.
 *
 * Source of truth for paths: design-process/G-Mimir-Handoff/phase-6-kickoff.md
 *   HD-005  /login
 *   HD-007  /dashboard
 *   HD-008  /tickets/new
 *   HD-009  /tickets/:id/created
 *   HD-010  /tickets/:id
 *   HD-012  /queue
 *   HD-013  /admin
 *   HD-014  /users
 *   (out of MVP) /forgot-password
 *
 * Authentication + role-based route guards (authGuard / roleGuard) land
 * in HD-006 and are applied here at that time.
 */
export const routes: Routes = [
  // HD-004 retarget: while the chrome is being smoke-tested without
  // a login flow (HD-005) or guards (HD-006), landing on `/` drops
  // the user on the chrome-preview page where the chrome + dropdown
  // can be exercised against a cookie set via curl. HD-006 flips
  // this back to redirect 'login' once authGuard lands.
  { path: '', redirectTo: 'chrome-preview', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
    title: 'Sign in · HelpDesk Lite',
  },

  // TODO(hd-006): remove this route — chrome-preview is a HD-004
  // scaffolding page for verifying the chrome end-to-end.
  {
    path: 'chrome-preview',
    loadComponent: () =>
      import('./pages/chrome-preview-page/chrome-preview-page.component').then(
        (m) => m.ChromePreviewPageComponent
      ),
    title: 'HD-004 chrome preview · HelpDesk Lite',
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/employee-dashboard-page/employee-dashboard-page.component').then(
        (m) => m.EmployeeDashboardPageComponent
      ),
    title: 'My Tickets · HelpDesk Lite',
  },

  {
    path: 'tickets/new',
    loadComponent: () =>
      import('./pages/create-ticket-page/create-ticket-page.component').then(
        (m) => m.CreateTicketPageComponent
      ),
    title: 'New ticket · HelpDesk Lite',
  },

  {
    path: 'tickets/:id/created',
    loadComponent: () =>
      import(
        './pages/submission-confirmation-page/submission-confirmation-page.component'
      ).then((m) => m.SubmissionConfirmationPageComponent),
    title: 'Ticket created · HelpDesk Lite',
  },

  {
    path: 'tickets/:id',
    loadComponent: () =>
      import('./pages/ticket-detail-page/ticket-detail-page.component').then(
        (m) => m.TicketDetailPageComponent
      ),
    title: 'Ticket · HelpDesk Lite',
  },

  {
    path: 'queue',
    loadComponent: () =>
      import('./pages/agent-kanban-page/agent-kanban-page.component').then(
        (m) => m.AgentKanbanPageComponent
      ),
    title: 'Queue · HelpDesk Lite',
  },

  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin-dashboard-page/admin-dashboard-page.component').then(
        (m) => m.AdminDashboardPageComponent
      ),
    title: 'Admin · HelpDesk Lite',
  },

  {
    path: 'users',
    loadComponent: () =>
      import('./pages/users-tab-page/users-tab-page.component').then(
        (m) => m.UsersTabPageComponent
      ),
    title: 'Users · HelpDesk Lite',
  },

  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password-page/forgot-password-page.component').then(
        (m) => m.ForgotPasswordPageComponent
      ),
    title: 'Reset password · HelpDesk Lite',
  },

  { path: '**', redirectTo: 'login' },
];
