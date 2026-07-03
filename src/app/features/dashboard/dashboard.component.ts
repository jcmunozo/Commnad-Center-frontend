import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import { DashboardService } from './dashboard.service';
import { PortfolioAlerts, PortfolioKpis } from './dashboard.models';
import { CatalogsService } from '../../core/services/catalogs.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgApexchartsModule, KpiCardComponent],
  template: `
    <h2>Tablero de portafolio</h2>

    @if (kpis(); as k) {
      <div class="pmo-grid pmo-grid--kpi">
        <app-kpi-card label="Proyectos" [value]="k.total_projects" />
        <app-kpi-card label="Activos" [value]="k.active_projects" accent="var(--pmo-success)" />
        <app-kpi-card label="Bloqueados" [value]="k.blocked_projects" accent="var(--pmo-danger)" />
        <app-kpi-card label="Tareas abiertas" [value]="k.open_tasks" />
        <app-kpi-card label="Tareas vencidas" [value]="k.overdue_tasks" accent="var(--pmo-warn)" />
        <app-kpi-card label="Riesgos críticos" [value]="k.critical_risks" accent="var(--pmo-danger)" />
      </div>

      <div class="charts">
        <div class="chart-card">
          <h3>Proyectos por estado</h3>
          <apx-chart [series]="statusSeries()" [chart]="{ type: 'donut', height: 280 }"
            [labels]="statusLabels()" />
        </div>
      </div>
    }

    @if (alerts(); as a) {
      <div class="alerts">
        <h3>Alertas</h3>
        <ul>
          <li>{{ a.critical_risks.length }} riesgos críticos abiertos</li>
          <li>{{ a.overdue_actions.length }} acciones vencidas</li>
          <li>{{ a.overdue_milestones.length }} hitos vencidos</li>
        </ul>
      </div>
    }
  `,
  styles: [`
    .charts { margin-top:2rem; display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1.5rem; }
    .chart-card { background:#fff; padding:1rem; border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .alerts { margin-top:2rem; background:#fff; padding:1rem 1.5rem; border-radius:var(--radius); }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly catalogs = inject(CatalogsService);

  readonly kpis = signal<PortfolioKpis | null>(null);
  readonly alerts = signal<PortfolioAlerts | null>(null);

  readonly statusLabels = computed(() =>
    Object.keys(this.kpis()?.by_status ?? {}).map((code) =>
      this.catalogs.label('project-statuses', code)),
  );
  readonly statusSeries = computed(() => Object.values(this.kpis()?.by_status ?? {}));

  ngOnInit() {
    this.service.portfolio().subscribe((k) => this.kpis.set(k));
    this.service.alerts().subscribe((a) => this.alerts.set(a));
  }
}
