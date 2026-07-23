/** Entidades relacionadas a un proyecto, consumidas por las pestañas del detalle. */

export interface TaskAssignee {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  legacy_code: string | null;
  name: string;
  project: string;
  project_name?: string;
  task_type: string;
  status: string;
  priority: string;
  planned_end: string | null;
  progress_pct: number;
  assignees?: TaskAssignee[];
  subtask_count?: number;
}

export interface Milestone {
  id: string;
  legacy_code: string | null;
  project: string;
  name: string;
  owner_employee: string | null;
  target_date: string | null;
  actual_date: string | null;
  comments: string;
  progress?: { derived_status: string; avg_progress: number };
  is_active: boolean;
}

/** Subtask: deuda o recordatorio colgado de una tarea (reemplaza a
 * riesgos/incidencias/acciones/bitácora desde 2026-07-14). */
export interface SubTask {
  id: string;
  legacy_code: string | null;
  task: string;
  task_name?: string;
  task_code?: string | null;
  description: string;
  assignee: string | null;
  assignee_name?: string | null;
  due_date: string | null;
  priority: string | null;
  status: string;
  is_active: boolean;
}
