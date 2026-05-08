export type UserRole = 'master' | 'admin' | 'user';
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SUBMITTED';
export type TaskType = 'DAILY' | 'WEEKLY' | 'ONCE';

export interface UserProfile {
  id: string; // UUID from auth.users
  email: string;
  name: string;
  role: UserRole;
  teams: string[];
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  task_name: string;
  tag_id: string | null;
  project_id: string | null;
  team_id: string | null;
  type: TaskType;
  deadline: string | null;
  estimated_time: string | null;
  actual_time: string | null;
  status: TaskStatus;
  subtasks: Subtask[];
  assignees: string[]; // List of user emails
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  description?: string;
  user_id: string | null;
  user_name: string | null;
  metadata: any;
  created_at: string;
}
