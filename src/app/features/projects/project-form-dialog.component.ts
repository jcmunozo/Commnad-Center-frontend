import { Component, inject, OnInit, output, signal, viewChild } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { forkJoin, of, switchMap } from 'rxjs';

import { ProjectService } from './project.service';
import { PhaseCode, PROJECT_PHASES, Project, ProjectPhase, ProjectWrite } from './project.models';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationService } from '../../core/services/notification.service';
import { LinksPanelComponent } from '../../shared/components/links-panel/links-panel.component';

/** Cross-field validator mirroring the backend: planned_end >= start_date. */
function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('start_date')?.value;
  const end = group.get('planned_end')?.value;
  return start && end && new Date(end) < new Date(start) ? { endBeforeStart: true } : null;
}

/** Create/edit Project as a modal — same pattern as Notes/Tickets/Continuous
 * Improvement: the list's "New" button and the detail page's "Edit" button
 * both call `open()` on this dialog instead of routing to a separate page. */
@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, InputTextModule, InputNumberModule, SelectModule, DatePickerModule,
    ButtonModule, DialogModule, LinksPanelComponent,
  ],
  template: `
    <p-dialog [header]="editingId() ? 'Edit project' : 'New project'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'44rem'}"
      [draggable]="false">
      <form [formGroup]="form" class="form-grid">
        <label>Name *
          <input pInputText formControlName="name" />
          @if (invalid('name')) { <small class="err">Required</small> }
        </label>

        <label class="span-2">Description
          <textarea pInputText formControlName="description" rows="3"></textarea>
        </label>

        <label>Trigger (source system)
          <input pInputText formControlName="trigger_name" placeholder="e.g. SAP ECC" />
        </label>

        <label>Target (target system)
          <input pInputText formControlName="target_name" placeholder="e.g. Salesforce" />
        </label>

        <label>Type *
          <p-select [options]="catalogs.get('project-types')" optionLabel="name" optionValue="code"
            formControlName="project_type" appendTo="body" />
        </label>

        <label>Status *
          <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
            formControlName="status" appendTo="body" />
        </label>

        <label>Priority *
          <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
            formControlName="priority" appendTo="body" />
        </label>

        <label>Health
          <p-select [options]="catalogs.get('health-statuses')" optionLabel="name" optionValue="code"
            formControlName="health" [showClear]="true" appendTo="body" />
        </label>

        <label>Start
          <p-datepicker formControlName="start_date" dateFormat="yy-mm-dd" [showIcon]="true" appendTo="body" />
        </label>
        <label>Planned end
          <p-datepicker formControlName="planned_end" dateFormat="yy-mm-dd" [showIcon]="true" appendTo="body" />
        </label>
        @if (isPlanning()) {
          <small class="hint span-2">Dates can't be set while status is Planning.</small>
        }

        <label>Progress %
          <p-inputNumber formControlName="progress_pct" [min]="0" [max]="100" suffix="%"
            [minFractionDigits]="0" [maxFractionDigits]="2" />
          @if (invalid('progress_pct')) { <small class="err">Must be between 0 and 100</small> }
        </label>

        @if (form.errors?.['endBeforeStart']) {
          <small class="err span-2">Planned end can't be before the start date.</small>
        }

        <fieldset class="span-2 phases" formGroupName="phases">
          <legend>Phase timeline</legend>
          @for (ph of phaseDefs; track ph.code) {
            <div class="phase-row" [class.phase-row--no-end]="ph.noEndDate" [formGroupName]="ph.code">
              <span class="phase-name" [title]="ph.hint">{{ ph.label }}</span>
              <p-datepicker formControlName="start" dateFormat="yy-mm-dd" [showIcon]="true"
                placeholder="Start" [showClear]="true" appendTo="body" />
              @if (!ph.noEndDate) {
                <p-datepicker formControlName="end" dateFormat="yy-mm-dd" [showIcon]="true"
                  placeholder="End" [showClear]="true" appendTo="body" />
              }
            </div>
          }
        </fieldset>

        <div class="field-block span-2">Links
          <app-links-panel ownerType="project" [ownerId]="editingId()" [singleColumn]="true" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="form.invalid || saving()" [loading]="saving()"
          (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding-top:.25rem; }
    label, .field-block { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem; color:var(--pmo-muted); }
    .span-2 { grid-column:span 2; }
    .err { color:var(--pmo-danger); font-size:.75rem; }
    textarea { resize:vertical; font:inherit; }
    .phases { border:1px solid var(--pmo-border); border-radius:var(--radius); padding:1rem; grid-column:span 2; }
    .phases legend { font-size:.8rem; color:var(--pmo-muted); text-transform:uppercase; padding:0 .5rem; }
    .phase-row { display:grid; grid-template-columns:110px 1fr 1fr; gap:.75rem; align-items:center; margin-bottom:.5rem; }
    .phase-name { font-weight:600; font-size:.85rem; }
    .hint { color:var(--pmo-warn); font-size:.78rem; margin:-.5rem 0 0; }
  `],
})
export class ProjectFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectService);
  readonly catalogs = inject(CatalogsService);
  private readonly notify = inject(NotificationService);

  /** Emits the saved project once create/update + phases + links have all
   *  gone through, so the caller (list or detail page) can refresh. */
  readonly saved = output<Project>();

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  /** Planning: the project's dates aren't ours to set yet (may not even happen) —
   *  kept read-only rather than cleared, since the value may already be known. */
  readonly isPlanning = signal(false);
  private readonly linksPanel = viewChild(LinksPanelComponent);

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
    this.syncPlanningLock(this.form.controls.status.value);
    this.form.controls.status.valueChanges.subscribe((status) => this.syncPlanningLock(status));
  }

  /** Opens the dialog: pass a project id to edit it, or `null` to create one. */
  open(id: string | null) {
    this.editingId.set(id);
    this.saving.set(false);
    this.form.reset({
      name: '', description: '', target_name: '', trigger_name: '', project_type: 'API',
      status: 'PLANNING', priority: 'MEDIUM', health: null, start_date: null, planned_end: null,
      progress_pct: 0,
      phases: Object.fromEntries(PROJECT_PHASES.map((ph) => [ph.code, { start: null, end: null }])),
    });

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
    } else {
      this.linksPanel()?.resetDrafts();
    }
    this.dialogOpen.set(true);
  }

  /** Dates stay read-only (not cleared) while status is Planning: a Planning
   *  project's timeline isn't ours to set, but a value already on record
   *  (or one that's simply known ahead of time) shouldn't be wiped. Covers
   *  the top-level dates plus every phase (Dev/SIT/UAT/Hypercare/Prod). */
  private syncPlanningLock(status: string) {
    this.isPlanning.set(status === 'PLANNING');
    const method = status === 'PLANNING' ? 'disable' : 'enable';
    this.form.controls.start_date[method]({ emitEvent: false });
    this.form.controls.planned_end[method]({ emitEvent: false });
    for (const ph of this.phaseDefs) {
      this.form.get(['phases', ph.code])?.[method]({ emitEvent: false });
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

    const id = this.editingId();
    const req = (id ? this.service.update(id, body) : this.service.create(body)).pipe(
      switchMap((p) => {
        const projectId = id ?? p.id;
        return forkJoin([
          of(p),
          this.service.savePhases(projectId, phaseRows),
          this.linksPanel()?.flush(projectId) ?? of(null),
        ]);
      }),
    );
    req.subscribe({
      next: ([p]) => {
        this.notify.success('Project saved');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.saved.emit(p);
      },
      error: () => this.saving.set(false),
    });
  }
}
