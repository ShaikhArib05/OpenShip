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

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  archived: boolean;
  created_at: string;
  task_count?: number;
  done_count?: number;
  role?: Role;
}

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Dashboard {
  stats: { projects: number; total_tasks: number; completed_tasks: number; overdue_tasks: number };
  by_status: Record<TaskStatus, number>;
  projects: Project[];
  upcoming: {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
  }[];
  activity: {
    id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
    profiles: { full_name: string | null; email: string } | null;
  }[];
}
