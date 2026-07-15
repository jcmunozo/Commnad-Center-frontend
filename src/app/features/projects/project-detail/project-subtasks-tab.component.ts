import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';

import { SubTaskService, TaskService } from '../project-related.services';
import { SubTask, Task } from '../project-related.models';
import { Employee, EmployeeService } from '../../team/employee.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-project-subtasks-tab',
  standalone: true,
  imports: [
    DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    InputTextModule, DatePickerModule, StatusBadgeComponent,
  ],
  template: `
    @if (canWrite()) {
      <div class="tab-toolbar">
        <p-button label="New subtask" icon="pi pi-plus" size="small"
          [disabled]="!tasks().length" (onClick)="open(null)" />
      </div>
    }

    <p-table [value]="subtasks()" [loading]="loading()" dataKey="id"
      [paginator]="subtasks().length > 10" [rows]="10" sortField="due_date" [sortOrder]="1">
      <ng-template pTemplate="header">
        <tr>
          <th>Code</th>
          <th>Tarea</th>
          <th>Subtask</th>
          <th>Dev</th>
          <th pSortableColumn="due_date">Vence</th>
          <th>Priority</th>
          <th>Status</th>
          @if (canWrite()) { <th style="width:7rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-s>
        <tr>
          <td>{{ s.legacy_code }}</td>
          <td class="task-ref">{{ s.task_code ? s.task_code + ' · ' : '' }}{{ s.task_name }}</td>
          <td class="wrap">{{ s.description }}</td>
          <td>{{ s.assignee_name }}</td>
          <td [class.overdue]="isOverdue(s)">{{ s.due_date | date }}</td>
          <td>
            @if (s.priority) {
              <app-status-badge [code]="s.priority" [label]="catalogs.label('severity-levels', s.priority)" />
            }
          </td>
          <td><app-status-badge [code]="s.status" [label]="catalogs.label('action-statuses', s.status)" /></td>
          @if (canWrite()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="open(s)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                (click)="remove(s)"><i class="pi pi-trash"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 8 : 7">
          No subtasks. Create one to track debt or reminders for a task.
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editing() ? 'Edit subtask' : 'New subtask'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'32rem'}"
      [draggable]="false">
      <div class="form-grid">
        <label class="span-2">Tarea *
          <p-select [options]="tasks()" optionValue="id" [(ngModel)]="form.task"
            [filter]="true" placeholder="Select a task" appendTo="body"
            optionLabel="name">
            <ng-template pTemplate="selectedItem" let-t>
              {{ t ? (t.legacy_code ? t.legacy_code + ' · ' : '') + t.name : '' }}
            </ng-template>
            <ng-template pTemplate="item" let-t>
              {{ (t.legacy_code ? t.legacy_code + ' · ' : '') + t.name }}
            </ng-template>
          </p-select>
        </label>
        <label class="span-2">Description *
          <textarea pInputText [(ngModel)]="form.description" rows="2"
            placeholder="e.g. logging is broken; fix before SIT"></textarea>
        </label>
        <label>Assigned dev
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="form.assignee" [filter]="true" [showClear]="true"
            placeholder="Unassigned" appendTo="body" />
        </label>
        <label>Vence
          <p-datepicker [(ngModel)]="form.due_date" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Priority
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name"
            optionValue="code" [(ngModel)]="form.priority" [showClear]="true"
            placeholder="No priority" appendTo="body" />
        </label>
        <label>Status
          <p-select [options]="catalogs.get('action-statuses')" optionLabel="name"
            optionValue="code" [(ngModel)]="form.status" appendTo="body" />
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [loading]="saving()"
          [disabled]="!form.task || !form.description.trim() || saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .tab-toolbar { display:flex; justify-content:flex-end; margin-bottom:.75rem; }
    .wrap { white-space:normal; max-width:26rem; }
    .task-ref { white-space:nowrap; font-size:.85rem; color:var(--pmo-muted); }
    .overdue { color:var(--pmo-danger); font-weight:600; }
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
export class ProjectSubtasksTabComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly count = output<number>();

  private readonly service = inject(SubTaskService);
  private readonly taskService = inject(TaskService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly subtasks = signal<SubTask[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly devs = signal<Employee[]>([]);
  readonly loading = signal(true);

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly dialogOpen = signal(false);
  readonly editing = signal<SubTask | null>(null);
  readonly saving = signal(false);
  form = this.emptyForm();

  ngOnInit() {
    this.load();
    this.loadTasks();
  }

  private emptyForm() {
    return { task: null as string | null, description: '', assignee: null as string | null,
      due_date: null as Date | null, priority: null as string | null, status: 'PENDING' };
  }

  /** Público: el padre lo invoca cuando cambian las tareas (borrar tarea arrastra pendientes). */
  load() {
    this.loading.set(true);
    this.service.list({ project: this.projectId(), page_size: 200, ordering: 'due_date' })
      .subscribe({
        next: (page) => {
          this.subtasks.set(page.results);
          this.loading.set(false);
          this.count.emit(page.count);
        },
        error: () => this.loading.set(false),
      });
  }

  loadTasks() {
    this.taskService.list({ project: this.projectId(), page_size: 200 })
      .subscribe((p) => this.tasks.set(p.results));
  }

  private ensureDevs() {
    if (!this.devs().length) {
      this.employees.list({ page_size: 200, ordering: 'name' })
        .subscribe((p) => this.devs.set(p.results));
    }
  }

  isOverdue(s: SubTask) {
    return !!s.due_date && Date.parse(s.due_date) < Date.now()
      && !['COMPLETED', 'CANCELLED'].includes(s.status);
  }

  open(s: SubTask | null) {
    this.editing.set(s);
    this.ensureDevs();
    this.form = s
      ? { task: s.task, description: s.description, assignee: s.assignee,
          due_date: s.due_date ? new Date(s.due_date) : null, priority: s.priority,
          status: s.status }
      : this.emptyForm();
    this.dialogOpen.set(true);
  }

  save() {
    const f = this.form;
    if (!f.task || !f.description.trim()) return;
    this.saving.set(true);
    const body = {
      task: f.task, description: f.description.trim(), assignee: f.assignee,
      due_date: f.due_date?.toISOString() ?? null, priority: f.priority, status: f.status,
    };
    const id = this.editing()?.id;
    (id ? this.service.update(id, body as never) : this.service.create(body as never)).subscribe({
      next: () => {
        this.notify.success(id ? 'Subtask updated' : 'Subtask created');
        this.saving.set(false); this.dialogOpen.set(false); this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(s: SubTask) {
    if (!confirm(`Delete subtask ${s.legacy_code ?? ''}?`)) return;
    this.service.remove(s.id).subscribe(() => {
      this.notify.success('Subtask deleted'); this.load();
    });
  }
}
