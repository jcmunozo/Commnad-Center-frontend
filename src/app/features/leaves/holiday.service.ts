import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';

export interface Holiday {
  id: string;
  legacy_code: string | null;
  name: string;
  location: string;
  location_name: string;
  date: string; // yyyy-MM-dd
}

export interface HolidayWrite {
  name: string;
  location: string;
  date: string;
}

/** Country public holidays (one row per date+country, registered by hand). */
@Injectable({ providedIn: 'root' })
export class HolidayService extends ApiBaseService<Holiday, HolidayWrite> {
  protected readonly path = 'holidays';
}
