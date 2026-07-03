import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';

import { ProjectService } from '../project.service';
import { Project, ProjectDashboard } from '../project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, TabsModule, ButtonModule, KpiCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    @if (project(); as p) {
      <div class="pmo-toolbar">
        <h2>{{ p.legacy_code }} · {{ p.name }}</h2>
        <app-status-badge [code]="p.status" [label]="catalogs.label('project-statuses', p.status)" />
        <span class="spacer"></span>
        <p-button label="Editar" icon="pi pi-pencil" [routerLink]="['/projects', p.id, 'edit']" />
      </div>

      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0">Información</p-tab>
          <p-tab value="1">Tareas</p-tab>
          <p-tab value="2">Recursos</p-tab>
          <p-tab value="3">Riesgos</p-tab>
          <p-tab value="4">Documentos</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            @if (dashboard(); as d) {
              <div class="pmo-grid pmo-grid--kpi">
                <app-kpi-card label="Tareas abiertas" [value]="d.open_tasks" />
                <app-kpi-card label="Tareas vencidas" [value]="d.overdue_tasks" accent="var(--pmo-danger)" />
                <app-kpi-card label="Issues abiertos" [value]="d.open_issues" />
                <app-kpi-card label="Riesgos abiertos" [value]="d.open_risks" accent="var(--pmo-warn)" />
                <app-kpi-card label="APIs" [value]="d.total_apis" />
                <app-kpi-card label="Endpoints" [value]="d.endpoints_done + '/' + d.endpoints_total" />
              </div>
            }
            <dl class="meta">
              <div><dt>Cliente</dt><dd>{{ p.client_name }}</dd></div>
              <div><dt>Avance</dt><dd>{{ p.progress_pct * 100 | number:'1.0-0' }}%</dd></div>
              <div><dt>Inicio</dt><dd>{{ p.start_date | date }}</dd></div>
              <div><dt>Fin planeado</dt><dd>{{ p.planned_end | date }}</dd></div>
            </dl>
          </p-tabpanel>
          <p-tabpanel value="1">
            <!-- TODO(expand): tabla de tareas filtrada por project -->
            <p>Listado de tareas del proyecto (pendiente de expandir: feature tasks).</p>
          </p-tabpanel>
          <p-tabpanel value="2">
            <p>Asignaciones y carga del equipo (pendiente: feature resources).</p>
          </p-tabpanel>
          <p-tabpanel value="3">
            <p>Riesgos e incidencias (pendiente: feature tracking).</p>
          </p-tabpanel>
          <p-tabpanel value="4">
            <p>Documentos y bitácora (pendiente).</p>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }
  `,
  styles: [`
    .spacer { flex:1; }
    .meta { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1rem; margin-top:1.5rem; }
    dt { font-size:.75rem; color:#64748b; text-transform:uppercase; }
    dd { margin:0; font-weight:600; }
  `],
})
export class ProjectDetailComponent implements OnInit {
  // Route param bound via withComponentInputBinding().
  readonly id = input.required<string>();

  private readonly service = inject(ProjectService);
  readonly catalogs = inject(CatalogsService);

  readonly project = signal<Project | null>(null);
  readonly dashboard = signal<ProjectDashboard | null>(null);

  ngOnInit() {
    this.service.get(this.id()).subscribe((p) => this.project.set(p));
    this.service.dashboard(this.id()).subscribe((d) => this.dashboard.set(d));
  }
}
