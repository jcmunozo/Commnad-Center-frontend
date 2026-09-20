import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { SelectModule } from 'primeng/select';
import { switchMap } from 'rxjs';

import { DashboardService } from './dashboard.service';
import { BurndownData, PortfolioAlerts, PortfolioKpis, VelocityData } from './dashboard.models';
import { SprintService } from '../sprints/sprint.service';
import { Sprint } from '../sprints/sprint.models';
import { TeamService, WorkloadRow } from '../team/team.service';
import { NoteService } from '../notes/note.service';
import { Note, dueState } from '../notes/note.models';
import { CatalogsService } from '../../core/services/catalogs.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

// Paleta validada (dataviz) sobre la superficie oscura #18181b:
// azul de serie 3:1+, estados con etiqueta de texto siempre presente.
const BLUE = '#3987e5';
const ORANGE = '#d95926';
const GOOD = '#0ca30c';
const WARNING = '#fab219';
const CRITICAL = '#d03b3b';
const NEUTRAL = '#898781';
// Tokens de chrome oscuro (palette.md) para elementos que no son marcas de datos
// (anotaciones, gridlines) — no forman parte de la paleta categórica/estado.
const CHROME_BASELINE = '#383835';
const CHROME_INK_SECONDARY = '#c3c2b7';

// Categórica (dataviz palette.md, pasos oscuros, validada sobre #18181b): un slot fijo
// por estado del catálogo, para que un filtro nunca repinte a los demás.
const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const SURFACE = '#18181b';
const DONUT_MAX_SEGMENTS = 6;

const HEALTH_COLOR: Record<string, string> = { GREEN: GOOD, YELLOW: WARNING, RED: CRITICAL };
const HEALTH_LABEL: Record<string, string> = { GREEN: 'Green', YELLOW: 'Yellow', RED: 'Red' };
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
const BASE_TOOLTIP = { theme: 'dark' };

