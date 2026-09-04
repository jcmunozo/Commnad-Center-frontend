export interface ProjectPhase {
  phase: PhaseCode;
  planned_start: string | null;
  planned_end: string | null;
}

export type PhaseCode = 'DEV' | 'SIT' | 'UAT' | 'PROD' | 'HYPERCARE';

/** Orden y etiquetas del timeline de fases de entrega. Hypercare va antes de
 *  Live: Live es la fase continua e indefinida que sigue, normalmente sin
 *  fecha de fin. Este orden también decide, en caso de solape, qué fase se
 *  muestra como vigente (ver current_phase en el backend).
 *  `noEndDate: true` marca fases que solo capturan fecha de inicio (Live: se
 *  queda en productivo indefinidamente) — el form no debe pedir/mostrar fin. */
export const PROJECT_PHASES: { code: PhaseCode; label: string; hint: string; noEndDate?: boolean }[] = [
  { code: 'DEV', label: 'Dev', hint: 'Solution development and documentation' },
  { code: 'SIT', label: 'SIT', hint: 'Pruebas entre sistemas' },
  { code: 'UAT', label: 'UAT', hint: 'Pruebas con el cliente' },
  { code: 'HYPERCARE', label: 'Hypercare', hint: 'One week of post-go-live support' },
  { code: 'PROD', label: 'Live', hint: 'Ongoing production support — no end date', noEndDate: true },
];

export function phaseLabel(code: PhaseCode | null | undefined): string {
  return PROJECT_PHASES.find((p) => p.code === code)?.label ?? '—';
}

export interface Project {
  id: string;
  legacy_code: string | null;
  name: string;
  description: string;
  target_name: string;
  trigger_name: string;
  phases?: ProjectPhase[];
  /** Delivery stage whose planned window covers today (list endpoint only; computed server-side). */
  current_phase?: PhaseCode | null;
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
