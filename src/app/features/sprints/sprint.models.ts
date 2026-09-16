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
