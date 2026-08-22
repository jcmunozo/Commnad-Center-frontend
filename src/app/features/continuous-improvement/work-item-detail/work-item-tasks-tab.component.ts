import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';

import { WorkItemTaskService } from '../work-item.services';
import { WorkItemTask } from '../work-item.models';
import { Employee, EmployeeService } from '../../team/employee.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

interface TaskForm {
  name: string;
  assignee: string | null;
  status: string;
  priority: string;
  planned_start: Date | null;
  planned_end: Date | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  progress: number; // 0..100 en UI; el API usa 0..1
  notes: string;
}

/** Tasks tab of a WorkItem's detail page — same table+dialog pattern as
 * a Project's own Tasks tab. No subtask nesting: WorkItemTask is the leaf
 * level by design. */
@Component({
  selector: 'app-work-item-tasks-tab',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    InputTextModule, InputNumberModule, DatePickerModule, StatusBadgeComponent,
  ],
  template: `
    <div class="tab-toolbar">
      <input pInputText placeholder="Search tasks…" [ngModel]="searchTerm()"
        (ngModelChange)="searchTerm.set($event)" />
      @if (canWrite()) {
        <span class="spacer"></span>
        <p-button label="New task" icon="pi pi-plus" size="small" (onClick)="openCreate()" />
      }
    </div>

    <p-table [value]="filteredTasks()" [loading]="loading()" [paginator]="filteredTasks().length > 10"
      [rows]="10" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th>Code</th><th>Name</th><th>Dev</th><th>Status</th><th>Priority</th>
          <th>Hours</th><th>Progress</th>
          @if (canWrite()) { <th style="width:6rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-t>
        <tr>
          <td>{{ t.legacy_code }}</td>
          <td>{{ t.name }}</td>
          <td>{{ t.assignee_name || '—' }}</td>
          <td><app-status-badge [code]="t.status" [label]="catalogs.label('task-statuses', t.status)" /></td>
          <td><app-status-badge [code]="t.priority" [label]="catalogs.label('severity-levels', t.priority)" /></td>
          <td>{{ t.estimated_hours ?? '—' }}</td>
          <td>{{ t.progress_pct * 100 | number:'1.0-0' }}%</td>
          @if (canWrite()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="openEdit(t)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                (click)="remove(t)"><i class="pi pi-trash"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 8 : 7">
          {{ searchTerm() ? 'No tasks match “' + searchTerm() + '”.' : 'No tasks yet.' }}
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editing() ? 'Edit task' : 'New task'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'32rem'}"
      [draggable]="false">
      <div class="form-grid">
        <label class="span-2">Name *
          <input pInputText [(ngModel)]="form.name" autocomplete="off" />
        </label>
        <label>Assigned dev
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="form.assignee" [filter]="true" [showClear]="true"
            placeholder="Unassigned" appendTo="body" />
        </label>
        <label>Status
          <p-select [options]="catalogs.get('task-statuses')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.status" appendTo="body" />
        </label>
        <label>Priority
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.priority" appendTo="body" />
        </label>
        <label>Progress %
          <p-inputNumber [(ngModel)]="form.progress" [min]="0" [max]="100" suffix="%" />
        </label>
        <label>Planned start
          <p-datepicker [(ngModel)]="form.planned_start" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Planned end
          <p-datepicker [(ngModel)]="form.planned_end" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Estimated hours
          <p-inputNumber [(ngModel)]="form.estimated_hours" [min]="0" [maxFractionDigits]="1" />
        </label>
        <label>Actual hours
          <p-inputNumber [(ngModel)]="form.actual_hours" [min]="0" [maxFractionDigits]="1" />
        </label>
        <label class="span-2">Notes
          <textarea pInputText [(ngModel)]="form.notes" rows="2"></textarea>
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!form.name.trim() || saving()" [loading]="saving()"
          (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .tab-toolbar { display:flex; align-items:center; gap:.75rem; margin-bottom:.75rem; }
    .tab-toolbar .spacer { flex:1; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; padding-top:.25rem; }
    .form-grid label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .span-2 { grid-column:span 2; }
    textarea { resize:vertical; font:inherit; }
  `],
})
export class WorkItemTasksTabComponent implements OnInit {
  readonly workItemId = input.required<string>();
  readonly count = output<number>();
  /** Notifica cambios que otras pestañas necesitan reflejar (link tasks en Milestones). */
  readonly changed = output<void>();

  private readonly service = inject(WorkItemTaskService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly tasks = signal<WorkItemTask[]>([]);
  readonly loading = signal(true);
  readonly devs = signal<Employee[]>([]);
  readonly searchTerm = signal('');
  readonly filteredTasks = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    return q ? this.tasks().filter((t) => t.name.toLowerCase().includes(q)) : this.tasks();
  });

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly dialogOpen = signal(false);
  readonly editing = signal<WorkItemTask | null>(null);
  readonly saving = signal(false);
  form: TaskForm = this.emptyForm();

  ngOnInit() { this.load(); }

  private emptyForm(): TaskForm {
    return { name: '', assignee: null, status: 'TODO', priority: 'MEDIUM',
      planned_start: null, planned_end: null, estimated_hours: null, actual_hours: null,
      progress: 0, notes: '' };
  }

  private ensureDevs() {
    if (!this.devs().length) {
      this.employees.list({ page_size: 200, ordering: 'name' })
        .subscribe((p) => this.devs.set(p.results));
    }
  }

  load() {
    this.service.list({ work_item: this.workItemId(), page_size: 200, ordering: '-created_at' })
      .subscribe({
        next: (p) => {
          this.tasks.set(p.results);
          this.loading.set(false);
          this.count.emit(p.count);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.ensureDevs();
    this.dialogOpen.set(true);
  }

  openEdit(t: WorkItemTask) {
    this.editing.set(t);
    this.ensureDevs();
    this.form = { name: t.name, assignee: t.assignee, status: t.status, priority: t.priority,
      planned_start: t.planned_start ? new Date(t.planned_start) : null,
      planned_end: t.planned_end ? new Date(t.planned_end) : null,
      estimated_hours: t.estimated_hours, actual_hours: t.actual_hours ?? null,
      progress: Math.round(t.progress_pct * 100), notes: t.notes ?? '' };
    this.dialogOpen.set(true);
  }

  save() {
    const f = this.form;
    if (!f.name.trim()) return;
    this.saving.set(true);
    const body = {
      work_item: this.workItemId(), name: f.name.trim(), assignee: f.assignee,
      status: f.status, priority: f.priority,
      planned_start: f.planned_start?.toISOString() ?? null,
      planned_end: f.planned_end?.toISOString() ?? null,
      estimated_hours: f.estimated_hours, actual_hours: f.actual_hours,
      progress_pct: f.progress / 100, notes: f.notes,
    };
    const id = this.editing()?.id;
    (id ? this.service.update(id, body) : this.service.create(body)).subscribe({
      next: () => {
        this.notify.success(id ? 'Task updated' : 'Task created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.load();
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(t: WorkItemTask) {
    this.confirm.danger(
      `Delete task ${t.legacy_code ?? ''} "${t.name}"?`,
      () => this.service.remove(t.id).subscribe(() => {
        this.notify.success('Task deleted');
        this.load();
        this.changed.emit();
      }),
      { header: 'Delete task' },
    );
  }
}
