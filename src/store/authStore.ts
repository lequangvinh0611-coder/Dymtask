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
      console.log('[AuthStore] Fetching profile for:', uid);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.warn('[AuthStore] Profile fetch error:', error);
        
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
                teams: [],
                status: 'ACTIVE'
              })
              .select()
              .single();

            if (insertError) {
              console.error('[AuthStore] Profile creation failed:', insertError);
              // Fallback profile if insert fails
              set({ 
                profile: { 
                  id: user.id, 
                  email: user.email!, 
                  name: user.email?.split('@')[0] || 'User', 
                  role: 'user', 
                  teams: [],
                  status: 'ACTIVE',
                  created_at: new Date().toISOString()
                } 
              });
              return;
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
      
      // Fallback: If we can't get a profile, set a default one based on session user if possible
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ 
          profile: { 
            id: session.user.id, 
            email: session.user.email!, 
            name: session.user.email?.split('@')[0] || 'User', 
            role: 'user', 
            teams: [],
            status: 'ACTIVE',
            created_at: new Date().toISOString()
          } 
        });
      } else {
        set({ profile: null });
      }
    } finally {
      // MANDATORY: Always stop the loading state
      set({ loading: false });
      console.log('[AuthStore] Loading finished');
    }
  },
}));
