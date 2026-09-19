import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { BurndownData, PortfolioAlerts, PortfolioKpis, VelocityData } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  portfolio(sprintId?: string | null) {
    return this.http.get<PortfolioKpis>(`${this.base}/dashboard/portfolio/`,
      { params: this.sprintParams(sprintId) });
  }
  alerts(sprintId?: string | null) {
    return this.http.get<PortfolioAlerts>(`${this.base}/dashboard/alerts/`,
      { params: this.sprintParams(sprintId) });
  }
  burndown(sprintId: string) {
    return this.http.get<BurndownData>(`${this.base}/dashboard/burndown/`,
      { params: new HttpParams().set('sprint_id', sprintId) });
  }
  velocity(limit = 6) {
    return this.http.get<VelocityData>(`${this.base}/dashboard/velocity/`,
      { params: new HttpParams().set('limit', String(limit)) });
  }

  private sprintParams(sprintId?: string | null) {
    return sprintId ? new HttpParams().set('sprint_id', sprintId) : new HttpParams();
  }
}
