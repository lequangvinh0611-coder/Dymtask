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
      set({ loading: true });
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        // Nếu không tìm thấy profile (người dùng mới), hệ thống sẽ tự tạo profile mặc định
        if (error.code === 'PGRST116') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: newProfile, error: insertError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email!,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                role: 'user',
                status: 'ACTIVE'
              })
              .select()
              .single();

            if (insertError) throw insertError;
            set({ profile: newProfile });
            return;
          }
        }
        throw error;
      }
      set({ profile: data });
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ profile: null });
    } finally {
      set({ loading: false });
    }
  },
}));
