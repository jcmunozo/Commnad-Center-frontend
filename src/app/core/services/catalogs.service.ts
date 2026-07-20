import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../shared/models/pagination';

export interface CatalogItem {
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  /** Solo catálogo shifts. */
  start_hour?: number | null;
  end_hour?: number | null;
  /** Solo catálogo timezones (DecimalField serializado como string). */
  utc_offset?: string;
}

const SLUGS = [
  'severity-levels', 'project-statuses', 'project-types', 'task-statuses', 'task-types',
  'health-statuses', 'risk-statuses', 'issue-statuses', 'milestone-statuses', 'action-statuses',
  'api-statuses', 'endpoint-statuses', 'http-methods', 'employee-levels', 'employee-statuses',
  'locations', 'timezones', 'shifts', 'update-types', 'action-origins', 'ticket-statuses',
  'leave-types',
] as const;
export type CatalogSlug = (typeof SLUGS)[number];

/** Loads and caches all catalogs once (they change rarely). */
@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly cache = signal<Record<string, CatalogItem[]>>({});

  get(slug: CatalogSlug): CatalogItem[] {
    return this.cache()[slug] ?? [];
  }

  label(slug: CatalogSlug, code: string | null): string {
    if (!code) return '';
    return this.get(slug).find((c) => c.code === code)?.name ?? code;
  }

  preload() {
    const requests = Object.fromEntries(
      SLUGS.map((slug) => [
        slug,
        this.http.get<Paginated<CatalogItem>>(`${this.base}/catalogs/${slug}/`, {
          params: { page_size: 200 },
        }),
      ]),
    );
    return forkJoin(requests).pipe(
      tap((result) => {
        const flat: Record<string, CatalogItem[]> = {};
        for (const [slug, page] of Object.entries(result)) flat[slug] = page.results;
        this.cache.set(flat);
      }),
    );
  }
}
