import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { forkJoin, of, switchMap } from 'rxjs';

import { MilestoneService, TaskService } from '../project-related.services';
import { Milestone, Task } from '../project-related.models';
import { Employee, EmployeeService } from '../../team/employee.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-project-milestones-tab',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    MultiSelectModule, InputTextModule, DatePickerModule, StatusBadgeComponent,
  ],
  template: `
    @if (canWrite()) {
      <div class="tab-toolbar">
        <p-button label="New milestone" icon="pi pi-plus" size="small" (onClick)="open(null)" />
      </div>
    }

    <p-table [value]="milestones()" [loading]="loading()" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th>Code</th><th>Name</th><th>Target date</th><th>Actual date</th>
          <th>Owner</th><th>Derived status</th><th>Progress</th>
          @if (canWrite()) { <th style="width:7rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-m>
        <tr>
          <td>{{ m.legacy_code }}</td>
          <td>{{ m.name }}</td>
          <td>{{ m.target_date | date }}</td>
          <td>{{ m.actual_date | date }}</td>
          <td>{{ ownerName(m.owner_employee) }}</td>
          <td>
            @if (m.progress?.derived_status; as st) {
              <app-status-badge [code]="st" [label]="catalogs.label('milestone-statuses', st)" />
            }
          </td>
          <td>{{ (m.progress?.avg_progress ?? 0) * 100 | number:'1.0-0' }}%</td>
          @if (canWrite()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="open(m)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                (click)="remove(m)"><i class="pi pi-trash"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canWrite() ? 8 : 7">This project has no milestones.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editing() ? 'Edit milestone' : 'New milestone'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'30rem'}"
      [draggable]="false">
      <div class="form-grid">
        <label class="span-2">Name *
          <input pInputText [(ngModel)]="form.name" autocomplete="off" />
        </label>
        <label>Target date
          <p-datepicker [(ngModel)]="form.target_date" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label>Actual date
          <p-datepicker [(ngModel)]="form.actual_date" dateFormat="yy-mm-dd" [showIcon]="true"
            appendTo="body" />
        </label>
        <label class="span-2">Owner
          <p-select [options]="devs()" optionLabel="name" optionValue="id"
            [(ngModel)]="form.owner_employee" [filter]="true" [showClear]="true"
            placeholder="No owner" appendTo="body" />
        </label>
        <label class="span-2">Link tasks
          <p-multiSelect [options]="tasks()" optionLabel="name" optionValue="id"
            [(ngModel)]="form.taskIds" [filter]="true" placeholder="No tasks"
            appendTo="body" display="chip" />
        </label>
        @if (editing()) {
          <small class="hint span-2">Saving only adds new links;
            unlinking tasks is not supported by the backend.</small>
        }
        <label class="span-2">Comments
          <textarea pInputText [(ngModel)]="form.comments" rows="2"></textarea>
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
    .tab-toolbar { display:flex; justify-content:flex-end; margin-bottom:.75rem; }
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
export class ProjectMilestonesTabComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly count = output<number>();

  private readonly service = inject(MilestoneService);
  private readonly taskService = inject(TaskService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly milestones = signal<Milestone[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly devs = signal<Employee[]>([]);
  readonly loading = signal(true);

  readonly canWrite = computed(() => this.auth.hasAnyRole(['PMO Admin', 'Project Manager']));

  readonly dialogOpen = signal(false);
  readonly editing = signal<Milestone | null>(null);
  readonly saving = signal(false);
  form = this.emptyForm();

  ngOnInit() { this.load(); }

  private emptyForm() {
    return { name: '', target_date: null as Date | null, actual_date: null as Date | null,
      owner_employee: null as string | null, comments: '', taskIds: [] as string[] };
  }

  load() {
    this.service.list({ project: this.projectId(), page_size: 200, ordering: 'target_date' })
      .subscribe({
        next: (p) => {
          this.milestones.set(p.results);
          this.loading.set(false);
          this.count.emit(p.count);
        },
        error: () => this.loading.set(false),
      });
  }

  private ensureLookups() {
    if (!this.devs().length) {
      this.employees.list({ page_size: 200, ordering: 'name' })
        .subscribe((p) => this.devs.set(p.results));
    }
    if (!this.tasks().length) {
      this.taskService.list({ project: this.projectId(), page_size: 200 })
        .subscribe((p) => this.tasks.set(p.results));
    }
  }

  ownerName(id: string | null) { return this.devs().find((d) => d.id === id)?.name ?? ''; }

  open(m: Milestone | null) {
    this.editing.set(m);
    this.ensureLookups();
    this.form = m
      ? { name: m.name, target_date: m.target_date ? new Date(m.target_date) : null,
          actual_date: m.actual_date ? new Date(m.actual_date) : null,
          owner_employee: m.owner_employee, comments: m.comments, taskIds: [] }
      : this.emptyForm();
    this.dialogOpen.set(true);
  }

  save() {
    const f = this.form;
    if (!f.name.trim()) return;
    this.saving.set(true);
    const body = {
      name: f.name.trim(), project: this.projectId(),
      target_date: f.target_date?.toISOString() ?? null,
      actual_date: f.actual_date?.toISOString() ?? null,
      owner_employee: f.owner_employee, comments: f.comments,
    };
    const id = this.editing()?.id;
    (id ? this.service.update(id, body as never) : this.service.create(body as never)).pipe(
      switchMap((saved) => {
        const milestoneId = id ?? (saved as Milestone).id;
        if (!f.taskIds.length || !milestoneId) return of(null);
        return forkJoin(f.taskIds.map((taskId) => this.service.linkTask(milestoneId, taskId)));
      }),
    ).subscribe({
      next: () => {
        this.notify.success(id ? 'Milestone updated' : 'Milestone created');
        this.saving.set(false); this.dialogOpen.set(false); this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(m: Milestone) {
    if (!confirm(`Delete milestone ${m.legacy_code ?? ''} "${m.name}"?`)) return;
    this.service.remove(m.id).subscribe(() => {
      this.notify.success('Milestone deleted'); this.load();
    });
  }
}
