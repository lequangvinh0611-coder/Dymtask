export type UserRole = 'master' | 'admin' | 'user';
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SUBMITTED' | 'SKIPPED';
export type TaskType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONETIME';

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
  name: string;                      // ✅ Changed from 'title' to match DB
  assignee?: string;                 // User email
  estimated_minutes?: number;
  actual_minutes?: number;
  status?: string;
  is_completed?: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  user_id: string | null;           // ✅ ADDED: User who created the task
  task_name: string;
  tag_id: string | null;
  tag?: string | null;              // Text representation of tag
  project_id: string | null;
  project?: string | null;          // Text representation of project
  team_id: string | null;
  team?: string | null;             // Text representation of team
  type: TaskType;
  deadline_date: string | null;
  deadline_day_num: number | null;
  
  // --- MIGRATION 1: CẬP NHẬT KIỂU THỜI GIAN ---
  deadline_time: string | null;     // Ánh xạ cột TIME (VD: "08:30:00")
  deadline_days: string[] | null;   // Ánh xạ cột TEXT[] (VD: ["Mon", "Tue"])
  estimated_minutes: number;        // Ánh xạ cột INTEGER
  actual_minutes: number;           // Ánh xạ cột INTEGER

  status: TaskStatus;
  display_id?: number; // ✅ ADDED: Auto-incrementing sequential ID
  subtasks: Subtask[]; // Ánh xạ JSONB
  assignees: string[]; // List of user emails
  created_at: string;
  updated_at: string;
  is_active: boolean;

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