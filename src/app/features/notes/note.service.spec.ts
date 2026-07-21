import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { NoteService } from './note.service';
import { environment } from '../../../environments/environment';

describe('NoteService', () => {
  let service: NoteService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NoteService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NoteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists notes with query params', () => {
    service.list({ status: 'OPEN', pinned: true, page: 2 }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/notes/` &&
             r.params.get('status') === 'OPEN' &&
             r.params.get('pinned') === 'true' && r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('creates a note', () => {
    service.create({ title: 'Remember the milk' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/notes/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Remember the milk' });
    req.flush({});
  });
});
