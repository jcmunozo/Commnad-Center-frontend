import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';

import { TeamService } from '../team/team.service';
import { Holiday, HolidayService } from '../leaves/holiday.service';
import { MilestoneService, TaskService } from '../projects/project-related.services';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmService } from '../../core/services/confirm.service';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The team's actual locations — the Location catalog also holds client-side
 *  countries (Argentina, Spain, ...) that aren't part of the distributed team. */
const TEAM_LOCATION_CODES = ['COLOMBIA', 'CHILE', 'PHILIPPINES'];

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const FULL_DAY_HOURS = 9; // Mon-Thu
const SHORT_DAY_HOURS = 6; // Fri — the 42h week splits 9-9-9-9-6, not evenly
const FRIDAY = 5; // Date#getDay(): 0=Sun..6=Sat

/** Hour-weight of a workday, matching the backend's capacity math. */
function dayHours(d: Date): number {
  return d.getDay() === FRIDAY ? SHORT_DAY_HOURS : FULL_DAY_HOURS;
}

interface DayCell {
  date: string; label: number; weekend: boolean; inRange: boolean; holidays: Holiday[];
}

@Component({
  selector: 'app-sprint',
  standalone: true,
  imports: [
    DatePipe, FormsModule, ButtonModule, DialogModule, DatePickerModule, SelectModule,
    InputTextModule, TableModule,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Sprint</h2>
      <span class="spacer"></span>
      <p-button label="Holidays" icon="pi pi-flag" severity="secondary" [outlined]="true"
        (onClick)="holidaysOpen.set(true)" />
      <p-button label="Export tasks (.xlsx)" icon="pi pi-file-excel" severity="secondary"
        [outlined]="true" (onClick)="exportTasks()" />
      <p-button label="Export milestones (.xlsx)" icon="pi pi-file-excel" severity="secondary"
        [outlined]="true" (onClick)="exportMilestones()" />
      @if (service.period()) {
        <p-button label="Reset to current week" severity="secondary" [outlined]="true"
          icon="pi pi-times" (onClick)="clearPeriod()" />
      }
      <p-button [label]="service.period() ? 'Change sprint' : 'Select sprint'"
        icon="pi pi-calendar" (onClick)="openDialog()" />
    </div>
    <p class="intro">
      Set the period used to calculate team workload capacity. Task/leave/holiday
      hours are weighted per working day (9h Mon&ndash;Thu, 6h Fri) and scaled to
      this range. It applies to the <strong>Team</strong> load column and persists
      per user across sessions and devices.
    </p>

    @if (service.period(); as p) {
      <div class="sprint-tag">
        <i class="pi pi-bolt"></i>
        <span class="sprint-tag-range">{{ p.start | date:'MMM d, y' }} – {{ p.end | date:'MMM d, y' }}</span>
        <span class="sprint-tag-sep">·</span>
        <span>{{ workdaySpan() }} working days</span>
      </div>
    } @else {
      <div class="sprint-tag sprint-tag--default">
        <i class="pi pi-calendar"></i> No sprint set — using the current ISO week
      </div>
    }

    <div class="country-hours">
      @for (c of countryHours(); track c.code) {
        <span class="country-chip">
          <i class="pi pi-clock"></i>{{ c.name }} <strong>{{ c.hours }}h</strong>
        </span>
      }
    </div>

    <div class="layout">
      <section class="calendar-card">
        <header class="cal-head">
          <p-button icon="pi pi-chevron-left" [text]="true" (onClick)="shiftMonth(-1)" />
          <span class="cal-title">
            {{ visibleMonths()[0] | date:'MMMM y' }}
            @if (visibleMonths().length > 1) {
              <span class="cal-title-sep">–</span> {{ visibleMonths()[1] | date:'MMMM y' }}
            }
          </span>
          <p-button icon="pi pi-chevron-right" [text]="true" (onClick)="shiftMonth(1)" />
        </header>

        <div class="cal-months" [class.cal-months--twin]="visibleMonths().length > 1">
          @for (m of visibleMonths(); track m.getTime()) {
            <div class="cal-month">
              @if (visibleMonths().length > 1) {
                <div class="cal-month-title">{{ m | date:'MMMM y' }}</div>
              }
              <div class="cal-grid">
                @for (w of weekdays; track w) { <div class="cal-dow">{{ w }}</div> }
                @for (cell of cellsForMonth(m); track cell?.date ?? $index) {
                  @if (cell) {
                    <div class="cal-day"
                      [class.cal-day--today]="cell.date === todayIso"
                      [class.cal-day--weekend]="cell.weekend"
                      [class.cal-day--sprint]="cell.inRange"
                      [title]="holidayTitle(cell.holidays)">
                      <span class="cal-num">{{ cell.label }}</span>
                      @if (cell.holidays.length) {
                        <span class="cal-holiday">
                          <i class="pi pi-flag-fill"></i>
                          {{ cell.holidays.length === 1
                             ? cell.holidays[0].location_name
                             : cell.holidays.length + ' countries' }}
                        </span>
                      }
                    </div>
                  } @else {
                    <div class="cal-blank"></div>
                  }
                }
              </div>
            </div>
          }
        </div>
      </section>

      <aside class="day-card">
        <h3>Legend</h3>
        <p class="cal-legend">
          <span class="chip chip--sprint">Sprint period</span>
          <span class="chip chip--weekend">Weekend (not counted)</span>
          <span class="chip chip--holiday">Public holiday (CO / CL / PH)</span>
        </p>
        <p class="hint">The calendar is read-only. Use
          "{{ service.period() ? 'Change sprint' : 'Select sprint' }}" above to set the dates.</p>
      </aside>
    </div>

    <p-dialog header="Select sprint" [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)"
      [modal]="true" [style]="{width:'26rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Start date *
          <p-datepicker [(ngModel)]="formStart" dateFormat="yy-mm-dd" [showIcon]="true"
            placeholder="Sprint start" appendTo="body" />
        </label>
        <label>End date *
          <p-datepicker [(ngModel)]="formEnd" dateFormat="yy-mm-dd" [showIcon]="true"
            [minDate]="formStart" placeholder="Sprint end" appendTo="body" />
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formStart || !formEnd || formStart > formEnd"
          (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <p-dialog header="Public holidays" [visible]="holidaysOpen()"
      (visibleChange)="holidaysOpen.set($event)" [modal]="true"
      [style]="{width:'38rem', maxWidth:'92vw'}" [draggable]="false">
      <p class="dialog-hint">One entry per country and date: everyone based in that
        country is off that day and leaves it out of the capacity math. Shown on both this
        calendar and the Leaves calendar.</p>
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
      <h4 class="holiday-list-title">Holidays in {{ visibleMonths()[0] | date:'MMMM y' }}
        @if (visibleMonths().length > 1) { – {{ visibleMonths()[1] | date:'MMMM y' }} }</h4>
      <p-table [value]="holidayList()" dataKey="id">
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
          <tr><td colspan="4">No holidays registered in the visible months.</td></tr>
        </ng-template>
      </p-table>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .intro { color:var(--pmo-muted); font-size:.9rem; max-width:46rem; line-height:1.5;
      margin:0 0 1.25rem; }

    .sprint-tag { display:inline-flex; align-items:center; gap:.5rem; font-size:.85rem;
      font-weight:600; color:#4ade80; background:rgba(34,197,94,.14);
      border:1px solid rgba(34,197,94,.4); border-radius:1rem; padding:.4rem .9rem;
      margin-bottom:.6rem; }
    .sprint-tag--default { color:var(--pmo-muted); background:rgba(255,255,255,.05);
      border-color:var(--pmo-border); font-weight:500; }
    .sprint-tag-sep { color:inherit; opacity:.6; }

    .country-hours { display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1.25rem; }
    .country-chip { display:inline-flex; align-items:center; gap:.4rem; font-size:.78rem;
      color:var(--pmo-muted); background:rgba(255,255,255,.04); border:1px solid var(--pmo-border);
      border-radius:1rem; padding:.3rem .75rem; }
    .country-chip .pi { font-size:.7rem; opacity:.7; }
    .country-chip strong { color:var(--pmo-text); font-weight:700; }

    .layout { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:1rem;
      align-items:start; }
    @media (max-width: 900px) { .layout { grid-template-columns:1fr; } }

    .calendar-card, .day-card { background:var(--pmo-surface);
      border:1px solid var(--pmo-border); border-radius:var(--radius); padding:1rem; }
    .cal-head { display:flex; align-items:center; justify-content:space-between;
      margin-bottom:.75rem; }
    .cal-title { font-weight:700; font-size:1rem; }
    .cal-title-sep { color:var(--pmo-muted); margin:0 .3rem; font-weight:400; }

    .cal-months { display:flex; gap:1.75rem; }
    .cal-months--twin { flex-wrap:wrap; }
    .cal-month { flex:1 1 260px; min-width:230px; }
    .cal-month-title { font-size:.78rem; font-weight:600; color:var(--pmo-muted);
      text-align:center; margin-bottom:.5rem; text-transform:uppercase; letter-spacing:.03em; }

    .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
    .cal-dow { text-align:center; font-size:.7rem; color:var(--pmo-muted);
      padding-bottom:.35rem; text-transform:uppercase; letter-spacing:.05em; }
    .cal-blank { min-height:44px; }
    .cal-day { min-height:44px; border:1px solid var(--pmo-border); border-radius:6px;
      background:rgba(255,255,255,.02); padding:.3rem .35rem;
      display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start;
      gap:.15rem; color:var(--pmo-text); }
    .cal-day--today { border-color:rgba(134,239,172,.5);
      box-shadow:inset 0 0 0 1px rgba(134,239,172,.5); }
    .cal-day--today .cal-num { font-weight:700; }
    .cal-day--weekend { opacity:.55; }
    .cal-day--sprint { background:rgba(34,197,94,.18); border-color:rgba(34,197,94,.55); }
    .cal-day--sprint .cal-num { color:#4ade80; font-weight:700; }
    .cal-num { font-size:.8rem; font-variant-numeric:tabular-nums; }
    .cal-holiday { font-size:.6rem; color:#7db2ec; display:inline-flex; align-items:center;
      gap:.2rem; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cal-holiday .pi { font-size:.55rem; }

    .day-card h3 { margin:0 0 .75rem; font-size:.95rem; }
    .cal-legend { display:flex; flex-direction:column; gap:.5rem; margin:0 0 1rem; }
    .chip { display:inline-flex; align-items:center; gap:.5rem; font-size:.78rem; font-weight:600; }
    .chip::before { content:''; width:7px; height:7px; border-radius:50%;
      background:currentColor; flex-shrink:0; }
    .chip--sprint { color:#4ade80; }
    .chip--weekend { color:var(--pmo-muted); }
    .chip--holiday { color:#7db2ec; }
    .hint { color:var(--pmo-muted); font-size:.78rem; margin:0; padding-top:.85rem;
      border-top:1px solid var(--pmo-border); }

    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }

    .dialog-hint { color:var(--pmo-muted); font-size:.82rem; margin:.25rem 0 1rem; }
    .holiday-form { display:grid;
      grid-template-columns:minmax(7.5rem,9rem) minmax(7.5rem,9.5rem) minmax(0,1fr) auto;
      gap:.9rem; align-items:center; margin-bottom:1.25rem; }
    /* Explicit margins in addition to grid gap: some PrimeNG form controls
       ship their own default spacing that can visually cancel a grid gap, so
       don't rely on gap alone to keep these fields apart. */
    .holiday-form > * { min-width:0; margin-right:.9rem; margin-bottom:.6rem; }
    .holiday-form > *:last-child { margin-right:0; }
    .holiday-form input { width:100%; }
    .holiday-form .p-button { margin-left:.15rem; }
    @media (max-width: 700px) { .holiday-form { grid-template-columns:1fr 1fr; } }
    .holiday-list-title { margin:0 0 .5rem; font-size:.85rem; color:var(--pmo-muted);
      font-weight:600; }
    .mono { font-variant-numeric:tabular-nums; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.35rem; font-size:.95rem; }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
  `],
})
export class SprintComponent implements OnInit {
  readonly service = inject(TeamService);
  private readonly holidayService = inject(HolidayService);
  private readonly taskService = inject(TaskService);
  private readonly milestoneService = inject(MilestoneService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  readonly catalogs = inject(CatalogsService);

  readonly weekdays = WEEKDAYS;
  readonly todayIso = iso(new Date());
  readonly monthStart = signal(startOfMonth(new Date()));
  readonly holidays = signal<Record<string, Holiday[]>>({});
  readonly holidayList = computed(() =>
    Object.values(this.holidays()).flat().sort((a, b) => a.date.localeCompare(b.date)));

  /** Holidays anywhere within the effective range, for the per-country hours readout. */
  readonly periodHolidays = signal<Holiday[]>([]);

  readonly dialogOpen = signal(false);
  formStart: Date | null = null;
  formEnd: Date | null = null;

  readonly holidaysOpen = signal(false);
  readonly holSaving = signal(false);
  holDate: Date | null = null;
  holLocation: string | null = null;
  holName = '';

  /** Two calendars are shown when the committed sprint spans two different months. */
  readonly twoMonthMode = computed(() => {
    const p = this.service.period();
    if (!p) return false;
    return p.start.getFullYear() !== p.end.getFullYear() || p.start.getMonth() !== p.end.getMonth();
  });

  readonly visibleMonths = computed(() => {
    const first = this.monthStart();
    return this.twoMonthMode()
      ? [first, new Date(first.getFullYear(), first.getMonth() + 1, 1)]
      : [first];
  });

  ngOnInit() {
    // No-op if TeamComponent already hydrated this session; needed when
    // /sprint is the first page visited (e.g. deep link, bookmark).
    this.service.loadPersistedPeriod().subscribe(() => {
      const p = this.service.period();
      if (p) this.monthStart.set(startOfMonth(p.start));
      this.loadHolidays();
      this.loadPeriodHolidays();
    });
  }

  readonly workdaySpan = computed(() => {
    const p = this.service.period();
    if (!p) return 0;
    let count = 0;
    for (let d = new Date(p.start); d <= p.end; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) count++;
    }
    return count;
  });

  /** Sprint dates if set, else the current ISO week (Mon-Sun) — matches the
   *  backend's default when no sprint period is persisted. */
  readonly effectiveRange = computed(() => {
    const p = this.service.period();
    if (p) return p;
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start, end };
  });

  /** Working hours per country over the effective range: total weighted
   *  workday hours (9h Mon-Thu, 6h Fri) minus that country's public
   *  holidays landing on a working day. */
  readonly countryHours = computed(() => {
    const { start, end } = this.effectiveRange();
    let base = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) base += dayHours(d);
    }
    const holidays = this.periodHolidays();
    const locations = this.catalogs.get('locations')
      .filter((loc) => TEAM_LOCATION_CODES.includes(loc.code))
      .sort((a, b) => TEAM_LOCATION_CODES.indexOf(a.code) - TEAM_LOCATION_CODES.indexOf(b.code));
    return locations.map((loc) => {
      const lost = holidays
        .filter((h) => h.location === loc.code)
        .reduce((sum, h) => {
          const d = parseIso(h.date);
          const wd = d.getDay();
          return wd === 0 || wd === 6 ? sum : sum + dayHours(d);
        }, 0);
      return { code: loc.code, name: loc.name, hours: Math.max(0, base - lost) };
    });
  });

  cellsForMonth(first: Date): (DayCell | null)[] {
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // ISO: Monday first
    const p = this.service.period();
    const holidays = this.holidays();
    const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      const dateIso = iso(date);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const inRange = !!p && date >= p.start && date <= p.end;
      cells.push({
        date: dateIso, label: d, weekend, inRange, holidays: holidays[dateIso] ?? [],
      });
    }
    return cells;
  }

  holidayTitle(hs: Holiday[]): string {
    return hs.map((h) => `${h.name} — ${h.location_name}`).join(', ');
  }

  private loadHolidays() {
    const months = this.visibleMonths();
    const from = startOfMonth(months[0]);
    const lastMonth = months[months.length - 1];
    const to = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    this.holidayService.list({
      date_from: iso(from), date_to: iso(to), ordering: 'date', page_size: 100,
    }).subscribe((page) => {
      const map: Record<string, Holiday[]> = {};
      for (const h of page.results) (map[h.date] ??= []).push(h);
      this.holidays.set(map);
    });
  }

  private loadPeriodHolidays() {
    const { start, end } = this.effectiveRange();
    this.holidayService.list({
      date_from: iso(start), date_to: iso(end), page_size: 100,
    }).subscribe((page) => this.periodHolidays.set(page.results));
  }

  shiftMonth(delta: number) {
    const m = this.monthStart();
    this.monthStart.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.loadHolidays();
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
        this.loadPeriodHolidays();
      },
      error: () => this.holSaving.set(false),
    });
  }

  removeHoliday(h: Holiday) {
    this.confirm.danger(
      `Delete holiday "${h.name}" (${h.location_name}, ${h.date})?`,
      () => this.holidayService.remove(h.id).subscribe(() => {
        this.notify.success('Holiday deleted');
        this.loadHolidays();
        this.loadPeriodHolidays();
      }),
      { header: 'Delete holiday' },
    );
  }

  openDialog() {
    const p = this.service.period();
    this.formStart = p?.start ?? null;
    this.formEnd = p?.end ?? null;
    this.dialogOpen.set(true);
  }

  save() {
    if (!this.formStart || !this.formEnd || this.formStart > this.formEnd) return;
    this.service.setPeriod({ start: this.formStart, end: this.formEnd });
    this.monthStart.set(startOfMonth(this.formStart));
    this.loadHolidays();
    this.loadPeriodHolidays();
    this.dialogOpen.set(false);
  }

  clearPeriod() {
    this.service.setPeriod(null);
    this.loadPeriodHolidays();
  }

  /** Downloads every active task as an .xlsx file — no sprint-range filter, since
   *  tasks are exported as soon as they're ready regardless of when they're due. */
  exportTasks() {
    this.taskService.exportXlsx().subscribe({
      next: (blob) => this.downloadBlob(blob, 'tasks_export.xlsx'),
      error: () => this.notify.error('Could not export tasks'),
    });
  }

  /** Downloads every active milestone (all projects) as an .xlsx file — no
   *  sprint-range filter, same reasoning as `exportTasks`. */
  exportMilestones() {
    this.milestoneService.exportXlsx().subscribe({
      next: (blob) => this.downloadBlob(blob, 'milestones_export.xlsx'),
      error: () => this.notify.error('Could not export milestones'),
    });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
