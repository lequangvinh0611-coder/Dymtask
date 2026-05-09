export type UserRole = 'master' | 'admin' | 'user';
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SUBMITTED';
export type TaskType = 'DAILY' | 'WEEKLY' | 'ONCE';

export interface UserProfile {
  id: string; // UUID from auth.users
  email: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  
  // Thay thế cho 'teams: string[]' cũ
  // Dùng khi bạn query kèm bảng user_teams
  user_teams?: { team_id: string }[];
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
  
  // --- MIGRATION 1: CẬP NHẬT KIỂU THỜI GIAN ---
  deadline_time: string | null;     // Ánh xạ cột TIME (VD: "08:30:00")
  deadline_days: string[] | null;   // Ánh xạ cột TEXT[] (VD: ["Mon", "Tue"])
  estimated_minutes: number;        // Ánh xạ cột INTEGER
  actual_minutes: number;           // Ánh xạ cột INTEGER

  status: TaskStatus;
  subtasks: Subtask[]; // Ánh xạ JSONB
  assignees: string[]; // List of user emails
  created_at: string;
  updated_at: string;

  // --- QUAN HỆ (RELATIONS) ---
  // Khai báo thêm để hứng data khi dùng Supabase JOIN
  projects?: Project;
  teams?: Team;
  tags?: Tag;
}

export interface AuditLog {
  id: string;
  action: string;
  description?: string;
  user_id: string | null;
  user_name: string | null;
  metadata: any; // Ánh xạ JSONB
  created_at: string;
}