export interface ProjectPhase {
  phase: PhaseCode;
  planned_start: string | null;
  planned_end: string | null;
}

export type PhaseCode = 'DEV' | 'SIT' | 'UAT' | 'PROD' | 'HYPERCARE';

/** Orden y etiquetas del timeline de fases de entrega. */
export const PROJECT_PHASES: { code: PhaseCode; label: string; hint: string }[] = [
  { code: 'DEV', label: 'Dev', hint: 'Solution development and documentation' },
  { code: 'SIT', label: 'SIT', hint: 'Pruebas entre sistemas' },
  { code: 'UAT', label: 'UAT', hint: 'Pruebas con el cliente' },
  { code: 'PROD', label: 'Prod', hint: 'Production go-live' },
  { code: 'HYPERCARE', label: 'Hypercare', hint: 'Post-go-live support' },
];

export interface Project {
  id: string;
  legacy_code: string | null;
  name: string;
  description: string;
  target_name: string;
  trigger_name: string;
  phases?: ProjectPhase[];
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
  is_favorite?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectWrite {
  legacy_code?: string | null;
  name: string;
  description?: string;
  target_name?: string;
  trigger_name?: string;
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
  open_subtasks: number;
  overdue_subtasks: number;
}

export interface ProjectProgress {
  project_id: string;
  weighted_progress_pct: number;
  task_count: number;
}
