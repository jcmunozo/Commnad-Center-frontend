/** Continuous Improvement: internally-initiated work (docs, tech debt, proxy
 * adjustments) that doesn't fit a delivery Project's phases/health — optionally
 * traced back to the delivered Project it touches. Mirrors Project's own
 * Task/Milestone shape, one level shallower (flat tasks, no subtasks). */

export interface WorkItem {
  id: string;
  legacy_code: string | null;
  title: string;
  description?: string;
  project: string | null;
  project_name?: string | null;
  project_code?: string | null;
  status: string;
  priority: string;
  task_count?: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WorkItemWrite {
  title: string;
  description?: string;
  project?: string | null;
  status?: string;
  priority?: string;
}

export interface WorkItemTask {
  id: string;
  legacy_code: string | null;
  work_item: string;
  work_item_title?: string;
  name: string;
  assignee: string | null;
  assignee_name?: string | null;
  status: string;
  priority: string;
  planned_start?: string | null;
  planned_end: string | null;
  estimated_hours: number | null;
  actual_hours?: number | null;
  progress_pct: number;
  notes?: string;
  is_active?: boolean;
}

export interface WorkItemTaskWrite {
  work_item: string;
  name: string;
  assignee?: string | null;
  status?: string;
  priority?: string;
  planned_start?: string | null;
  planned_end?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  progress_pct?: number;
  notes?: string;
}

export interface WorkItemMilestoneProgress {
  total_tasks: number;
  done_tasks: number;
  avg_progress: number;
  derived_status: string;
}

export interface WorkItemMilestone {
  id: string;
  legacy_code: string | null;
  work_item: string;
  name: string;
  owner_employee: string | null;
  owner_name?: string | null;
  target_date: string | null;
  actual_date: string | null;
  comments: string;
  progress?: WorkItemMilestoneProgress;
  is_active: boolean;
}

export interface WorkItemMilestoneWrite {
  work_item: string;
  name: string;
  owner_employee?: string | null;
  target_date?: string | null;
  actual_date?: string | null;
  comments?: string;
}
