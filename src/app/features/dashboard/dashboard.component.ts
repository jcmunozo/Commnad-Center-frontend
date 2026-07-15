import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import { DashboardService } from './dashboard.service';
import { PortfolioAlerts, PortfolioKpis } from './dashboard.models';
import { TeamService, WorkloadRow } from '../team/team.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

// Paleta validada (dataviz) sobre la superficie oscura #18181b:
// azul de serie 3:1+, estados con etiqueta de texto siempre presente.
const BLUE = '#3987e5';
const GOOD = '#0ca30c';
const WARNING = '#fab219';
const CRITICAL = '#d03b3b';
const NEUTRAL = '#898781';

const HEALTH_COLOR: Record<string, string> = { GREEN: GOOD, YELLOW: WARNING, RED: CRITICAL };
const LOAD_COLOR: Record<WorkloadRow['alert'], string> = {
  OK: GOOD, HIGH_LOAD: WARNING, OVERLOADED: CRITICAL,
};
const LOAD_LABEL: Record<WorkloadRow['alert'], string> = {
  OK: 'Available', HIGH_LOAD: 'At capacity', OVERLOADED: 'Overloaded',
};

const BASE_CHART = {
  toolbar: { show: false },
  background: 'transparent',
  fontFamily: 'inherit',
};
const BASE_GRID = { borderColor: '#2c2c2a', strokeDashArray: 0 };
const AXIS_LABELS = { style: { colors: '#a1a1aa' } };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgApexchartsModule, KpiCardComponent],
  template: `
    <h2>Portfolio dashboard</h2>

    @if (kpis(); as k) {
      <div class="pmo-grid pmo-grid--kpi">
        <app-kpi-card label="Projects" [value]="k.total_projects" accent="${BLUE}" />
        <app-kpi-card label="Activos" [value]="k.active_projects" accent="${BLUE}" />
        <app-kpi-card label="Bloqueados" [value]="k.blocked_projects"
          [accent]="k.blocked_projects > 0 ? '${CRITICAL}' : 'var(--pmo-border)'" />
        <app-kpi-card label="Open tasks" [value]="k.open_tasks" accent="${BLUE}" />
        <app-kpi-card label="Overdue tasks" [value]="k.overdue_tasks"
          [accent]="k.overdue_tasks > 0 ? '${WARNING}' : 'var(--pmo-border)'" />
        <app-kpi-card label="Overdue subtasks" [value]="k.overdue_subtasks"
          [accent]="k.overdue_subtasks > 0 ? '${CRITICAL}' : 'var(--pmo-border)'" />
      </div>

      <div class="charts">
        <div class="chart-card">
          <h3>Projects by status</h3>
          <apx-chart [series]="[{ name: 'Projects', data: projectStatus().counts }]"
            [chart]="chartCfg(projectStatus().labels.length)"
            [plotOptions]="barOpts" [colors]="['${BLUE}']"
            [dataLabels]="countLabels" [xaxis]="{ categories: projectStatus().labels, labels: axisLabels }"
            [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
            [tooltip]="{ theme: 'dark' }" />
        </div>

        <div class="chart-card">
          <h3>Tasks by status</h3>
          <apx-chart [series]="[{ name: 'Tasks', data: taskStatus().counts }]"
            [chart]="chartCfg(taskStatus().labels.length)"
            [plotOptions]="barOpts" [colors]="['${BLUE}']"
            [dataLabels]="countLabels" [xaxis]="{ categories: taskStatus().labels, labels: axisLabels }"
            [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
            [tooltip]="{ theme: 'dark' }" />
        </div>

        <div class="chart-card">
          <h3>Progress by project <span class="chart-sub">color = health</span></h3>
          <apx-chart [series]="[{ name: 'Progress', data: progress().values }]"
            [chart]="chartCfg(progress().labels.length)"
            [plotOptions]="distributedBarOpts" [colors]="progress().colors"
            [dataLabels]="pctLabels" [xaxis]="{ categories: progress().labels, max: 100, labels: axisLabels }"
            [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
            [tooltip]="{ theme: 'dark' }" />
          <div class="viz-legend">
            <span><i [style.background]="'${GOOD}'"></i> Verde</span>
            <span><i [style.background]="'${WARNING}'"></i> Amarilla</span>
            <span><i [style.background]="'${CRITICAL}'"></i> Roja</span>
            <span><i [style.background]="'${NEUTRAL}'"></i> No health</span>
          </div>
        </div>

        @if (workload().length) {
          <div class="chart-card">
            <h3>Team load <span class="chart-sub">% of weekly capacity</span></h3>
            <apx-chart [series]="[{ name: 'Load', data: load().values }]"
              [chart]="chartCfg(load().labels.length)"
              [plotOptions]="distributedBarOpts" [colors]="load().colors"
              [dataLabels]="pctLabels" [xaxis]="{ categories: load().labels, labels: axisLabels }"
              [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
              [tooltip]="{ theme: 'dark' }" />
            <div class="viz-legend">
              <span><i [style.background]="'${GOOD}'"></i> Available</span>
              <span><i [style.background]="'${WARNING}'"></i> At capacity</span>
              <span><i [style.background]="'${CRITICAL}'"></i> Overloaded</span>
            </div>
          </div>
        }
      </div>
    }

    @if (alerts(); as a) {
      <div class="alerts">
        <h3>Alerts</h3>
        <div class="alert-groups">
          <div class="alert-group">
            <div class="alert-head">
              <i class="pi pi-exclamation-circle" [style.color]="'${CRITICAL}'"></i>
              <strong>{{ a.overdue_subtasks.length }}</strong> overdue subtasks
            </div>
            <ul>
              @for (s of a.overdue_subtasks.slice(0, 6); track s.id) {
                <li>{{ s.description }}
                  <span class="dim">({{ s.task_code || s.task_name }}
                    @if (s.assignee_name) { · {{ s.assignee_name }} }
                    · due {{ s.due_date | date:'dd MMM' }})</span></li>
              }
            </ul>
          </div>
          <div class="alert-group">
            <div class="alert-head">
              <i class="pi pi-flag" [style.color]="'${WARNING}'"></i>
              <strong>{{ a.overdue_milestones.length }}</strong> overdue milestones
            </div>
            <ul>
              @for (m of a.overdue_milestones.slice(0, 4); track m.id) {
                <li>{{ m.name }} <span class="dim">({{ m.avg_progress * 100 | number:'1.0-0' }}% ·
                  {{ m.target_date | date:'dd MMM' }})</span></li>
              }
            </ul>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .charts { margin-top:1.5rem; display:grid; grid-template-columns:repeat(auto-fit,minmax(380px,1fr)); gap:1.25rem; }
    .chart-card { background:var(--pmo-surface); padding:1rem 1.25rem; border-radius:var(--radius);
      border:1px solid var(--pmo-border); }
    .chart-card h3 { margin:0 0 .25rem; font-size:.95rem; }
    .chart-sub { font-weight:400; font-size:.75rem; color:var(--pmo-muted); margin-left:.5rem; }
    .viz-legend { display:flex; gap:1rem; flex-wrap:wrap; font-size:.75rem; color:var(--pmo-muted);
      padding:.25rem .25rem 0; }
    .viz-legend i { display:inline-block; width:.6rem; height:.6rem; border-radius:50%;
      margin-right:.3rem; }
    .alerts { margin-top:1.5rem; background:var(--pmo-surface); padding:1rem 1.5rem 1.25rem;
      border-radius:var(--radius); border:1px solid var(--pmo-border); }
    .alerts h3 { margin:.25rem 0 1rem; font-size:.95rem; }
    .alert-groups { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1.25rem; }
    .alert-head { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
    .alert-head strong { font-size:1.1rem; }
    .alert-group ul { margin:0; padding-left:1.1rem; }
    .alert-group li { font-size:.85rem; margin-bottom:.3rem; }
    .dim { color:var(--pmo-muted); font-size:.78rem; }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly team = inject(TeamService);
  private readonly catalogs = inject(CatalogsService);

  readonly kpis = signal<PortfolioKpis | null>(null);
  readonly alerts = signal<PortfolioAlerts | null>(null);
  readonly workload = signal<WorkloadRow[]>([]);

  // Opciones compartidas de las barras (marcas finas, extremos redondeados 4px).
  readonly grid = BASE_GRID;
  readonly axisLabels = AXIS_LABELS;
  readonly barOpts = {
    bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end' as const,
      barHeight: '55%' },
  };
  readonly distributedBarOpts = {
    bar: { horizontal: true, distributed: true, borderRadius: 4,
      borderRadiusApplication: 'end' as const, barHeight: '55%' },
  };
  readonly countLabels = {
    enabled: true, style: { colors: ['#e4e4e7'], fontWeight: 600 },
  };
  readonly pctLabels = {
    enabled: true, style: { colors: ['#e4e4e7'], fontWeight: 600 },
    formatter: (v: number) => `${Math.round(v)}%`,
  };

  /** Ordena un conteo {code: n} según el orden del catálogo y lo etiqueta. */
  private ordered(counts: Record<string, number>, slug: 'project-statuses' | 'task-statuses') {
    const rows = this.catalogs.get(slug)
      .filter((c) => counts[c.code] !== undefined)
      .map((c) => ({ label: c.name, count: counts[c.code] }));
    return { labels: rows.map((r) => r.label), counts: rows.map((r) => r.count) };
  }

  readonly projectStatus = computed(() =>
    this.ordered(this.kpis()?.by_status ?? {}, 'project-statuses'));
  readonly taskStatus = computed(() =>
    this.ordered(this.kpis()?.by_task_status ?? {}, 'task-statuses'));

  readonly progress = computed(() => {
    const projects = this.kpis()?.projects ?? [];
    return {
      labels: projects.map((p) => p.legacy_code || p.name),
      values: projects.map((p) => Math.round(p.progress_pct * 100)),
      colors: projects.map((p) => HEALTH_COLOR[p.health ?? ''] ?? NEUTRAL),
    };
  });

  readonly load = computed(() => {
    const rows = [...this.workload()].sort((a, b) => b.workload_pct - a.workload_pct).slice(0, 10);
    return {
      labels: rows.map((r) => r.name),
      values: rows.map((r) => Math.round(r.workload_pct * 100)),
      colors: rows.map((r) => LOAD_COLOR[r.alert]),
      states: rows.map((r) => LOAD_LABEL[r.alert]),
    };
  });

  chartCfg(rows: number) {
    return { type: 'bar' as const, height: Math.max(160, rows * 44 + 60), ...BASE_CHART };
  }

  ngOnInit() {
    this.service.portfolio().subscribe((k) => this.kpis.set(k));
    this.service.alerts().subscribe((a) => this.alerts.set(a));
    // Solo Admin/PM tienen acceso a workload; para otros roles el panel se omite.
    this.team.workload().subscribe({
      next: (rows) => this.workload.set(rows),
      error: () => this.workload.set([]),
    });
  }
}
