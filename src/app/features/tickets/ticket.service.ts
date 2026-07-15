import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';
import { Ticket, TicketStatsRow, TicketStatusLogRow, TicketWrite } from './ticket.models';

@Injectable({ providedIn: 'root' })
export class TicketService extends ApiBaseService<Ticket, TicketWrite> {
  protected readonly path = 'tickets';

  stats() {
    return this.http.get<TicketStatsRow[]>(`${this.url}/stats/`);
  }

  statusLog(id: string) {
    return this.http.get<TicketStatusLogRow[]>(`${this.url}/${id}/status-log/`);
  }
}
