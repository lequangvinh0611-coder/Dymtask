import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database.types';
import { useAppStore } from '../types';

export interface TaskFilters {
  search?: string;
  status?: string;
  is_active?: boolean;
}

export const useTasks = (page = 1, pageSize = 20, filters: TaskFilters = {}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { refreshKey } = useAppStore();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' });

      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

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
  }, [fetchTasks, refreshKey]);

  useEffect(() => {
    const channel = supabase.channel('tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  return { tasks, totalCount, loading, refetch: fetchTasks };
};
