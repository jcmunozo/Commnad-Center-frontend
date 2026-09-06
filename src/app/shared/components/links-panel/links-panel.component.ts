import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Observable, forkJoin, of } from 'rxjs';

import { LinkService } from '../../../core/services/link.service';
import { Link, LinkOwnerType, LinkWrite } from '../../models/link';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Row shape shared by a persisted `Link` and a not-yet-saved draft one. */
interface LinkRow {
  id: string;
  url: string;
  label: string;
  description: string;
}

/** Reusable "reference links" list (Confluence, Swagger, Drive, a design
 * doc…) for whichever of the 4 owner types the embedding page passes —
 * project/ticket/CI documentation was scattered across different links
 * with no single place to find them all. A Note's own links stay open to
 * any authenticated user (mirrors NoteViewSet; the backend enforces it's
 * only their own note).
 *
 * `ownerId` may be null — used on a create form before the owning record
 * has been saved. Links added then are kept as local drafts (not
 * persisted yet); the embedding page calls `flush(newOwnerId)` right
 * after it creates the owning record, which posts every draft to the API
 * in one go. Call `resetDrafts()` when reopening the form for a *new*
 * record (a dialog instance is reused, so stale drafts would otherwise
 * leak into the next create). */
@Component({
  selector: 'app-links-panel',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule],
  template: `
    <div class="links-panel">
      @if (rows().length) {
        <ul class="links-list" [class.links-list--single]="singleColumn()">
          @for (l of rows(); track l.id) {
            <li class="link-card">
              <span class="link-icon"><i class="pi pi-link"></i></span>
              <div class="link-info">
                <a [href]="l.url" target="_blank" rel="noopener noreferrer">
                  <span class="link-title">{{ l.label || hostOf(l.url) }}</span>
                  <i class="pi pi-arrow-up-right link-ext"></i>
                </a>
                @if (l.description) { <p class="link-desc">{{ l.description }}</p> }
                @if (l.label) { <span class="link-url">{{ hostOf(l.url) }}</span> }
              </div>
              @if (canWrite()) {
                <div class="link-actions">
                  <button type="button" class="icon-btn" title="Edit link" (click)="openEdit(l)">
                    <i class="pi pi-pencil"></i></button>
                  <button type="button" class="icon-btn icon-btn--danger" title="Remove link"
                    (click)="remove(l)"><i class="pi pi-trash"></i></button>
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="empty">
          <i class="pi pi-link"></i>
          <p>No links yet.</p>
        </div>
      }

      @if (canWrite()) {
        <button type="button" class="add-link-btn" (click)="openAdd()">
          <i class="pi pi-plus"></i> Add link
        </button>
      }
    </div>

    <p-dialog [header]="editingId() ? 'Edit link' : 'Add link'" [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)" [modal]="true" [style]="{width:'28rem'}"
      [draggable]="false" appendTo="body">
      <div class="link-form">
        <label>URL *
          <input pInputText placeholder="https://…" [(ngModel)]="formUrl" autocomplete="off" />
        </label>
        <label>Name
          <input pInputText placeholder="Optional" [(ngModel)]="formLabel" autocomplete="off" />
        </label>
        <label class="span-2">Description
          <textarea pInputText placeholder="Optional" rows="3" [(ngModel)]="formDescription"></textarea>
        </label>
        @if (error()) { <small class="err span-2">{{ error() }}</small> }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="dialogOpen.set(false)" />
        <p-button label="Save" [loading]="saving()" [disabled]="!formUrl.trim() || saving()"
          (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display:block; width:100%; }
    .links-panel { display:flex; flex-direction:column; gap:.65rem; align-items:stretch; }

    /* Page context (full-width section, not a dialog): a 4-per-row grid that
       stretches to fill whatever width the page gives it — no artificial cap,
       so it doesn't end up cornered on a wide screen. */
    .links-list { list-style:none; margin:0; padding:0; display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr)); gap:.75rem; }
    @media (max-width: 900px) {
      .links-list { grid-template-columns:repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 520px) {
      .links-list { grid-template-columns:1fr; }
    }
    /* Dialog context: a narrow modal can't fit 4 columns without squeezing
       each card unreadably — one full-width column instead, and no line-clamp
       on the description since there's now room to show it in full. */
    .links-list.links-list--single { grid-template-columns:1fr; }
    .links-list--single .link-desc { display:block; overflow:visible; }

    .link-card {
      display:flex; align-items:flex-start; gap:.75rem;
      padding:.85rem 1rem; border-radius:var(--radius);
      border:1px solid var(--pmo-border); background:var(--pmo-surface);
      transition:border-color .15s ease, box-shadow .15s ease, transform .1s ease;
      min-width:0;
    }
    .link-card:hover {
      border-color:var(--pmo-primary);
      box-shadow:0 2px 10px -4px rgba(0,0,0,.18);
    }

    .link-icon {
      display:flex; align-items:center; justify-content:center;
      width:2.4rem; height:2.4rem; min-width:2.4rem; border-radius:50%;
      background:color-mix(in srgb, var(--pmo-primary) 14%, transparent);
      color:var(--pmo-primary); font-size:1rem;
    }

    .link-info { display:flex; flex-direction:column; gap:.3rem; min-width:0; flex:1; overflow:hidden; }
    .link-info a { display:inline-flex; align-items:center; gap:.4rem; min-width:0;
      color:var(--pmo-text); font-weight:600; font-size:1rem; }
    .link-info a:hover { color:var(--pmo-primary); }
    .link-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .link-ext { font-size:.7rem; color:var(--pmo-muted); flex-shrink:0; }
    .link-desc {
      margin:0; color:var(--pmo-muted); font-size:.82rem; line-height:1.45;
      overflow-wrap:anywhere; word-break:break-word;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
    }
    .link-url { color:var(--pmo-muted); font-size:.75rem; overflow-wrap:anywhere; }

    .link-actions { display:flex; gap:.15rem; flex-shrink:0; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      width:2rem; height:2rem; border-radius:6px; font-size:.9rem;
      display:flex; align-items:center; justify-content:center; transition:background .15s, color .15s; }
    .icon-btn:hover { background:var(--surface-bg); color:var(--pmo-primary); }
    .icon-btn--danger:hover { color:var(--pmo-danger); }

    .empty {
      display:flex; flex-direction:column; align-items:center; gap:.5rem;
      padding:1.75rem 1.5rem; max-width:300px; border-radius:var(--radius);
      border:1px dashed var(--pmo-border); color:var(--pmo-muted);
    }
    .empty .pi-link { font-size:1.4rem; opacity:.6; }
    .empty p { margin:0; font-size:.88rem; }

    .add-link-btn {
      display:inline-flex; align-items:center; gap:.45rem; align-self:flex-start;
      padding:.55rem 1.1rem; border-radius:var(--radius);
      border:1px solid var(--pmo-border); background:transparent;
      color:var(--pmo-primary); font-size:.85rem; font-weight:600; cursor:pointer;
      transition:background .15s, border-color .15s;
    }
    .add-link-btn:hover { background:color-mix(in srgb, var(--pmo-primary) 10%, transparent);
      border-color:var(--pmo-primary); }

    .link-form { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:.9rem;
      padding-top:.25rem; }
    .link-form label { display:flex; flex-direction:column; gap:.35rem; font-size:.85rem;
      color:var(--pmo-muted); min-width:0; }
    .link-form input, .link-form textarea { width:100%; box-sizing:border-box; }
    .span-2 { grid-column:span 2; }
    textarea { resize:vertical; font:inherit; }
    .err { color:var(--pmo-danger); font-size:.78rem; }
  `],
})
export class LinksPanelComponent implements OnChanges {
  readonly ownerType = input.required<LinkOwnerType>();
  readonly ownerId = input<string | null>(null);
  /** Read-only display — used by a "view details" dialog that isn't meant
   *  to let the viewer edit anything, regardless of role/note-ownership. */
  readonly viewOnly = input(false);
  /** Lay links out in one full-width column instead of the 4-per-row grid —
   *  set this whenever the panel sits inside a `p-dialog`, since a narrow
   *  modal can't fit 4 columns without squeezing each card unreadably.
   *  Independent of `viewOnly`: an edit dialog still needs single-column too. */
  readonly singleColumn = input(false);
  readonly count = output<number>();

