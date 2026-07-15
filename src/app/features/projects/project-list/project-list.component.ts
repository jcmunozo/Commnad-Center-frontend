import { Component, computed, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

import { ProjectsStore } from '../projects.store';
import { ProjectService } from '../project.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-project-list',
  standalone: true,
  providers: [ProjectsStore],
  imports: [
    DecimalPipe, RouterLink, FormsModule, TableModule, InputTextModule, ButtonModule,
    SelectModule, StatusBadgeComponent,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Project portfolio</h2>
      <span class="spacer"></span>
      <input pInputText placeholder="Search…" [(ngModel)]="searchTerm" (input)="onSearch()" />
      <p-select [options]="statusOptions" [(ngModel)]="statusFilter" (onChange)="onStatus()"
        placeholder="Status" [showClear]="true" optionLabel="name" optionValue="code" />
      <p-button label="New" icon="pi pi-plus" routerLink="/projects/new" />
    </div>

    <p-table [value]="store.items()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="store.filters().page_size" [totalRecords]="store.total()"
      [loading]="store.loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th pSortableColumn="legacy_code">Code</th>
          <th pSortableColumn="name">Name</th>
          <th>Trigger</th>
          <th>Target</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Health</th>
          <th pSortableColumn="progress_pct">Progress</th>
          <th></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-p>
        <tr>
          <td>{{ p.legacy_code }}</td>
          <td><a [routerLink]="['/projects', p.id]">{{ p.name }}</a></td>
          <td>{{ p.trigger_name || '—' }}</td>
          <td>{{ p.target_name || '—' }}</td>
          <td><app-status-badge [code]="p.status" [label]="catalogs.label('project-statuses', p.status)" /></td>
          <td><app-status-badge [code]="p.priority" [label]="catalogs.label('severity-levels', p.priority)" /></td>
          <td>@if (p.health) { <app-status-badge [code]="p.health" [label]="p.health" /> }</td>
          <td>{{ p.progress_pct * 100 | number:'1.0-0' }}%</td>
          <td class="row-actions">
            <a [routerLink]="['/projects', p.id, 'edit']" title="Edit"><i class="pi pi-pencil"></i></a>
            @if (canArchive()) {
              <button type="button" class="icon-btn icon-btn--danger" title="Archive"
                (click)="archive(p)"><i class="pi pi-trash"></i></button>
            }
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="9">No projects.</td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .spacer { flex:1; }
    .pmo-toolbar input, .pmo-toolbar p-select { min-width:180px; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
  `],
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectsStore);
  readonly catalogs = inject(CatalogsService);
  private readonly service = inject(ProjectService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);

  readonly canArchive = computed(() => this.auth.hasAnyRole(['PMO Admin', 'Project Manager']));

  archive(p: { id: string; legacy_code: string | null; name: string }) {
    if (!confirm(`Archive project ${p.legacy_code ?? ''} "${p.name}"? It will no longer appear in the app.`)) return;
    this.service.remove(p.id).subscribe(() => {
      this.notify.success('Project archived');
      this.store.load();
    });
  }

  searchTerm = '';
  statusFilter: string | null = null;
  get statusOptions() { return this.catalogs.get('project-statuses'); }

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() { this.store.load(); }

  /** Server-side pagination + sorting from PrimeNG's table. */
  onLazyLoad(e: TableLazyLoadEvent) {
    const page = Math.floor((e.first ?? 0) / (e.rows ?? 25)) + 1;
    const ordering = e.sortField
      ? `${e.sortOrder === -1 ? '-' : ''}${e.sortField}`
      : 'name';
    this.store.patchFilters({ page, page_size: e.rows ?? 25, ordering });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.patchFilters({ search: this.searchTerm, page: 1 }), 300);
  }

  onStatus() { this.store.patchFilters({ status: this.statusFilter, page: 1 }); }
}
