import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';

import { ProjectService } from '../project.service';
import { ProjectWrite } from '../project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { ClientService, Client } from '../../clients/client.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Cross-field validator mirroring the backend: planned_end >= start_date. */
function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('start_date')?.value;
  const end = group.get('planned_end')?.value;
  return start && end && new Date(end) < new Date(start) ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, InputTextModule, InputNumberModule, SelectModule, DatePickerModule,
    ButtonModule,
  ],
  template: `
    <div class="pmo-toolbar"><h2>{{ id() ? 'Editar' : 'Nuevo' }} proyecto</h2></div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
      <label>Nombre *
        <input pInputText formControlName="name" />
        @if (invalid('name')) { <small class="err">Requerido</small> }
      </label>

      <label>Cliente *
        <p-select [options]="clients()" optionLabel="name" optionValue="id"
          formControlName="client" [filter]="true" placeholder="Selecciona" />
        @if (invalid('client')) { <small class="err">Requerido</small> }
      </label>

      <label>Tipo *
        <p-select [options]="catalogs.get('project-types')" optionLabel="name" optionValue="code"
          formControlName="project_type" />
      </label>

      <label>Estado *
        <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
          formControlName="status" />
      </label>

      <label>Prioridad *
        <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
          formControlName="priority" />
      </label>

      <label>Salud
        <p-select [options]="catalogs.get('health-statuses')" optionLabel="name" optionValue="code"
          formControlName="health" [showClear]="true" />
      </label>

      <label>Inicio
        <p-datepicker formControlName="start_date" dateFormat="yy-mm-dd" [showIcon]="true" />
      </label>
      <label>Fin planeado
        <p-datepicker formControlName="planned_end" dateFormat="yy-mm-dd" [showIcon]="true" />
      </label>

      <label>Avance %
        <p-inputNumber formControlName="progress_pct" [min]="0" [max]="1" mode="decimal"
          [minFractionDigits]="2" [maxFractionDigits]="4" />
      </label>

      @if (form.errors?.['endBeforeStart']) {
        <small class="err span-2">El fin planeado no puede ser anterior al inicio.</small>
      }

      <div class="actions span-2">
        <p-button type="submit" label="Guardar" [disabled]="form.invalid || saving()" [loading]="saving()" />
        <p-button label="Cancelar" severity="secondary" (onClick)="router.navigate(['/projects'])" />
      </div>
    </form>
  `,
  styles: [`
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; max-width:720px; }
    label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem; color:#475569; }
    .span-2 { grid-column:span 2; }
    .err { color:var(--pmo-danger); font-size:.75rem; }
    .actions { display:flex; gap:.75rem; }
  `],
})
export class ProjectFormComponent implements OnInit {
  readonly id = input<string>();  // absent on /new, present on /:id/edit (route input binding)

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectService);
  private readonly clientService = inject(ClientService);
  readonly catalogs = inject(CatalogsService);
  readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly clients = signal<Client[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', Validators.required],
      client: ['', Validators.required],
      project_type: ['API', Validators.required],
      status: ['PLANNING', Validators.required],
      priority: ['MEDIUM', Validators.required],
      health: [null as string | null],
      start_date: [null as Date | null],
      planned_end: [null as Date | null],
      progress_pct: [0, [Validators.min(0), Validators.max(1)]],
    },
    { validators: endAfterStart },
  );

  ngOnInit() {
    this.clientService.list({ page_size: 200 }).subscribe((p) => this.clients.set(p.results));
    const id = this.id();
    if (id) {
      this.service.get(id).subscribe((p) =>
        this.form.patchValue({
          ...p,
          health: p.health,
          start_date: p.start_date ? new Date(p.start_date) : null,
          planned_end: p.planned_end ? new Date(p.planned_end) : null,
        }),
      );
    }
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const body: ProjectWrite = {
      ...raw,
      start_date: raw.start_date ? raw.start_date.toISOString() : null,
      planned_end: raw.planned_end ? raw.planned_end.toISOString() : null,
    };
    const id = this.id();
    const req = id ? this.service.update(id, body) : this.service.create(body);
    req.subscribe({
      next: () => { this.notify.success('Proyecto guardado'); this.router.navigate(['/projects']); },
      error: () => this.saving.set(false),
    });
  }
}
