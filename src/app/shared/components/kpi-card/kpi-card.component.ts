import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <div class="kpi" [style.borderLeftColor]="accent">
      <div class="kpi-value">{{ value }}</div>
      <div class="kpi-label">{{ label }}</div>
    </div>
  `,
  styles: [`
    .kpi { background:var(--pmo-surface); border-radius:var(--radius); padding:.9rem 1.1rem;
      border:1px solid var(--pmo-border); border-left:4px solid var(--pmo-primary); }
    .kpi-value { font-size:1.9rem; font-weight:700; color:var(--pmo-text);
      font-variant-numeric:tabular-nums; line-height:1.2; }
    .kpi-label { font-size:.72rem; color:var(--pmo-muted); text-transform:uppercase;
      letter-spacing:.05em; margin-top:.15rem; }
  `],
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number | string;
  @Input() accent = 'var(--pmo-primary)';
}
