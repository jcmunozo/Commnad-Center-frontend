import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { forkJoin, of, switchMap } from 'rxjs';

import { WorkItemMilestoneService, WorkItemTaskService } from './work-item.services';
import { WorkItemMilestone, WorkItemTask } from './work-item.models';
import { Employee, EmployeeService } from '../team/employee.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AuthStore } from '../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

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

interface MilestoneForm {
  name: string;
  owner_employee: string | null;
  target_date: Date | null;
  actual_date: Date | null;
  comments: string;
  taskIds: string[];
}

/** Tasks + Milestones of a single WorkItem — embedded in the work item's own
 * detail page (/continuous-improvement/:id) and in a row-expansion on a
 * Project's "Work Items" tab. No subtask nesting: WorkItemTask is the leaf
 * level by design. */
@Component({
  selector: 'app-work-item-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    MultiSelectModule, InputTextModule, InputNumberModule, DatePickerModule, StatusBadgeComponent,
  ],
  template: `
    <div class="panel-section">
      <div class="panel-head">
        <h4>Tasks</h4>
        @if (canWrite()) {
          <p-button label="Add task" icon="pi pi-plus" size="small" text="true"
            (onClick)="openTask(null)" />
        }
      </div>
      <p-table [value]="tasks()" [loading]="tasksLoading()" dataKey="id">
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
                <button type="button" class="icon-btn" title="Edit" (click)="openTask(t)">
                  <i class="pi pi-pencil"></i></button>
                <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                  (click)="removeTask(t)"><i class="pi pi-trash"></i></button>
              </td>
            }
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td [attr.colspan]="canWrite() ? 8 : 7">No tasks yet.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <div class="panel-section">
      <div class="panel-head">
        <h4>Milestones <span class="hint">(optional — add one only when this work is handed off)</span></h4>
        @if (canWrite()) {
          <p-button label="Add milestone" icon="pi pi-plus" size="small" text="true"
            (onClick)="openMilestone(null)" />
        }
      </div>
      <p-table [value]="milestones()" [loading]="milestonesLoading()" dataKey="id">
        <ng-template pTemplate="header">
          <tr>
            <th>Code</th><th>Name</th><th>Target date</th><th>Actual date</th>
            <th>Owner</th><th>Derived status</th>
            @if (canWrite()) { <th style="width:6rem"></th> }
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-m>
          <tr>
            <td>{{ m.legacy_code }}</td>
            <td>{{ m.name }}</td>
            <td>{{ m.target_date | date }}</td>
            <td>{{ m.actual_date | date }}</td>
            <td>{{ m.owner_name || '—' }}</td>
            <td>
              @if (m.progress?.derived_status; as st) {
                <app-status-badge [code]="st" [label]="catalogs.label('milestone-statuses', st)" />
              }
            </td>
            @if (canWrite()) {
              <td class="row-actions">
                <button type="button" class="icon-btn" title="Edit" (click)="openMilestone(m)">
                  <i class="pi pi-pencil"></i></button>
                <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                  (click)="removeMilestone(m)"><i class="pi pi-trash"></i></button>
              </td>
            }
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td [attr.colspan]="canWrite() ? 7 : 6">No milestones — add one only if this work is handed off to someone.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Diálogo tarea -->
    <p-dialog [header]="editingTask() ? 'Edit task' : 'New task'" [visible]="taskDialogOpen()"
      (visibleChange)="taskDialogOpen.set($event)" [modal]="true" [style]="{width:'32rem'}"
      [draggable]="false" appendTo="body">
      <div class="form-grid">
        <label class="span-2">Name *
          <input pInputText [(ngModel)]="taskForm.name" autocomplete="off" />
        </label>
        <label>Assigned dev
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="taskForm.assignee" [filter]="true" [showClear]="true"
            placeholder="Unassigned" appendTo="body" />
        </label>
        <label>Status
          <p-select [options]="catalogs.get('task-statuses')" optionLabel="name" optionValue="code"
            [(ngModel)]="taskForm.status" appendTo="body" />
        </label>
        <label>Priority
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
            [(ngModel)]="taskForm.priority" appendTo="body" />
        </label>
        <label>Progress %
          <p-inputNumber [(ngModel)]="taskForm.progress" [min]="0" [max]="100" suffix="%" />
        </label>
        <label>Planned start
          <p-datepicker [(ngModel)]="taskForm.planned_start" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Planned end
          <p-datepicker [(ngModel)]="taskForm.planned_end" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Estimated hours
          <p-inputNumber [(ngModel)]="taskForm.estimated_hours" [min]="0" [maxFractionDigits]="1" />
        </label>
        <label>Actual hours
          <p-inputNumber [(ngModel)]="taskForm.actual_hours" [min]="0" [maxFractionDigits]="1" />
        </label>
        <label class="span-2">Notes
          <textarea pInputText [(ngModel)]="taskForm.notes" rows="2"></textarea>
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="taskDialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!taskForm.name.trim() || saving()" [loading]="saving()"
          (onClick)="saveTask()" />
      </ng-template>
    </p-dialog>

    <!-- Diálogo milestone -->
    <p-dialog [header]="editingMilestone() ? 'Edit milestone' : 'New milestone'"
      [visible]="milestoneDialogOpen()" (visibleChange)="milestoneDialogOpen.set($event)"
      [modal]="true" [style]="{width:'30rem'}" [draggable]="false" appendTo="body">
      <div class="form-grid">
        <label class="span-2">Name *
          <input pInputText [(ngModel)]="milestoneForm.name" autocomplete="off" />
        </label>
        <label>Target date
          <p-datepicker [(ngModel)]="milestoneForm.target_date" dateFormat="yy-mm-dd"
            [showIcon]="true" appendTo="body" />
        </label>
        <label>Actual date
          <p-datepicker [(ngModel)]="milestoneForm.actual_date" dateFormat="yy-mm-dd"
            [showIcon]="true" appendTo="body" />
        </label>
        <label class="span-2">Owner
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="milestoneForm.owner_employee" [filter]="true" [showClear]="true"
            placeholder="No owner" appendTo="body" />
        </label>
        <label class="span-2">Link tasks
          <p-multiSelect [options]="tasks()" optionLabel="name" optionValue="id"
            [(ngModel)]="milestoneForm.taskIds" [filter]="true" placeholder="No tasks"
            appendTo="body" display="chip" />
        </label>
        @if (editingMilestone()) {
          <small class="hint span-2">Saving only adds new links;
            unlinking tasks is not supported by the backend.</small>
        }
        <label class="span-2">Comments
          <textarea pInputText [(ngModel)]="milestoneForm.comments" rows="2"></textarea>
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="milestoneDialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!milestoneForm.name.trim() || saving()" [loading]="saving()"
          (onClick)="saveMilestone()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .panel-section { padding:.75rem 1rem 1.25rem; }
    .panel-head { display:flex; align-items:center; gap:.6rem; margin-bottom:.5rem; }
    .panel-head h4 { margin:0; font-size:.85rem; text-transform:uppercase;
      letter-spacing:.04em; color:var(--pmo-muted); }
    .panel-head .hint { text-transform:none; letter-spacing:0; font-weight:400; font-size:.75rem; }
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
    .hint { color:var(--pmo-warn); font-size:.75rem; }
  `],
})
export class WorkItemDetailPanelComponent implements OnInit {
  readonly workItemId = input.required<string>();
  /** Notifies the parent so it can refresh row-level counters (e.g. task_count). */
  readonly changed = output<void>();

