import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task, Project, Team, Tag } from '../types/database.types';
import { useAppStore } from '../types';

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
  startDate?: string;
  endDate?: string;
  is_active?: boolean;
  masterDataMode?: boolean; // ✅ Added to differentiate Task Manager view
}

export const useTasks = (page = 1, pageSize = 20, filters: TaskFilters = {}) => {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { refreshKey } = useAppStore();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`*, tags(name, color), projects(name), teams(name)`, { count: (filters.startDate || filters.endDate) ? undefined : 'exact' });

      if (filters.search) query = query.ilike('task_name', `%${filters.search}%`);
      if (filters.project_id) query = query.eq('project_id', filters.project_id);
      
      if (filters.team_id) {
        if (Array.isArray(filters.team_id)) {
          if (filters.team_id.length > 0) query = query.in('team_id', filters.team_id);
        } else {
          query = query.eq('team_id', filters.team_id);
        }
      }
      
      if (filters.tag_id) query = query.eq('tag_id', filters.tag_id);
      if (filters.assignee_email) query = query.contains('assignees', [filters.assignee_email]);
      if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      // Handle Master Data Mode (Task Manager) filtering
      if (filters.masterDataMode) {
        // Only show ONETIME tasks that are NEW, but always show Recurring templates that are Active
        query = query.or(`type.neq.ONETIME,and(type.eq.ONETIME,status.eq.NEW)`);
      }

      if (filters.startDate || filters.endDate) {
        const startStr = filters.startDate || filters.endDate!;
        const endStr = filters.endDate || filters.startDate!;
        
        // Fetch all templates and instances within or related to the range
        const { data: allRelatedTasks, error } = await query
          .or(`type.neq.ONETIME,and(deadline_date.gte.${startStr},deadline_date.lte.${endStr})`);

        if (error) throw error;

        const start = new Date(startStr);
        const end = new Date(endStr);
        const result: TaskWithDetails[] = [];
        
        const templates = (allRelatedTasks as TaskWithDetails[]).filter(t => t.type !== 'ONETIME' && t.is_active);
        const instances = (allRelatedTasks as TaskWithDetails[]).filter(t => t.type === 'ONETIME');

        // Add instances that fall within the range
        instances.forEach(inst => result.push(inst));

        // For each day in the range, check which templates should appear
        const curr = new Date(start);
        while (curr <= end) {
          const dateStr = curr.toISOString().split('T')[0];
          const dayOfWeek = curr.toLocaleDateString('en-US', { weekday: 'short' });
          const dayOfMonth = curr.getDate();

          templates.forEach(tpl => {
            let shouldAppear = false;
            const creationDate = new Date(tpl.created_at).toISOString().split('T')[0];
            
            if (creationDate <= dateStr) {
              if (tpl.type === 'DAILY') shouldAppear = true;
              else if (tpl.type === 'WEEKLY' && tpl.deadline_days?.includes(dayOfWeek)) shouldAppear = true;
              else if (tpl.type === 'MONTHLY' && tpl.deadline_day_num === dayOfMonth) shouldAppear = true;
            }

            if (shouldAppear) {
              // Check if there's already an instance for this specific date
              const hasInstance = instances.some(inst => 
                inst.task_name === tpl.task_name && 
                inst.project_id === tpl.project_id &&
                inst.team_id === tpl.team_id &&
                inst.deadline_date === dateStr
              );
              if (!hasInstance) {
                // Return a virtual task for this specific date
                result.push({ 
                  ...tpl, 
                  status: 'NEW', 
                  actual_minutes: 0,
                  deadline_date: dateStr // Assign the specific date to the virtual task
                });
              }
            }
          });
          curr.setDate(curr.getDate() + 1);
        }

        let finalResults = result;
        if (filters.status) finalResults = finalResults.filter(t => t.status === filters.status);

        // Sort by deadline_date then task_name
        finalResults.sort((a, b) => {
          const dateA = a.deadline_date || '';
          const dateB = b.deadline_date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return (a.task_name || '').localeCompare(b.task_name || '');
        });

        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        setTasks(finalResults.slice(from, to));
        setTotalCount(finalResults.length);
      } else {
        if (filters.status) query = query.eq('status', filters.status);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query
          .range(from, to)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTasks((data as TaskWithDetails[]) || []);
        setTotalCount(count || 0);
      }
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