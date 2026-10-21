export type Role = "owner" | "member";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  role: Role;
}

export interface Member {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
}

export interface Invite {
  id: string;
  token: string;
  email: string | null;
  expires_at: string;
}
