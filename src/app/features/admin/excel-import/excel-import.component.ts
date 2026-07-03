import { Component, inject, signal } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { ImportReport, ImportService } from './import.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-excel-import',
  standalone: true,
  imports: [TableModule, ButtonModule, TagModule],
  template: `
    <h2>Importar Excel</h2>
    <p class="hint">Sube el workbook PMO. Primero validamos (dry-run); si no hay errores, confirma para persistir.</p>

    <div class="pmo-toolbar">
      <input type="file" accept=".xlsx,.xlsm" (change)="onFile($event)" />
      <p-button label="Validar" icon="pi pi-search" (onClick)="validate()"
        [disabled]="!file() || busy()" [loading]="busy()" />
      <p-button label="Confirmar import" icon="pi pi-check" severity="success"
        (onClick)="confirm()" [disabled]="!canConfirm() || busy()" />
    </div>

    @if (report(); as r) {
      <p-tag [severity]="r.has_errors ? 'danger' : 'success'"
        [value]="r.has_errors ? 'Con errores — corrige antes de confirmar' : 'Validación OK'" />

      <p-table [value]="r.entities" class="report-table">
        <ng-template pTemplate="header">
          <tr><th>Hoja</th><th>Modelo</th><th>Filas</th><th>Nuevos</th><th>Actualiza</th><th>Inválidos</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-e>
          <tr>
            <td>{{ e.sheet }}</td><td>{{ e.model }}</td><td>{{ e.total_rows }}</td>
            <td>{{ e.new }}</td><td>{{ e.updated }}</td>
            <td [class.err]="e.invalid">{{ e.invalid }}</td>
          </tr>
          @if (e.row_errors.length) {
            <tr><td colspan="6" class="row-errors">
              @for (re of e.row_errors; track re.row) {
                <div>Fila {{ re.row }}: {{ re.errors.join(', ') }}</div>
              }
            </td></tr>
          }
        </ng-template>
      </p-table>
    }
  `,
  styles: [`
    .hint { color:#64748b; }
    .err { color:var(--pmo-danger); font-weight:700; }
    .row-errors { background:#fef2f2; font-size:.8rem; color:#b91c1c; }
    .report-table { margin-top:1rem; }
  `],
})
export class ExcelImportComponent {
  private readonly service = inject(ImportService);
  private readonly notify = inject(NotificationService);

  readonly file = signal<File | null>(null);
  readonly report = signal<ImportReport | null>(null);
  readonly busy = signal(false);

  canConfirm() {
    const r = this.report();
    return !!r && !r.has_errors && r.dry_run;
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.report.set(null);
  }

  validate() {
    const f = this.file();
    if (!f) return;
    this.busy.set(true);
    this.service.dryRun(f).subscribe({
      next: (r) => { this.report.set(r); this.busy.set(false); },
      error: () => this.busy.set(false),
    });
  }

  confirm() {
    const f = this.file();
    if (!f) return;
    this.busy.set(true);
    this.service.confirm(f).subscribe({
      next: (r) => {
        this.report.set(r);
        this.busy.set(false);
        this.notify.success('Importación completada');
      },
      error: () => this.busy.set(false),
    });
  }
}
