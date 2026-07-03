import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { NotificationService } from '../../../core/services/notification.service';

/**
 * Password recovery request. NOTE: the backend endpoint is not yet implemented
 * (proposed for a later phase). This UI is ready to POST /api/auth/password-reset/.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, ButtonModule],
  template: `
    @if (!sent()) {
      <form [formGroup]="form" (ngSubmit)="submit()" class="fp-form">
        <p class="hint">Te enviaremos un enlace para restablecer tu contraseña.</p>
        <label>Correo
          <input pInputText type="email" formControlName="email" />
        </label>
        <p-button type="submit" label="Enviar enlace" [disabled]="form.invalid" styleClass="w-full" />
      </form>
    } @else {
      <p>Si el correo existe, recibirás instrucciones en breve.</p>
    }
    <a routerLink="/auth/login">Volver a iniciar sesión</a>
  `,
  styles: [`
    .fp-form { display:flex; flex-direction:column; gap:1rem; }
    .hint { font-size:.85rem; color:#64748b; }
    label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem; }
    :host ::ng-deep .w-full { width:100%; }
  `],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit() {
    if (this.form.invalid) return;
    // TODO: wire to backend password-reset endpoint when available.
    this.sent.set(true);
    this.notify.info('Solicitud enviada');
  }
}
