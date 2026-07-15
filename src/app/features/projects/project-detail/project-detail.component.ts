import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';

import { ProjectService } from '../project.service';
import { PROJECT_PHASES, Project, ProjectDashboard } from '../project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ProjectTasksTabComponent } from './project-tasks-tab.component';
import { ProjectMilestonesTabComponent } from './project-milestones-tab.component';
import { ProjectSubtasksTabComponent } from './project-subtasks-tab.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, TabsModule, ButtonModule, KpiCardComponent,
    StatusBadgeComponent, ProjectTasksTabComponent, ProjectMilestonesTabComponent,
    ProjectSubtasksTabComponent,
  ],
  template: `
    @if (project(); as p) {
      <div class="pmo-toolbar">
        <h2>{{ p.legacy_code }} · {{ p.name }}</h2>
        <app-status-badge [code]="p.status" [label]="catalogs.label('project-statuses', p.status)" />
        <span class="spacer"></span>
        <p-button label="Edit" icon="pi pi-pencil" [routerLink]="['/projects', p.id, 'edit']" />
      </div>

      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0">Information</p-tab>
          <p-tab value="1">Tasks
            @if (taskCount() !== null) { <span class="tab-badge">{{ taskCount() }}</span> }
          </p-tab>
          <p-tab value="2">Milestones
            @if (milestoneCount() !== null) { <span class="tab-badge">{{ milestoneCount() }}</span> }
          </p-tab>
          <p-tab value="3">Subtasks
            @if (subtaskCount() !== null) { <span class="tab-badge">{{ subtaskCount() }}</span> }
          </p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            @if (dashboard(); as d) {
              <div class="pmo-grid pmo-grid--kpi">
                <app-kpi-card label="Open tasks" [value]="d.open_tasks" />
                <app-kpi-card label="Overdue tasks" [value]="d.overdue_tasks"
                  [accent]="d.overdue_tasks > 0 ? 'var(--pmo-warn)' : 'var(--pmo-border)'" />
                <app-kpi-card label="Open subtasks" [value]="d.open_subtasks" />
                <app-kpi-card label="Overdue subtasks" [value]="d.overdue_subtasks"
                  [accent]="d.overdue_subtasks > 0 ? 'var(--pmo-danger)' : 'var(--pmo-border)'" />
              </div>
            }
            @if (p.description) { <p class="description">{{ p.description }}</p> }

            <dl class="meta">
              <div><dt>Trigger</dt><dd>{{ p.trigger_name || '—' }}</dd></div>
              <div><dt>Target</dt><dd>{{ p.target_name || '—' }}</dd></div>
              <div><dt>Progress</dt><dd>{{ p.progress_pct * 100 | number:'1.0-0' }}%</dd></div>
              <div><dt>Start</dt><dd>{{ p.start_date | date }}</dd></div>
              <div><dt>Planned end</dt><dd>{{ p.planned_end | date }}</dd></div>
            </dl>

            @if (phaseRows().length) {
              <h3 class="phases-title">Timeline de fases</h3>
              <div class="phases">
                @for (ph of phaseRows(); track ph.code) {
                  <div class="phase" [class.phase--current]="ph.current"
                    [class.phase--done]="ph.done" [title]="ph.hint">
                    <span class="phase__label">{{ ph.label }}</span>
                    <span class="phase__dates">
                      {{ ph.start | date:'dd MMM' }} – {{ ph.end | date:'dd MMM' }}
                    </span>
                  </div>
                }
              </div>
            }
          </p-tabpanel>
          <p-tabpanel value="1">
            <app-project-tasks-tab [projectId]="p.id" (count)="taskCount.set($event)"
              (changed)="subtasksTab.load(); subtasksTab.loadTasks()" />
          </p-tabpanel>
          <p-tabpanel value="2">
            <app-project-milestones-tab [projectId]="p.id" (count)="milestoneCount.set($event)" />
          </p-tabpanel>
          <p-tabpanel value="3">
            <app-project-subtasks-tab #subtasksTab [projectId]="p.id"
              (count)="subtaskCount.set($event)" />
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }
  `,
  styles: [`
    .spacer { flex:1; }
    .tab-badge { display:inline-block; margin-left:.45rem; min-width:1.4rem; text-align:center;
      padding:.05rem .4rem; border-radius:1rem; font-size:.72rem; font-weight:700;
      background:var(--p-green-500, #22c55e); color:#04220f; }
    .meta { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1rem; margin-top:1.5rem; }
    dt { font-size:.75rem; color:var(--pmo-muted); text-transform:uppercase; }
    dd { margin:0; font-weight:600; }
    .description { margin:1.25rem 0 0; max-width:70ch; color:var(--pmo-muted); }
    .phases-title { margin:1.75rem 0 .75rem; font-size:.8rem; text-transform:uppercase;
      letter-spacing:.05em; color:var(--pmo-muted); }
    .phases { display:flex; gap:.35rem; flex-wrap:wrap; }
    .phase { flex:1; min-width:120px; padding:.6rem .75rem; border-radius:var(--radius);
      background:var(--pmo-surface); border:1px solid var(--pmo-border);
      display:flex; flex-direction:column; gap:.15rem; opacity:.75; }
    .phase--done { border-color:var(--pmo-primary); opacity:.55; }
    .phase--current { border-color:var(--pmo-primary); opacity:1;
      box-shadow:0 0 0 1px var(--pmo-primary); }
    .phase__label { font-weight:700; font-size:.85rem; }
    .phase__dates { font-size:.75rem; color:var(--pmo-muted); }
  `],
})
export class ProjectDetailComponent implements OnInit {
  // Route param bound via withComponentInputBinding().
  readonly id = input.required<string>();

  private readonly service = inject(ProjectService);
  readonly catalogs = inject(CatalogsService);

  readonly project = signal<Project | null>(null);
  readonly dashboard = signal<ProjectDashboard | null>(null);

  // Contadores emitidos por cada pestaña al cargar su data (badges del tablist).
  readonly taskCount = signal<number | null>(null);
  readonly milestoneCount = signal<number | null>(null);
  readonly subtaskCount = signal<number | null>(null);

  /** Fases con fechas, en orden Dev→Hypercare, marcando la fase vigente hoy. */
  readonly phaseRows = computed(() => {
    const phases = this.project()?.phases ?? [];
    const now = Date.now();
    return PROJECT_PHASES
      .map((def) => {
        const row = phases.find((f) => f.phase === def.code);
        if (!row || (!row.planned_start && !row.planned_end)) return null;
        const start = row.planned_start ? Date.parse(row.planned_start) : null;
        const end = row.planned_end ? Date.parse(row.planned_end) : null;
        return {
          ...def,
          start: row.planned_start,
          end: row.planned_end,
          current: (start === null || start <= now) && (end === null || now <= end),
          done: end !== null && end < now,
        };
      })
      .filter((r) => r !== null);
  });

  ngOnInit() {
    this.service.get(this.id()).subscribe((p) => this.project.set(p));
    this.service.dashboard(this.id()).subscribe((d) => this.dashboard.set(d));
  }
}
