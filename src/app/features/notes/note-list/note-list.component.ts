import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';

import { NoteService } from '../note.service';
import {
  Note, NoteWrite, NOTE_CATEGORIES, NOTE_PRIORITIES, dueState,
} from '../note.models';
import { ProjectService } from '../../projects/project.service';
import { Project } from '../../projects/project.models';
import { NotificationService } from '../../../core/services/notification.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STATUS_TOGGLE = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'All', value: 'ALL' },
];

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [
    DatePipe, FormsModule, TableModule, InputTextModule, ButtonModule,
    SelectModule, SelectButtonModule, DialogModule, DatePickerModule,
    CheckboxModule, StatusBadgeComponent,
  ],
  template: `
    <div class="pmo-toolbar">
      <h2>My notes</h2>
      <span class="spacer"></span>
      <input pInputText placeholder="Search…" [(ngModel)]="searchTerm" (input)="onSearch()" />
      <p-select [options]="categoryOptions" [(ngModel)]="categoryFilter" (onChange)="reload()"
        placeholder="Category" [showClear]="true" optionLabel="name" optionValue="code" />
      <p-select [options]="priorityOptions" [(ngModel)]="priorityFilter" (onChange)="reload()"
        placeholder="Priority" [showClear]="true" optionLabel="name" optionValue="code" />
      <p-selectbutton [options]="statusToggle" [(ngModel)]="statusFilter"
        (onChange)="reload()" [allowEmpty]="false" optionLabel="label" optionValue="value" />
      <p-button label="New note" icon="pi pi-plus" (onClick)="openCreate()" />
    </div>

    <p-table [value]="rows()" [lazy]="true" (onLazyLoad)="onLazyLoad($event)"
      [paginator]="true" [rows]="pageSize" [totalRecords]="total()"
      [loading]="loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:3rem"></th>
          <th>Code</th>
          <th pSortableColumn="title">Title</th>
          <th>Content</th>
          <th>Category</th>
          <th>Priority</th>
          <th>Project</th>
          <th pSortableColumn="due_date">Due date</th>
          <th pSortableColumn="created_at">Created</th>
          <th style="width:8rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-n>
        <tr [class.row--done]="n.status === 'COMPLETED'">
          <td>
            <button type="button" class="icon-btn" [class.pin--on]="n.pinned"
              [title]="n.pinned ? 'Unpin' : 'Pin'" (click)="togglePin(n)">
              <i class="pi" [class.pi-bookmark-fill]="n.pinned"
                [class.pi-bookmark]="!n.pinned"></i></button>
          </td>
          <td class="note-code">{{ n.legacy_code }}</td>
          <td>{{ n.title }}</td>
          <td class="note-content-cell" [title]="n.content">{{ n.content || '—' }}</td>
          <td><app-status-badge [code]="n.category" [label]="label(categoryOptions, n.category)" /></td>
          <td><app-status-badge [code]="n.priority" [label]="label(priorityOptions, n.priority)" /></td>
          <td>{{ n.project_name || '—' }}</td>
          <td>
            @if (n.due_date) {
              <span class="due" [class.due--overdue]="due(n) === 'overdue'"
                [class.due--upcoming]="due(n) === 'upcoming'">
                @if (due(n) === 'overdue') { <i class="pi pi-exclamation-circle"></i> }
                @else if (due(n) === 'upcoming') { <i class="pi pi-clock"></i> }
                {{ n.due_date | date:'dd/MM/yyyy' }}
              </span>
            } @else { — }
          </td>
          <td>{{ n.created_at | date:'dd/MM/yyyy' }}</td>
          <td class="row-actions">
            <button type="button" class="icon-btn"
              [title]="n.status === 'COMPLETED' ? 'Reopen' : 'Mark as completed'"
              (click)="toggleStatus(n)">
              <i class="pi" [class.pi-check-circle]="n.status !== 'COMPLETED'"
                [class.pi-replay]="n.status === 'COMPLETED'"></i></button>
            <button type="button" class="icon-btn" title="Edit" (click)="openEdit(n)">
              <i class="pi pi-pencil"></i></button>
            <button type="button" class="icon-btn icon-btn--danger" title="Archive"
              (click)="archive(n)"><i class="pi pi-trash"></i></button>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="9">No notes.</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editingId() ? 'Edit note' : 'New note'"
      [visible]="dialogOpen()" (visibleChange)="dialogOpen.set($event)" [modal]="true"
      [style]="{width:'34rem'}" [draggable]="false">
      <div class="dialog-form">
        <label>Title *
          <input pInputText [(ngModel)]="formTitle" autocomplete="off" />
        </label>
        <label>Content
          <textarea pInputText [(ngModel)]="formContent" rows="4"></textarea>
        </label>
        <div class="field-row">
          <label>Category
            <p-select [options]="categoryOptions" optionLabel="name" optionValue="code"
              [(ngModel)]="formCategory" appendTo="body" />
          </label>
          <label>Priority
            <p-select [options]="priorityOptions" optionLabel="name" optionValue="code"
              [(ngModel)]="formPriority" appendTo="body" />
          </label>
        </div>
        <div class="field-row">
          <label>Due date
            <p-datepicker [(ngModel)]="formDue" dateFormat="yy-mm-dd" [showIcon]="true"
              [showClear]="true" appendTo="body" />
          </label>
          <label>Project
            <p-select [options]="projects()" optionLabel="name" optionValue="id"
              [(ngModel)]="formProject" [showClear]="true" placeholder="No project"
              [filter]="true" appendTo="body" />
          </label>
        </div>
        <label class="pin-check">
          <p-checkbox [(ngModel)]="formPinned" [binary]="true" inputId="notePinned" />
          <span>Pin this note (shows on the dashboard)</span>
        </label>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [disabled]="!formValid() || saving()"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .spacer { flex:1; }
    .pmo-toolbar input, .pmo-toolbar p-select { min-width:150px; }
    .note-code { font-variant-numeric:tabular-nums; font-weight:600; }
    .row--done { opacity:.55; }
    .row-actions { white-space:nowrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.25rem .4rem; font-size:.9rem; }
    .icon-btn:hover { color:var(--pmo-primary); }
    .note-content-cell { max-width:20rem; white-space:pre-wrap; word-break:break-word;
      color:var(--pmo-muted); font-size:.85rem; }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .pin--on { color:var(--pmo-primary); }
    .due { white-space:nowrap; }
    .due--overdue { color:var(--pmo-danger); font-weight:600; }
    .due--upcoming { color:#fab219; }
    .dialog-form { display:flex; flex-direction:column; gap:1rem; padding-top:.25rem; }
    .dialog-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .pin-check { flex-direction:row !important; align-items:center; gap:.5rem !important; }
    textarea { resize:vertical; font:inherit; }
  `],
})
export class NoteListComponent implements OnInit {
  private readonly service = inject(NoteService);
  private readonly projectsSvc = inject(ProjectService);
  private readonly notify = inject(NotificationService);

