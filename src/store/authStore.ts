import { create } from 'zustand';

// Đơn giản hóa type tạm thời cho MVP
interface AuthState {
  session: any | null;
  profile: any | null;
  loading: boolean;
  setSession: (session: any | null) => void;
  setProfile: (profile: any | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfile: (uid: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 1. FAKE SESSION
  session: {
    access_token: 'mock-token',
    user: {
      id: 'mock-user-id',
      email: 'admin@dymtask.com',
      role: 'authenticated',
    }
  },
  
  // 2. FAKE PROFILE (Cấp quyền Master luôn để không bị vướng trang Settings)
  profile: {
    id: 'mock-user-id',
    email: 'admin@dymtask.com',
    name: 'Admin Dymtask',
    role: 'master', 
    team_ids: [],
    status: 'ACTIVE',
  },
  
  loading: false, // Để false luôn để không bị xoay vòng xoay loading
  
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  
  signOut: async () => {
    // Tạm thời không gọi supabase.auth.signOut() để tránh lỗi mạng
    set({ session: null, profile: null });
  },
  
  // 3. CHẶN KHÔNG CHO GỌI DATABASE BẢNG USERS
  fetchProfile: async (uid: string) => {
    console.log('[AuthStore] MVP Mode: Đã bỏ qua việc gọi database bảng users.');
    // Không làm gì cả vì chúng ta đã có Fake Profile ở trên rồi
    set({ loading: false }); 
  },
}));