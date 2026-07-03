import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../services/notification.service';

/** Normalizes DRF error payloads into user-facing toasts (skips 401, handled by auth). */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) {
        notify.error(`Error ${err.status}`, extractMessage(err));
      }
      return throwError(() => err);
    }),
  );
};

function extractMessage(err: HttpErrorResponse): string {
  const body = err.error;
  if (typeof body === 'string') return body;
  if (body?.detail) return body.detail;
  if (body && typeof body === 'object') {
    // DRF field errors: { field: ["msg", ...] }
    return Object.entries(body)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ');
  }
  return err.message;
}
