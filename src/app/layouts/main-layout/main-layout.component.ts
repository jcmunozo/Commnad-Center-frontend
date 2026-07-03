import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';

import { AuthStore } from '../../core/auth/auth.store';
import { LoadingService } from '../../core/services/loading.service';
import { CatalogsService } from '../../core/services/catalogs.service';

interface NavItem { label: string; icon: string; route: string; roles?: string[]; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
  template: `
    <div class="layout" [ngClass]="{ collapsed: collapsed() }">
      <aside class="sidenav">
        <div class="brand">PMO</div>
        <nav>
          @for (item of visibleNav(); track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active">
              <i class="pi {{ item.icon }}"></i><span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>

      <div class="content">
        <header class="topbar">
          <button class="icon-btn" (click)="toggle()"><i class="pi pi-bars"></i></button>
          @if (loading.isLoading()) { <span class="loading-dot">●</span> }
          <span class="spacer"></span>
          <span class="user">{{ auth.user()?.username }}</span>
          <button class="icon-btn" (click)="auth.logout()"><i class="pi pi-sign-out"></i></button>
        </header>
        <main class="pmo-page">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display:grid; grid-template-columns:220px 1fr; min-height:100vh; }
    .layout.collapsed { grid-template-columns:64px 1fr; }
    .sidenav { background:#0f172a; color:#cbd5e1; padding:1rem .5rem; }
    .brand { font-weight:700; color:#fff; padding:.5rem 1rem 1.5rem; }
    .sidenav nav a { display:flex; gap:.75rem; align-items:center; padding:.6rem 1rem; border-radius:var(--radius); color:#cbd5e1; }
    .sidenav nav a.active, .sidenav nav a:hover { background:#1e293b; color:#fff; }
    .layout.collapsed span { display:none; }
    .topbar { display:flex; align-items:center; gap:.75rem; padding:.5rem 1rem; background:#fff; border-bottom:1px solid #e5e7eb; }
    .spacer { flex:1; }
    .icon-btn { background:none; border:none; cursor:pointer; font-size:1.1rem; color:#475569; }
    .loading-dot { color:var(--pmo-primary); animation:pulse 1s infinite; }
    @keyframes pulse { 50% { opacity:.3; } }
  `],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthStore);
  readonly loading = inject(LoadingService);
  private readonly catalogs = inject(CatalogsService);

  readonly collapsed = signal(false);
  toggle() { this.collapsed.update((v) => !v); }

  private readonly nav: NavItem[] = [
    { label: 'Tablero', icon: 'pi-chart-bar', route: '/dashboard' },
    { label: 'Proyectos', icon: 'pi-folder', route: '/projects' },
    { label: 'Importar', icon: 'pi-upload', route: '/admin/import', roles: ['PMO Admin'] },
  ];

  readonly visibleNav = computed(() =>
    this.nav.filter((i) => !i.roles || this.auth.hasAnyRole(i.roles)),
  );

  constructor() {
    // Preload user + catalogs once the shell mounts.
    if (!this.auth.user()) this.auth.loadUser().subscribe();
    this.catalogs.preload().subscribe();
  }
}
