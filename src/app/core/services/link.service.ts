import { Injectable } from '@angular/core';

import { ApiBaseService } from './api-base.service';
import { Link, LinkWrite } from '../../shared/models/link';

@Injectable({ providedIn: 'root' })
export class LinkService extends ApiBaseService<Link, LinkWrite> {
  protected readonly path = 'links';
}
