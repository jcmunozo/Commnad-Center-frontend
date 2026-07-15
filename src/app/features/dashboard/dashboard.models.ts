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
}

export interface PortfolioAlerts {
  overdue_subtasks: {
    id: string; project_id: string; description: string; due_date: string;
    task_code: string | null; task_name: string; assignee_name: string | null;
  }[];
  overdue_milestones: { id: string; name: string; target_date: string; derived_status: string; avg_progress: number }[];
}
