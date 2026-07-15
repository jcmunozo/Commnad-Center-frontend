import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';

export interface Employee {
  id: string;
  legacy_code: string | null;
  name: string;
  role: string;
  level: string | null;
  status: string;
  location: string | null;
  timezone: string | null;
}

export interface EmployeeShiftRow {
  id?: number;
  employee?: string;
  weekday: number; // ISO: 1=lunes .. 7=domingo
  shift?: string | null;
  start_hour?: number | null;
  end_hour?: number | null;
  shift_name?: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService extends ApiBaseService<Employee> {
  protected readonly path = 'employees';

  schedule(id: string) {
    return this.http.get<EmployeeShiftRow[]>(`${this.url}/${id}/schedule/`);
  }

  saveSchedule(id: string, rows: EmployeeShiftRow[]) {
    return this.http.put<EmployeeShiftRow[]>(`${this.url}/${id}/schedule/`, rows);
  }
}
