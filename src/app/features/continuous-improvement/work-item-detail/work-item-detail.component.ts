import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';

import { WorkItemService } from '../work-item.services';
import { WorkItem, WorkItemWrite } from '../work-item.models';
import { WorkItemTasksTabComponent } from './work-item-tasks-tab.component';
import { WorkItemMilestonesTabComponent } from './work-item-milestones-tab.component';
import { ProjectService } from '../../projects/project.service';
import { Project } from '../../projects/project.models';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

/** Detail page for a single Continuous Improvement work item — same
 * list → click-through → tabs pattern as a Project's detail page, with
 * separate Tasks and Milestones tabs (each with its own badge count)
 * instead of a row dropdown. */
@Component({
  selector: 'app-work-item-detail',
  standalone: true,
  imports: [
    DatePipe, RouterLink, FormsModule, TabsModule, ButtonModule, DialogModule, SelectModule,
    InputTextModule, StatusBadgeComponent, WorkItemTasksTabComponent, WorkItemMilestonesTabComponent,
  ],
  template: `
    @if (workItem(); as wi) {
      <div class="pmo-toolbar">
        <a routerLink="/continuous-improvement" class="back-link" title="Back to Continuous Improvement">
          <i class="pi pi-arrow-left"></i>
        </a>
        <h2>{{ wi.legacy_code }} · {{ wi.title }}</h2>
        <app-status-badge [code]="wi.status" [label]="catalogs.label('project-statuses', wi.status)" />
        <app-status-badge [code]="wi.priority" [label]="catalogs.label('severity-levels', wi.priority)" />
        <span class="spacer"></span>
        @if (canWrite()) {
          <p-button label="Edit" icon="pi pi-pencil" (onClick)="openEdit()" />
        }
      </div>

      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0">Information</p-tab>
          <p-tab value="1">Tasks
            @if (taskCount() !== null) { <span class="tab-badge">{{ taskCount() }}</span> }
          </p-tab>
          <p-tab value="2">Milestones
            @if (milestoneCount() !== null) { <span class="tab-badge">{{ milestoneCount() }}</span> }
          </p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            @if (wi.description) { <p class="description">{{ wi.description }}</p> }
            <dl class="meta">
              <div><dt>Project</dt>
                <dd>
                  @if (wi.project) {
                    <a [routerLink]="['/projects', wi.project]">{{ wi.project_name || wi.project_code }}</a>
                  } @else { <span class="dim">Internal work — no project</span> }
                </dd>
              </div>
              <div><dt>Created</dt><dd>{{ wi.created_at | date }}</dd></div>
            </dl>
          </p-tabpanel>
          <p-tabpanel value="1">
            <app-work-item-tasks-tab [workItemId]="wi.id" (count)="taskCount.set($event)" />
          </p-tabpanel>
          <p-tabpanel value="2">
            <app-work-item-milestones-tab [workItemId]="wi.id" (count)="milestoneCount.set($event)" />
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }

    <p-dialog header="Edit work item" [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)"
      [modal]="true" [style]="{width:'32rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Title *
          <input pInputText [(ngModel)]="formTitle" autocomplete="off" />
        </label>
        <label>Description
          <textarea pInputText [(ngModel)]="formDescription" rows="3"></textarea>
        </label>
        <div class="field-row">
          <label>Status
            <p-select [options]="catalogs.get('project-statuses')" optionLabel="name" optionValue="code"
              [(ngModel)]="formStatus" appendTo="body" />
          </label>
          <label>Priority
            <p-select [options]="catalogs.get('severity-levels')" optionLabel="name" optionValue="code"
              [(ngModel)]="formPriority" appendTo="body" />
          </label>
        </div>
        <label>Project <span class="dim">(only if this traces back to a delivered proxy)</span>
          <p-select [options]="projects()" optionLabel="name" optionValue="id"
            [(ngModel)]="formProject" [showClear]="true" placeholder="No project — internal work"
            [filter]="true" appendTo="body" />
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formTitle.trim() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .back-link { color:var(--pmo-muted); font-size:1rem; }
    .back-link:hover { color:var(--pmo-primary); }
    .tab-badge { display:inline-block; margin-left:.45rem; min-width:1.4rem; text-align:center;
      padding:.05rem .4rem; border-radius:1rem; font-size:.72rem; font-weight:700;
      background:var(--p-green-500, #22c55e); color:#04220f; }
    .description { margin:1.25rem 0 0; max-width:70ch; color:var(--pmo-muted); }
    .meta { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1rem; margin-top:1.5rem; }
    dt { font-size:.75rem; color:var(--pmo-muted); text-transform:uppercase; }
    dd { margin:0; font-weight:600; }
    .dim { font-weight:400; color:var(--pmo-muted); }
    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    textarea { resize:vertical; font:inherit; }
  `],
})
export class WorkItemDetailComponent implements OnInit {
  // Route param bound via withComponentInputBinding().
  readonly id = input.required<string>();

  private readonly service = inject(WorkItemService);
  private readonly projectsSvc = inject(ProjectService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  readonly catalogs = inject(CatalogsService);

  readonly workItem = signal<WorkItem | null>(null);
  readonly projects = signal<Project[]>([]);

  // Contadores emitidos por cada pestaña al cargar su data (badges del tablist).
  readonly taskCount = signal<number | null>(null);
  readonly milestoneCount = signal<number | null>(null);

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly dialogOpen = signal(false);
  readonly saving = signal(false);
  formTitle = '';
  formDescription = '';
  formStatus = 'PLANNING';
  formPriority = 'MEDIUM';
  formProject: string | null = null;

  ngOnInit() {
    this.reload();
    this.projectsSvc.list({ page_size: 200, ordering: 'name' })
      .subscribe((page) => this.projects.set(page.results));
  }

  reload() {
    this.service.get(this.id()).subscribe((wi) => this.workItem.set(wi));
  }

  openEdit() {
    const wi = this.workItem();
    if (!wi) return;
    this.formTitle = wi.title;
    this.formDescription = wi.description ?? '';
    this.formStatus = wi.status;
    this.formPriority = wi.priority;
    this.formProject = wi.project;
    this.dialogOpen.set(true);
  }

  save() {
    if (!this.formTitle.trim()) return;
    this.saving.set(true);
    const body: WorkItemWrite = {
      title: this.formTitle.trim(),
      description: this.formDescription,
      status: this.formStatus,
      priority: this.formPriority,
      project: this.formProject,
    };
    this.service.update(this.id(), body).subscribe({
      next: () => {
        this.notify.success('Work item updated');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }
}
