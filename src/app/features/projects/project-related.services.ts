import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';
import { Milestone, SubTask, Task, TaskAssignee } from './project-related.models';

@Injectable({ providedIn: 'root' })
export class TaskService extends ApiBaseService<Task> {
  protected readonly path = 'tasks';

  assignees(taskId: string) {
    return this.http.get<TaskAssignee[]>(`${this.url}/${taskId}/assignees/`);
  }

  saveAssignees(taskId: string, employeeIds: string[]) {
    return this.http.put<TaskAssignee[]>(`${this.url}/${taskId}/assignees/`, {
      employees: employeeIds,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class MilestoneService extends ApiBaseService<Milestone> {
  protected readonly path = 'milestones';

  linkTask(milestoneId: string, taskId: string) {
    return this.http.post<{ created: boolean }>(`${this.url}/${milestoneId}/tasks/`, {
      task: taskId,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class SubTaskService extends ApiBaseService<SubTask> {
  protected readonly path = 'subtasks';
}
