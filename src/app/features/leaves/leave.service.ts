import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../core/services/api-base.service';

export interface Leave {
  id: string;
  legacy_code: string | null;
  employee: string;
  employee_name: string;
  employee_code: string | null;
  leave_type: string;
  leave_type_name: string;
  start_date: string; // yyyy-MM-dd, inclusive
  end_date: string;
  notes: string;
}

export interface LeaveWrite {
  employee: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface LeaveCalendarDay {
  date: string;
  absent: { employee_id: string; name: string; leave_type: string }[];
  absent_count: number;
  headcount: number;
  absent_pct: number;
  alert: 'OK' | 'OVER_THRESHOLD';
  holidays: { location: string; location_name: string; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class LeaveService extends ApiBaseService<Leave, LeaveWrite> {
  protected readonly path = 'leaves';

  /** Per-day absence counts (capacity check) between two inclusive ISO dates. */
  calendar(start: string, end: string) {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<LeaveCalendarDay[]>(
      `${environment.apiUrl}/resources/leave-calendar/`, { params });
  }
}
