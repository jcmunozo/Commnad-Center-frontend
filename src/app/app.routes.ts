import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ROLES } from './core/auth/auth.models';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./features/projects/projects.routes').then((m) => m.PROJECT_ROUTES),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/ticket-list/ticket-list.component').then(
            (m) => m.TicketListComponent),
      },
      {
        path: 'leaves',
        loadComponent: () =>
          import('./features/leaves/leaves.component').then((m) => m.LeavesComponent),
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./features/notes/note-list/note-list.component').then(
            (m) => m.NoteListComponent),
      },
      {
        path: 'team',
        canActivate: [roleGuard([ROLES.ADMIN, ROLES.PM])],
        loadComponent: () =>
          import('./features/team/team.component').then((m) => m.TeamComponent),
      },
    ],
  },
  { path: 'forbidden', loadComponent: () => import('./shared/components/forbidden.component').then((m) => m.ForbiddenComponent) },
  { path: '**', redirectTo: '' },
];
