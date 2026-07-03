import { Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

import { ProjectsStore } from '../projects.store';
import { CatalogsService } from '../../../core/services/catalogs.service';
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
      <h2>Portafolio de proyectos</h2>
      <span class="spacer"></span>
      <input pInputText placeholder="Buscar…" [(ngModel)]="searchTerm" (input)="onSearch()" />
      <p-select [options]="statusOptions" [(ngModel)]="statusFilter" (onChange)="onStatus()"
        placeholder="Estado" [showClear]="true" optionLabel="name" optionValue="code" />
      <p-button label="Nuevo" icon="pi pi-plus" routerLink="/projects/new" />
    </div>

    <p-table [value]="store.items()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="store.filters().page_size" [totalRecords]="store.total()"
      [loading]="store.loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th pSortableColumn="legacy_code">Código</th>
          <th pSortableColumn="name">Nombre</th>
          <th>Cliente</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>Salud</th>
          <th pSortableColumn="progress_pct">Avance</th>
          <th></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-p>
        <tr>
          <td>{{ p.legacy_code }}</td>
          <td><a [routerLink]="['/projects', p.id]">{{ p.name }}</a></td>
          <td>{{ p.client_name }}</td>
          <td><app-status-badge [code]="p.status" [label]="catalogs.label('project-statuses', p.status)" /></td>
          <td><app-status-badge [code]="p.priority" [label]="catalogs.label('severity-levels', p.priority)" /></td>
          <td>@if (p.health) { <app-status-badge [code]="p.health" [label]="p.health" /> }</td>
          <td>{{ p.progress_pct * 100 | number:'1.0-0' }}%</td>
          <td><a [routerLink]="['/projects', p.id, 'edit']"><i class="pi pi-pencil"></i></a></td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8">Sin proyectos.</td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`.spacer { flex:1; } .pmo-toolbar input, .pmo-toolbar p-select { min-width:180px; }`],
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectsStore);
  readonly catalogs = inject(CatalogsService);

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
