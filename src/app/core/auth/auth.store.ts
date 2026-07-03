import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CurrentUser, TokenPair } from './auth.models';

const ACCESS_KEY = 'pmo_access';
const REFRESH_KEY = 'pmo_refresh';

/**
 * Global auth state as signals. Holds tokens + current user, exposes role checks,
 * and owns the refresh/login/logout flows.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = environment.apiUrl;

  readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly refreshToken = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  readonly user = signal<CurrentUser | null>(null);

  readonly isAuthenticated = computed(() => !!this.accessToken());
  readonly roles = computed(() => this.user()?.roles ?? []);

  hasAnyRole(roles: string[]): boolean {
    const mine = this.roles();
    return roles.some((r) => mine.includes(r));
  }

  login(username: string, password: string) {
    return this.http.post<TokenPair>(`${this.base}/auth/token/`, { username, password }).pipe(
      tap((tokens) => this.setTokens(tokens)),
      tap(() => this.loadUser().subscribe()),
    );
  }

  refresh() {
    return this.http
      .post<{ access: string }>(`${this.base}/auth/token/refresh/`, { refresh: this.refreshToken() })
      .pipe(tap(({ access }) => this.setAccess(access)));
  }

  loadUser() {
    return this.http.get<CurrentUser>(`${this.base}/me/`).pipe(tap((u) => this.user.set(u)));
  }

  logout() {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.router.navigate(['/auth/login']);
  }

  private setTokens(tokens: TokenPair) {
    this.setAccess(tokens.access);
    this.refreshToken.set(tokens.refresh);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }

  private setAccess(access: string) {
    this.accessToken.set(access);
    localStorage.setItem(ACCESS_KEY, access);
  }
}
