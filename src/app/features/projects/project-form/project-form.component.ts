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

import { forkJoin, of, switchMap } from 'rxjs';

import { ProjectService } from '../project.service';
import { PhaseCode, PROJECT_PHASES, ProjectPhase, ProjectWrite } from '../project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
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
    <div class="pmo-toolbar"><h2>{{ id() ? 'Edit' : 'New' }} project</h2></div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
      <label>Name *
        <input pInputText formControlName="name" />
        @if (invalid('name')) { <small class="err">Requerido</small> }
      </label>

      <label class="span-2">Description
        <textarea pInputText formControlName="description" rows="3"></textarea>
      </label>

      <label>Trigger (sistema origen)
        <input pInputText formControlName="trigger_name" placeholder="e.g. SAP ECC" />
      </label>

      <label>Target (sistema objetivo)
        <input pInputText formControlName="target_name" placeholder="e.g. Salesforce" />
      </label>

      <label>Type *
        <p-select [options]="catalogs.get('project-types')" optionLabel="name" optionValue="code"
          formControlName="project_type" />
      </label>

      <label>Status *
        <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
          formControlName="status" />
      </label>

      <label>Priority *
        <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
          formControlName="priority" />
      </label>

      <label>Health
        <p-select [options]="catalogs.get('health-statuses')" optionLabel="name" optionValue="code"
          formControlName="health" [showClear]="true" />
      </label>

      <label>Start
        <p-datepicker formControlName="start_date" dateFormat="yy-mm-dd" [showIcon]="true" />
      </label>
      <label>Planned end
        <p-datepicker formControlName="planned_end" dateFormat="yy-mm-dd" [showIcon]="true" />
      </label>

      <label>Progress %
        <p-inputNumber formControlName="progress_pct" [min]="0" [max]="100" suffix="%"
          [minFractionDigits]="0" [maxFractionDigits]="2" />
        @if (invalid('progress_pct')) { <small class="err">Debe estar entre 0 y 100</small> }
      </label>

      @if (form.errors?.['endBeforeStart']) {
        <small class="err span-2">El fin planeado no puede ser anterior al inicio.</small>
      }

      <fieldset class="span-2 phases" formGroupName="phases">
        <legend>Timeline de fases</legend>
        @for (ph of phaseDefs; track ph.code) {
          <div class="phase-row" [formGroupName]="ph.code">
            <span class="phase-name" [title]="ph.hint">{{ ph.label }}</span>
            <p-datepicker formControlName="start" dateFormat="yy-mm-dd" [showIcon]="true"
              placeholder="Start" [showClear]="true" />
            <p-datepicker formControlName="end" dateFormat="yy-mm-dd" [showIcon]="true"
              placeholder="End" [showClear]="true" />
          </div>
        }
      </fieldset>

      <div class="actions span-2">
        <p-button type="submit" label="Save" [disabled]="form.invalid || saving()" [loading]="saving()" />
        <p-button label="Cancel" severity="secondary" (onClick)="router.navigate(['/projects'])" />
      </div>
    </form>
  `,
  styles: [`
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; max-width:720px; }
    label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem; color:var(--pmo-muted); }
    .span-2 { grid-column:span 2; }
    .err { color:var(--pmo-danger); font-size:.75rem; }
    .actions { display:flex; gap:.75rem; }
    textarea { resize:vertical; font:inherit; }
    .phases { border:1px solid var(--pmo-border); border-radius:var(--radius); padding:1rem; }
    .phases legend { font-size:.8rem; color:var(--pmo-muted); text-transform:uppercase; padding:0 .5rem; }
    .phase-row { display:grid; grid-template-columns:110px 1fr 1fr; gap:.75rem; align-items:center; margin-bottom:.5rem; }
    .phase-name { font-weight:600; font-size:.85rem; }
  `],
})
export class ProjectFormComponent implements OnInit {
  readonly id = input<string>();  // absent on /new, present on /:id/edit (route input binding)

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectService);
  readonly catalogs = inject(CatalogsService);
  readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly saving = signal(false);

  readonly phaseDefs = PROJECT_PHASES;

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', Validators.required],
      description: [''],
      target_name: [''],
      trigger_name: [''],
      project_type: ['API', Validators.required],
      status: ['PLANNING', Validators.required],
      priority: ['MEDIUM', Validators.required],
      health: [null as string | null],
      start_date: [null as Date | null],
      planned_end: [null as Date | null],
      progress_pct: [0, [Validators.min(0), Validators.max(100)]],
      phases: this.fb.group(
        Object.fromEntries(PROJECT_PHASES.map((ph) => [
          ph.code,
          this.fb.group({ start: [null as Date | null], end: [null as Date | null] }),
        ])),
      ),
    },
    { validators: endAfterStart },
  );

  ngOnInit() {
    const id = this.id();
    if (id) {
      this.service.get(id).subscribe(({ phases: _phases, ...p }) =>
        this.form.patchValue({
          ...p,
          health: p.health,
          start_date: p.start_date ? new Date(p.start_date) : null,
          planned_end: p.planned_end ? new Date(p.planned_end) : null,
          progress_pct: Math.round((p.progress_pct ?? 0) * 100 * 100) / 100,
        }),
      );
      this.service.phases(id).subscribe((rows) => {
        for (const row of rows) {
          this.form.get(['phases', row.phase])?.patchValue({
            start: row.planned_start ? new Date(row.planned_start) : null,
            end: row.planned_end ? new Date(row.planned_end) : null,
          });
        }
      });
    }
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const { phases, ...raw } = this.form.getRawValue();
    const body: ProjectWrite = {
      ...raw,
      start_date: raw.start_date ? raw.start_date.toISOString() : null,
      planned_end: raw.planned_end ? raw.planned_end.toISOString() : null,
      progress_pct: Math.round(raw.progress_pct) / 100,
    };
    const phaseRows: ProjectPhase[] = this.phaseDefs
      .map((ph) => ({ code: ph.code, ...phases[ph.code] }))
      .filter((row) => row.start || row.end)
      .map((row) => ({
        phase: row.code as PhaseCode,
        planned_start: row.start ? row.start.toISOString() : null,
        planned_end: row.end ? row.end.toISOString() : null,
      }));

    const id = this.id();
    const req = (id ? this.service.update(id, body) : this.service.create(body)).pipe(
      switchMap((p) => forkJoin([of(p), this.service.savePhases(id ?? p.id, phaseRows)])),
    );
    req.subscribe({
      next: () => { this.notify.success('Project guardado'); this.router.navigate(['/projects']); },
      error: () => this.saving.set(false),
    });
  }
}
