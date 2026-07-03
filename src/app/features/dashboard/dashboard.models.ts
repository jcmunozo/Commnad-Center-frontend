export interface PortfolioKpis {
  total_projects: number;
  active_projects: number;
  blocked_projects: number;
  open_tasks: number;
  overdue_tasks: number;
  critical_risks: number;
  by_status: Record<string, number>;
}

export interface PortfolioAlerts {
  critical_risks: { id: string; project_id: string; description: string; probability: number; impact: number }[];
  overdue_actions: { id: string; project_id: string; description: string; due_date: string }[];
  overdue_milestones: { id: string; name: string; target_date: string; derived_status: string; avg_progress: number }[];
}
