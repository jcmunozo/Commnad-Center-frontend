import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';

/** Selector libre de turno sobre un dial de 24 horas.
 *
 * El usuario elige la duración (chips 8h/9h o número libre) y hace clic en el
 * dial para fijar la hora de inicio; el turno se dibuja como un arco
 * (medianoche arriba, sentido horario) y puede cruzar la medianoche. Muestra
 * la equivalencia en la hora local del usuario según la zona horaria del dev.
 */
@Component({
  selector: 'app-shift-clock',
  standalone: true,
  imports: [FormsModule, InputNumberModule],
  template: `
    <div class="clock-wrap">
      <div class="duration">
        <span class="duration__label">Duration:</span>
        @for (d of [8, 9]; track d) {
          <button type="button" class="chip" [class.chip--on]="duration() === d"
            (click)="duration.set(d)">{{ d }}h</button>
        }
        <p-inputNumber [ngModel]="duration()" (ngModelChange)="duration.set($event ?? 8)"
          [min]="1" [max]="23" [showButtons]="true" suffix="h" inputStyleClass="dur-input" />
      </div>

      <svg viewBox="0 0 220 220" (click)="onDialClick($event)">
        <circle cx="110" cy="110" r="88" fill="none" stroke="var(--pmo-border)"
          stroke-width="16" />
        @if (arc(); as a) {
          <path [attr.d]="a" fill="none" stroke="var(--pmo-primary)" stroke-width="16"
            stroke-linecap="round" />
          <!-- marcador de inicio -->
          <circle [attr.cx]="startPoint().x" [attr.cy]="startPoint().y" r="5"
            fill="#fff" stroke="var(--pmo-primary)" stroke-width="3" />
        }
        @for (h of hours; track h) {
          <line [attr.x1]="tick(h, 76).x" [attr.y1]="tick(h, 76).y"
            [attr.x2]="tick(h, h % 6 === 0 ? 68 : 72).x"
            [attr.y2]="tick(h, h % 6 === 0 ? 68 : 72).y"
            stroke="var(--pmo-muted)" [attr.stroke-width]="h % 6 === 0 ? 2 : 1" />
        }
        @for (h of [0, 6, 12, 18]; track h) {
          <text [attr.x]="tick(h, 56).x" [attr.y]="tick(h, 56).y" text-anchor="middle"
            dominant-baseline="central" fill="var(--pmo-muted)" font-size="11">{{ h }}</text>
        }
        <text x="110" y="103" text-anchor="middle" fill="var(--pmo-text)"
          font-size="19" font-weight="700">{{ centerLabel() }}</text>
        <text x="110" y="124" text-anchor="middle" fill="var(--pmo-muted)" font-size="10">
          {{ start() === null ? 'click to set the start' : 'click to move the start' }}
        </text>
      </svg>

      @if (localEquivalent(); as eq) {
        <p class="equiv"><i class="pi pi-globe"></i> In your local time: <strong>{{ eq }}</strong></p>
      }
    </div>
  `,
  styles: [`
    .clock-wrap { display:flex; flex-direction:column; align-items:center; gap:.5rem; }
    svg { width: 190px; height: 190px; cursor: pointer; }
    .duration { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap;
      justify-content:center; }
    .duration__label { font-size:.78rem; color:var(--pmo-muted); }
    .chip { background:var(--pmo-surface); border:1px solid var(--pmo-border);
      border-radius:1rem; padding:.25rem .7rem; font-size:.78rem; cursor:pointer;
      color:var(--pmo-muted); font-family:inherit; }
    .chip:hover { border-color:var(--pmo-primary); color:var(--pmo-text); }
    .chip--on { background:var(--pmo-primary); border-color:var(--pmo-primary);
      color:#fff; font-weight:600; }
    :host ::ng-deep .dur-input { width:4.5rem; text-align:center; }
    .equiv { margin:0; font-size:.78rem; color:var(--pmo-muted); }
    .equiv i { font-size:.72rem; margin-right:.25rem; }
  `],
})
export class ShiftClockComponent {
  /** Hora de inicio (0-23) elegida; two-way binding. */
  readonly start = model<number | null>(null);
  /** Duración en horas; two-way binding. */
  readonly duration = model<number>(9);
  /** Offset UTC de la zona del dev (p. ej. -5, 8, 5.5); null = sin zona. */
  readonly tzOffset = input<number | null>(null);

  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly end = computed(() => {
    const s = this.start();
    return s === null ? null : (s + this.duration()) % 24;
  });

  readonly centerLabel = computed(() => {
    const s = this.start();
    const e = this.end();
    return s === null || e === null ? '—' : `${s}–${e}`;
  });

  /** Ángulo horario: medianoche arriba, sentido horario. */
  private point(hour: number, r: number) {
    const rad = ((hour / 24) * 360 - 90) * (Math.PI / 180);
    return { x: 110 + r * Math.cos(rad), y: 110 + r * Math.sin(rad) };
  }

  tick(hour: number, r: number) { return this.point(hour, r); }

  startPoint() { return this.point(this.start() ?? 0, 88); }

  readonly arc = computed(() => {
    const s = this.start();
    if (s === null) return null;
    const e = s + this.duration();
    const p1 = this.point(s, 88);
    const p2 = this.point(e, 88);
    const large = this.duration() > 12 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A 88 88 0 ${large} 1 ${p2.x} ${p2.y}`;
  });

  /** Turno del dev convertido a la hora local del navegador. */
  readonly localEquivalent = computed(() => {
    const s = this.start();
    const e = this.end();
    const devOff = this.tzOffset();
    if (s === null || e === null || devOff === null) return null;
    const viewerOff = -new Date().getTimezoneOffset() / 60;
    const shift = viewerOff - devOff;
    if (Math.abs(shift) < 0.01) return null; // misma zona: no aporta
    const fmt = (h: number) => {
      const norm = ((h % 24) + 24) % 24;
      const mins = Math.round((norm % 1) * 60);
      return `${String(Math.floor(norm)).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };
    return `${fmt(s + shift)} – ${fmt(e + shift)}`;
  });

  onDialClick(ev: MouseEvent) {
    const svg = (ev.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 220 - 110;
    const y = ((ev.clientY - rect.top) / rect.height) * 220 - 110;
    const hour = ((Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360) / 360 * 24;
    this.start.set(Math.round(hour) % 24);
  }
}
