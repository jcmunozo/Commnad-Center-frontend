import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="auth-brand">PMO Command Center</h1>
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .auth-shell { min-height:100vh; display:grid; place-items:center; background:linear-gradient(135deg,#eef2ff,#f7f8fa); }
    .auth-card { width:360px; background:#fff; padding:2rem; border-radius:var(--radius); box-shadow:0 10px 30px rgba(0,0,0,.08); }
    .auth-brand { font-size:1.25rem; margin:0 0 1.5rem; color:var(--pmo-primary); text-align:center; }
  `],
})
export class AuthLayoutComponent {}
