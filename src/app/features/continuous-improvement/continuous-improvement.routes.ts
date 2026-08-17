import { Routes } from '@angular/router';

export const CONTINUOUS_IMPROVEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./work-item-list/work-item-list.component').then((m) => m.WorkItemListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./work-item-detail/work-item-detail.component').then(
        (m) => m.WorkItemDetailComponent),
  },
];