  private readonly service = inject(LinkService);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  // Notes are personal and open to any authenticated user regardless of
  // role (same as NoteViewSet) — everything else follows Task/SubTask's bar.
  readonly canWrite = computed(() => !this.viewOnly() && (
    this.ownerType() === 'note' || this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member'])));

  readonly links = signal<Link[]>([]);
  /** Not-yet-persisted links added before the owning record exists. */
  readonly draftLinks = signal<LinkRow[]>([]);
  readonly rows = computed<LinkRow[]>(() => (this.ownerId() ? this.links() : this.draftLinks()));

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  formUrl = '';
  formLabel = '';
  formDescription = '';

  ngOnChanges() {
    if (this.ownerId()) {
      this.draftLinks.set([]); // moved into bound mode — any leftover draft is stale
      this.load();
    } else {
      this.links.set([]);
    }
  }

  /** Call when reopening the embedding form/dialog for a brand-new record —
   *  a dialog instance is reused across creates, so drafts from a previous
   *  (already-saved) one would otherwise still be sitting in `draftLinks`. */
  resetDrafts() {
    this.draftLinks.set([]);
  }

  /** Posts every draft link against `newOwnerId`, right after the embedding
   *  page creates the owning record. No-op (and no request) when there are
   *  no drafts. */
  flush(newOwnerId: string): Observable<unknown> {
    const drafts = this.draftLinks();
    if (!drafts.length) return of(null);
    const creates = drafts.map((d) => this.service.create({
      url: d.url, label: d.label, description: d.description,
      [this.ownerType()]: newOwnerId,
    } as LinkWrite));
    return forkJoin(creates);
  }

  /** Bare host for display fallback (label empty) and as a subtitle under a named link. */
  hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private load() {
    this.service.list({ [this.ownerType()]: this.ownerId(), page_size: 200, ordering: '-created_at' })
      .subscribe((page) => {
        this.links.set(page.results);
        this.count.emit(page.count);
      });
  }

  openAdd() {
    this.error.set(null);
    this.editingId.set(null);
    this.formUrl = '';
    this.formLabel = '';
    this.formDescription = '';
    this.dialogOpen.set(true);
  }

  openEdit(row: LinkRow) {
    this.error.set(null);
    this.editingId.set(row.id);
    this.formUrl = row.url;
    this.formLabel = row.label;
    this.formDescription = row.description;
    this.dialogOpen.set(true);
  }

  submit() {
    const url = this.formUrl.trim();
    if (!url) return;
    const editingId = this.editingId();
    const ownerId = this.ownerId();

    if (!ownerId) {
      // Draft mode: no owner to attach to yet — just hold it locally.
      if (editingId) {
        this.draftLinks.update((list) => list.map((l) => (l.id === editingId
          ? { ...l, url, label: this.formLabel.trim(), description: this.formDescription.trim() }
          : l)));
      } else {
        this.draftLinks.update((list) => [
          { id: crypto.randomUUID(), url, label: this.formLabel.trim(),
            description: this.formDescription.trim() },
          ...list,
        ]);
      }
      this.dialogOpen.set(false);
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const body: LinkWrite = {
      url, label: this.formLabel.trim(), description: this.formDescription.trim(),
      ...(editingId ? {} : { [this.ownerType()]: ownerId }),
    };
    const req$ = editingId ? this.service.update(editingId, body) : this.service.create(body);
    req$.subscribe({
      next: (link) => {
        this.links.update((list) => (editingId
          ? list.map((l) => (l.id === editingId ? link : l))
          : [link, ...list]));
        this.count.emit(this.links().length);
        this.saving.set(false);
        this.dialogOpen.set(false);
      },
      error: () => {
        this.error.set("Couldn't save that link — check the URL and try again.");
        this.saving.set(false);
      },
    });
  }

  remove(row: LinkRow) {
    if (!this.ownerId()) {
      this.confirm.danger(`Remove link "${row.label || row.url}"?`, () =>
        this.draftLinks.update((list) => list.filter((l) => l.id !== row.id)),
      { header: 'Remove link' });
      return;
    }
    this.confirm.danger(`Remove link "${row.label || row.url}"?`, () =>
      this.service.remove(row.id).subscribe(() => {
        this.links.update((list) => list.filter((l) => l.id !== row.id));
        this.count.emit(this.links().length);
        this.notify.success('Link removed');
      }), { header: 'Remove link' });
  }
}
