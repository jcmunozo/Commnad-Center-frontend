import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { of, switchMap } from 'rxjs';

import { SubTaskService, TaskService } from '../project-related.services';
import { SubTask, Task } from '../project-related.models';
import { Employee, EmployeeService } from '../../team/employee.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

interface TaskForm {
  name: string;
  task_type: string;
  status: string;
  priority: string;
  planned_start: Date | null;
  planned_end: Date | null;
  estimated_hours: number | null;
  progress: number;      // 0..100 en UI; el API usa 0..1
  dev: string | null;
  notes: string;
}

@Component({
  selector: 'app-project-tasks-tab',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, TableModule, ButtonModule, DialogModule,
    SelectModule, InputTextModule, InputNumberModule, DatePickerModule, TagModule,
    StatusBadgeComponent,
  ],
  template: `
    @if (canWrite()) {
      <div class="tab-toolbar">
        <p-button label="New task" icon="pi pi-plus" size="small" (onClick)="openCreate()" />
      </div>
    }

    <p-table [value]="tasks()" [loading]="loading()" [paginator]="tasks().length > 10"
      [rows]="10" dataKey="id" sortField="planned_end" [sortOrder]="1"
      [expandedRowKeys]="expanded()" (onRowExpand)="loadSubtasks($event.data)">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:2.5rem"></th>
          <th>Code</th>
          <th pSortableColumn="name">Name</th>
          <th style="width:4rem">Subtasks</th>
          <th>Type</th>
          <th>Dev</th>
          <th>Status</th>
          <th>Priority</th>
          <th pSortableColumn="planned_end">Planned end</th>
          <th pSortableColumn="progress_pct">Progress</th>
          @if (canWrite()) { <th style="width:7rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-t let-expanded="expanded">
        <tr>
          <td>
            <button type="button" pButton class="p-button-text p-button-rounded subtask-toggle"
              [class.subtask-toggle--active]="t.subtask_count"
              [pRowToggler]="t" [title]="(t.subtask_count || 0) + ' linked subtask(s)'">
              <i class="pi" [class.pi-chevron-down]="expanded"
                [class.pi-chevron-right]="!expanded"></i>
            </button>
          </td>
          <td>{{ t.legacy_code }}</td>
          <td>{{ t.name }}</td>
          <td>
            <p-tag [value]="(t.subtask_count || 0).toString()"
              [severity]="t.subtask_count ? 'success' : 'secondary'" styleClass="subtask-tag" />
          </td>
          <td>{{ catalogs.label('task-types', t.task_type) }}</td>
          <td class="dev-cell">
            <span>{{ assigneeNames(t) || '—' }}</span>
            @if (canReassign()) {
              <button type="button" class="icon-btn" title="Reassign dev"
                (click)="openReassign(t)"><i class="pi pi-user-edit"></i></button>
            }
          </td>
          <td><app-status-badge [code]="t.status" [label]="catalogs.label('task-statuses', t.status)" /></td>
          <td><app-status-badge [code]="t.priority" [label]="catalogs.label('severity-levels', t.priority)" /></td>
          <td>{{ t.planned_end | date }}</td>
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
      <ng-template pTemplate="expandedrow" let-t>
        <tr class="expansion">
          <td></td>
          <td></td>
          <td></td>
          <td [attr.colspan]="canWrite() ? 8 : 7" class="expansion-cell">
            @if (subtasksByTask()[t.id]; as subs) {
              @if (subs.length) {
                <ul class="subtask-list">
                  @for (s of subs; track s.id) {
                    <li>
                      <app-status-badge [code]="s.status" [label]="catalogs.label('action-statuses', s.status)" />
                      {{ s.description }}
                      @if (s.assignee_name) { <span class="dim">· {{ s.assignee_name }}</span> }
                      @if (s.due_date) { <span class="dim">· due {{ s.due_date | date }}</span> }
                    </li>
                  }
                </ul>
              } @else {
                <p class="empty">No linked subtasks.</p>
              }
            } @else {
              <p class="empty">Loading…</p>
            }
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 11 : 10">This project has no tasks.</td></tr>
      </ng-template>
    </p-table>

    <!-- Diálogo crear/editar tarea -->
    <p-dialog [header]="editing() ? 'Edit task' : 'New task'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'34rem'}"
      [draggable]="false">
      <div class="form-grid">
        <label class="span-2">Name *
          <input pInputText [(ngModel)]="form.name" autocomplete="off" />
        </label>
        <label>Type
          <p-select [options]="catalogs.get('task-types')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.task_type" appendTo="body" />
        </label>
        <label>Status
          <p-select [options]="catalogs.get('task-statuses')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.status" appendTo="body" />
        </label>
        <label>Priority
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
            [(ngModel)]="form.priority" appendTo="body" />
        </label>
        <label>Assigned dev
          <p-select [options]="devs()" optionLabel="name" optionValue="id" [(ngModel)]="form.dev"
            [filter]="true" [showClear]="true" placeholder="Unassigned" appendTo="body" />
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
        <label>Progress %
          <p-inputNumber [(ngModel)]="form.progress" [min]="0" [max]="100" suffix="%" />
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

    <!-- Diálogo reasignar dev -->
    <p-dialog header="Reassign developer" [visible]="reassignOpen()"
      (visibleChange)="reassignOpen.set($event)" [modal]="true" [style]="{width:'26rem'}"
      [draggable]="false">
      @if (reassigning(); as t) {
        <p class="task-ref">{{ t.legacy_code }} · {{ t.name }}</p>
        <label class="field">New dev *
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="selectedDev" [filter]="true" placeholder="Select" appendTo="body" />
        </label>
        @if ((t.assignees?.length ?? 0) > 1) {
          <small class="hint">This task has {{ t.assignees!.length }} devs; saving will
            assign it only to the selected dev.</small>
        }
      }
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="reassignOpen.set(false)" />
        <p-button label="Save" [disabled]="!selectedDev || saving()" [loading]="saving()"
          (onClick)="saveReassign()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .tab-toolbar { display:flex; justify-content:flex-end; margin-bottom:.75rem; }
    .dev-cell, .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .task-ref { margin:0 0 1rem; font-weight:600; }
    .field, .form-grid label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; padding-top:.25rem; }
    .span-2 { grid-column:span 2; }
    textarea { resize:vertical; font:inherit; }
    .hint { display:block; margin-top:.75rem; color:var(--pmo-warn); font-size:.78rem; }
    .subtask-toggle { color:var(--pmo-muted); }
    .subtask-toggle--active { color:#22c55e; }
    .subtask-tag { box-sizing:border-box !important; display:inline-block !important;
      width:1.6rem !important; height:1.6rem !important; padding:0 !important;
      border-radius:50% !important; line-height:1.6rem !important; text-align:center !important; }
    .expansion-cell { padding:.5rem 1rem; }
    .subtask-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.4rem; }
    .subtask-list li { display:flex; align-items:center; gap:.5rem; font-size:.85rem; }
    .dim { color:var(--pmo-muted); }
    .empty { margin:0; color:var(--pmo-muted); font-size:.85rem; }
  `],
})
export class ProjectTasksTabComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly count = output<number>();
  /** Notifica cambios que afectan otras pestañas (asignaciones → Recursos). */
  readonly changed = output<void>();

  private readonly service = inject(TaskService);
  private readonly subtaskService = inject(SubTaskService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(true);
  readonly devs = signal<Employee[]>([]);
  readonly expanded = signal<Record<string, boolean>>({});
  readonly subtasksByTask = signal<Record<string, SubTask[]>>({});

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));
  readonly canReassign = computed(() => this.auth.hasAnyRole(['PMO Admin', 'Project Manager']));

  readonly dialogOpen = signal(false);
  readonly editing = signal<Task | null>(null);
  readonly saving = signal(false);
  form: TaskForm = this.emptyForm();

  readonly reassignOpen = signal(false);
  readonly reassigning = signal<Task | null>(null);
  selectedDev: string | null = null;

  ngOnInit() {
    this.load();
  }

  private emptyForm(): TaskForm {
    return {
      name: '', task_type: 'DEV', status: 'TODO', priority: 'MEDIUM',
      planned_start: null, planned_end: null, estimated_hours: null, progress: 0,
      dev: null, notes: '',
    };
  }

  load() {
    this.service
      .list({ project: this.projectId(), page_size: 200, ordering: 'planned_end' })
      .subscribe({
        next: (page) => {
          this.tasks.set(page.results);
          this.subtasksByTask.set({});
          this.loading.set(false);
          this.count.emit(page.count);
        },
        error: () => this.loading.set(false),
      });
  }

  loadSubtasks(task: Task) {
    if (this.subtasksByTask()[task.id]) return;
    this.subtaskService.list({ task: task.id, page_size: 200 }).subscribe((page) => {
      this.subtasksByTask.update((m) => ({ ...m, [task.id]: page.results }));
    });
  }

  private ensureLookups() {
    if (!this.devs().length) {
      this.employees.list({ page_size: 200, ordering: 'name' })
        .subscribe((p) => this.devs.set(p.results));
    }
  }

  assigneeNames(t: Task): string {
    return (t.assignees ?? []).map((a) => a.name).join(', ');
  }

  openCreate() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.ensureLookups();
    this.dialogOpen.set(true);
  }

  openEdit(t: Task) {
    this.editing.set(t);
    this.ensureLookups();
    this.form = {
      name: t.name, task_type: t.task_type, status: t.status, priority: t.priority,
      planned_start: null, planned_end: t.planned_end ? new Date(t.planned_end) : null,
      estimated_hours: null, progress: Math.round(t.progress_pct * 100),
      dev: t.assignees?.[0]?.id ?? null, notes: '',
    };
    this.dialogOpen.set(true);
    // El list serializer no trae todos los campos: completar con el detalle.
    this.service.get(t.id).subscribe((detail) => {
      if (this.editing()?.id !== t.id) return;
      const full = detail as unknown as {
        planned_start: string | null; estimated_hours: number | null; notes: string;
      };
      this.form.planned_start = full.planned_start ? new Date(full.planned_start) : null;
      this.form.estimated_hours = full.estimated_hours;
      this.form.notes = full.notes ?? '';
    });
  }

  save() {
    const f = this.form;
    if (!f.name.trim()) return;
    this.saving.set(true);
    const body = {
      name: f.name.trim(), project: this.projectId(), task_type: f.task_type,
      status: f.status, priority: f.priority,
      planned_start: f.planned_start?.toISOString() ?? null,
      planned_end: f.planned_end?.toISOString() ?? null,
      estimated_hours: f.estimated_hours, progress_pct: f.progress / 100,
      notes: f.notes,
    };
    const id = this.editing()?.id;
    (id ? this.service.update(id, body) : this.service.create(body as never)).pipe(
      switchMap((saved: Task | { id?: string }) => {
        const taskId = id ?? (saved as Task).id;
        // El write serializer no devuelve id en create: recuperar por código si falta.
        if (!taskId) return of(null);
        return this.service.saveAssignees(taskId, f.dev ? [f.dev] : []);
      }),
    ).subscribe({
      next: () => {
        this.notify.success(id ? 'Tarea actualizada' : 'Tarea creada');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.load();
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(t: Task) {
    if (!confirm(`Delete task ${t.legacy_code ?? ''} "${t.name}"?`)) return;
    this.service.remove(t.id).subscribe(() => {
      this.notify.success('Tarea eliminada');
      this.load();
      this.changed.emit();
    });
  }

  openReassign(t: Task) {
    this.reassigning.set(t);
    this.selectedDev = t.assignees?.[0]?.id ?? null;
    this.ensureLookups();
    this.reassignOpen.set(true);
  }

  saveReassign() {
    const task = this.reassigning();
    if (!task || !this.selectedDev) return;
    this.saving.set(true);
    this.service.saveAssignees(task.id, [this.selectedDev]).subscribe({
      next: (assignees) => {
        this.tasks.update((list) =>
          list.map((t) => (t.id === task.id ? { ...t, assignees } : t)));
        this.notify.success('Tarea reasignada');
        this.saving.set(false);
        this.reassignOpen.set(false);
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
