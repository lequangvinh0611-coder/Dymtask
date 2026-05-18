import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task, Project, Team, Tag } from '../types/database.types';

export interface TaskWithDetails extends Task {
  tags?: Tag | null;
  projects?: Project | null;
  teams?: Team | null;
}

export interface TaskFilters {
  search?: string;
  status?: string;
  project_id?: string;
  team_id?: string | string[];
  tag_id?: string;
  assignee_email?: string;
  date?: string;
}

export const useTasks = (page = 1, pageSize = 20, filters: TaskFilters = {}) => {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`*, tags(name, color), projects(name), teams(name)`, { count: 'exact' });

      if (filters.search) query = query.ilike('task_name', `%${filters.search}%`);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.project_id) query = query.eq('project_id', filters.project_id);
      
      if (filters.team_id) {
        if (Array.isArray(filters.team_id)) {
          if (filters.team_id.length > 0) {
            query = query.in('team_id', filters.team_id);
          }
        } else {
          query = query.eq('team_id', filters.team_id);
        }
      }
      
      if (filters.tag_id) query = query.eq('tag_id', filters.tag_id);
      if (filters.assignee_email) query = query.contains('assignees', [filters.assignee_email]);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data as TaskWithDetails[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, JSON.stringify(filters)]);

  useEffect(() => {
    fetchTasks();
    const channel = supabase.channel('tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchTasks(); // Fetch lại để lấy dữ liệu JOIN
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  return { tasks, totalCount, loading, refetch: fetchTasks };
};