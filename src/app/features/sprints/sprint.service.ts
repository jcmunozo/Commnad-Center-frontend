import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ApiBaseService } from '../../core/services/api-base.service';
import {
  Sprint, SprintDeletionImpact, SprintDeletionResult, SprintWrite, StartNextSprintResult,
} from './sprint.models';

@Injectable({ providedIn: 'root' })
export class SprintService extends ApiBaseService<Sprint, SprintWrite> {
  protected readonly path = 'sprints';

  /**
   * The globally active sprint, if one has been started. A root-provided
   * signal (same pattern as TeamService.period) so any feature — the Sprints
   * page, a task list's "current sprint" filter — reads the same value
   * without re-fetching.
   */
  readonly current = signal<Sprint | null>(null);
  private hydratedFromServer = false;

  /** Hits the network once per app lifetime; later calls are a no-op. */
  loadActive(): Observable<void> {
    if (this.hydratedFromServer) return of(undefined);
    this.hydratedFromServer = true;
    return this.active().pipe(
      tap((sprint) => this.current.set(sprint)),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  active() {
    return this.http.get<Sprint | null>(`${this.url}/active/`);
  }

  startNext(id: string, payload: SprintWrite) {
    return this.http.post<StartNextSprintResult>(`${this.url}/${id}/start_next/`, payload).pipe(
      tap((result) => this.current.set(result.sprint)),
    );
  }

  deletionImpact(id: string) {
    return this.http.get<SprintDeletionImpact>(`${this.url}/${id}/deletion_impact/`);
  }

  /** Deletes a sprint created by mistake; the backend requires a reason. */
  removeWithReason(id: string, reason: string) {
    return this.http.request<SprintDeletionResult>('DELETE', `${this.url}/${id}/`, {
      body: { reason },
    }).pipe(
      tap((result) => {
        if (result.was_active) this.current.set(null);
      }),
    );
  }

  override create(body: SprintWrite) {
    return super.create(body).pipe(tap((sprint) => this.current.set(sprint)));
  }
}
