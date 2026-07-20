import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';

import { Leave, LeaveCalendarDay, LeaveService } from './leave.service';
import { Holiday, HolidayService } from './holiday.service';
import { Employee, EmployeeService } from '../team/employee.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ROLES } from '../../core/auth/auth.models';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Component({
  selector: 'app-leaves',
  standalone: true,
  imports: [
    DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule,
    DatePickerModule, InputTextModule,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Leaves</h2>
      <span class="spacer"></span>
      @if (isManager()) {
        <p-button label="Holidays" icon="pi pi-flag" severity="secondary" [outlined]="true"
          (onClick)="holidaysOpen.set(true)" />
      }
      @if (canWrite()) {
        <p-button label="New leave" icon="pi pi-calendar-plus" (onClick)="openCreate()" />
      }
    </div>

    <div class="layout">
      <section class="calendar-card">
        <header class="cal-head">
          <p-button icon="pi pi-chevron-left" [text]="true" (onClick)="shiftMonth(-1)" />
          <span class="cal-title">{{ monthStart() | date:'MMMM y' }}</span>
          <p-button icon="pi pi-chevron-right" [text]="true" (onClick)="shiftMonth(1)" />
        </header>

        <div class="cal-grid">
          @for (w of weekdays; track w) { <div class="cal-dow">{{ w }}</div> }
          @for (cell of gridCells(); track $index) {
            @if (cell) {
              <button type="button" class="cal-day"
                [class.cal-day--today]="cell.date === todayIso"
                [class.cal-day--selected]="cell.date === selectedDate()"
                [class.cal-day--warn]="cell.day?.alert === 'OVER_THRESHOLD'"
                [class.cal-day--busy]="cell.day && cell.day.absent_count > 0 && cell.day.alert === 'OK'"
                [class.cal-day--rest]="cell.day?.headcount === 0"
                [class.cal-day--past]="cell.date < todayIso"
                [class.cal-day--holiday]="!!cell.day?.holidays?.length"
                (click)="selectedDate.set(cell.date)">
                <span class="cal-num">{{ cell.label }}</span>
                @if (cell.day && cell.day.holidays.length) {
                  <span class="cal-holiday" [title]="holidayTitle(cell.day)">
                    <i class="pi pi-flag-fill"></i>
                    {{ cell.day.holidays.length === 1
                       ? cell.day.holidays[0].location_name
                       : cell.day.holidays.length + ' countries' }}
                  </span>
                }
                @if (cell.day && cell.day.absent_count > 0) {
                  <span class="cal-count">{{ cell.day.absent_count }}/{{ cell.day.headcount }} out</span>
                }
              </button>
            } @else {
              <div class="cal-blank"></div>
            }
          }
        </div>
        <p class="cal-legend">
          <span class="chip chip--busy">Some on leave</span>
          <span class="chip chip--warn">Over {{ thresholdLabel() }} of team out</span>
          <span class="chip chip--holiday">Public holiday</span>
        </p>
      </section>

      <aside class="day-card">
        @if (selectedDay(); as day) {
          <h3>{{ day.date | date:'EEEE, MMM d' }}</h3>
          @for (h of day.holidays; track h.location) {
            <p class="holiday-line"><i class="pi pi-flag-fill"></i>
              {{ h.name }} — {{ h.location_name }}</p>
          }
          @if (day.headcount === 0) {
            <p class="empty">Non-working day — leaves don't count here.</p>
          } @else {
            <p class="day-summary" [class.day-summary--warn]="day.alert === 'OVER_THRESHOLD'">
              {{ day.absent_count }} of {{ day.headcount }} people on leave
              @if (day.alert === 'OVER_THRESHOLD') { — capacity warning }
            </p>
            @if (day.absent.length) {
              <ul class="absent-list">
                @for (a of day.absent; track a.employee_id + a.leave_type) {
                  <li><span class="absent-name">{{ a.name }}</span>
                    <span class="absent-type">{{ a.leave_type }}</span></li>
                }
              </ul>
            } @else {
              <p class="empty">Everyone is available.</p>
            }
          }
        } @else {
          <p class="empty">Select a day to see who is out.</p>
        }
      </aside>
    </div>

    <h3 class="table-title">Upcoming &amp; ongoing leaves</h3>
    <p-table [value]="leaves()" [loading]="loading()" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th>Code</th>
          <th>Employee</th>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Workdays</th>
          <th>Notes</th>
          <th style="width:6rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-l>
        <tr>
          <td class="mono">{{ l.legacy_code }}</td>
          <td>{{ l.employee_name }}</td>
          <td>{{ l.leave_type_name }}</td>
          <td>{{ l.start_date | date:'MMM d, y' }}</td>
          <td>{{ l.end_date | date:'MMM d, y' }}</td>
          <td>{{ daysOf(l) }}</td>
          <td class="notes-cell">{{ l.notes }}</td>
          <td class="row-actions">
            @if (canEdit(l)) {
              <button type="button" class="icon-btn" title="Edit" (click)="openEdit(l)">
                <i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                (click)="remove(l)"><i class="pi pi-trash"></i></button>
            }
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8">No upcoming leaves.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editingId() ? 'Edit leave' : 'New leave'"
      [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)" [modal]="true"
      [style]="{width:'32rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Employee *
          @if (isManager()) {
            <p-select [options]="employees()" optionLabel="name" optionValue="id"
              [(ngModel)]="formEmployee" (ngModelChange)="checkConflicts()"
              placeholder="Select" [filter]="true" appendTo="body" />
          } @else {
            <input pInputText [value]="myName()" disabled />
          }
        </label>
        <label>Type *
          <p-select [options]="catalogs.get('leave-types')" optionLabel="name" optionValue="code"
            [(ngModel)]="formType" placeholder="Select" appendTo="body" />
        </label>
        <div class="date-row">
          <label>From *
            <p-datepicker [(ngModel)]="formStart" (ngModelChange)="checkConflicts()"
              dateFormat="yy-mm-dd" [showIcon]="true" appendTo="body" />
          </label>
          <label>To *
            <p-datepicker [(ngModel)]="formEnd" (ngModelChange)="checkConflicts()"
              dateFormat="yy-mm-dd" [showIcon]="true" [minDate]="formStart" appendTo="body" />
          </label>
        </div>
        <label>Notes
          <textarea pInputText [(ngModel)]="formNotes" rows="2"></textarea>
        </label>

        @if (conflicts().length) {
          <div class="conflict-box">
            <strong><i class="pi pi-exclamation-triangle"></i> Also out on those dates:</strong>
            <ul>
              @for (c of conflicts(); track c.date) {
                <li [class.conflict--warn]="c.alert === 'OVER_THRESHOLD'">
                  {{ c.date | date:'MMM d' }}: {{ c.names }} ({{ c.count }}/{{ c.headcount }})
                  @if (c.alert === 'OVER_THRESHOLD') { — over capacity threshold }
                </li>
              }
            </ul>
          </div>
        } @else if (formStart && formEnd) {
          <p class="all-clear"><i class="pi pi-check-circle"></i>
            No one else is on leave on those dates.</p>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formValid() || saving()" [loading]="saving()"
          (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <p-dialog header="Public holidays" [visible]="holidaysOpen()"
      (visibleChange)="holidaysOpen.set($event)" [modal]="true"
      [style]="{width:'38rem'}" [draggable]="false">
      <p class="dialog-hint">One entry per country and date: everyone based in that
        country is off that day and leaves it out of the capacity math.</p>
      <div class="holiday-form">
        <p-datepicker [(ngModel)]="holDate" dateFormat="yy-mm-dd" [showIcon]="true"
          placeholder="Date" appendTo="body" />
        <p-select [options]="catalogs.get('locations')" optionLabel="name" optionValue="code"
          [(ngModel)]="holLocation" placeholder="Country" [filter]="true" appendTo="body" />
        <input pInputText [(ngModel)]="holName" placeholder="Holiday name"
          (keyup.enter)="addHoliday()" />
        <p-button label="Add" icon="pi pi-plus" [disabled]="!holValid() || holSaving()"
          [loading]="holSaving()" (onClick)="addHoliday()" />
      </div>
      <h4 class="holiday-list-title">Holidays in {{ monthStart() | date:'MMMM y' }}</h4>
      <p-table [value]="holidays()" dataKey="id">
        <ng-template pTemplate="header">
          <tr><th>Date</th><th>Name</th><th>Country</th><th style="width:3.5rem"></th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-h>
          <tr>
            <td class="mono">{{ h.date | date:'EEE, MMM d' }}</td>
            <td>{{ h.name }}</td>
            <td>{{ h.location_name }}</td>
            <td>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                (click)="removeHoliday(h)"><i class="pi pi-trash"></i></button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4">No holidays registered this month.</td></tr>
        </ng-template>
      </p-table>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .layout { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:1rem;
      align-items:start; }
    @media (max-width: 900px) { .layout { grid-template-columns:1fr; } }

    .calendar-card, .day-card { background:var(--pmo-surface);
      border:1px solid var(--pmo-border); border-radius:var(--radius); padding:1rem; }
    .cal-head { display:flex; align-items:center; justify-content:space-between;
      margin-bottom:.75rem; }
    .cal-title { font-weight:700; font-size:1rem; }
    .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
    .cal-dow { text-align:center; font-size:.7rem; color:var(--pmo-muted);
      padding-bottom:.35rem; text-transform:uppercase; letter-spacing:.05em; }
    .cal-blank { min-height:56px; }
    .cal-day { min-height:56px; border:1px solid var(--pmo-border); border-radius:6px;
      background:rgba(255,255,255,.02); cursor:pointer; padding:.3rem .35rem;
      display:flex; flex-direction:column; align-items:flex-start; gap:.25rem;
      font-family:inherit; color:var(--pmo-text); }
    .cal-day:hover { border-color:var(--pmo-primary); }
    .cal-day--today { border-color:rgba(134,239,172,.5);
      box-shadow:inset 0 0 0 1px rgba(134,239,172,.5); }
    .cal-day--today .cal-num { color:rgba(134,239,172,.5); font-weight:700; }
    .cal-day--selected { outline:2px solid var(--pmo-primary); outline-offset:-1px; }
    .cal-day--holiday { background:rgba(57,135,229,.10); border-color:rgba(57,135,229,.45); }
    .cal-day--busy { background:rgba(250,178,25,.10); border-color:rgba(250,178,25,.45); }
    .cal-day--warn { background:rgba(208,59,59,.12); border-color:rgba(208,59,59,.55); }
    .cal-day--rest { opacity:.45; background:transparent; }
    .cal-day--past { opacity:.45; }
    .cal-num { font-size:.8rem; font-variant-numeric:tabular-nums; }
    .cal-holiday { font-size:.62rem; color:#7db2ec; display:inline-flex;
      align-items:center; gap:.25rem; max-width:100%; overflow:hidden;
      text-overflow:ellipsis; white-space:nowrap; }
    .cal-holiday .pi { font-size:.58rem; }
    .cal-count { font-size:.66rem; color:var(--pmo-muted); white-space:nowrap; }
    .cal-day--warn .cal-count { color:#e07a7a; }
    .cal-legend { display:flex; gap:.6rem; margin:.75rem 0 0; }
    .chip { font-size:.7rem; padding:.15rem .6rem; border-radius:1rem; border:1px solid; }
    .chip--busy { border-color:rgba(250,178,25,.55); color:#fab219; }
    .chip--warn { border-color:rgba(208,59,59,.6); color:#e07a7a; }
    .chip--holiday { border-color:rgba(57,135,229,.55); color:#7db2ec; }

    .day-card h3 { margin:0 0 .5rem; font-size:.95rem; }
    .holiday-line { display:flex; align-items:center; gap:.4rem; font-size:.82rem;
      color:#7db2ec; margin:0 0 .6rem; }
    .day-summary { font-size:.85rem; color:var(--pmo-muted); margin:0 0 .75rem; }
    .day-summary--warn { color:#e07a7a; font-weight:600; }
    .absent-list { list-style:none; margin:0; padding:0; display:flex;
      flex-direction:column; gap:.5rem; }
    .absent-list li { display:flex; justify-content:space-between; gap:.5rem;
      font-size:.85rem; }
    .absent-type { color:var(--pmo-muted); font-size:.75rem; }
    .empty { color:var(--pmo-muted); font-size:.85rem; }

    .table-title { margin:1.5rem 0 .75rem; font-size:1rem; }
    .mono { font-variant-numeric:tabular-nums; }
    .notes-cell { max-width:220px; overflow:hidden; text-overflow:ellipsis;
      white-space:nowrap; color:var(--pmo-muted); }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.35rem; font-size:.95rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }

    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .date-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .conflict-box { border:1px solid rgba(250,178,25,.5); border-radius:var(--radius);
      padding:.6rem .8rem; font-size:.82rem; background:rgba(250,178,25,.07); }
    .conflict-box strong { display:flex; align-items:center; gap:.4rem; color:#fab219; }
    .conflict-box ul { margin:.5rem 0 0; padding-left:1.1rem; }
    .conflict-box li { margin-bottom:.2rem; }
    .conflict--warn { color:#e07a7a; font-weight:600; }
    .all-clear { display:flex; align-items:center; gap:.4rem; font-size:.82rem;
      color:#0ca30c; margin:0; }

    .dialog-hint { color:var(--pmo-muted); font-size:.82rem; margin:.25rem 0 1rem; }
    .holiday-form { display:grid;
      grid-template-columns:minmax(8rem,9.5rem) minmax(8rem,10rem) minmax(0,1fr) auto;
      gap:.6rem; align-items:center; margin-bottom:1.25rem; }
    .holiday-form > * { min-width:0; }
    .holiday-form input { width:100%; }
    @media (max-width: 700px) { .holiday-form { grid-template-columns:1fr 1fr; } }
    .holiday-list-title { margin:0 0 .5rem; font-size:.85rem; color:var(--pmo-muted);
      font-weight:600; }
  `],
})
export class LeavesComponent implements OnInit {
  private readonly service = inject(LeaveService);
  private readonly holidayService = inject(HolidayService);
  private readonly employeeService = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly weekdays = WEEKDAYS;
  readonly todayIso = iso(new Date());

  readonly monthStart = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly calendar = signal<Record<string, LeaveCalendarDay>>({});
  readonly selectedDate = signal<string | null>(this.todayIso);
  readonly leaves = signal<Leave[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly loading = signal(true);

  readonly isManager = computed(() => this.auth.hasAnyRole([ROLES.ADMIN, ROLES.PM]));
  readonly myEmployeeId = computed(() => this.auth.user()?.employee ?? null);
  readonly canWrite = computed(() =>
    this.isManager() || (this.auth.hasAnyRole([ROLES.TEAM]) && !!this.myEmployeeId()));

  readonly holidaysOpen = signal(false);
  readonly holidays = signal<Holiday[]>([]);
  readonly holSaving = signal(false);
  holDate: Date | null = null;
  holLocation: string | null = null;
  holName = '';

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly conflicts = signal<{
    date: string; names: string; count: number; headcount: number; alert: string;
  }[]>([]);
  formEmployee: string | null = null;
  formType: string | null = null;
  formStart: Date | null = null;
  formEnd: Date | null = null;
  formNotes = '';

  readonly selectedDay = computed(() => {
    const d = this.selectedDate();
    return d ? this.calendar()[d] ?? null : null;
  });

  /** Threshold shown in the legend, derived from the first day the API flagged. */
  readonly thresholdLabel = computed(() => '25%');

  readonly gridCells = computed(() => {
    const first = this.monthStart();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // ISO: Monday first
    const cal = this.calendar();
    const cells: ({ date: string; label: number; day: LeaveCalendarDay | null } | null)[] =
      Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = iso(new Date(first.getFullYear(), first.getMonth(), d));
      cells.push({ date, label: d, day: cal[date] ?? null });
    }
    return cells;
  });

  ngOnInit() {
    this.loadCalendar();
    this.loadHolidays();
    this.loadLeaves();
    if (this.isManager()) {
      this.employeeService.list({ page_size: 200, ordering: 'name' })
        .subscribe((page) => this.employees.set(page.results));
    }
  }

  shiftMonth(delta: number) {
    const m = this.monthStart();
    this.monthStart.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.selectedDate.set(null);
    this.loadCalendar();
    this.loadHolidays();
  }

  loadCalendar() {
    const first = this.monthStart();
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    this.service.calendar(iso(first), iso(last)).subscribe((days) => {
      const map: Record<string, LeaveCalendarDay> = {};
      for (const d of days) map[d.date] = d;
      this.calendar.set(map);
    });
  }

  loadHolidays() {
    const first = this.monthStart();
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    this.holidayService.list({
      date_from: iso(first), date_to: iso(last), ordering: 'date', page_size: 100,
    }).subscribe((page) => this.holidays.set(page.results));
  }

  holidayTitle(day: LeaveCalendarDay): string {
    return day.holidays.map((h) => `${h.name} — ${h.location_name}`).join(', ');
  }

  holValid(): boolean {
    return !!(this.holDate && this.holLocation && this.holName.trim());
  }

  addHoliday() {
    if (!this.holValid() || this.holSaving()) return;
    this.holSaving.set(true);
    this.holidayService.create({
      name: this.holName.trim(), location: this.holLocation!, date: iso(this.holDate!),
    }).subscribe({
      next: () => {
        this.notify.success('Holiday registered');
        this.holSaving.set(false);
        this.holName = '';
        this.loadHolidays();
        this.loadCalendar();
      },
      error: () => this.holSaving.set(false),
    });
  }

  removeHoliday(h: Holiday) {
    if (!confirm(`Delete holiday "${h.name}" (${h.location_name}, ${h.date})?`)) return;
    this.holidayService.remove(h.id).subscribe(() => {
      this.notify.success('Holiday deleted');
      this.loadHolidays();
      this.loadCalendar();
    });
  }

  loadLeaves() {
    this.loading.set(true);
    this.service.list({ date_from: this.todayIso, ordering: 'start_date', page_size: 100 })
      .subscribe({
        next: (page) => { this.leaves.set(page.results); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  /** Working days (Mon–Fri) covered by the leave; weekends don't count. */
  daysOf(l: Leave): number {
    let count = 0;
    const d = new Date(l.start_date + 'T00:00:00');
    const end = new Date(l.end_date + 'T00:00:00');
    while (d <= end) {
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  canEdit(l: Leave): boolean {
    return this.isManager() || l.employee === this.myEmployeeId();
  }

  formValid(): boolean {
    return !!(this.formEmployee && this.formType && this.formStart && this.formEnd
      && this.formStart <= this.formEnd);
  }

  myName(): string {
    const u = this.auth.user();
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.username : '';
  }

  openCreate() {
    this.editingId.set(null);
    this.formEmployee = this.isManager() ? null : this.myEmployeeId();
    this.formType = null;
    this.formStart = null;
    this.formEnd = null;
    this.formNotes = '';
    this.conflicts.set([]);
    this.dialogOpen.set(true);
  }

  openEdit(l: Leave) {
    this.editingId.set(l.id);
    this.formEmployee = l.employee;
    this.formType = l.leave_type;
    this.formStart = new Date(l.start_date + 'T00:00:00');
    this.formEnd = new Date(l.end_date + 'T00:00:00');
    this.formNotes = l.notes;
    this.dialogOpen.set(true);
    this.checkConflicts();
  }

  /** Live capacity check: who else is already out on the chosen dates. */
  checkConflicts() {
    if (!this.formStart || !this.formEnd || this.formStart > this.formEnd) {
      this.conflicts.set([]);
      return;
    }
    this.service.calendar(iso(this.formStart), iso(this.formEnd)).subscribe((days) => {
      this.conflicts.set(days
        .map((d) => {
          const others = d.absent.filter((a) => a.employee_id !== this.formEmployee);
          const names = [...new Set(others.map((a) => a.name))];
          return {
            date: d.date, names: names.join(', '), count: names.length,
            headcount: d.headcount, alert: d.alert,
          };
        })
        .filter((c) => c.count > 0));
    });
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const body = {
      employee: this.formEmployee!, leave_type: this.formType!,
      start_date: iso(this.formStart!), end_date: iso(this.formEnd!),
      notes: this.formNotes.trim(),
    };
    const id = this.editingId();
    const req$ = id ? this.service.update(id, body) : this.service.create(body);
    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Leave updated' : 'Leave registered');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.loadLeaves();
        this.loadCalendar();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(l: Leave) {
    if (!confirm(`Delete ${l.employee_name}'s leave (${l.start_date} → ${l.end_date})?`)) return;
    this.service.remove(l.id).subscribe(() => {
      this.notify.success('Leave deleted');
      this.loadLeaves();
      this.loadCalendar();
    });
  }
}
