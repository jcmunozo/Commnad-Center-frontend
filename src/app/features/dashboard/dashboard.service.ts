import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { PortfolioAlerts, PortfolioKpis } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  portfolio() { return this.http.get<PortfolioKpis>(`${this.base}/dashboard/portfolio/`); }
  alerts() { return this.http.get<PortfolioAlerts>(`${this.base}/dashboard/alerts/`); }
}
