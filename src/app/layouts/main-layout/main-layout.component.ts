import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PopoverModule } from 'primeng/popover';

import { AuthStore } from '../../core/auth/auth.store';
import { LoadingService } from '../../core/services/loading.service';
import { CatalogsService } from '../../core/services/catalogs.service';

interface NavItem { label: string; icon: string; route: string; roles?: string[]; }

/** Orden de importancia para mostrar el rol principal del usuario. */
const ROLE_ORDER = ['PMO Admin', 'Project Manager', 'Team Member', 'Viewer'];

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PopoverModule],
  template: `
    <div class="layout">
      <aside class="sidenav">
        <div class="brand">PMO Command Center</div>
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
          @if (loading.isLoading()) { <span class="loading-dot">●</span> }
          <span class="spacer"></span>

          <button type="button" class="user-chip" (click)="op.toggle($event)">
            <span class="avatar">{{ initials() }}</span>
            <span class="user-meta">
              <span class="user-name">{{ displayName() }}</span>
              <span class="user-role">{{ primaryRole() }}</span>
            </span>
            <i class="pi pi-chevron-down user-caret"></i>
          </button>

          <p-popover #op [style]="{width: '260px'}">
            <div class="menu-card">
              <div class="menu-head">
                <span class="avatar avatar--lg">{{ initials() }}</span>
                <div>
                  <div class="menu-name">{{ displayName() }}</div>
                  @if (auth.user()?.email; as email) {
                    <div class="menu-email">{{ email }}</div>
                  }
                </div>
              </div>
              @if (auth.user()?.roles?.length) {
                <div class="menu-roles">
                  @for (r of auth.user()!.roles; track r) {
                    <span class="role-chip">{{ r }}</span>
                  }
                </div>
              }
              <hr class="menu-sep" />
              <button type="button" class="menu-action" (click)="op.hide(); auth.logout()">
                <i class="pi pi-sign-out"></i> Sign out
              </button>
            </div>
          </p-popover>
        </header>
        <main class="pmo-page">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display:grid; grid-template-columns:220px 1fr; min-height:100vh; }
    .sidenav { background:#0f172a; color:#cbd5e1; padding:1rem .5rem; }
    .brand { font-weight:700; color:#fff; padding:.5rem 1rem 1.5rem; font-size:.95rem; }
    .sidenav nav a { display:flex; gap:.75rem; align-items:center; padding:.6rem 1rem; border-radius:var(--radius); color:#cbd5e1; }
    .sidenav nav a.active, .sidenav nav a:hover { background:#1e293b; color:#fff; }
    .topbar { display:flex; align-items:center; gap:.75rem; padding:.4rem 1rem; background:var(--pmo-surface); border-bottom:1px solid var(--pmo-border); }
    .spacer { flex:1; }
    .loading-dot { color:var(--pmo-primary); animation:pulse 1s infinite; }
    @keyframes pulse { 50% { opacity:.3; } }

    .user-chip { display:flex; align-items:center; gap:.6rem; background:none; border:none;
      cursor:pointer; padding:.35rem .5rem; border-radius:var(--radius); font-family:inherit; }
    .user-chip:hover { background:rgba(255,255,255,.05); }
    .avatar { width:34px; height:34px; border-radius:50%; display:inline-flex;
      align-items:center; justify-content:center; background:var(--pmo-primary);
      color:#fff; font-weight:700; font-size:.8rem; letter-spacing:.02em; flex-shrink:0; }
    .avatar--lg { width:44px; height:44px; font-size:1rem; }
    .user-meta { display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; }
    .user-name { font-size:.85rem; font-weight:600; color:var(--pmo-text); }
    .user-role { font-size:.7rem; color:var(--pmo-muted); }
    .user-caret { font-size:.65rem; color:var(--pmo-muted); }

    .menu-card { display:flex; flex-direction:column; gap:.75rem; }
    .menu-head { display:flex; align-items:center; gap:.75rem; }
    .menu-name { font-weight:700; }
    .menu-email { font-size:.78rem; color:var(--pmo-muted); word-break:break-all; }
    .menu-roles { display:flex; flex-wrap:wrap; gap:.35rem; }
    .role-chip { font-size:.7rem; padding:.15rem .55rem; border-radius:1rem;
      border:1px solid var(--pmo-border); color:var(--pmo-muted); }
    .menu-sep { border:none; border-top:1px solid var(--pmo-border); margin:0; }
    .menu-action { display:flex; align-items:center; gap:.5rem; background:none; border:none;
      cursor:pointer; padding:.5rem .4rem; border-radius:var(--radius); font-family:inherit;
      font-size:.85rem; color:var(--pmo-text); width:100%; text-align:left; }
    .menu-action:hover { background:rgba(220,38,38,.12); color:var(--pmo-danger); }
  `],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthStore);
  readonly loading = inject(LoadingService);
  private readonly catalogs = inject(CatalogsService);

  private readonly nav: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-chart-bar', route: '/dashboard' },
    { label: 'Projects', icon: 'pi-folder', route: '/projects' },
    { label: 'Tickets', icon: 'pi-ticket', route: '/tickets' },
    { label: 'Leaves', icon: 'pi-calendar-minus', route: '/leaves' },
    { label: 'Team', icon: 'pi-users', route: '/team', roles: ['PMO Admin', 'Project Manager'] },
  ];

  readonly visibleNav = computed(() =>
    this.nav.filter((i) => !i.roles || this.auth.hasAnyRole(i.roles)),
  );

  readonly displayName = computed(() => {
    const u = this.auth.user();
    if (!u) return '';
    const full = `${u.first_name} ${u.last_name}`.trim();
    return full || u.username;
  });

  readonly initials = computed(() => {
    const u = this.auth.user();
    if (!u) return '';
    const a = (u.first_name || u.username).charAt(0);
    const b = (u.last_name || u.username.charAt(1) || '').charAt(0);
    return (a + b).toUpperCase();
  });

  readonly primaryRole = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return ROLE_ORDER.find((r) => roles.includes(r)) ?? roles[0] ?? '';
  });

  constructor() {
    // Preload user + catalogs once the shell mounts.
    if (!this.auth.user()) this.auth.loadUser().subscribe();
    this.catalogs.preload().subscribe();
  }
}
