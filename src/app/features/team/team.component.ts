import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { forkJoin, switchMap } from 'rxjs';

import { TeamService, WorkloadRow } from './team.service';
import { EmployeeService } from './employee.service';
import { DayShift, defaultWeek, ShiftWeekEditorComponent } from './shift-week-editor.component';
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

// Banderas por código del catálogo Location (USA tiene dos entradas, un solo país ISO).
// SVG vía flag-icons (no depende de la fuente emoji del SO — Windows no renderiza
// banderas emoji y muestra el código de país como texto plano).
const ISO2: Record<string, string> = {
  COLOMBIA: 'co', PHILIPPINES: 'ph', CHILE: 'cl', ARGENTINA: 'ar',
  MEXICO: 'mx', SPAIN: 'es', INDIA: 'in', USA_EAST: 'us', USA_WEST: 'us',
  UK: 'gb', BRAZIL: 'br',
};

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, TableModule, ProgressBarModule, ButtonModule, DialogModule,
    InputTextModule, SelectModule, StatusBadgeComponent, ShiftWeekEditorComponent,
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
          <td><button type="button" pButton class="p-button-text p-button-rounded subtask-toggle"
            [class.subtask-toggle--active]="r.open_tasks"
            [pRowToggler]="r"><i class="pi" [class.pi-chevron-down]="expanded"
            [class.pi-chevron-right]="!expanded"></i></button></td>
          <td>
            {{ r.name }}
            @if (r.location) {
              <div class="country-line" [title]="r.location_name">
                <span [class]="flagClass(r.location)"></span>{{ r.location_name }}
              </div>
            }
          </td>
          <td>
            @if (r.on_leave_today) {
              <span class="leave-pill" title="On leave today">
                <i class="pi pi-calendar-minus"></i> On leave</span>
            } @else if (r.holiday_today) {
              <span class="holiday-pill" title="Public holiday in their country today">
                <i class="pi pi-flag-fill"></i> Holiday</span>
            } @else if (r.shift_today) {
              <span class="shift-pill" [class.shift-pill--on]="r.on_shift_now"
                [title]="r.on_shift_now ? 'On shift now' : 'Off shift'">
                <span class="dot"></span>{{ r.shift_today }}</span>
            } @else {
              <span class="shift-off">Off</span>
            }
          </td>
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
        <label>Country
          <p-select [options]="locations()" optionLabel="name" optionValue="code"
            [(ngModel)]="formLocation" [showClear]="true"
            placeholder="Select" appendTo="body">
            <ng-template pTemplate="selectedItem" let-opt>
              @if (opt) {
                <span class="select-flag-row">
                  <span [class]="flagClass(opt.code)"></span>{{ opt.name }}
                </span>
              }
            </ng-template>
            <ng-template pTemplate="item" let-opt>
              <span class="select-flag-row">
                <span [class]="flagClass(opt.code)"></span>{{ opt.name }}
              </span>
            </ng-template>
          </p-select>
        </label>
        <label>Time zone
          <p-select [options]="timezones()" optionLabel="name" optionValue="code"
            [(ngModel)]="formTimezone" [showClear]="true"
            placeholder="Select" appendTo="body" />
        </label>
        <label>Weekly shifts</label>
        <app-shift-week-editor #weekEditor [(days)]="formDays" />
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formName.trim() || !weekEditor.valid() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .load-cell { min-width:220px; }
    .country-line { display:flex; align-items:center; gap:.35rem; margin-top:.2rem;
      font-size:.72rem; color:var(--pmo-muted); white-space:nowrap; }
    .select-flag-row { display:flex; align-items:center; gap:.5rem; }
    .country-line .fi, .select-flag-row .fi {
      width:1.2em; height:.9em; border-radius:2px; flex:none;
      box-shadow:0 0 0 1px rgba(255,255,255,.08);
    }
    .load-label { font-size:.75rem; color:var(--pmo-muted); }
    .shift-pill { display:inline-flex; align-items:center; gap:.45rem;
      background:rgba(255,255,255,.05); border:1px solid var(--pmo-border);
      border-radius:1rem; padding:.25rem .7rem; font-size:.82rem;
      font-variant-numeric:tabular-nums; white-space:nowrap; }
    .shift-pill .dot { width:8px; height:8px; border-radius:50%;
      background:var(--pmo-muted); flex-shrink:0; }
    .shift-pill--on .dot { background:#22c55e; box-shadow:0 0 6px rgba(34,197,94,.7); }
    .shift-off { color:var(--pmo-muted); font-size:.85rem; font-style:italic; }
    .subtask-toggle { color:var(--pmo-muted); }
    .subtask-toggle--active { color:#22c55e; }
    .leave-pill { display:inline-flex; align-items:center; gap:.4rem;
      background:rgba(250,178,25,.10); border:1px solid rgba(250,178,25,.45);
      border-radius:1rem; padding:.25rem .7rem; font-size:.82rem; color:#fab219;
      white-space:nowrap; }
    .leave-pill .pi { font-size:.75rem; }
    .holiday-pill { display:inline-flex; align-items:center; gap:.4rem;
      background:rgba(57,135,229,.10); border:1px solid rgba(57,135,229,.45);
      border-radius:1rem; padding:.25rem .7rem; font-size:.82rem; color:#7db2ec;
      white-space:nowrap; }
    .holiday-pill .pi { font-size:.75rem; }
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
  readonly formDays = signal<DayShift[]>(defaultWeek());
  formTimezone: string | null = null;
  formLocation: string | null = null;

  readonly locations = computed(() => this.catalogs.get('locations')
    .map((l) => ({ code: l.code, name: l.name })));

  flagClass(code: string): string {
    const iso = ISO2[code];
    return iso ? `fi fi-${iso}` : 'pi pi-globe';
  }

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
    this.formDays.set(defaultWeek());
    this.formTimezone = null;
    this.formLocation = null;
    this.dialogOpen.set(true);
  }

  openEdit(row: WorkloadRow) {
    this.editingId.set(row.employee_id);
    this.formName = row.name;
    this.formDays.set(defaultWeek().map((d) => ({ ...d, off: true })));
    this.formTimezone = null;
    this.formLocation = row.location;
    this.dialogOpen.set(true);
    this.employees.schedule(row.employee_id).subscribe((rows) => {
      if (this.editingId() !== row.employee_id) return;
      const byDay = new Map(rows.map((r) => [r.weekday, r]));
      this.formDays.set(Array.from({ length: 7 }, (_, i) => {
        const r = byDay.get(i + 1);
        const hasHours = r?.start_hour != null && r?.end_hour != null;
        return {
          weekday: i + 1,
          start: hasHours ? r!.start_hour! : null,
          end: hasHours ? r!.end_hour! : null,
          off: !hasHours,
        };
      }));
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
      ? this.employees.update(id, { name, timezone: this.formTimezone,
          location: this.formLocation })
      : this.employees.create({ name, status: 'ACTIVE', timezone: this.formTimezone,
          location: this.formLocation });

    upsert$.pipe(
      switchMap((emp) => {
        const empId = id ?? emp.id;
        const rows = this.formDays()
          .filter((d) => !d.off && d.start !== null && d.end !== null)
          .map((d) => ({
            employee: empId, weekday: d.weekday,
            start_hour: d.start!, end_hour: d.end!,
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
