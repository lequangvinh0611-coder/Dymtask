import { create } from 'zustand';

export type UserRole = 'master' | 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  // Đã xóa string[] teams cũ, thay bằng quan hệ từ bảng user_teams
  user_teams?: { team_id: string }[];
}

export interface Project {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Subtask {
  id: string;
  name: string;
  assignee: string;
  estimated_minutes: number;
  actual_minutes?: number; // Thêm actual_minutes
  status?: 'NEW' | 'IN_PROGRESS' | 'DONE'; // Thêm status thay vì chỉ is_completed
  is_completed: boolean;
}

export interface Task {
  id: string;
  task_name: string;
  tag_id: string;
  project_id: string;
  team_id: string;
  type: 'DAILY' | 'WEEKLY' | 'ONCE';
  
  // Các field thời gian mới theo Phase 2 (Migration 1)
  deadline_time?: string | null;     // VD: "08:30" hoặc "17:00:00"
  deadline_days?: string[] | null;   // VD: ["Mon", "Tue"]
  estimated_minutes: number;         // Chuyển sang lưu số phút
  actual_minutes: number;            // Chuyển sang lưu số phút

  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SUBMITTED';
  subtasks: Subtask[];
  assignees: string[]; // Mảng email
  created_at: string;
  updated_at?: string;

  // Thuộc tính quan hệ (sinh ra khi gọi Supabase select đi kèm bảng khác)
  projects?: { name: string };
  teams?: { name: string };
  tags?: { name: string; color?: string };
}

export interface AuditLog {
  id: string;
  action: string;
  description: string;
  user_id?: string;
  user_name: string;
  metadata?: any;       // Lưu log dạng JSONB
  created_at: string;   // Thay thế cho field 'time' cũ
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface AppState {
  activeTab: 'TO-DO LIST' | 'TASK MANAGER' | 'DASHBOARD' | 'AUDIT LOG' | 'SETTINGS';
  setActiveTab: (tab: AppState['activeTab']) => void;
  theme: 'indigo' | 'emerald' | 'slate' | 'rose';
  setTheme: (theme: AppState['theme']) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  confirmDialog: ConfirmConfig | null;
  showConfirm: (config: ConfirmConfig) => void;
  hideConfirm: () => void;
}

// Store chỉ còn quản lý trạng thái UI (activeTab)
export const useAppStore = create<AppState>((set) => ({
  activeTab: 'TO-DO LIST',
  setActiveTab: (tab) => set({ activeTab: tab, isSidebarOpen: false }),
  theme: 'indigo',
  setTheme: (theme) => set({ theme }),
  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
  isSidebarOpen: false,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  confirmDialog: null,
  showConfirm: (config) => set({ confirmDialog: config }),
  hideConfirm: () => set({ confirmDialog: null }),
}));