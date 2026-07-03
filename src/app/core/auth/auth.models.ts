export interface TokenPair {
  access: string;
  refresh: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  employee: string | null;
  roles: string[];
}

export const ROLES = {
  ADMIN: 'PMO Admin',
  PM: 'Project Manager',
  TEAM: 'Team Member',
  VIEWER: 'Viewer',
} as const;
