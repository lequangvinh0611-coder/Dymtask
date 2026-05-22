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
  is_active: boolean;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  is_active: boolean;
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
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  is_active: boolean;
  est_time: number;
  actual_time: number;
  created_at: string;
  assignees?: string[] | null;
  project_id?: string | null;
  tag_id?: string | null;
  due_date?: string | null;
  priority?: string;
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

// Định nghĩa Database Type hoàn chỉnh của Supabase cho dự án Dymtask
export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          task_type: string;
          status: string;
          is_active: boolean;
          est_time: number;
          actual_time: number;
          created_at: string;
          assignees: string[] | null;
          project_id: string | null;
          tag_id: string | null;
          due_date: string | null;
          priority: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          task_type: string;
          status?: string;
          is_active?: boolean;
          est_time?: number;
          actual_time?: number;
          created_at?: string;
          assignees?: string[] | null;
          project_id?: string | null;
          tag_id?: string | null;
          due_date?: string | null;
          priority?: string; // Mặc định 'Medium'
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          task_type?: string;
          status?: string;
          is_active?: boolean;
          est_time?: number;
          actual_time?: number;
          created_at?: string;
          assignees?: string[] | null;
          project_id?: string | null;
          tag_id?: string | null;
          due_date?: string | null;
          priority?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          description?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          description?: string | null;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          color?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          color?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          color?: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: string;
          status: string;
          team_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: string;
          status?: string;
          team_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: string;
          status?: string;
          team_ids?: string[];
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
