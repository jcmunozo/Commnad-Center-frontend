import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { forkJoin, of, switchMap } from 'rxjs';

import { TeamService, WorkloadRow } from './team.service';
import { EmployeeService } from './employee.service';
import { ShiftClockComponent } from './shift-clock.component';
import { TaskService } from '../projects/project-related.services';
import { TicketService } from '../tickets/ticket.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStore } from '../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

const AVAILABILITY: Record<WorkloadRow['alert'], { label: string; code: string }> = {
  OK: { label: 'Available', code: 'DONE' },
  HIGH_LOAD: { label: 'At capacity', code: 'MEDIUM' },
  OVERLOADED: { label: 'Overloaded', code: 'CRITICAL' },
};

const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, TableModule, ProgressBarModule, ButtonModule, DialogModule,
    InputTextModule, SelectModule, StatusBadgeComponent, ShiftClockComponent,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Team</h2>
      <span class="spacer"></span>
      @if (canManage()) {
        <p-button label="New developer" icon="pi pi-user-plus" (onClick)="openCreate()" />
      }
    </div>

    <p-table [value]="rows()" [loading]="loading()" dataKey="employee_id"
      [expandedRowKeys]="expanded()" (onRowExpand)="loadTasks($event.data)">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:3rem"></th>
          <th pSortableColumn="name">Name</th>
          <th>Shift today</th>
          <th pSortableColumn="open_tasks">Open tasks</th>
          <th pSortableColumn="open_tickets">Open tickets</th>
          <th pSortableColumn="workload_pct">Load</th>
          <th>Availability</th>
          @if (canManage()) { <th style="width:6rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-r let-expanded="expanded">
        <tr>
          <td><button type="button" pButton class="p-button-text p-button-rounded"
            [pRowToggler]="r"><i class="pi" [class.pi-chevron-down]="expanded"
            [class.pi-chevron-right]="!expanded"></i></button></td>
          <td>{{ r.name }}</td>
          <td>{{ r.shift_today || '—' }}</td>
          <td>{{ r.open_tasks }}</td>
          <td>{{ r.open_tickets }}</td>
          <td class="load-cell">
            <p-progressBar [value]="loadPct(r)" [showValue]="false" [style]="{height:'8px'}" />
            <span class="load-label">{{ r.assigned_hours | number:'1.0-1' }}h /
              {{ r.capacity_hours | number:'1.0-1' }}h ({{ r.workload_pct * 100 | number:'1.0-0' }}%)
              @if (r.ticket_hours) { · {{ r.ticket_hours | number:'1.0-1' }}h tickets }</span>
          </td>
          <td><app-status-badge [code]="availability(r).code" [label]="availability(r).label" /></td>
          @if (canManage()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="openEdit(r)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Deactivate"
                (click)="deactivate(r)"><i class="pi pi-user-minus"></i></button>
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="expandedrow" let-r>
        <tr class="expansion">
          <td></td>
          <td></td>
          <td></td>
          <td class="expansion-cell">
            @if (workByDev()[r.employee_id]; as work) {
              @if (work.tasks.length) {
                <ul class="work-list">
                  @for (t of work.tasks; track t.id) { <li>{{ t.name }}</li> }
                </ul>
              } @else {
                <p class="empty">No open tasks.</p>
              }
            } @else {
              <p class="empty">Loading…</p>
            }
          </td>
          <td class="expansion-cell">
            @if (workByDev()[r.employee_id]; as work) {
              @if (work.tickets.length) {
                <ul class="work-list">
                  @for (t of work.tickets; track t.id) {
                    <li>{{ t.ticket_number }} · {{ t.name }}</li>
                  }
                </ul>
              } @else {
                <p class="empty">No open tickets.</p>
              }
            }
          </td>
          <td [attr.colspan]="canManage() ? 3 : 2"></td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canManage() ? 8 : 7">No active employees.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editingId() ? 'Edit developer' : 'New developer'"
      [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)" [modal]="true"
      [style]="{width:'30rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Name *
          <input pInputText [(ngModel)]="formName" autocomplete="off" />
        </label>
        <label>Time zone
          <p-select [options]="timezones()" optionLabel="name" optionValue="code"
            [(ngModel)]="formTimezone" [showClear]="true"
            placeholder="Select" appendTo="body" />
        </label>
        <label>Shift (Mon–Fri)</label>
        <app-shift-clock [(start)]="formStart" [(duration)]="formDuration"
          [tzOffset]="tzOffset()" />
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formName.trim() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .load-cell { min-width:220px; }
    .load-label { font-size:.75rem; color:var(--pmo-muted); }
    .expansion-cell { vertical-align:top; padding-top:.35rem; padding-bottom:.75rem; }
    .empty { color:var(--pmo-muted); margin:.25rem 0; font-size:.85rem; }
    .work-list { list-style:none; margin:.25rem 0; padding:0;
      display:flex; flex-direction:column; gap:.4rem; }
    .work-list li { font-size:.85rem; color:var(--pmo-text); line-height:1.3; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.35rem; font-size:.95rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
  `],
})
export class TeamComponent implements OnInit {
  private readonly service = inject(TeamService);
  private readonly employees = inject(EmployeeService);
  private readonly taskService = inject(TaskService);
  private readonly ticketService = inject(TicketService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly rows = signal<WorkloadRow[]>([]);
  readonly loading = signal(true);
  readonly expanded = signal<Record<string, boolean>>({});
  readonly workByDev = signal<Record<string, {
    tasks: { id: string; name: string }[];
    tickets: { id: string; ticket_number: string; name: string }[];
  }>>({});

  // El backend solo permite escribir employees al rol PMO Admin.
  readonly canManage = computed(() => this.auth.hasAnyRole(['PMO Admin']));

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  formName = '';
  readonly formStart = signal<number | null>(null);
  readonly formDuration = signal<number>(9);
  formTimezone: string | null = null;

  /** Solo las zonas donde opera el equipo (Colombia, Filipinas, Chile). */
  readonly timezones = computed(() => {
    const wanted: Record<string, string> = {
      'UTC-5': 'Colombia (UTC-5)',
      'UTC+8': 'Philippines (UTC+8)',
      'UTC-4': 'Chile (UTC-4)',
    };
    return this.catalogs.get('timezones')
      .filter((t) => t.code in wanted)
      .map((t) => ({ ...t, name: wanted[t.code] }));
  });

  tzOffset(): number | null {
    const tz = this.catalogs.get('timezones').find((t) => t.code === this.formTimezone);
    return tz?.utc_offset != null ? parseFloat(tz.utc_offset) : null;
  }

  ngOnInit() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.service.workload().subscribe({
      next: (rows) => {
        rows.sort((a, b) => b.workload_pct - a.workload_pct);
        this.rows.set(rows);
        this.workByDev.set({});
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  availability(r: WorkloadRow) { return AVAILABILITY[r.alert]; }

  loadPct(r: WorkloadRow) { return Math.min(100, Math.round(r.workload_pct * 100)); }

  loadTasks(row: WorkloadRow) {
    if (this.workByDev()[row.employee_id]) return;
    forkJoin({
      tasks: this.taskService
        .list({ assignee: row.employee_id, page_size: 200, ordering: 'planned_end' }),
      tickets: this.ticketService
        .list({ assignee: row.employee_id, open: true, page_size: 200 }),
    }).subscribe(({ tasks, tickets }) => {
      const openTasks = tasks.results
        .filter((t) => !['DONE', 'CANCELLED'].includes(t.status))
        .map((t) => ({ id: t.id, name: t.name }));
      const openTickets = tickets.results
        .map((t) => ({ id: t.id, ticket_number: t.ticket_number, name: t.name }));
      this.workByDev.update((m) => ({
        ...m, [row.employee_id]: { tasks: openTasks, tickets: openTickets },
      }));
    });
  }

  openCreate() {
    this.editingId.set(null);
    this.formName = '';
    this.formStart.set(9);
    this.formDuration.set(9);
    this.formTimezone = null;
    this.dialogOpen.set(true);
  }

  openEdit(row: WorkloadRow) {
    this.editingId.set(row.employee_id);
    this.formName = row.name;
    this.formStart.set(null);
    this.formDuration.set(9);
    this.formTimezone = null;
    this.dialogOpen.set(true);
    this.employees.schedule(row.employee_id).subscribe((rows) => {
      if (this.editingId() !== row.employee_id) return;
      const first = rows[0];
      if (first?.start_hour != null && first?.end_hour != null) {
        this.formStart.set(first.start_hour);
        const span = (first.end_hour - first.start_hour + 24) % 24;
        this.formDuration.set(span === 0 ? 24 : span);
      }
    });
    this.employees.get(row.employee_id).subscribe((emp) => {
      if (this.editingId() === row.employee_id) this.formTimezone = emp.timezone;
    });
  }

  save() {
    const name = this.formName.trim();
    if (!name) return;
    this.saving.set(true);
    const id = this.editingId();

    // legacy_code lo autogenera el backend (EMP-NNN, viendo también inactivos).
    const upsert$ = id
      ? this.employees.update(id, { name, timezone: this.formTimezone })
      : this.employees.create({ name, status: 'ACTIVE', timezone: this.formTimezone });

    upsert$.pipe(
      switchMap((emp) => {
        const empId = id ?? emp.id;
        const start = this.formStart();
        if (start === null) return of(null);
        const end = (start + this.formDuration()) % 24;
        const rows = WEEKDAYS_MON_FRI.map((weekday) => ({
          employee: empId, weekday, start_hour: start, end_hour: end,
        }));
        return this.employees.saveSchedule(empId, rows);
      }),
    ).subscribe({
      next: () => {
        this.notify.success(id ? 'Developer updated' : 'Developer created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  deactivate(row: WorkloadRow) {
    if (!confirm(`Deactivate ${row.name}? Their tasks will show as unassigned in Team.`)) return;
    this.employees.remove(row.employee_id).subscribe(() => {
      this.notify.success('Developer deactivated');
      this.reload();
    });
  }

}
