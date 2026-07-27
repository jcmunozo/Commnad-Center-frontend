import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

/**
 * Thin wrapper around PrimeNG's ConfirmationService so every destructive
 * action (delete/archive/deactivate) shows the same themed dialog instead
 * of the native browser confirm().
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly confirmation = inject(ConfirmationService);

  danger(message: string, accept: () => void, opts?: { header?: string; acceptLabel?: string }) {
    this.confirmation.confirm({
      message,
      header: opts?.header ?? 'Confirm',
      icon: 'pi pi-exclamation-circle',
      acceptButtonProps: { label: opts?.acceptLabel ?? 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept,
    });
  }
}
