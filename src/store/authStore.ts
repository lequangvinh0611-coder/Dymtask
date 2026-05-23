import { create } from 'zustand';

interface AuthState {
  session: any | null;
  profile: any | null;
  currentUser?: any | null;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  initializeAuth: () => Promise<void>;
  setupListenerOnce: () => void;
  setSession: (session: any | null) => void;
  setProfile: (profile: any | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
  fetchProfile: (email: string) => Promise<any | null>;
}

const mockProfile = {
  id: '5354d1b2-6fd5-4529-a486-c1f32606c369',
  email: 'lequangvinh0611@gmail.com',
  name: 'Master Admin',
  role: 'Master',
  status: 'ACTIVE',
  team_ids: [],
  teams: []
};

const mockSession = {
  access_token: 'mock-token-dymtask',
  user: {
    id: '5354d1b2-6fd5-4529-a486-c1f32606c369',
    email: 'lequangvinh0611@gmail.com'
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: mockSession,
  profile: mockProfile,
  currentUser: mockProfile,
  loading: false,
  isLoading: false,
  error: null,

  setSession: (session) => {
    console.log('[MockAuthStore] setSession called', session);
    set({ session });
  },
  setProfile: (profile) => {
    console.log('[MockAuthStore] setProfile called', profile);
    set({ profile, currentUser: profile });
  },
  setLoading: (loading) => set({ loading, isLoading: loading }),
  setError: (error) => set({ error }),

  fetchProfile: async (email: string) => {
    console.log('[MockAuthStore] fetchProfile mock query for email:', email);
    return mockProfile;
  },

  initializeAuth: async () => {
    console.log('[MockAuthStore] Initializing under Mock Auth mode.');
    set({
      session: mockSession,
      profile: mockProfile,
      currentUser: mockProfile,
      loading: false,
      isLoading: false,
      error: null
    });
  },

  setupListenerOnce: () => {
    console.log('[MockAuthStore] setupListenerOnce registered (noop).');
  },

  signOut: async () => {
    console.log('[MockAuthStore] signOut called, resetting to public null (mock sign out).');
    set({
      session: null,
      profile: null,
      currentUser: null,
      loading: false,
      isLoading: false,
      error: null
    });
  }
}));

// Expose setupListenerOnce as utility interface
(useAuthStore as any).setupListenerOnce = () => {
  useAuthStore.getState().setupListenerOnce();
};
