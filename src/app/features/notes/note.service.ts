import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';
import { Note, NoteWrite } from './note.models';

@Injectable({ providedIn: 'root' })
export class NoteService extends ApiBaseService<Note, NoteWrite> {
  protected readonly path = 'notes';
}
