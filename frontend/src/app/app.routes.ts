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
 *   HD-006  /forbidden
 *
 * HD-006 wires `authGuard` (must be authenticated) and `roleGuard(...)`
 * (role-restricted routes) into every protected entry. `/login` uses
 * `loginGuard` so an already-authenticated user bounces to their role
 * home instead of seeing the form. `/forbidden` is authGuard'd but NOT
 * roleGuard'd so role mismatches have somewhere to land without looping.
 */
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { loginGuard } from './guards/login.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
    title: 'Sign in · HelpDesk Lite',
  },

  {
    path: 'forbidden',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/forbidden-page/forbidden-page.component').then(
        (m) => m.ForbiddenPageComponent
      ),
    title: 'Forbidden · HelpDesk Lite',
  },

  {
    path: 'dashboard',
    canActivate: [authGuard, roleGuard(['User', 'Support Agent', 'Admin'])],
    loadComponent: () =>
      import('./pages/employee-dashboard-page/employee-dashboard-page.component').then(
        (m) => m.EmployeeDashboardPageComponent
      ),
    title: 'My Tickets · HelpDesk Lite',
  },

  {
    path: 'tickets/new',
    canActivate: [authGuard, roleGuard(['User'])],
    loadComponent: () =>
      import('./pages/create-ticket-page/create-ticket-page.component').then(
        (m) => m.CreateTicketPageComponent
      ),
    title: 'New ticket · HelpDesk Lite',
  },

  {
    path: 'tickets/:id/created',
    canActivate: [authGuard, roleGuard(['User'])],
    loadComponent: () =>
      import(
        './pages/submission-confirmation-page/submission-confirmation-page.component'
      ).then((m) => m.SubmissionConfirmationPageComponent),
    title: 'Ticket created · HelpDesk Lite',
  },

  {
    path: 'tickets/:id',
    canActivate: [authGuard, roleGuard(['User', 'Support Agent', 'Admin'])],
    loadComponent: () =>
      import('./pages/ticket-detail-page/ticket-detail-page.component').then(
        (m) => m.TicketDetailPageComponent
      ),
    title: 'Ticket · HelpDesk Lite',
  },

  {
    path: 'queue',
    canActivate: [authGuard, roleGuard(['Support Agent'])],
    loadComponent: () =>
      import('./pages/agent-kanban-page/agent-kanban-page.component').then(
        (m) => m.AgentKanbanPageComponent
      ),
    title: 'Queue · HelpDesk Lite',
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['Admin'])],
    loadComponent: () =>
      import('./pages/admin-dashboard-page/admin-dashboard-page.component').then(
        (m) => m.AdminDashboardPageComponent
      ),
    title: 'Admin · HelpDesk Lite',
  },

  {
    path: 'users',
    canActivate: [authGuard, roleGuard(['Admin'])],
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
