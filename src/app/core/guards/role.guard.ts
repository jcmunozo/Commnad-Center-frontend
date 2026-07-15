import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthStore } from '../auth/auth.store';

/** Usage: `canActivate: [roleGuard([ROLES.ADMIN, ROLES.PM])]`. */
export const roleGuard = (roles: string[]): CanActivateFn => () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const check = () => (auth.hasAnyRole(roles) ? true : router.createUrlTree(['/forbidden']));

  // On a hard reload the guard can run before /me/ resolves; fetch it first
  // so role checks see real data instead of the empty default.
  if (!auth.user() && auth.isAuthenticated()) {
    return auth.loadUser().pipe(
      map(check),
      catchError(() => of(router.createUrlTree(['/forbidden']))),
    );
  }
  return check();
};
