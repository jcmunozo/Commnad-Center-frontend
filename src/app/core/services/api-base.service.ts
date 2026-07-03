import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { ListParams, Paginated } from '../../shared/models/pagination';

/**
 * Generic typed CRUD client. Concrete services set `path` and add custom methods.
 */
export abstract class ApiBaseService<T, TWrite = Partial<T>> {
  protected readonly http = inject(HttpClient);
  protected abstract readonly path: string;

  protected get url(): string {
    return `${environment.apiUrl}/${this.path}`;
  }

  list(params: ListParams = {}) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') httpParams = httpParams.set(k, String(v));
    });
    return this.http.get<Paginated<T>>(`${this.url}/`, { params: httpParams });
  }

  get(id: string) { return this.http.get<T>(`${this.url}/${id}/`); }
  create(body: TWrite) { return this.http.post<T>(`${this.url}/`, body); }
  update(id: string, body: Partial<TWrite>) { return this.http.patch<T>(`${this.url}/${id}/`, body); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}/`); }
}
