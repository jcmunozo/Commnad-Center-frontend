/** A Link attaches to exactly one owner — the field name doubles as the
 * `?<field>=<id>` filter/write key the `/api/links/` endpoint expects. */
export type LinkOwnerType = 'project' | 'note' | 'ticket' | 'work_item';

export interface Link {
  id: string;
  url: string;
  label: string;
  description: string;
  project: string | null;
  project_name: string | null;
  note: string | null;
  note_title: string | null;
  ticket: string | null;
  ticket_number: string | null;
  work_item: string | null;
  work_item_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkWrite {
  url: string;
  label?: string;
  description?: string;
  project?: string | null;
  note?: string | null;
  ticket?: string | null;
  work_item?: string | null;
}
