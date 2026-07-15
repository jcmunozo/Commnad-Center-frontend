import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';

const SEVERITY_MAP: Record<string, 'success' | 'info' | 'warn' | 'danger'> = {
  LOW: 'info', MEDIUM: 'warn', HIGH: 'warn', CRITICAL: 'danger',
  GREEN: 'success', YELLOW: 'warn', RED: 'danger',
  DONE: 'success', COMPLETED: 'success', BLOCKED: 'danger', CANCELLED: 'danger',
  IN_PROGRESS: 'info',
  WIP: 'info', PAUSED: 'warn', RESOLVED: 'success',
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
