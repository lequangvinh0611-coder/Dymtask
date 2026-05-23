import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthState {
  session: any | null;
  profile: any | null;
  loading: boolean;
  error: string | null;
  initializeAuth: () => Promise<void>;
  setSession: (session: any | null) => void;
  setProfile: (profile: any | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
  fetchProfile: (email: string) => Promise<any | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  error: null,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchProfile: async (email: string) => {
    try {
      console.log(`[AuthStore] Querying database for whitelist user: "${email}"`);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('[AuthStore] Error querying users table in database:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[AuthStore] Exception in fetchProfile database query:', err);
      return null;
    }
  },

  initializeAuth: async () => {
    set({ loading: true, error: null });
    try {
      // 1. Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email) {
        const profile = await get().fetchProfile(session.user.email);
        
        if (profile && profile.status === 'ACTIVE') {
          console.log('[AuthStore] Whitelisted active user loaded on init:', profile.email, `(${profile.role})`);
          set({ session, profile, loading: false });
        } else {
          console.warn('[AuthStore] Rejecting user on init:', session.user.email, profile ? `Status: ${profile.status}` : 'Not in whitelist');
          await supabase.auth.signOut();
          set({ 
            session: null, 
            profile: null, 
            loading: false,
            error: !profile 
              ? `Email "${session.user.email}" không nằm trong danh sách Whitelist cho phép đăng nhập!`
              : `Tài khoản "${session.user.email}" của bạn đã bị khóa (INACTIVE)!`
          });
        }
      } else {
        set({ session: null, profile: null, loading: false });
      }

      // 2. Setup auth state listener
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('[AuthStore] Auth event changed:', event, 'Email:', newSession?.user?.email);
        
        if (newSession?.user?.email) {
          set({ loading: true });
          const profile = await get().fetchProfile(newSession.user.email);
          
          if (profile && profile.status === 'ACTIVE') {
            console.log('[AuthStore] Whitelist check passed:', profile.email, `(${profile.role})`);
            set({ session: newSession, profile, loading: false, error: null });
          } else {
            console.warn('[AuthStore] Whitelist check failed, signing out:', newSession.user.email);
            // Sign out to clear invalid session
            await supabase.auth.signOut();
            
            const errorText = !profile 
              ? `Email "${newSession.user.email}" không nằm trong danh sách Whitelist cho phép đăng nhập!`
              : `Tài khoản "${newSession.user.email}" của bạn đã bị khóa (INACTIVE)!`;
            
            set({ 
              session: null, 
              profile: null, 
              loading: false,
              error: errorText
            });
            
            toast.error(!profile 
              ? `Đăng nhập thất bại: Email không có trong Whitelist!`
              : `Đăng nhập thất bại: Tài khoản đang bị khóa!`
            );
          }
        } else {
          // SIGNED_OUT or similar
          set({ session: null, profile: null, loading: false });
        }
      });
    } catch (err: any) {
      console.error('[AuthStore] Initialize error exception:', err);
      set({ session: null, profile: null, loading: false, error: err.message || 'Unknown initialization error' });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      console.log('[AuthStore] Signed out and session cleared.');
    } catch (err) {
      console.error('[AuthStore] Error performing signOut:', err);
    } finally {
      set({ session: null, profile: null, loading: false, error: null });
    }
  }
}));
