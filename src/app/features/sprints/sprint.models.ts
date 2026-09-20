export interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'CLOSED';
  closed_at: string | null;
}

export interface SprintWrite {
  name: string;
  start_date: string;
  end_date: string;
}

export interface StartNextSprintResult {
  sprint: Sprint;
  carried_over_count: number;
  closed_count: number;
}

/** What deleting a sprint would touch (GET /sprints/{id}/deletion_impact/). */
export interface SprintDeletionImpact {
  tasks: number;
  open_tasks: number;
  ci_tasks: number;
  open_ci_tasks: number;
  is_active_sprint: boolean;
}

export interface SprintDeletionResult {
  id: string;
  was_active: boolean;
  detached_tasks: number;
  detached_ci_tasks: number;
}
