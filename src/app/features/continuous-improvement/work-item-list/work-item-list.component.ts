import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { WorkItemService } from '../work-item.services';
import { WorkItem, WorkItemWrite } from '../work-item.models';
import { ProjectService } from '../../projects/project.service';
import { Project } from '../../projects/project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-work-item-list',
  standalone: true,
  imports: [
    DatePipe, RouterLink, FormsModule, TableModule, InputTextModule, ButtonModule, SelectModule,
    DialogModule, TagModule, StatusBadgeComponent,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Continuous Improvement</h2>
      <span class="spacer"></span>
      <input pInputText placeholder="Search…" [(ngModel)]="searchTerm" (input)="onSearch()" />
      <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
        [(ngModel)]="statusFilter" (onChange)="reload()" placeholder="Status" [showClear]="true" />
      <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
        [(ngModel)]="priorityFilter" (onChange)="reload()" placeholder="Priority" [showClear]="true" />
      @if (canWrite()) {
        <p-button label="New work item" icon="pi pi-plus" (onClick)="openCreate()" />
      }
    </div>

    <p-table [value]="rows()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="pageSize" [totalRecords]="total()" [loading]="loading()"
      [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th>Code</th>
          <th pSortableColumn="title">Title</th>
          <th>Project</th>
          <th>Status</th>
          <th>Priority</th>
          <th style="width:5rem">Tasks</th>
          <th pSortableColumn="created_at">Created</th>
          @if (canWrite()) { <th style="width:6rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-wi>
        <tr>
          <td>{{ wi.legacy_code }}</td>
          <td><a [routerLink]="['/continuous-improvement', wi.id]">{{ wi.title }}</a></td>
          <td>{{ wi.project_name || '—' }}</td>
          <td><app-status-badge [code]="wi.status" [label]="catalogs.label('project-statuses', wi.status)" /></td>
          <td><app-status-badge [code]="wi.priority" [label]="catalogs.label('severity-levels', wi.priority)" /></td>
          <td>
            <p-tag [value]="(wi.task_count || 0).toString()"
              [severity]="wi.task_count ? 'success' : 'secondary'" styleClass="count-tag" />
          </td>
          <td>{{ wi.created_at | date:'dd/MM/yyyy' }}</td>
          @if (canWrite()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="openEdit(wi)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Archive"
                (click)="archive(wi)"><i class="pi pi-trash"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 8 : 7">No Continuous Improvement work items yet.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editingId() ? 'Edit work item' : 'New work item'"
      [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)" [modal]="true"
      [style]="{width:'32rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Title *
          <input pInputText [(ngModel)]="formTitle" autocomplete="off" />
        </label>
        <label>Description
          <textarea pInputText [(ngModel)]="formDescription" rows="3"></textarea>
        </label>
        <div class="field-row">
          <label>Status
            <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
              [(ngModel)]="formStatus" appendTo="body" />
          </label>
          <label>Priority
            <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
              [(ngModel)]="formPriority" appendTo="body" />
          </label>
        </div>
        <label>Project <span class="dim">(only if this traces back to a delivered proxy)</span>
          <p-select [options]="projects()" optionLabel="name" optionValue="id"
            [(ngModel)]="formProject" [showClear]="true" placeholder="No project — internal work"
            [filter]="true" appendTo="body" />
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formValid() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .pmo-toolbar input, .pmo-toolbar p-select { min-width:150px; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .count-tag { box-sizing:border-box !important; display:inline-block !important;
      width:1.6rem !important; height:1.6rem !important; padding:0 !important;
      border-radius:50% !important; line-height:1.6rem !important; text-align:center !important; }
    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .dim { font-weight:400; font-size:.75rem; }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    textarea { resize:vertical; font:inherit; }
  `],
})
export class WorkItemListComponent implements OnInit {
  private readonly service = inject(WorkItemService);
  private readonly projectsSvc = inject(ProjectService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly rows = signal<WorkItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly projects = signal<Project[]>([]);

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  searchTerm = '';
  statusFilter: string | null = null;
  priorityFilter: string | null = null;
  pageSize = 25;
  private page = 1;
  private ordering = '-created_at';
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  formTitle = '';
  formDescription = '';
  formStatus = 'PLANNING';
  formPriority = 'MEDIUM';
  formProject: string | null = null;

  ngOnInit() {
    this.reload();
    this.projectsSvc.list({ page_size: 200, ordering: 'name' })
      .subscribe((page) => this.projects.set(page.results));
  }

  reload() {
    this.loading.set(true);
    this.service.list({
      page: this.page, page_size: this.pageSize, ordering: this.ordering,
      search: this.searchTerm || undefined,
      status: this.statusFilter ?? undefined,
      priority: this.priorityFilter ?? undefined,
    }).subscribe({
      next: (page) => {
        this.rows.set(page.results);
        this.total.set(page.count);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onLazyLoad(e: TableLazyLoadEvent) {
    this.pageSize = e.rows ?? 25;
    this.page = Math.floor((e.first ?? 0) / this.pageSize) + 1;
    this.ordering = e.sortField ? `${e.sortOrder === -1 ? '-' : ''}${e.sortField}` : '-created_at';
    this.reload();
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.reload(); }, 300);
  }

  formValid() {
    return this.formTitle.trim().length > 0;
  }

  openCreate() {
    this.editingId.set(null);
    this.formTitle = '';
    this.formDescription = '';
    this.formStatus = 'PLANNING';
    this.formPriority = 'MEDIUM';
    this.formProject = null;
    this.dialogOpen.set(true);
  }

  openEdit(wi: WorkItem) {
    this.editingId.set(wi.id);
    this.formTitle = wi.title;
    this.formDescription = wi.description ?? '';
    this.formStatus = wi.status;
    this.formPriority = wi.priority;
    this.formProject = wi.project;
    this.dialogOpen.set(true);
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const body: WorkItemWrite = {
      title: this.formTitle.trim(),
      description: this.formDescription,
      status: this.formStatus,
      priority: this.formPriority,
      project: this.formProject,
    };
    const id = this.editingId();
    const upsert$ = id ? this.service.update(id, body) : this.service.create(body);
    upsert$.subscribe({
      next: () => {
        this.notify.success(id ? 'Work item updated' : 'Work item created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  archive(wi: WorkItem) {
    this.confirm.danger(
      `Archive work item "${wi.title}"?`,
      () => this.service.remove(wi.id).subscribe(() => {
        this.notify.success('Work item archived');
        this.reload();
      }),
      { header: 'Archive work item', acceptLabel: 'Archive' },
    );
  }
}
