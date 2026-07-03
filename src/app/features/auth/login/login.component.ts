import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
      <label>Usuario
        <input pInputText formControlName="username" autocomplete="username" />
      </label>
      <label>Contraseña
        <p-password formControlName="password" [feedback]="false" [toggleMask]="true" styleClass="w-full" />
      </label>
      <p-button type="submit" label="Iniciar sesión" [loading]="loading()" [disabled]="form.invalid" styleClass="w-full" />
      <a routerLink="/auth/forgot-password" class="forgot">¿Olvidaste tu contraseña?</a>
    </form>
  `,
  styles: [`
    .login-form { display:flex; flex-direction:column; gap:1rem; }
    label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem; color:#475569; }
    .forgot { text-align:center; font-size:.85rem; }
    :host ::ng-deep .w-full, :host ::ng-deep .w-full input { width:100%; }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => { this.loading.set(false); this.notify.error('Credenciales inválidas'); },
    });
  }
}
