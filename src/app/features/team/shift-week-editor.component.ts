import { Component, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';

/** One row per ISO weekday (1=Mon .. 7=Sun). Hours are the dev's local time. */
export interface DayShift {
  weekday: number;
  start: number | null;
  end: number | null;
  off: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function defaultWeek(): DayShift[] {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    start: i < 5 ? 9 : null,
    end: i < 5 ? 18 : null,
    off: i >= 5,
  }));
}

@Component({
  selector: 'app-shift-week-editor',
  standalone: true,
  imports: [FormsModule, SelectModule, CheckboxModule, ButtonModule],
  template: `
    <div class="week">
      @for (d of days(); track d.weekday) {
        <div class="day-row" [class.day-row--invalid]="!rowValid(d)">
          <span class="day-name">{{ label(d.weekday) }}</span>
          @if (!d.off) {
            <p-select class="hour" [options]="hourOptions" optionLabel="label"
              optionValue="value" [ngModel]="d.start" appendTo="body"
              (ngModelChange)="patch(d.weekday, { start: $event })" />
            <span class="dash">–</span>
            <p-select class="hour" [options]="hourOptions" optionLabel="label"
              optionValue="value" [ngModel]="d.end" appendTo="body"
              (ngModelChange)="patch(d.weekday, { end: $event })" />
          } @else {
            <span class="off-label">Off</span>
          }
          <label class="off-toggle" [title]="d.off ? 'Enable this day' : 'Day off'">
            <p-checkbox [binary]="true" [ngModel]="d.off"
              (ngModelChange)="toggleOff(d.weekday, $event)" />
            <span>Off</span>
          </label>
        </div>
      }
      @if (!valid()) {
        <p class="hint hint--error">Start and end must differ on working days.</p>
      }
      <p-button label="Copy Monday to all weekdays" icon="pi pi-copy" size="small"
        severity="secondary" [text]="true" (onClick)="copyMonday()" />
    </div>
  `,
  styles: [`
    .week { display:flex; flex-direction:column; gap:.4rem; }
    .day-row { display:flex; align-items:center; gap:.5rem; padding:.15rem .4rem;
      border-radius:var(--radius); }
    .day-row--invalid { outline:1px solid var(--pmo-danger); }
    .day-name { width:2.6rem; font-size:.85rem; color:var(--pmo-text); font-weight:600; }
    .dash { color:var(--pmo-muted); }
    .hour { width:6.2rem; }
    .off-label { flex:1; color:var(--pmo-muted); font-size:.85rem; font-style:italic; }
    .off-toggle { display:flex; align-items:center; gap:.35rem; margin-left:auto;
      font-size:.78rem; color:var(--pmo-muted); cursor:pointer; }
    .hint { margin:0; font-size:.78rem; }
    .hint--error { color:var(--pmo-danger); }
  `],
})
export class ShiftWeekEditorComponent {
  /** Two-way bound week (always 7 rows, weekday 1..7). */
  readonly days = model<DayShift[]>(defaultWeek());

  readonly hourOptions = Array.from({ length: 24 }, (_, h) => ({
    value: h, label: `${String(h).padStart(2, '0')}:00`,
  }));

  readonly valid = computed(() => this.days().every((d) => this.rowValid(d)));

  label(weekday: number) { return DAY_LABELS[weekday - 1]; }

  rowValid(d: DayShift) {
    return d.off || (d.start !== null && d.end !== null && d.start !== d.end);
  }

  patch(weekday: number, change: Partial<DayShift>) {
    this.days.update((week) =>
      week.map((d) => (d.weekday === weekday ? { ...d, ...change } : d)));
  }

  toggleOff(weekday: number, off: boolean) {
    this.days.update((week) =>
      week.map((d) => (d.weekday === weekday
        ? { ...d, off, start: off ? d.start : d.start ?? 9, end: off ? d.end : d.end ?? 18 }
        : d)));
  }

  copyMonday() {
    const mon = this.days().find((d) => d.weekday === 1)!;
    this.days.update((week) =>
      week.map((d) => (d.weekday >= 2 && d.weekday <= 5
        ? { ...d, off: mon.off, start: mon.start, end: mon.end }
        : d)));
  }
}