  private readonly taskService = inject(WorkItemTaskService);
  private readonly milestoneService = inject(WorkItemMilestoneService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly tasks = signal<WorkItemTask[]>([]);
  readonly tasksLoading = signal(true);
  readonly milestones = signal<WorkItemMilestone[]>([]);
  readonly milestonesLoading = signal(true);
  readonly devs = signal<Employee[]>([]);

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly saving = signal(false);

  readonly taskDialogOpen = signal(false);
  readonly editingTask = signal<WorkItemTask | null>(null);
  taskForm: TaskForm = this.emptyTaskForm();

  readonly milestoneDialogOpen = signal(false);
  readonly editingMilestone = signal<WorkItemMilestone | null>(null);
  milestoneForm: MilestoneForm = this.emptyMilestoneForm();

  ngOnInit() {
    this.loadTasks();
    this.loadMilestones();
  }

  private emptyTaskForm(): TaskForm {
    return { name: '', assignee: null, status: 'TODO', priority: 'MEDIUM',
      planned_start: null, planned_end: null, estimated_hours: null, actual_hours: null,
      progress: 0, notes: '' };
  }

  private emptyMilestoneForm(): MilestoneForm {
    return { name: '', owner_employee: null, target_date: null, actual_date: null,
      comments: '', taskIds: [] };
  }

  private ensureDevs() {
    if (!this.devs().length) {
      this.employees.list({ page_size: 200, ordering: 'name' })
        .subscribe((p) => this.devs.set(p.results));
    }
  }

  loadTasks() {
    this.taskService.list({ work_item: this.workItemId(), page_size: 200, ordering: '-created_at' })
      .subscribe({
        next: (p) => { this.tasks.set(p.results); this.tasksLoading.set(false); },
        error: () => this.tasksLoading.set(false),
      });
  }

  loadMilestones() {
    this.milestoneService
      .list({ work_item: this.workItemId(), page_size: 200, ordering: 'target_date' })
      .subscribe({
        next: (p) => { this.milestones.set(p.results); this.milestonesLoading.set(false); },
        error: () => this.milestonesLoading.set(false),
      });
  }

  openTask(t: WorkItemTask | null) {
    this.editingTask.set(t);
    this.ensureDevs();
    this.taskForm = t
      ? { name: t.name, assignee: t.assignee, status: t.status, priority: t.priority,
          planned_start: t.planned_start ? new Date(t.planned_start) : null,
          planned_end: t.planned_end ? new Date(t.planned_end) : null,
          estimated_hours: t.estimated_hours, actual_hours: t.actual_hours ?? null,
          progress: Math.round(t.progress_pct * 100), notes: t.notes ?? '' }
      : this.emptyTaskForm();
    this.taskDialogOpen.set(true);
  }

  saveTask() {
    const f = this.taskForm;
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
    const id = this.editingTask()?.id;
    (id ? this.taskService.update(id, body) : this.taskService.create(body)).subscribe({
      next: () => {
        this.notify.success(id ? 'Task updated' : 'Task created');
        this.saving.set(false);
        this.taskDialogOpen.set(false);
        this.loadTasks();
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  removeTask(t: WorkItemTask) {
    this.confirm.danger(
      `Delete task ${t.legacy_code ?? ''} "${t.name}"?`,
      () => this.taskService.remove(t.id).subscribe(() => {
        this.notify.success('Task deleted');
        this.loadTasks();
        this.changed.emit();
      }),
      { header: 'Delete task' },
    );
  }

  openMilestone(m: WorkItemMilestone | null) {
    this.editingMilestone.set(m);
    this.ensureDevs();
    if (!this.tasks().length) this.loadTasks();
    this.milestoneForm = m
      ? { name: m.name, owner_employee: m.owner_employee,
          target_date: m.target_date ? new Date(m.target_date) : null,
          actual_date: m.actual_date ? new Date(m.actual_date) : null,
          comments: m.comments, taskIds: [] }
      : this.emptyMilestoneForm();
    this.milestoneDialogOpen.set(true);
  }

  saveMilestone() {
    const f = this.milestoneForm;
    if (!f.name.trim()) return;
    this.saving.set(true);
    const body = {
      work_item: this.workItemId(), name: f.name.trim(),
      target_date: f.target_date?.toISOString() ?? null,
      actual_date: f.actual_date?.toISOString() ?? null,
      owner_employee: f.owner_employee, comments: f.comments,
    };
    const id = this.editingMilestone()?.id;
    (id ? this.milestoneService.update(id, body) : this.milestoneService.create(body)).pipe(
      switchMap((saved) => {
        const milestoneId = id ?? (saved as WorkItemMilestone).id;
        if (!f.taskIds.length || !milestoneId) return of(null);
        return forkJoin(f.taskIds.map((taskId) => this.milestoneService.linkTask(milestoneId, taskId)));
      }),
    ).subscribe({
      next: () => {
        this.notify.success(id ? 'Milestone updated' : 'Milestone created');
        this.saving.set(false);
        this.milestoneDialogOpen.set(false);
        this.loadMilestones();
      },
      error: () => this.saving.set(false),
    });
  }

  removeMilestone(m: WorkItemMilestone) {
    this.confirm.danger(
      `Delete milestone ${m.legacy_code ?? ''} "${m.name}"?`,
      () => this.milestoneService.remove(m.id).subscribe(() => {
        this.notify.success('Milestone deleted');
        this.loadMilestones();
      }),
      { header: 'Delete milestone' },
    );
  }
}