  readonly rows = signal<Note[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly projects = signal<Project[]>([]);

  readonly categoryOptions = NOTE_CATEGORIES;
  readonly priorityOptions = NOTE_PRIORITIES;
  readonly statusToggle = STATUS_TOGGLE;
  readonly due = dueState;

  searchTerm = '';
  categoryFilter: string | null = null;
  priorityFilter: string | null = null;
  statusFilter = 'OPEN';
  pageSize = 25;
  private page = 1;
  private ordering = '-pinned,-created_at';
  private searchTimer?: ReturnType<typeof setTimeout>;

  // formulario del diálogo
  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  formTitle = '';
  formContent = '';
  formCategory = 'TODO';
  formPriority = 'MEDIUM';
  formDue: Date | null = null;
  formProject: string | null = null;
  formPinned = false;

  ngOnInit() {
    this.reload();
    this.projectsSvc.list({ page_size: 200, ordering: 'name' })
      .subscribe((page) => this.projects.set(page.results));
  }

  label(options: { code: string; name: string }[], code: string) {
    return options.find((o) => o.code === code)?.name ?? code;
  }

  reload() {
    this.loading.set(true);
    this.service.list({
      page: this.page, page_size: this.pageSize, ordering: this.ordering,
      search: this.searchTerm || undefined,
      status: this.statusFilter === 'ALL' ? undefined : this.statusFilter,
      category: this.categoryFilter ?? undefined,
      priority: this.priorityFilter ?? undefined,
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
      : '-pinned,-created_at';
    this.reload();
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.reload(); }, 300);
  }

  togglePin(n: Note) {
    this.service.update(n.id, { pinned: !n.pinned }).subscribe(() => this.reload());
  }

  toggleStatus(n: Note) {
    const status = n.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    this.service.update(n.id, { status }).subscribe(() => {
      this.notify.success(status === 'COMPLETED' ? 'Note completed' : 'Note reopened');
      this.reload();
    });
  }

  formValid() {
    return this.formTitle.trim().length > 0;
  }

  openCreate() {
    this.editingId.set(null);
    this.formTitle = '';
    this.formContent = '';
    this.formCategory = 'TODO';
    this.formPriority = 'MEDIUM';
    this.formDue = null;
    this.formProject = null;
    this.formPinned = false;
    this.dialogOpen.set(true);
  }

  openEdit(n: Note) {
    this.editingId.set(n.id);
    this.formTitle = n.title;
    this.formContent = n.content;
    this.formCategory = n.category;
    this.formPriority = n.priority;
    this.formDue = n.due_date ? new Date(`${n.due_date}T00:00:00`) : null;
    this.formProject = n.project;
    this.formPinned = n.pinned;
    this.dialogOpen.set(true);
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const body: NoteWrite = {
      title: this.formTitle.trim(),
      content: this.formContent,
      category: this.formCategory,
      priority: this.formPriority,
      due_date: this.formDue ? iso(this.formDue) : null,
      project: this.formProject,
      pinned: this.formPinned,
    };
    const id = this.editingId();
    const upsert$ = id ? this.service.update(id, body) : this.service.create(body);
    upsert$.subscribe({
      next: () => {
        this.notify.success(id ? 'Note updated' : 'Note created');
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  archive(n: Note) {
    if (!confirm(`Archive note "${n.title}"?`)) return;
    this.service.remove(n.id).subscribe(() => {
      this.notify.success('Note archived');
      this.reload();
    });
  }
}
