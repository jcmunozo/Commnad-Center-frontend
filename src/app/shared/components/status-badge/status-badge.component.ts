import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';

const SEVERITY_MAP: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
  LOW: 'info', MEDIUM: 'warn', HIGH: 'danger', CRITICAL: 'danger',
  GREEN: 'success', YELLOW: 'warn', RED: 'danger',
  DONE: 'success', COMPLETED: 'success', BLOCKED: 'danger', CANCELLED: 'danger',
  IN_PROGRESS: 'info',
  WIP: 'info', PAUSED: 'warn', RESOLVED: 'success',
  // Project delivery stage (Dev → Hypercare), see project.models.ts PhaseCode.
  DEV: 'secondary', SIT: 'info', UAT: 'warn', HYPERCARE: 'danger', PROD: 'success',
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
