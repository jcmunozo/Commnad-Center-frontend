import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export interface EntityReport {
  sheet: string;
  model: string;
  total_rows: number;
  new: number;
  updated: number;
  skipped: number;
  invalid: number;
  row_errors: { row: number; errors: string[] }[];
}

export interface ImportReport {
  dry_run: boolean;
  has_errors: boolean;
  entities: EntityReport[];
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/imports/excel`;

  private post(url: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportReport>(url, fd);
  }

  dryRun(file: File) { return this.post(`${this.base}/dry-run/`, file); }
  confirm(file: File) { return this.post(`${this.base}/confirm/`, file); }
}
