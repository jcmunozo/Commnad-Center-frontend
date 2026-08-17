import { Injectable } from '@angular/core';

import { ApiBaseService } from '../../core/services/api-base.service';
import {
  WorkItem, WorkItemMilestone, WorkItemMilestoneWrite, WorkItemTask, WorkItemTaskWrite,
  WorkItemWrite,
} from './work-item.models';

@Injectable({ providedIn: 'root' })
export class WorkItemService extends ApiBaseService<WorkItem, WorkItemWrite> {
  protected readonly path = 'work-items';
}

@Injectable({ providedIn: 'root' })
export class WorkItemTaskService extends ApiBaseService<WorkItemTask, WorkItemTaskWrite> {
  protected readonly path = 'work-item-tasks';
}

@Injectable({ providedIn: 'root' })
export class WorkItemMilestoneService
  extends ApiBaseService<WorkItemMilestone, WorkItemMilestoneWrite> {
  protected readonly path = 'work-item-milestones';

  linkTask(milestoneId: string, taskId: string) {
    return this.http.post<{ created: boolean }>(`${this.url}/${milestoneId}/tasks/`, {
      task: taskId,
    });
  }
}
