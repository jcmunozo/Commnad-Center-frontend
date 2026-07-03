import { computed, inject, Injectable, signal } from '@angular/core';

import { ProjectService } from './project.service';
import { Project } from './project.models';
import { ListParams } from '../../shared/models/pagination';

export interface ProjectFilters {
  search: string;
  status: string | null;
  client: string | null;
  page: number;
  page_size: number;
  ordering: string;
}

const DEFAULTS: ProjectFilters = {
  search: '', status: null, client: null, page: 1, page_size: 25, ordering: 'name',
};

/** Feature-scoped state for the project list (signals, no NgRx). */
@Injectable()
export class ProjectsStore {
  private readonly service = inject(ProjectService);

  readonly items = signal<Project[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly filters = signal<ProjectFilters>({ ...DEFAULTS });

  readonly isEmpty = computed(() => !this.loading() && this.items().length === 0);

  load() {
    this.loading.set(true);
    const f = this.filters();
    const params: ListParams = {
      page: f.page, page_size: f.page_size, ordering: f.ordering,
      search: f.search || undefined,
      status: f.status || undefined,
      client: f.client || undefined,
    };
    this.service.list(params).subscribe({
      next: (page) => { this.items.set(page.results); this.total.set(page.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  patchFilters(patch: Partial<ProjectFilters>) {
    this.filters.update((f) => ({ ...f, ...patch }));
    this.load();
  }
}
