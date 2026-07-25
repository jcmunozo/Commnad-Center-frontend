import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

interface WorkloadPeriodDto {
  start_date: string | null;
  end_date: string | null;
}

/** Fila del endpoint /resources/workload/: carga y disponibilidad por dev. */
export interface WorkloadRow {
  employee_id: string;
  name: string;
  location: string | null;
  location_name: string | null;
  assigned_hours: number;
  capacity_hours: number;
  workload_pct: number;
  alert: 'OK' | 'HIGH_LOAD' | 'OVERLOADED';
  shift_today: string | null;
  on_shift_now: boolean | null;
  open_tasks: number;
  ticket_hours: number;
  open_tickets: number;
  on_leave_today: boolean;
  leave_days: number;
  holiday_today: boolean;
  holiday_days: number;
}

export interface WorkloadPeriod {
  start: Date;
  end: Date;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);

  /**
   * Rango de sprint seleccionado en /team. Vive aquí (no en el componente)
   * porque este servicio es un singleton `providedIn: 'root'`: al navegar a
   * otra vista Angular destruye TeamComponent, pero el servicio sigue vivo,
   * así que la selección persiste hasta que el usuario la cambie a mano.
   */
  readonly period = signal<WorkloadPeriod | null>(null);
  periodStart: Date | null = null;
  periodEnd: Date | null = null;
  private hydratedFromServer = false;

  /**
   * Restores the saved range from the backend (survives a full page reload,
   * unlike the in-memory signals above). Only hits the network once per app
   * lifetime — later calls (e.g. remounting /team) are a no-op.
   */
  loadPersistedPeriod(): Observable<void> {
    if (this.hydratedFromServer) return of(undefined);
    this.hydratedFromServer = true;
    return this.http.get<WorkloadPeriodDto>(`${environment.apiUrl}/resources/workload-period/`).pipe(
      tap((dto) => {
        if (dto.start_date && dto.end_date) {
          const start = this.parseDate(dto.start_date);
          const end = this.parseDate(dto.end_date);
          this.periodStart = start;
          this.periodEnd = end;
          this.period.set({ start, end });
        }
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Sets the sprint range (or clears it with `null`) and persists it server-side. */
  setPeriod(period: WorkloadPeriod | null) {
    this.periodStart = period?.start ?? null;
    this.periodEnd = period?.end ?? null;
    this.period.set(period);
    this.http.put<WorkloadPeriodDto>(`${environment.apiUrl}/resources/workload-period/`, {
      start_date: period ? this.toDateStr(period.start) : null,
      end_date: period ? this.toDateStr(period.end) : null,
    }).subscribe();
  }

  /**
   * Sin `period`, el backend usa la semana ISO actual como capacidad (42h/semana).
   * Con `period` (p. ej. un sprint de 2 semanas), la capacidad se escala a los
   * días laborales reales de ese rango — ver apps/resources/services.py.
   */
  workload(period?: WorkloadPeriod) {
    let params = new HttpParams();
    if (period) {
      params = params
        .set('start', this.startOfDay(period.start))
        .set('end', this.endOfDay(period.end));
    }
    return this.http.get<WorkloadRow[]>(`${environment.apiUrl}/resources/workload/`, { params });
  }

  private startOfDay(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
  }

  private endOfDay(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
  }

  /** 'YYYY-MM-DD' in local time (avoids UTC toISOString() shifting the day). */
  private toDateStr(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private parseDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
