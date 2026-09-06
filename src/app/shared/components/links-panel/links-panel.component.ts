import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { LinkService } from '../../../core/services/link.service';
import { Link, LinkOwnerType, LinkWrite } from '../../models/link';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Reusable "reference links" list (Confluence, Swagger, Drive, a design
 * doc…) for whichever of the 4 owner types the embedding page passes —
 * project/ticket/CI documentation was scattered across different links
 * with no single place to find them all. A Note's own links stay open to
 * any authenticated user (mirrors NoteViewSet; the backend enforces it's
 * only their own note). */
@Component({
  selector: 'app-links-panel',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="links-panel">
      @if (links().length) {
        <ul class="links-list">
          @for (l of links(); track l.id) {
            <li>
              <i class="pi pi-link"></i>
              <div class="link-info">
                <a [href]="l.url" target="_blank" rel="noopener noreferrer">{{ l.label || l.url }}</a>
                @if (l.description) { <p class="link-desc">{{ l.description }}</p> }
              </div>
              @if (canWrite()) {
                <button type="button" class="icon-btn icon-btn--danger" title="Remove link"
                  (click)="remove(l)"><i class="pi pi-trash"></i></button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="empty">No links yet.</p>
      }

      @if (canWrite()) {
        <div class="add-form">
          <label>URL *
            <input pInputText placeholder="https://…" [(ngModel)]="newUrl" autocomplete="off" />
          </label>
          <label>Name
            <input pInputText placeholder="Optional" [(ngModel)]="newLabel" autocomplete="off" />
          </label>
          <label class="span-2">Description
            <textarea pInputText placeholder="Optional" rows="2" [(ngModel)]="newDescription"></textarea>
          </label>
          <div class="span-2 add-actions">
            <p-button label="Add link" icon="pi pi-plus" size="small" [loading]="saving()"
              [disabled]="!newUrl.trim() || saving()" (onClick)="add()" />
          </div>
        </div>
        @if (error()) { <small class="err">{{ error() }}</small> }
      }
    </div>
  `,
  styles: [`
    .links-panel { display:flex; flex-direction:column; gap:.75rem; }
    .links-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.5rem; }
    .links-list li { display:flex; align-items:flex-start; gap:.5rem; font-size:.85rem; }
    .links-list .pi-link { color:var(--pmo-muted); font-size:.8rem; margin-top:.2rem; }
    .link-info { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
    .links-list a { color:var(--pmo-primary); word-break:break-all; }
    .link-desc { margin:0; color:var(--pmo-muted); font-size:.78rem; white-space:pre-wrap; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--pmo-muted);
      padding:.15rem .35rem; font-size:.85rem; margin-left:auto; }
    .icon-btn--danger:hover { color:var(--pmo-danger); }
    .empty { margin:0; color:var(--pmo-muted); font-size:.85rem; }
    .add-form { display:grid; grid-template-columns:1fr 1fr; gap:.6rem .75rem; }
    .add-form label { display:flex; flex-direction:column; gap:.3rem; font-size:.8rem;
      color:var(--pmo-muted); }
    .span-2 { grid-column:span 2; }
    .add-actions { display:flex; justify-content:flex-end; }
    textarea { resize:vertical; font:inherit; }
    .err { color:var(--pmo-danger); font-size:.78rem; }
  `],
})
export class LinksPanelComponent implements OnChanges {
  readonly ownerType = input.required<LinkOwnerType>();
  readonly ownerId = input.required<string>();
  readonly count = output<number>();

  private readonly service = inject(LinkService);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  // Notes are personal and open to any authenticated user regardless of
  // role (same as NoteViewSet) — everything else follows Task/SubTask's bar.
  readonly canWrite = computed(() =>
    this.ownerType() === 'note' || this.auth.hasAnyRole(['PMO Admin', 'Project Manager', 'Team Member']));

  readonly links = signal<Link[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  newUrl = '';
  newLabel = '';
  newDescription = '';

  ngOnChanges() {
    if (this.ownerId()) this.load();
  }

  private load() {
    this.service.list({ [this.ownerType()]: this.ownerId(), page_size: 200, ordering: '-created_at' })
      .subscribe((page) => {
        this.links.set(page.results);
        this.count.emit(page.count);
      });
  }

  add() {
    const url = this.newUrl.trim();
    if (!url) return;
    this.error.set(null);
    this.saving.set(true);
    const body: LinkWrite = {
      url, label: this.newLabel.trim(), description: this.newDescription.trim(),
      [this.ownerType()]: this.ownerId(),
    };
    this.service.create(body).subscribe({
      next: (link) => {
        this.links.update((list) => [link, ...list]);
        this.count.emit(this.links().length);
        this.newUrl = '';
        this.newLabel = '';
        this.newDescription = '';
        this.saving.set(false);
      },
      error: () => {
        this.error.set("Couldn't add that link — check the URL and try again.");
        this.saving.set(false);
      },
    });
  }

  remove(link: Link) {
    this.confirm.danger(`Remove link "${link.label || link.url}"?`, () =>
      this.service.remove(link.id).subscribe(() => {
        this.links.update((list) => list.filter((l) => l.id !== link.id));
        this.count.emit(this.links().length);
        this.notify.success('Link removed');
      }), { header: 'Remove link' });
  }
}
