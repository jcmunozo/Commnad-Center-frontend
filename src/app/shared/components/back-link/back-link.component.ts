import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** "Back to X" affordance for a detail page's toolbar — a circular button
 * instead of a bare arrow glyph, so it reads as a clickable control rather
 * than decoration. Reused wherever a detail page needs one (Project, CI
 * work item…) so the look stays consistent and changes apply everywhere. */
@Component({
  selector: 'app-back-link',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a [routerLink]="to()" class="back-link" [title]="label()" [attr.aria-label]="label()">
      <i class="pi pi-arrow-left"></i>
    </a>
  `,
  styles: [`
    :host { display:inline-flex; }
    .back-link {
      display:flex; align-items:center; justify-content:center;
      width:2.25rem; height:2.25rem; border-radius:50%;
      border:1px solid var(--pmo-border); background:var(--pmo-surface);
      color:var(--pmo-muted); font-size:.95rem;
      transition:background .15s ease, border-color .15s ease, color .15s ease, transform .12s ease;
    }
    .back-link:hover {
      color:var(--pmo-primary); border-color:var(--pmo-primary);
      background:color-mix(in srgb, var(--pmo-primary) 12%, transparent);
      transform:translateX(-2px);
    }
  `],
})
export class BackLinkComponent {
  readonly to = input.required<string>();
  readonly label = input('Back');
}
