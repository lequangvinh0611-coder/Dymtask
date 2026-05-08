import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { UserProfile } from '../types/database.types';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfile: (uid: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
  fetchProfile: async (uid: string) => {
    // Luôn luôn chạy try-catch-finally để đảm bảo không bao giờ kẹt Loading
    try {
      console.log('[AuthStore] Fetching profile for:', uid);
      
      // Sửa lại thành bảng 'profiles' thay vì 'users'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.warn('[AuthStore] Profile fetch error:', error);
        
        // Nếu không tìm thấy profile (PGRST116), tạo profile mặc định
        if (error.code === 'PGRST116') {
          console.log('[AuthStore] No profile found, creating fallback profile...');
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const fallbackProfile: UserProfile = { 
                id: user.id, 
                email: user.email!, 
                name: user.email?.split('@')[0] || 'User', 
                role: 'USER', // Mặc định là USER
                teams: [],
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            } as any; // Ép kiểu tạm thời để tránh lỗi type

            set({ profile: fallbackProfile });
            return;
          }
        }
        throw error;
      }
      
      console.log('[AuthStore] Profile fetched successfully:', data);
      set({ profile: data });

    } catch (error: any) {
      console.error('[AuthStore] Final fetchProfile error:', error);
      
      // Fallback cuối cùng nếu mọi thứ thất bại: Tự set làm USER để vớt vát giao diện
      const sessionUser = get().session?.user;
      if (sessionUser) {
        set({ 
          profile: { 
            id: sessionUser.id, 
            email: sessionUser.email!, 
            name: sessionUser.email?.split('@')[0] || 'User', 
            role: 'USER' 
          } as any 
        });
      } else {
        set({ profile: null });
      }
    } finally {
      // ĐÂY LÀ CHỐT CHẶN QUAN TRỌNG NHẤT: Bắt buộc tắt Loading
      set({ loading: false });
      console.log('[AuthStore] Loading finished and set to FALSE');
    }
  },
}));
