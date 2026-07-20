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
      <button type="button" class="fav-filter" [class.fav-filter--on]="store.filters().favorite"
        (click)="toggleFavoriteFilter()"
        [title]="store.filters().favorite ? 'Showing favorites only' : 'Show favorites only'">
        <i class="pi" [class.pi-star-fill]="store.filters().favorite"
          [class.pi-star]="!store.filters().favorite"></i> Favorites
      </button>
      <p-button label="New" icon="pi pi-plus" routerLink="/projects/new" />
    </div>

    <p-table [value]="store.items()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="store.filters().page_size" [totalRecords]="store.total()"
      [loading]="store.loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:2.5rem"></th>
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
          <td>
            <button type="button" class="star-btn" [class.star-btn--on]="p.is_favorite"
              [title]="p.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
              (click)="toggleFavorite(p)">
              <i class="pi" [class.pi-star-fill]="p.is_favorite"
                [class.pi-star]="!p.is_favorite"></i>
            </button>
          </td>
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
        <tr><td colspan="10">
          {{ store.filters().favorite ? 'No favorite projects yet — star one with the ★ column.' : 'No projects.' }}
        </td></tr>
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
    .star-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .3rem; font-size:.95rem; }
    .star-btn:hover { color:#fab219; }
    .star-btn--on { color:#fab219; }
    .fav-filter { display:inline-flex; align-items:center; gap:.4rem; background:none;
      cursor:pointer; border:1px solid var(--pmo-border); border-radius:var(--radius);
      padding:.45rem .8rem; font-family:inherit; font-size:.85rem; color:var(--pmo-muted); }
    .fav-filter:hover { border-color:#fab219; color:#fab219; }
    .fav-filter--on { border-color:rgba(250,178,25,.6); color:#fab219;
      background:rgba(250,178,25,.08); }
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

  toggleFavoriteFilter() {
    this.store.patchFilters({ favorite: !this.store.filters().favorite, page: 1 });
  }

  toggleFavorite(p: { id: string; is_favorite?: boolean }) {
    this.service.favorite(p.id).subscribe(({ is_favorite }) => {
      // update in place; the pinned-first order applies on the next load
      this.store.items.update((rows) =>
        rows.map((r) => (r.id === p.id ? { ...r, is_favorite } : r)));
    });
  }
}
