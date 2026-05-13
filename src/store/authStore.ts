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
    try {
      console.log('[AuthStore] Fetching profile for:', uid);

      // Bọc query trong timeout 8 giây để tránh treo vĩnh viễn
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 8000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.warn('[AuthStore] Profile fetch error:', error.code, error.message);

        if (error.code === 'PGRST116') {
          // Không tìm thấy profile trong DB → dùng fallback
          console.log('[AuthStore] No profile in DB, using fallback...');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const isMaster = user.email === 'lequangvinh0611@gmail.com';
            set({
              profile: {
                id: user.id,
                email: user.email!,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                role: isMaster ? 'master' : 'user',
                teams: [],
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
              } as any,
            });
          }
          return;
        }
        throw error;
      }

      console.log('[AuthStore] Profile fetched successfully:', data);
      
      // ✅ Force Master role if email matches (Security enforcement)
      if (data.email === 'lequangvinh0611@gmail.com' && data.role !== 'master') {
        data.role = 'master';
      }
      
      set({ profile: data });

    } catch (error: any) {
      console.error('[AuthStore] fetchProfile failed:', error.message);

      // ✅ FIX: Chỉ set fallback nếu CHƯA có profile — không ghi đè profile đã load được
      const currentProfile = get().profile;
      if (!currentProfile) {
        const sessionUser = get().session?.user;
        if (sessionUser) {
          set({
            profile: {
              id: sessionUser.id,
              email: sessionUser.email!,
              name: sessionUser.user_metadata?.full_name
                    || sessionUser.email?.split('@')[0]
                    || 'User',
              role: 'user',
            } as any,
          });
        } else {
          set({ profile: null });
        }
      }
      // Nếu đã có profile rồi → giữ nguyên, không làm gì
    } finally {
      // Luôn luôn tắt loading dù có chuyện gì xảy ra
      set({ loading: false });
      console.log('[AuthStore] Loading finished → FALSE');
    }
  },
}));
