import { Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/role.guard';
import { ROLES } from '../../core/auth/auth.models';

export const PROJECT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./project-list/project-list.component').then((m) => m.ProjectListComponent),
  },
  {
    path: 'new',
    canActivate: [roleGuard([ROLES.ADMIN, ROLES.PM])],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
  },
  {
    path: ':id/edit',
    canActivate: [roleGuard([ROLES.ADMIN, ROLES.PM])],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
  },
];
