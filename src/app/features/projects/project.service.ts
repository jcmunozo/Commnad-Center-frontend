import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';
import {
  Project, ProjectDashboard, ProjectPhase, ProjectProgress, ProjectWrite,
} from './project.models';

@Injectable({ providedIn: 'root' })
export class ProjectService extends ApiBaseService<Project, ProjectWrite> {
  protected readonly path = 'projects';

  dashboard(id: string) {
    return this.http.get<ProjectDashboard>(`${this.url}/${id}/dashboard/`);
  }

  progress(id: string) {
    return this.http.get<ProjectProgress>(`${this.url}/${id}/progress/`);
  }

  phases(id: string) {
    return this.http.get<ProjectPhase[]>(`${this.url}/${id}/phases/`);
  }

  savePhases(id: string, phases: ProjectPhase[]) {
    return this.http.put<ProjectPhase[]>(`${this.url}/${id}/phases/`, phases);
  }
}
