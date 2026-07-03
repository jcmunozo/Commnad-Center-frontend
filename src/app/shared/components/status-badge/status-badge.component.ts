import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';

const SEVERITY_MAP: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'info', MEDIUM: 'warning', HIGH: 'warning', CRITICAL: 'danger',
  GREEN: 'success', YELLOW: 'warning', RED: 'danger',
  DONE: 'success', COMPLETED: 'success', BLOCKED: 'danger', CANCELLED: 'danger',
  IN_PROGRESS: 'info',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [TagModule],
  template: `<p-tag [value]="label || code" [severity]="severity" />`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) code!: string;
  @Input() label = '';

  get severity() {
    return SEVERITY_MAP[this.code] ?? 'info';
  }
}
