export interface Note {
  id: string;
  legacy_code: string | null;
  title: string;
  content: string;
  pinned: boolean;
  due_date: string | null;
  category: string;
  priority: string;
  status: string;
  project: string | null;
  project_name: string | null;
  project_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteWrite {
  title: string;
  content?: string;
  pinned?: boolean;
  due_date?: string | null;
  category?: string;
  priority?: string;
  status?: string;
  project?: string | null;
}

export const NOTE_CATEGORIES = [
  { code: 'IDEA', name: 'Idea' },
  { code: 'TODO', name: 'To-Do' },
  { code: 'REMINDER', name: 'Reminder' },
  { code: 'DECISION', name: 'Decision' },
];

export const NOTE_PRIORITIES = [
  { code: 'HIGH', name: 'High' },
  { code: 'MEDIUM', name: 'Medium' },
  { code: 'LOW', name: 'Low' },
];

export const NOTE_STATUSES = [
  { code: 'OPEN', name: 'Open' },
  { code: 'COMPLETED', name: 'Completed' },
];

/** Estado visual del vencimiento; completadas nunca alertan. */
export function dueState(n: Note): 'overdue' | 'upcoming' | null {
  if (!n.due_date || n.status === 'COMPLETED') return null;
  const due = new Date(`${n.due_date}T23:59:59`);
  const days = Math.floor((due.getTime() - Date.now()) / 86_400_000);
  return days < 0 ? 'overdue' : days <= 3 ? 'upcoming' : null;
}
