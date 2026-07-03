export interface Project {
  id: string;
  legacy_code: string | null;
  name: string;
  client: string;
  client_name?: string;
  project_type: string;
  status: string;
  priority: string;
  health: string | null;
  start_date: string | null;
  planned_end: string | null;
  actual_end: string | null;
  progress_pct: number;
  planned_hours: number | null;
  consumed_hours: number | null;
  comments: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectWrite {
  legacy_code?: string | null;
  name: string;
  client: string;
  project_type: string;
  status: string;
  priority: string;
  health?: string | null;
  start_date?: string | null;
  planned_end?: string | null;
  actual_end?: string | null;
  progress_pct?: number;
  planned_hours?: number | null;
  consumed_hours?: number | null;
  comments?: string;
}

export interface ProjectDashboard {
  project_id: string;
  open_tasks: number;
  overdue_tasks: number;
  open_issues: number;
  open_risks: number;
  critical_risks: number;
  total_apis: number;
  endpoints_total: number;
  endpoints_done: number;
}

export interface ProjectProgress {
  project_id: string;
  weighted_progress_pct: number;
  task_count: number;
}