/** Identifica cada tarjeta de gráfica para el toggle de vista-tabla. */
type ChartKey = 'project-status' | 'task-status' | 'progress' | 'load' | 'effort'
  | 'burndown' | 'velocity' | 'accuracy';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, NgApexchartsModule, SelectModule, KpiCardComponent],
  template: `
    <div class="page-head">
      <h2>Portfolio dashboard</h2>
      <label class="sprint-picker">
        <span>Sprint</span>
        <p-select [options]="sprintOptions()" optionLabel="label" optionValue="id"
          [ngModel]="selectedSprintId()" (ngModelChange)="onSprintChange($event)"
          [showClear]="true" placeholder="All time" appendTo="body" />
      </label>
    </div>

    @if (kpis(); as k) {
      <div class="pmo-grid pmo-grid--kpi">
        <app-kpi-card label="Projects" [value]="k.total_projects" [accent]="blue" />
        <app-kpi-card label="Activos" [value]="k.active_projects" [accent]="blue" />
        <app-kpi-card label="Bloqueados" [value]="k.blocked_projects"
          [accent]="k.blocked_projects > 0 ? critical : borderColor" />
        <app-kpi-card label="Open tasks" [value]="k.open_tasks" [accent]="blue" />
        <app-kpi-card label="Overdue tasks" [value]="k.overdue_tasks"
          [accent]="k.overdue_tasks > 0 ? warning : borderColor" />
        <app-kpi-card label="Overdue subtasks" [value]="k.overdue_subtasks"
          [accent]="k.overdue_subtasks > 0 ? critical : borderColor" />
      </div>

      <div class="charts">
        <div class="chart-card" [style.--accent]="blue">
          <div class="chart-head">
            <h3><i class="pi pi-briefcase"></i> Projects by status <span class="chart-sub">all sprints</span></h3>
            @if (projectStatus().labels.length) { <button type="button" class="table-toggle"
              (click)="toggleTable('project-status')" [attr.aria-pressed]="isTable('project-status') ? 'true' : 'false'"
              [attr.title]="isTable('project-status') ? 'Show chart' : 'Show as table'">
              <i class="pi" [class.pi-table]="!isTable('project-status')"
                [class.pi-chart-bar]="isTable('project-status')"></i>
            </button> }
          </div>
          @if (!projectStatus().labels.length) {
            <p class="chart-empty">No projects yet.</p>
          } @else if (isTable('project-status')) {
            <table class="chart-table">
              <caption class="sr-only">Projects by status</caption>
              <thead><tr><th>Status</th><th>Projects</th></tr></thead>
              <tbody>
                @for (row of projectStatus().rows; track row.label) {
                  <tr><td>{{ row.label }}</td><td>{{ row.count }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <apx-chart [series]="projectStatus().donut.values" [labels]="projectStatus().donut.labels"
              [chart]="donutChartCfg" [colors]="projectStatus().donut.colors"
              [plotOptions]="donutOpts" [stroke]="donutStroke" [dataLabels]="{ enabled: false }"
              [legend]="donutLegend" [tooltip]="tooltipBase" />
          }
        </div>

        <div class="chart-card" [style.--accent]="blue">
          <div class="chart-head">
            <h3><i class="pi pi-list-check"></i> Tasks by status</h3>
            @if (taskStatus().labels.length) { <button type="button" class="table-toggle"
              (click)="toggleTable('task-status')" [attr.aria-pressed]="isTable('task-status') ? 'true' : 'false'"
              [attr.title]="isTable('task-status') ? 'Show chart' : 'Show as table'">
              <i class="pi" [class.pi-table]="!isTable('task-status')"
                [class.pi-chart-bar]="isTable('task-status')"></i>
            </button> }
          </div>
          @if (!taskStatus().labels.length) {
            <p class="chart-empty">No tasks yet.</p>
          } @else if (isTable('task-status')) {
            <table class="chart-table">
              <caption class="sr-only">Tasks by status</caption>
              <thead><tr><th>Status</th><th>Tasks</th></tr></thead>
              <tbody>
                @for (row of taskStatus().rows; track row.label) {
                  <tr><td>{{ row.label }}</td><td>{{ row.count }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <apx-chart [series]="taskStatus().donut.values" [labels]="taskStatus().donut.labels"
              [chart]="donutChartCfg" [colors]="taskStatus().donut.colors"
              [plotOptions]="donutOpts" [stroke]="donutStroke" [dataLabels]="{ enabled: false }"
              [legend]="donutLegend" [tooltip]="tooltipBase" />
          }
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <h3><i class="pi pi-chart-line"></i> Progress by project <span class="chart-sub">color = health · all sprints</span></h3>
            @if (progress().labels.length) { <button type="button" class="table-toggle"
              (click)="toggleTable('progress')" [attr.aria-pressed]="isTable('progress') ? 'true' : 'false'"
              [attr.title]="isTable('progress') ? 'Show chart' : 'Show as table'">
              <i class="pi" [class.pi-table]="!isTable('progress')"
                [class.pi-chart-bar]="isTable('progress')"></i>
            </button> }
          </div>
          @if (!progress().labels.length) {
            <p class="chart-empty">No projects yet.</p>
          } @else if (isTable('progress')) {
            <table class="chart-table">
              <caption class="sr-only">Progress by project</caption>
              <thead><tr><th>Project</th><th>Progress</th><th>Health</th></tr></thead>
              <tbody>
                @for (row of progress().rows; track row.label) {
                  <tr><td>{{ row.label }}</td><td>{{ row.value }}%</td><td>{{ row.healthLabel }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <apx-chart [series]="[{ name: 'Progress', data: progress().values }]"
              [chart]="chartCfg(progress().labels.length)"
              [plotOptions]="distributedBarOpts" [colors]="progress().colors"
              [dataLabels]="pctLabels" [xaxis]="{ categories: progress().labels, max: 100, labels: axisLabels }"
              [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
              [tooltip]="progressTooltip" />
            <div class="viz-legend">
              <span><i [style.background]="good"></i> Green</span>
              <span><i [style.background]="warning"></i> Yellow</span>
              <span><i [style.background]="critical"></i> Red</span>
              <span><i [style.background]="neutral"></i> No health</span>
            </div>
          }
        </div>

        @if (workload().length) {
          <div class="chart-card">
            <div class="chart-head">
              <h3><i class="pi pi-users"></i> Team load <span class="chart-sub">% of capacity · selected period</span></h3>
              <button type="button" class="table-toggle"
                (click)="toggleTable('load')" [attr.aria-pressed]="isTable('load') ? 'true' : 'false'"
                [attr.title]="isTable('load') ? 'Show chart' : 'Show as table'">
                <i class="pi" [class.pi-table]="!isTable('load')" [class.pi-chart-bar]="isTable('load')"></i>
              </button>
            </div>
            @if (isTable('load')) {
              <table class="chart-table">
                <caption class="sr-only">Team load</caption>
                <thead><tr><th>Employee</th><th>Load</th><th>Status</th></tr></thead>
                <tbody>
                  @for (row of load().rows; track row.label) {
                    <tr><td>{{ row.label }}</td><td>{{ row.value }}%</td><td>{{ row.state }}</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <apx-chart [series]="[{ name: 'Load', data: load().values }]"
                [chart]="chartCfg(load().labels.length)"
                [plotOptions]="distributedBarOpts" [colors]="load().colors"
                [dataLabels]="pctLabels" [xaxis]="{ categories: load().labels, labels: axisLabels }"
                [yaxis]="{ labels: axisLabels }" [grid]="grid" [legend]="{ show: false }"
                [annotations]="loadAnnotations" [tooltip]="loadTooltip" />
              <div class="viz-legend">
                <span><i [style.background]="good"></i> Available</span>
                <span><i [style.background]="warning"></i> At capacity</span>
                <span><i [style.background]="critical"></i> Overloaded</span>
              </div>
            }
          </div>
        }

        @if (effort().labels.length) {
          <div class="chart-card chart-card--wide" [style.--accent]="blue">
            <div class="chart-head">
              <h3><i class="pi pi-clock"></i> Estimated vs actual hours <span class="chart-sub">per task{{ kpis()?.sprint ? ' · ' + kpis()!.sprint!.name : '' }}</span></h3>
              <button type="button" class="table-toggle"
                (click)="toggleTable('effort')" [attr.aria-pressed]="isTable('effort') ? 'true' : 'false'"
                [attr.title]="isTable('effort') ? 'Show chart' : 'Show as table'">
                <i class="pi" [class.pi-table]="!isTable('effort')" [class.pi-chart-bar]="isTable('effort')"></i>
              </button>
            </div>
            @if (isTable('effort')) {
              <table class="chart-table">
                <caption class="sr-only">Estimated vs actual hours per task</caption>
                <thead><tr><th>Task</th><th>Estimated</th><th>Actual</th></tr></thead>
                <tbody>
                  @for (row of effort().rows; track row.label) {
                    <tr><td>{{ row.label }}</td><td>{{ row.estimated }}h</td><td>{{ row.actual }}h</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <apx-chart [series]="[
                  { name: 'Estimated', data: effort().estimated },
                  { name: 'Actual', data: effort().actual }
                ]"
                [chart]="effortChartCfg(effort().labels.length)"
                [plotOptions]="barOpts" [colors]="[blue, orange]"
                [dataLabels]="hoursLabels" [xaxis]="{ categories: effort().labels, labels: axisLabels }"
                [yaxis]="{ labels: axisLabels }" [grid]="grid"
                [legend]="{ show: true, position: 'top', labels: { colors: '#a1a1aa' } }"
                [tooltip]="effortTooltip" />
            }
            <div class="viz-legend">
              <span>Tasks without a recorded estimate are excluded. Actual = 0h means the task has not logged hours yet.</span>
            </div>
          </div>
        }

        @if (selectedSprintId()) {
          <div class="chart-card chart-card--wide" [style.--accent]="blue">
            <div class="chart-head">
              <h3><i class="pi pi-arrow-down-right"></i> Burndown <span class="chart-sub">remaining estimated hours</span></h3>
              @if (burndownView().labels.length) { <button type="button" class="table-toggle"
                (click)="toggleTable('burndown')" [attr.aria-pressed]="isTable('burndown') ? 'true' : 'false'"
                [attr.title]="isTable('burndown') ? 'Show chart' : 'Show as table'">
                <i class="pi" [class.pi-table]="!isTable('burndown')" [class.pi-chart-line]="isTable('burndown')"></i>
              </button> }
            </div>
            @if (!burndownView().labels.length) {
              <p class="chart-empty">No estimated tasks in this sprint yet.</p>
            } @else if (isTable('burndown')) {
              <table class="chart-table">
                <caption class="sr-only">Sprint burndown</caption>
                <thead><tr><th>Day</th><th>Remaining</th><th>Ideal</th></tr></thead>
                <tbody>
                  @for (row of burndownView().rows; track row.label) {
                    <tr><td>{{ row.label }}</td><td>{{ row.remaining }}h</td><td>{{ row.ideal }}h</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <apx-chart [series]="[
                  { name: 'Remaining', data: burndownView().remaining },
                  { name: 'Ideal', data: burndownView().ideal }
                ]"
                [chart]="areaChartCfg" [colors]="[blue, neutral]"
                [fill]="burndownFill"
                [stroke]="{ width: [3, 2], dashArray: [0, 5], curve: 'smooth' }"
                [dataLabels]="{ enabled: false }"
                [xaxis]="{ categories: burndownView().labels, labels: axisLabels }"
                [yaxis]="{ min: 0, labels: axisLabels }" [grid]="grid"
                [legend]="{ show: true, position: 'top', labels: { colors: '#a1a1aa' } }"
                [tooltip]="effortTooltip" />
            }
            <div class="viz-legend">
              <span>Scope is the tasks assigned to the sprint right now, so it changes if tasks are added mid-sprint.
                Tasks with no completion timestamp count as not done.</span>
            </div>
          </div>
        }

        <div class="chart-card" [style.--accent]="blue">
          <div class="chart-head">
            <h3><i class="pi pi-bolt"></i> Velocity <span class="chart-sub">tasks done · last closed sprints</span></h3>
            @if (velocityView().labels.length) { <button type="button" class="table-toggle"
              (click)="toggleTable('velocity')" [attr.aria-pressed]="isTable('velocity') ? 'true' : 'false'"
              [attr.title]="isTable('velocity') ? 'Show chart' : 'Show as table'">
              <i class="pi" [class.pi-table]="!isTable('velocity')" [class.pi-chart-bar]="isTable('velocity')"></i>
            </button> }
          </div>
          @if (!velocityView().labels.length) {
            <p class="chart-empty">No closed sprints yet.</p>
          } @else if (isTable('velocity')) {
            <table class="chart-table">
              <caption class="sr-only">Velocity per closed sprint</caption>
              <thead><tr><th>Sprint</th><th>Tasks done</th><th>Hours done</th></tr></thead>
              <tbody>
                @for (row of velocityView().rows; track row.label) {
                  <tr><td>{{ row.label }}</td><td>{{ row.tasks }}</td><td>{{ row.hours }}h</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <apx-chart [series]="[{ name: 'Tasks done', data: velocityView().tasks }]"
              [chart]="columnChartCfg" [plotOptions]="columnOpts" [colors]="[blue]"
              [dataLabels]="countLabels" [xaxis]="{ categories: velocityView().labels, labels: axisLabels }"
              [yaxis]="{ min: 0, forceNiceScale: true, labels: axisLabels }" [grid]="grid"
              [legend]="{ show: false }" [tooltip]="tooltipBase" />
          }
        </div>

        <div class="chart-card" [style.--accent]="blue">
          <div class="chart-head">
            <h3><i class="pi pi-bullseye"></i> Estimation accuracy <span class="chart-sub">hours · closed sprints</span></h3>
            @if (velocityView().labels.length) { <button type="button" class="table-toggle"
              (click)="toggleTable('accuracy')" [attr.aria-pressed]="isTable('accuracy') ? 'true' : 'false'"
              [attr.title]="isTable('accuracy') ? 'Show chart' : 'Show as table'">
              <i class="pi" [class.pi-table]="!isTable('accuracy')" [class.pi-chart-bar]="isTable('accuracy')"></i>
            </button> }
          </div>
          @if (!velocityView().labels.length) {
            <p class="chart-empty">No closed sprints yet.</p>
          } @else if (isTable('accuracy')) {
            <table class="chart-table">
              <caption class="sr-only">Estimated vs actual hours per closed sprint</caption>
              <thead><tr><th>Sprint</th><th>Estimated</th><th>Actual</th></tr></thead>
              <tbody>
                @for (row of velocityView().rows; track row.label) {
                  <tr><td>{{ row.label }}</td><td>{{ row.estimated }}h</td><td>{{ row.actual }}h</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <apx-chart [series]="[
                { name: 'Estimated', data: velocityView().estimated },
                { name: 'Actual', data: velocityView().actual }
              ]"
              [chart]="columnChartCfg" [plotOptions]="columnOpts" [colors]="[blue, orange]"
              [dataLabels]="{ enabled: false }"
              [xaxis]="{ categories: velocityView().labels, labels: axisLabels }"
              [yaxis]="{ min: 0, labels: axisLabels }" [grid]="grid"
              [legend]="{ show: true, position: 'top', labels: { colors: '#a1a1aa' } }"
              [tooltip]="effortTooltip" />
          }
          <div class="viz-legend"><span>Only tasks marked Done in each sprint. Actual = hours logged on those tasks.</span></div>
        </div>
      </div>
    }

    @if (pinnedNotes().length) {
      <div class="pinned-notes">
        <h3><i class="pi pi-bookmark-fill"></i> Pinned notes</h3>
        <ul>
          @for (n of pinnedNotes(); track n.id) {
            <li>
              <a routerLink="/notes">{{ n.title }}</a>
              @if (n.due_date) {
                <span class="dim" [style.color]="dueColor(n)">
                  · due {{ n.due_date | date:'dd MMM' }}</span>
              }
            </li>
          }
        </ul>
      </div>
    }

    @if (alerts(); as a) {
      <div class="alerts">
        <h3>Alerts</h3>
        <div class="alert-groups">
          <div class="alert-group">
            <div class="alert-head">
              <i class="pi pi-exclamation-circle" [style.color]="critical"></i>
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
              <i class="pi pi-flag" [style.color]="warning"></i>
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
    .page-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
    .page-head h2 { margin:0; }
    .sprint-picker { display:flex; align-items:center; gap:.5rem; font-size:.8rem; color:var(--pmo-muted); }
    .charts { margin-top:1.5rem; display:grid; grid-template-columns:repeat(auto-fit,minmax(380px,1fr)); gap:1.25rem; }
    .chart-card { background:var(--pmo-surface); padding:1rem 1.25rem; border-radius:var(--radius);
      border:1px solid var(--pmo-border); border-top:3px solid var(--accent, var(--pmo-border));
      transition:box-shadow .15s ease; }
    .chart-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.24); }
    .chart-card--wide { grid-column: 1 / -1; }
    .chart-head { display:flex; align-items:center; gap:.5rem; margin-bottom:.25rem; }
    .chart-head h3 { margin:0; font-size:.95rem; flex:1; }
    .chart-head h3 i { color:var(--pmo-muted); margin-right:.4rem; }
    .chart-sub { font-weight:400; font-size:.75rem; color:var(--pmo-muted); margin-left:.5rem; }
    .table-toggle { background:transparent; border:1px solid var(--pmo-border); border-radius:6px;
      color:var(--pmo-muted); width:1.75rem; height:1.75rem; display:flex; align-items:center;
      justify-content:center; cursor:pointer; flex-shrink:0; transition:color .15s ease, border-color .15s ease; }
    .table-toggle:hover { color:var(--pmo-text); border-color:var(--pmo-muted); }
    .table-toggle i { font-size:.85rem; }
    .chart-empty { color:var(--pmo-muted); font-size:.85rem; text-align:center; padding:2.5rem 0; margin:0; }
    .chart-table { width:100%; border-collapse:collapse; font-size:.82rem; }
    .chart-table th { text-align:left; color:var(--pmo-muted); font-weight:600; font-size:.72rem;
      text-transform:uppercase; letter-spacing:.04em; padding:.4rem .5rem; border-bottom:1px solid var(--pmo-border); }
    .chart-table td { padding:.4rem .5rem; border-bottom:1px solid var(--pmo-border); color:var(--pmo-text); }
    .chart-table tbody tr:last-child td { border-bottom:none; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
      clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .viz-legend { display:flex; gap:1rem; flex-wrap:wrap; font-size:.75rem; color:var(--pmo-muted);
      padding:.5rem .25rem 0; }
    .viz-legend i { display:inline-block; width:.6rem; height:.6rem; border-radius:50%;
      margin-right:.3rem; }
    .alerts { margin-top:1.5rem; background:var(--pmo-surface); padding:1rem 1.5rem 1.25rem;
      border-radius:var(--radius); border:1px solid var(--pmo-border); }
    .pinned-notes { margin-top:1.5rem; background:var(--pmo-surface); padding:1rem 1.5rem 1.25rem;
      border-radius:var(--radius); border:1px solid var(--pmo-border); }
    .pinned-notes h3 { margin:.25rem 0 .75rem; font-size:.95rem; }
    .pinned-notes h3 i { color:var(--pmo-primary); margin-right:.4rem; }
    .pinned-notes ul { margin:0; padding-left:1.1rem; }
    .pinned-notes li { font-size:.85rem; margin-bottom:.3rem; }
    .pinned-notes a { color:var(--pmo-text); text-decoration:none; }
    .pinned-notes a:hover { color:var(--pmo-primary); }
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
  private readonly notes = inject(NoteService);
  private readonly catalogs = inject(CatalogsService);
  private readonly sprints = inject(SprintService);

  readonly kpis = signal<PortfolioKpis | null>(null);
  readonly alerts = signal<PortfolioAlerts | null>(null);
  readonly workload = signal<WorkloadRow[]>([]);
  readonly pinnedNotes = signal<Note[]>([]);
  readonly sprintList = signal<Sprint[]>([]);
  readonly selectedSprintId = signal<string | null>(null);
  readonly burndown = signal<BurndownData | null>(null);
  readonly velocity = signal<VelocityData | null>(null);

  readonly sprintOptions = computed(() => this.sprintList().map((s) => ({
    id: s.id, label: s.status === 'ACTIVE' ? `${s.name} (active)` : s.name,
  })));

  // Colores enlazados como propiedades de clase (en vez de interpolarlos como texto
  // dentro del template literal) para que el binding sea Angular normal y no un
  // splice de JS resuelto antes de compilar el componente.
  readonly blue = BLUE;
  readonly orange = ORANGE;
  readonly good = GOOD;
  readonly warning = WARNING;
  readonly critical = CRITICAL;
  readonly neutral = NEUTRAL;
  readonly borderColor = 'var(--pmo-border)';

  dueColor(n: Note) {
    return dueState(n) === 'overdue' ? this.critical : 'var(--pmo-muted)';
  }

  // Opciones compartidas de las barras (marcas finas, extremos redondeados 4px).
  readonly grid = BASE_GRID;
  readonly axisLabels = AXIS_LABELS;
  readonly tooltipBase = BASE_TOOLTIP;
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
  readonly hoursLabels = {
    enabled: true, style: { colors: ['#e4e4e7'], fontWeight: 600 },
    formatter: (v: number) => `${this.roundHours(v)}h`,
  };

  // Tooltips enriquecidos: el valor primero, la etiqueta de estado/salud después
  // ("values lead, labels follow" — dataviz skill), leyendo el mismo array que
  // ya alimenta la leyenda manual para que nunca se desincronicen.
  readonly progressTooltip = {
    ...BASE_TOOLTIP,
    y: { formatter: (v: number, o: any) => `${v}% · ${this.progress().rows[o.dataPointIndex]?.healthLabel ?? ''}` },
  };
  readonly loadTooltip = {
    ...BASE_TOOLTIP,
    y: { formatter: (v: number, o: any) => `${v}% · ${this.load().rows[o.dataPointIndex]?.state ?? ''}` },
  };
  readonly effortTooltip = {
    ...BASE_TOOLTIP,
    y: { formatter: (v: number) => `${this.roundHours(v)} h` },
  };
  // Línea de referencia al 100% de capacidad semanal en "Team load".
  readonly loadAnnotations = {
    xaxis: [{
      x: 100,
      strokeDashArray: 0,
      borderColor: CHROME_BASELINE,
      label: {
        text: '100% capacity', orientation: 'horizontal' as const,
        style: { color: CHROME_INK_SECONDARY, background: CHROME_BASELINE, fontSize: '10px' },
      },
    }],
  };

  readonly columnOpts = {
    bar: { horizontal: false, borderRadius: 4, borderRadiusApplication: 'end' as const,
      columnWidth: '45%' },
  };
  readonly areaChartCfg = { type: 'area' as const, height: 300, ...BASE_CHART };
  // Degradado solo en "Remaining"; la línea ideal queda sin relleno.
  readonly burndownFill = {
    type: ['gradient', 'solid'],
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 95, 100] },
    opacity: [1, 0],
  };
  readonly donutChartCfg = { type: 'donut' as const, height: 320, ...BASE_CHART };
  // Hueco de 2px del color de la superficie entre segmentos (marks-and-anatomy).
  readonly donutStroke = { width: 2, colors: [SURFACE] };
  readonly donutOpts = {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, color: '#a1a1aa', fontSize: '12px' },
          value: { show: true, color: '#e4e4e7', fontSize: '30px', fontWeight: 600 },
          total: { show: true, showAlways: true, label: 'Total', color: '#a1a1aa', fontSize: '12px',
            formatter: (w: any) => String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)) },
        },
      },
    },
  };
  // Leyenda siempre visible con el conteo: la identidad nunca depende solo del color.
  readonly donutLegend = {
    show: true, position: 'bottom' as const, fontSize: '12px',
    labels: { colors: '#c3c2b7' },
    markers: { strokeWidth: 0, offsetX: -2 },
    formatter: (name: string, o: any) => `${name} · ${o.w.globals.series[o.seriesIndex]}`,
  };
  readonly columnChartCfg = { type: 'bar' as const, height: 300, ...BASE_CHART };

  private roundHours(v: number): number {
    return Math.round(v * 10) / 10;
  }

  // Toggle de vista tabla por tarjeta (accesibilidad — cada gráfica tiene su
  // gemela en tabla, ver dataviz skill § anti-patterns "no table view").
  private readonly tableView = signal<ReadonlySet<ChartKey>>(new Set());
  isTable(key: ChartKey) {
    return this.tableView().has(key);
  }
  toggleTable(key: ChartKey) {
    const next = new Set(this.tableView());
    next.has(key) ? next.delete(key) : next.add(key);
    this.tableView.set(next);
  }

  /** Ordena un conteo {code: n} según el orden del catálogo y lo etiqueta.
   *  Cada estado conserva su color por posición en el catálogo (no por ranking). El
   *  `donut` pliega los segmentos más pequeños en "Other" si superan el máximo legible. */
  private ordered(counts: Record<string, number>, slug: 'project-statuses' | 'task-statuses') {
    const rows = this.catalogs.get(slug)
      .map((c, i) => ({ code: c.code, label: c.name, count: counts[c.code], color: CATEGORICAL[i % CATEGORICAL.length] }))
      .filter((r) => r.count !== undefined);

    let segments = rows;
    if (rows.length > DONUT_MAX_SEGMENTS) {
      const keep = new Set([...rows].sort((a, b) => b.count - a.count)
        .slice(0, DONUT_MAX_SEGMENTS - 1).map((r) => r.code));
      const kept = rows.filter((r) => keep.has(r.code));
      const otherCount = rows.filter((r) => !keep.has(r.code)).reduce((n, r) => n + r.count, 0);
      segments = [...kept, { code: 'OTHER', label: 'Other', count: otherCount, color: NEUTRAL }];
    }
    return {
      labels: rows.map((r) => r.label), counts: rows.map((r) => r.count), rows,
      donut: {
        labels: segments.map((r) => r.label), values: segments.map((r) => r.count),
        colors: segments.map((r) => r.color),
      },
    };
  }

  readonly projectStatus = computed(() =>
    this.ordered(this.kpis()?.by_status ?? {}, 'project-statuses'));
  readonly taskStatus = computed(() =>
    this.ordered(this.kpis()?.by_task_status ?? {}, 'task-statuses'));

  readonly progress = computed(() => {
    const projects = this.kpis()?.projects ?? [];
    const rows = projects.map((p) => ({
      label: p.name,
      value: Math.round(p.progress_pct * 100),
      color: HEALTH_COLOR[p.health ?? ''] ?? this.neutral,
      healthLabel: HEALTH_LABEL[p.health ?? ''] ?? 'No health',
    }));
    return {
      labels: rows.map((r) => r.label), values: rows.map((r) => r.value),
      colors: rows.map((r) => r.color), rows,
    };
  });

  readonly load = computed(() => {
    const sorted = [...this.workload()].sort((a, b) => b.workload_pct - a.workload_pct).slice(0, 10);
    const rows = sorted.map((r) => ({
      label: r.name, value: Math.round(r.workload_pct * 100),
      color: LOAD_COLOR[r.alert], state: LOAD_LABEL[r.alert],
    }));
    return {
      labels: rows.map((r) => r.label), values: rows.map((r) => r.value),
      colors: rows.map((r) => r.color), rows,
    };
  });

  readonly effort = computed(() => {
    const tasks = this.kpis()?.tasks_effort ?? [];
    const rows = tasks.map((t) => {
      const full = `${t.legacy_code ?? ''} — ${t.name}`;
      return {
        label: full.length > 42 ? `${full.slice(0, 41)}…` : full,
        estimated: this.roundHours(t.estimated_hours), actual: this.roundHours(t.actual_hours),
      };
    });
    return {
      labels: rows.map((r) => r.label), estimated: rows.map((r) => r.estimated),
      actual: rows.map((r) => r.actual), rows,
    };
  });

  readonly burndownView = computed(() => {
    const days = this.burndown()?.days ?? [];
    const rows = days.map((d) => ({
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      remaining: this.roundHours(d.remaining_hours), ideal: this.roundHours(d.ideal_hours),
    }));
    return {
      labels: rows.map((r) => r.label), remaining: rows.map((r) => r.remaining),
      ideal: rows.map((r) => r.ideal), rows,
    };
  });

  readonly velocityView = computed(() => {
    const rows = (this.velocity()?.sprints ?? []).map((s) => ({
      label: s.name, tasks: s.tasks_done, hours: this.roundHours(s.hours_done),
      estimated: this.roundHours(s.estimated_hours), actual: this.roundHours(s.actual_hours),
    }));
    return {
      labels: rows.map((r) => r.label), tasks: rows.map((r) => r.tasks),
      estimated: rows.map((r) => r.estimated), actual: rows.map((r) => r.actual), rows,
    };
  });

  chartCfg(rows: number) {
    return { type: 'bar' as const, height: Math.max(160, rows * 44 + 60), ...BASE_CHART };
  }
  effortChartCfg(rows: number) {
    return { type: 'bar' as const, height: Math.max(200, rows * 50 + 80), ...BASE_CHART };
  }

  ngOnInit() {
    this.sprints.list({ page_size: 50, ordering: '-start_date' }).subscribe({
      next: (page) => this.sprintList.set(page.results),
      error: () => this.sprintList.set([]),
    });
    // Default to the active sprint; with none, fall back to the all-time view.
    this.sprints.loadActive().subscribe(() => {
      this.selectedSprintId.set(this.sprints.current()?.id ?? null);
      this.reload();
    });
    this.service.velocity().subscribe({
      next: (v) => this.velocity.set(v),
      error: () => this.velocity.set(null),
    });
    // Solo Admin/PM tienen acceso a workload; para otros roles el panel se omite.
    // El periodo guardado se hidrata primero para que el gráfico coincida con /team.
    this.team.loadPersistedPeriod()
      .pipe(switchMap(() => this.team.workload(this.team.period() ?? undefined)))
      .subscribe({
        next: (rows) => this.workload.set(rows),
        error: () => this.workload.set([]),
      });
    this.notes.list({ pinned: true, status: 'OPEN', page_size: 6, ordering: '-created_at' })
      .subscribe({
        next: (page) => this.pinnedNotes.set(page.results),
        error: () => this.pinnedNotes.set([]),
      });
  }

  onSprintChange(id: string | null) {
    this.selectedSprintId.set(id);
    this.reload();
  }

  private reload() {
    const id = this.selectedSprintId();
    this.service.portfolio(id).subscribe((k) => this.kpis.set(k));
    this.service.alerts(id).subscribe({
      next: (a) => this.alerts.set(a),
      error: () => this.alerts.set(null),
    });
    if (id) {
      this.service.burndown(id).subscribe({
        next: (b) => this.burndown.set(b),
        error: () => this.burndown.set(null),
      });
    } else {
      this.burndown.set(null);
    }
  }
}
