import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { of, switchMap } from 'rxjs';

import { TicketService } from '../ticket.service';
import { Ticket, TicketWrite } from '../ticket.models';
import { EmployeeService, Employee } from '../../team/employee.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LinksPanelComponent } from '../../../shared/components/links-panel/links-panel.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, TableModule, InputTextModule,
    ButtonModule, SelectModule, DialogModule, StatusBadgeComponent, LinksPanelComponent,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>Tickets</h2>
      <span class="spacer"></span>
      <input pInputText placeholder="Search…" [(ngModel)]="searchTerm" (input)="onSearch()" />
      <p-select [options]="statusOptions" [(ngModel)]="statusFilter" (onChange)="reload()"
        placeholder="Status" [showClear]="true" optionLabel="name" optionValue="code" />
      <p-select [options]="devOptions()" [(ngModel)]="assigneeFilter" (onChange)="reload()"
        placeholder="Developer" [showClear]="true" optionLabel="name" optionValue="id" />
      @if (canManage()) {
        <p-button label="New ticket" icon="pi pi-plus" (onClick)="openCreate()" />
      }
    </div>

    <p-table [value]="rows()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="pageSize" [totalRecords]="total()"
      [loading]="loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th>#</th>
          <th pSortableColumn="ticket_number">Ticket #</th>
          <th>Name</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Developer</th>
          <th>Invested hours</th>
          <th pSortableColumn="created_at">Created</th>
          @if (canManage()) { <th style="width:6rem"></th> }
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-t let-rowIndex="rowIndex">
        <tr class="row--clickable" [class.row--archived]="t.is_active === false" (click)="openView(t)">
          <td>{{ rowIndex + 1 }}</td>
          <td class="ticket-number">{{ t.ticket_number }}</td>
          <td>
            {{ t.name }}
            @if (t.is_active === false) { <span class="archived-tag">Archived</span> }
          </td>
          <td><app-status-badge [code]="t.priority" [label]="catalogs.label('severity-levels', t.priority)" /></td>
          <td><app-status-badge [code]="t.status" [label]="catalogs.label('ticket-statuses', t.status)" /></td>
          <td>{{ t.assignee_name || '—' }}</td>
          <td>{{ t.invested_hours | number:'1.0-1' }}h</td>
          <td>{{ t.created_at | date:'dd/MM/yyyy' }}</td>
          @if (canManage()) {
            <td class="row-actions">
              <button type="button" class="icon-btn" title="Edit" (click)="$event.stopPropagation(); openEdit(t)">
                <i class="pi pi-pencil"></i></button>
              @if (t.is_active !== false) {
                <button type="button" class="icon-btn icon-btn--danger" title="Archive"
                  (click)="$event.stopPropagation(); archive(t)"><i class="pi pi-trash"></i></button>
              }
            </td>
          }
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="canManage() ? 9 : 8">No tickets.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editingId() ? 'Edit ticket' : 'New ticket'"
      [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)" [modal]="true"
      [style]="{width:'34rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Ticket # *
          <input pInputText [(ngModel)]="formNumber" autocomplete="off"
            placeholder="e.g. INC-2026-0042" />
        </label>
        <label>Name *
          <input pInputText [(ngModel)]="formName" autocomplete="off" />
        </label>
        <label>Description (projects/services involved)
          <textarea pInputText [(ngModel)]="formDescription" rows="4"></textarea>
        </label>
        <label>Priority *
          <p-select [options]="priorityOptions" optionLabel="name" optionValue="code"
            [(ngModel)]="formPriority" placeholder="Select" appendTo="body" />
        </label>
        <label>Status
          <p-select [options]="statusOptions" optionLabel="name" optionValue="code"
            [(ngModel)]="formStatus" appendTo="body" />
        </label>
        <label>Developer
          <p-select [options]="devOptions()" optionLabel="name" optionValue="id"
            [(ngModel)]="formAssignee" [showClear]="true" placeholder="Unassigned"
            appendTo="body" />
        </label>
        <div class="field-block">Links
          <app-links-panel ownerType="ticket" [ownerId]="editingId()" [singleColumn]="true" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formValid() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <!-- Read-only detail view: opened by clicking a row, no editing here. -->
    <p-dialog header="Ticket details" [visible]="viewOpen()" (visibleChange)="viewOpen.set($event)"
      [modal]="true" [dismissableMask]="true" [style]="{width:'34rem'}" [draggable]="false">
      @if (viewing(); as t) {
        <div class="view-grid">
          <div class="view-row"><span class="vlabel">Ticket #</span><span>{{ t.ticket_number }}</span></div>
          <div class="view-row"><span class="vlabel">Name</span><span>{{ t.name }}</span></div>
          <div class="view-row">
            <span class="vlabel">Priority</span>
            <app-status-badge [code]="t.priority" [label]="catalogs.label('severity-levels', t.priority)" />
          </div>
          <div class="view-row">
            <span class="vlabel">Status</span>
            <app-status-badge [code]="t.status" [label]="catalogs.label('ticket-statuses', t.status)" />
          </div>
          <div class="view-row"><span class="vlabel">Developer</span><span>{{ t.assignee_name || '—' }}</span></div>
          <div class="view-row"><span class="vlabel">Invested hours</span><span>{{ t.invested_hours | number:'1.0-1' }}h</span></div>
          <div class="view-row"><span class="vlabel">Created</span><span>{{ t.created_at | date:'dd/MM/yyyy' }}</span></div>
          <div class="view-row"><span class="vlabel">Archived</span><span>{{ t.is_active === false ? 'Yes' : 'No' }}</span></div>
          <div class="view-row span-2">
            <span class="vlabel">Description</span>
            <p class="view-content">{{ viewDescription() === null ? 'Loading…' : (viewDescription() || '—') }}</p>
          </div>
          <div class="view-row span-2">
            <span class="vlabel">Links</span>
            <app-links-panel ownerType="ticket" [ownerId]="t.id" [viewOnly]="true" [singleColumn]="true" />
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button label="Close" severity="secondary" (onClick)="viewOpen.set(false)" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .pmo-toolbar input, .pmo-toolbar p-select { min-width:160px; }
    .ticket-number { font-variant-numeric:tabular-nums; font-weight:600; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .row--archived { opacity:.6; }
    .row--clickable { cursor:pointer; }
    .row--clickable:hover { background:var(--surface-bg); }
    .archived-tag { margin-left:.5rem; padding:.05rem .5rem; border-radius:1rem;
      font-size:.72rem; font-weight:600; text-transform:uppercase; letter-spacing:.03em;
      background:rgba(220,38,38,.12); color:var(--pmo-danger); }
    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label, .dialog-form .field-block { display:flex; flex-direction:column; gap:.35rem;
      font-size:.85rem; color:var(--pmo-muted); }
    textarea { resize:vertical; font:inherit; }
    .view-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding-top:.25rem; }
    .view-row { display:flex; flex-direction:column; gap:.3rem; min-width:0; }
    .view-row.span-2 { grid-column:span 2; }
    .vlabel { font-size:.75rem; text-transform:uppercase; letter-spacing:.03em; color:var(--pmo-muted); }
    .view-content { margin:0; white-space:pre-wrap; word-break:break-word; font-size:.9rem; }
  `],
})
export class TicketListComponent implements OnInit {
  private readonly service = inject(TicketService);
  private readonly employees = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthStore);
  private readonly linksPanel = viewChild(LinksPanelComponent);
  readonly catalogs = inject(CatalogsService);

  readonly rows = signal<Ticket[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly devs = signal<Employee[]>([]);
  readonly devOptions = computed(() => this.devs());

  readonly canManage = computed(() => this.auth.hasAnyRole(['PMO Admin', 'Project Manager']));

  get statusOptions() { return this.catalogs.get('ticket-statuses'); }
  get priorityOptions() { return this.catalogs.get('severity-levels'); }

  searchTerm = '';
  statusFilter: string | null = null;
  assigneeFilter: string | null = null;
  pageSize = 25;
  private page = 1;
  private ordering = '-created_at';
  private searchTimer?: ReturnType<typeof setTimeout>;

  // formulario del diálogo
  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  formNumber = '';
  formName = '';
  formDescription = '';
  formPriority: string | null = null;
  formStatus = 'WIP';
  formAssignee: string | null = null;

  // read-only detail view, opened by clicking a row
  readonly viewOpen = signal(false);
  readonly viewing = signal<Ticket | null>(null);
  /** null while the detail (description) is still being fetched. */
  readonly viewDescription = signal<string | null>(null);

  ngOnInit() {
    this.reload();
    this.employees.list({ page_size: 200, ordering: 'name' })
      .subscribe((page) => this.devs.set(page.results));
  }

  reload() {
    this.loading.set(true);
    this.service.list({
      page: this.page, page_size: this.pageSize, ordering: this.ordering,
      search: this.searchTerm || undefined,
      status: this.statusFilter ?? undefined,
      assignee: this.assigneeFilter ?? undefined,
    }).subscribe({
      next: (page) => {
        this.rows.set(page.results);
        this.total.set(page.count);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onLazyLoad(e: TableLazyLoadEvent) {
    this.pageSize = e.rows ?? 25;
    this.page = Math.floor((e.first ?? 0) / this.pageSize) + 1;
    this.ordering = e.sortField
      ? `${e.sortOrder === -1 ? '-' : ''}${e.sortField}`
      : '-created_at';
    this.reload();
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.reload(); }, 300);
  }

  formValid() {
    return this.formNumber.trim() && this.formName.trim() && this.formPriority;
  }

  openCreate() {
    this.editingId.set(null);
    this.formNumber = '';
    this.formName = '';
    this.formDescription = '';
    this.formPriority = null;
    this.formStatus = 'WIP';
    this.formAssignee = null;
    this.linksPanel()?.resetDrafts();
    this.dialogOpen.set(true);
  }

  openView(t: Ticket) {
    this.viewing.set(t);
    this.viewDescription.set(null);
    this.viewOpen.set(true);
    // The list serializer doesn't include description: fetch the detail for it.
    this.service.get(t.id).subscribe((full) => {
      if (this.viewing()?.id !== t.id) return;
      this.viewDescription.set(full.description ?? '');
    });
  }

  openEdit(t: Ticket) {
    this.editingId.set(t.id);
    this.formNumber = t.ticket_number;
    this.formName = t.name;
    this.formPriority = t.priority;
    this.formStatus = t.status;
    this.formAssignee = t.assignee;
    this.formDescription = '';
    this.dialogOpen.set(true);
    // la descripción solo viene en el detalle
    this.service.get(t.id).subscribe((full) => {
      if (this.editingId() === t.id) this.formDescription = full.description ?? '';
    });
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const body: TicketWrite = {
      ticket_number: this.formNumber.trim(),
      name: this.formName.trim(),
      description: this.formDescription,
      priority: this.formPriority!,
      status: this.formStatus,
      assignee: this.formAssignee,
    };
    const id = this.editingId();
    const upsert$ = (id ? this.service.update(id, body) : this.service.create(body)).pipe(
      switchMap((t) => this.linksPanel()?.flush(id ?? t.id) ?? of(null)),
    );
    upsert$.subscribe({
      next: () => {
        this.notify.success(id ? 'Ticket updated' : 'Ticket created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  archive(t: Ticket) {
    this.confirm.danger(
      `Archive ticket ${t.ticket_number} "${t.name}"?`,
      () => this.service.remove(t.id).subscribe(() => {
        this.notify.success('Ticket archived');
        this.reload();
      }),
      { header: 'Archive ticket', acceptLabel: 'Archive' },
    );
  }
}
