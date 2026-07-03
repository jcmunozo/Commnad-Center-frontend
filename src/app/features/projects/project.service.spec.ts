import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ProjectService } from './project.service';
import { environment } from '../../../environments/environment';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists projects with query params', () => {
    service.list({ status: 'IN_PROGRESS', page: 2 }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/projects/` &&
             r.params.get('status') === 'IN_PROGRESS' && r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('fetches the project dashboard', () => {
    service.dashboard('abc').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/projects/abc/dashboard/`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
