import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

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

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);

  workload() {
    return this.http.get<WorkloadRow[]>(`${environment.apiUrl}/resources/workload/`);
  }
}
