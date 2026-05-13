import { supabase } from './supabase';

export const logger = {
  log: async (action: string, description: string, metadata: any = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      await supabase.from('audit_logs').insert({
        action,
        description,
        user_id: user.id,
        user_name: profile?.name || user.email?.split('@')[0] || 'Unknown',
        metadata,
      });
    } catch (err) {
      console.error('[Logger] Failed to log action:', err);
    }
  }
};
