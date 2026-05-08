/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Đảm bảo URL sạch sẽ, không có /rest/v1 hay /auth/v1
const cleanUrl = (supabaseUrl || '').trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/auth\/v1\/?$/, '')
  .replace(/\/$/, '');

if (!cleanUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing credentials in .env');
}

export const supabase = createClient(
  cleanUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce' // Khuyên dùng cho Supabase v2
    }
  }
);
