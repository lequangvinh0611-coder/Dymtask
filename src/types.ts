import { create } from 'zustand';

export type UserRole = 'master' | 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teams: string[];
  status: 'ACTIVE' | 'INACTIVE';
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
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  task_name: string;
  tag_id: string;
  project_id: string;
  team_id: string;
  type: 'DAILY' | 'WEEKLY' | 'ONCE';
  deadline: string;
  estimated_time: string;
  actual_time: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SUBMITTED';
  subtasks: Subtask[];
  assignees: string[]; // List of user emails
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  description: string;
  user_name: string;
  time: string;
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_TEAM' | 'UPDATE_TEAM' | 'CREATE_PROJECT' | 'UPDATE_TAG' | 'RESET_TASK' | 'UPDATE_USER';
}

interface AppState {
  activeTab: 'TO-DO LIST' | 'TASK MANAGER' | 'DASHBOARD' | 'AUDIT LOG' | 'SETTINGS';
  setActiveTab: (tab: AppState['activeTab']) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'TO-DO LIST',
  setActiveTab: (tab) => set({ activeTab: tab }),
  currentUser: {
    id: '1',
    name: 'LE QUANG VINH',
    email: 'le-v@dymvietnam.jp',
    role: 'master',
    teams: ['内部'],
    status: 'ACTIVE'
  },
  setCurrentUser: (user) => set({ currentUser: user }),
}));
