import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';

import { TeamService } from '../team/team.service';
import { Holiday, HolidayService } from '../leaves/holiday.service';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface DayCell {
  date: string; label: number; weekend: boolean;
  inRange: boolean; pending: boolean; holidays: Holiday[];
}

@Component({
  selector: 'app-sprint',
  standalone: true,
  imports: [DatePipe, ButtonModule],
  template: `
    <div class="pmo-toolbar">
      <h2>Sprint</h2>
      <span class="spacer"></span>
      @if (service.period()) {
        <p-button label="Reset to current week" size="small" severity="secondary" [outlined]="true"
          icon="pi pi-times" (onClick)="clearPeriod()" />
      }
    </div>
    <p class="intro">
      Set the period used to calculate team workload capacity. Task/leave/holiday
      hours are weighted per working day (9h Mon&ndash;Thu, 6h Fri) and scaled to
      this range. It applies to the <strong>Team</strong> load column and persists
      per user across sessions and devices.
    </p>

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
                    <button type="button" class="cal-day"
                      [class.cal-day--today]="cell.date === todayIso"
                      [class.cal-day--weekend]="cell.weekend"
                      [class.cal-day--sprint]="cell.inRange"
                      [class.cal-day--pending]="cell.pending"
                      [title]="holidayTitle(cell.holidays)"
                      (click)="onDayClick(cell.date)">
                      <span class="cal-num">{{ cell.label }}</span>
                      @if (cell.holidays.length) {
                        <span class="cal-holiday">
                          <i class="pi pi-flag-fill"></i>
                          {{ cell.holidays.length === 1
                             ? cell.holidays[0].location_name
                             : cell.holidays.length + ' countries' }}
                        </span>
                      }
                    </button>
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
        @if (pendingStart()) {
          <p class="hint hint--active">
            <i class="pi pi-info-circle"></i> Pick the end date for the sprint.
          </p>
          <p-button label="Cancel" size="small" severity="secondary" [outlined]="true"
            (onClick)="pendingStart.set(null)" />
        } @else if (service.period(); as p) {
          <h3>Active sprint</h3>
          <p class="period-range">{{ p.start | date:'MMM d, y' }} – {{ p.end | date:'MMM d, y' }}</p>
          <p class="period-days">{{ workdaySpan() }} working days</p>
          <p class="hint">Click a day on the calendar to start a new selection.</p>
        } @else {
          <h3>No sprint set</h3>
          <p class="empty">Using the current ISO week as the default capacity period.</p>
          <p class="hint">Click a start day, then an end day to define a sprint.</p>
        }
        <p class="cal-legend">
          <span class="chip chip--sprint">Sprint period</span>
          <span class="chip chip--weekend">Weekend (not counted)</span>
          <span class="chip chip--holiday">Public holiday (CO / CL / PH)</span>
        </p>
      </aside>
    </div>
  `,
  styles: [`
    .spacer { flex:1; }
    .intro { color:var(--pmo-muted); font-size:.9rem; max-width:46rem; line-height:1.5;
      margin:0 0 1.25rem; }

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
      background:rgba(255,255,255,.02); cursor:pointer; padding:.3rem .35rem;
      display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start;
      gap:.15rem; font-family:inherit; color:var(--pmo-text); }
    .cal-day:hover { border-color:var(--pmo-primary); }
    .cal-day--today { border-color:rgba(134,239,172,.5);
      box-shadow:inset 0 0 0 1px rgba(134,239,172,.5); }
    .cal-day--today .cal-num { font-weight:700; }
    .cal-day--weekend { opacity:.55; }
    .cal-day--sprint { background:rgba(34,197,94,.18); border-color:rgba(34,197,94,.55); }
    .cal-day--sprint .cal-num { color:#4ade80; font-weight:700; }
    .cal-day--pending { background:rgba(34,197,94,.32); border-color:#22c55e; }
    .cal-num { font-size:.8rem; font-variant-numeric:tabular-nums; }
    .cal-holiday { font-size:.6rem; color:#7db2ec; display:inline-flex; align-items:center;
      gap:.2rem; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cal-holiday .pi { font-size:.55rem; }

    .cal-legend { display:flex; flex-direction:column; gap:.5rem;
      margin:1.25rem 0 0; padding-top:1rem; border-top:1px solid var(--pmo-border); }
    .chip { display:inline-flex; align-items:center; gap:.5rem; font-size:.78rem; font-weight:600; }
    .chip::before { content:''; width:7px; height:7px; border-radius:50%;
      background:currentColor; flex-shrink:0; }
    .chip--sprint { color:#4ade80; }
    .chip--weekend { color:var(--pmo-muted); }
    .chip--holiday { color:#7db2ec; }

    .day-card h3 { margin:0 0 .6rem; font-size:.95rem; }
    .period-range { font-size:.95rem; font-weight:600; margin:0 0 .3rem; }
    .period-days { font-size:.82rem; color:var(--pmo-muted); margin:0 0 .85rem; }
    .empty { color:var(--pmo-muted); font-size:.85rem; margin:0 0 .6rem; }
    .hint { color:var(--pmo-muted); font-size:.78rem; margin:0; }
    .hint--active { display:flex; align-items:center; gap:.4rem; color:#4ade80;
      margin:0 0 .75rem; }
  `],
})
export class SprintComponent implements OnInit {
  readonly service = inject(TeamService);
  private readonly holidayService = inject(HolidayService);

  readonly weekdays = WEEKDAYS;
  readonly todayIso = iso(new Date());
  readonly monthStart = signal(startOfMonth(new Date()));
  readonly holidays = signal<Record<string, Holiday[]>>({});

  /** First day clicked while building a new selection; null once the range is committed. */
  readonly pendingStart = signal<string | null>(null);

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

  private readonly activeRange = computed(() => {
    const pending = this.pendingStart();
    if (pending) return { start: pending, end: pending, pending: true };
    const p = this.service.period();
    if (!p) return null;
    return { start: iso(p.start), end: iso(p.end), pending: false };
  });

  cellsForMonth(first: Date): (DayCell | null)[] {
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // ISO: Monday first
    const range = this.activeRange();
    const holidays = this.holidays();
    const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      const dateIso = iso(date);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const inRange = !!range && dateIso >= range.start && dateIso <= range.end;
      cells.push({
        date: dateIso, label: d, weekend, inRange,
        pending: !!range?.pending && inRange,
        holidays: holidays[dateIso] ?? [],
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

  shiftMonth(delta: number) {
    const m = this.monthStart();
    this.monthStart.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.loadHolidays();
  }

  onDayClick(dateIso: string) {
    const start = this.pendingStart();
    if (!start) {
      this.pendingStart.set(dateIso);
      return;
    }
    const [startIso, endIso] = start <= dateIso ? [start, dateIso] : [dateIso, start];
    this.pendingStart.set(null);
    const startDate = parseIso(startIso);
    this.service.setPeriod({ start: startDate, end: parseIso(endIso) });
    this.monthStart.set(startOfMonth(startDate));
    this.loadHolidays();
  }

  clearPeriod() {
    this.pendingStart.set(null);
    this.service.setPeriod(null);
  }
}
