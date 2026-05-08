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
    // Nếu đang loading và profile đã có rồi thì không fetch lại trừ khi cần thiết
    const currentProfile = get().profile;
    if (get().loading && currentProfile) return;

    try {
      set({ loading: true });
      console.log('[AuthStore] Fetching profile for:', uid);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.warn('[AuthStore] Profile fetch error:', error);
        
        // PGRST116: No rows found
        if (error.code === 'PGRST116') {
          console.log('[AuthStore] No profile found, creating new one...');
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

            if (insertError) {
              console.error('[AuthStore] Profile creation failed:', insertError);
              throw insertError;
            }
            
            console.log('[AuthStore] New profile created successfully');
            set({ profile: newProfile });
            return;
          }
        }
        throw error;
      }
      
      set({ profile: data });
    } catch (error: any) {
      console.error('[AuthStore] Final fetchProfile error:', error);
      // Fallback for UI if everything fails
      if (!get().profile) {
        set({ profile: null });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
