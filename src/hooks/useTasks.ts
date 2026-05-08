import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database.types';

export interface TaskWithDetails extends Task {
  tags?: { name: string; color: string };
  projects?: { name: string };
  teams?: { name: string };
}

export const useTasks = (page = 1, pageSize = 15, filters: any = {}) => {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          tags (name, color),
          projects (name),
          teams (name)
        `, { count: 'exact' });

      // Apply filters
      if (filters && filters.status) query = query.eq('status', filters.status);
      if (filters && filters.project_id) query = query.eq('project_id', filters.project_id);
      
      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;
      console.log(`[Supabase] Fetched ${data?.length || 0} tasks from table "tasks".`);

      if (error) throw error;
      setTasks(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, JSON.stringify(filters)]);

  useEffect(() => {
    fetchTasks();

    // ⚡ Realtime subscription
    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('Realtime update received:', payload);
          // For simplicity, we re-fetch to ensure relations (tags, projects) are included
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  return { tasks, totalCount, loading, refetch: fetchTasks };
};
