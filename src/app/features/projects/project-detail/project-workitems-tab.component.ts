import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { WorkItemService } from '../../continuous-improvement/work-item.services';
import { WorkItem, WorkItemWrite } from '../../continuous-improvement/work-item.models';
import { WorkItemDetailPanelComponent } from '../../continuous-improvement/work-item-detail-panel.component';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

/** Continuous Improvement work items traced back to this project (adjustments
 * on the delivered proxy, docs, etc.) — same data as /continuous-improvement,
 * filtered by `?project=`. */
@Component({
  selector: 'app-project-workitems-tab',
  standalone: true,
  imports: [
    FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    InputTextModule, TagModule, StatusBadgeComponent, WorkItemDetailPanelComponent,
  ],
  template: `
    @if (canWrite()) {
      <div class="tab-toolbar">
        <p-button label="New work item" icon="pi pi-plus" size="small" (onClick)="open(null)" />
      </div>
    }

    <p-table [value]="workItems()" [loading]="loading()" dataKey="id" [expandedRowKeys]="expanded()">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:2.5rem"></th>
          <th>Code</th><th>Title</th><th>Status</th><th>Priority</th><th style="width:5rem">Tasks</th>
          @if (canWrite()) { <th style="width:6rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-wi let-expanded="expanded">
        <tr>
          <td>
            <button type="button" pButton class="p-button-text p-button-rounded" [pRowToggler]="wi">
              <i class="pi" [class.pi-chevron-down]="expanded" [class.pi-chevron-right]="!expanded"></i>
            </button>
          </td>
          <td>{{ wi.legacy_code }}</td>
          <td>{{ wi.title }}</td>
          <td><app-status-badge [code]="wi.status" [label]="catalogs.label('project-statuses', wi.status)" /></td>
          <td><app-status-badge [code]="wi.priority" [label]="catalogs.label('severity-levels', wi.priority)" /></td>
          <td>
            <p-tag [value]="(wi.task_count || 0).toString()"
              [severity]="wi.task_count ? 'success' : 'secondary'" styleClass="count-tag" />
          </td>
          @if (canWrite()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="open(wi)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Archive"
                (click)="remove(wi)"><i class="pi pi-trash"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="expandedrow" let-wi>
        <tr class="expansion">
          <td [attr.colspan]="canWrite() ? 7 : 6" class="expansion-cell">
            <app-work-item-detail-panel [workItemId]="wi.id" (changed)="load()" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 7 : 6">No Continuous Improvement work on this project.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editing() ? 'Edit work item' : 'New work item'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'30rem'}"
      [draggable]="false">
      <div class="form-grid">
        <label class="span-2">Title *
          <input pInputText [(ngModel)]="form.title" autocomplete="off" />
        </label>
        <label class="span-2">Description
          <textarea pInputText [(ngModel)]="form.description" rows="3"></textarea>
        </label>
        <label>Status
          <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.status" appendTo="body" />
        </label>
        <label>Priority
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.priority" appendTo="body" />
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!form.title.trim() || saving()" [loading]="saving()"
          (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .tab-toolbar { display:flex; justify-content:flex-end; margin-bottom:.75rem; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .count-tag { box-sizing:border-box !important; display:inline-block !important;
      width:1.6rem !important; height:1.6rem !important; padding:0 !important;
      border-radius:50% !important; line-height:1.6rem !important; text-align:center !important; }
    .expansion-cell { padding:0; background:var(--pmo-surface); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; padding-top:.25rem; }
    .form-grid label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .span-2 { grid-column:span 2; }
    textarea { resize:vertical; font:inherit; }
  `],
})
export class ProjectWorkitemsTabComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly count = output<number>();

  private readonly service = inject(WorkItemService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly workItems = signal<WorkItem[]>([]);
  readonly loading = signal(true);
  readonly expanded = signal<Record<string, boolean>>({});

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly dialogOpen = signal(false);
  readonly editing = signal<WorkItem | null>(null);
  readonly saving = signal(false);
  form = this.emptyForm();

  ngOnInit() { this.load(); }

  private emptyForm() {
    return { title: '', description: '', status: 'PLANNING', priority: 'MEDIUM' };
  }

  load() {
    this.service.list({ project: this.projectId(), page_size: 200, ordering: '-created_at' })
      .subscribe({
        next: (p) => {
          this.workItems.set(p.results);
          this.loading.set(false);
          this.count.emit(p.count);
        },
        error: () => this.loading.set(false),
      });
  }

  open(wi: WorkItem | null) {
    this.editing.set(wi);
    this.form = wi
      ? { title: wi.title, description: wi.description ?? '', status: wi.status, priority: wi.priority }
      : this.emptyForm();
    this.dialogOpen.set(true);
  }

  save() {
    const f = this.form;
    if (!f.title.trim()) return;
    this.saving.set(true);
    const body: WorkItemWrite = {
      title: f.title.trim(), description: f.description, status: f.status, priority: f.priority,
      project: this.projectId(),
    };
    const id = this.editing()?.id;
    (id ? this.service.update(id, body) : this.service.create(body)).subscribe({
      next: () => {
        this.notify.success(id ? 'Work item updated' : 'Work item created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(wi: WorkItem) {
    this.confirm.danger(
      `Archive work item "${wi.title}"?`,
      () => this.service.remove(wi.id).subscribe(() => {
        this.notify.success('Work item archived');
        this.load();
      }),
      { header: 'Archive work item', acceptLabel: 'Archive' },
    );
  }
}
