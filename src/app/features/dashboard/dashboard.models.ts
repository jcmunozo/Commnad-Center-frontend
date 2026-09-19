export interface PortfolioKpis {
  total_projects: number;
  active_projects: number;
  blocked_projects: number;
  open_tasks: number;
  overdue_tasks: number;
  overdue_subtasks: number;
  by_status: Record<string, number>;
  by_task_status: Record<string, number>;
  projects: {
    id: string;
    legacy_code: string | null;
    name: string;
    progress_pct: number;
    health: string | null;
  }[];
  tasks_effort: TaskEffort[];
  /** Only present when the request was scoped with ?sprint_id=. */
  sprint?: { id: string; name: string };
  sprint_effort_totals?: { estimated_hours: number; actual_hours: number };
}

export interface BurndownDay { date: string; remaining_hours: number; ideal_hours: number; }

export interface BurndownData {
  sprint: { id: string; name: string; start_date: string; end_date: string };
  total_scope_hours: number;
  days: BurndownDay[];
}

export interface VelocitySprint {
  id: string; name: string; start_date: string; end_date: string;
  tasks_done: number; hours_done: number;
  estimated_hours: number; actual_hours: number;
}

export interface VelocityData { sprints: VelocitySprint[]; }

export interface TaskEffort {
  id: string;
  legacy_code: string | null;
  name: string;
  project_name: string;
  status: string;
  estimated_hours: number;
  actual_hours: number;
}

export interface PortfolioAlerts {
  overdue_subtasks: {
    id: string; project_id: string; description: string; due_date: string;
    task_code: string | null; task_name: string; assignee_name: string | null;
  }[];
  overdue_milestones: { id: string; name: string; target_date: string; derived_status: string; avg_progress: number }[];
}
