import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/** Fila del endpoint /resources/workload/: carga y disponibilidad por dev. */
export interface WorkloadRow {
  employee_id: string;
  name: string;
  assigned_hours: number;
  capacity_hours: number;
  workload_pct: number;
  alert: 'OK' | 'HIGH_LOAD' | 'OVERLOADED';
  shift_today: string | null;
  open_tasks: number;
  ticket_hours: number;
  open_tickets: number;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);

  workload() {
    return this.http.get<WorkloadRow[]>(`${environment.apiUrl}/resources/workload/`);
  }
}
