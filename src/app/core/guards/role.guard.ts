import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '../auth/auth.store';

/** Usage: `canActivate: [roleGuard([ROLES.ADMIN, ROLES.PM])]`. */
export const roleGuard = (roles: string[]): CanActivateFn => () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return auth.hasAnyRole(roles) ? true : router.createUrlTree(['/forbidden']);
};
