export interface Ticket {
  id: string;
  legacy_code: string | null;
  ticket_number: string;
  name: string;
  status: string;
  priority: string;
  assignee: string | null;
  assignee_name: string | null;
  invested_hours: number;
  resolved_at: string | null;
  created_at: string;
  // solo en el detalle
  description?: string;
  status_logs?: TicketStatusLogRow[];
}

export interface TicketWrite {
  ticket_number: string;
  name: string;
  description?: string;
  priority: string;
  status?: string;
  assignee?: string | null;
}

export interface TicketStatusLogRow {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
}

export interface TicketStatsRow {
  employee_id: string;
  name: string;
  open_tickets: number;
  wip_tickets: number;
  paused_tickets: number;
  resolved_tickets: number;
  invested_hours: number;
}
