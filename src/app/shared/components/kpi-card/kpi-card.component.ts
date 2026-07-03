import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <div class="kpi" [style.borderTopColor]="accent">
      <div class="kpi-value">{{ value }}</div>
      <div class="kpi-label">{{ label }}</div>
    </div>
  `,
  styles: [`
    .kpi { background:#fff; border-radius:var(--radius); padding:1rem 1.25rem; border-top:3px solid var(--pmo-primary); box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .kpi-value { font-size:1.8rem; font-weight:700; color:#0f172a; }
    .kpi-label { font-size:.8rem; color:#64748b; text-transform:uppercase; letter-spacing:.03em; }
  `],
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number | string;
  @Input() accent = 'var(--pmo-primary)';
}
