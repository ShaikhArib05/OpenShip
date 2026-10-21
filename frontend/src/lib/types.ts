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

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  labels: string[];
  estimate: number | null;
  position: number;
  completed_at: string | null;
  created_at: string;
}

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
