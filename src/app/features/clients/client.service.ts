import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';

export interface Client {
  id: string;
  legacy_code: string | null;
  name: string;
  contact_name: string;
  contact_email: string;
  notes: string;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientService extends ApiBaseService<Client> {
  protected readonly path = 'clients';
}
