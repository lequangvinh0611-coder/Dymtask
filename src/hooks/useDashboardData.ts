import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database.types';
import { toast } from 'sonner';

export const useDashboardData = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata states
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [assigneesList, setAssigneesList] = useState<string[]>([]);

  // Safely fetch all metadata tables and handle failures
  const fetchMetadata = useCallback(async () => {
    try {
      const [
        { data: usersData, error: usersErr },
        { data: projectsData, error: projectsErr },
        { data: teamsData, error: teamsErr },
        { data: tagsData, error: tagsErr }
      ] = await Promise.all([
        supabase.from('users').select('name, status'),
        supabase.from('projects').select('name, is_active'),
        supabase.from('teams').select('name, is_active'),
        supabase.from('tags').select('name, is_active')
      ]);

      if (usersErr) console.warn('Lỗi fetch users:', usersErr);
      if (projectsErr) console.warn('Lỗi fetch projects:', projectsErr);
      if (teamsErr) console.warn('Lỗi fetch teams:', teamsErr);
      if (tagsErr) console.warn('Lỗi fetch tags:', tagsErr);

      const activeUsers = (usersData || [])
        .filter((u: any) => u.status !== 'INACTIVE' && u.name)
        .map((u: any) => u.name);

      const activeProj = (projectsData || [])
        .filter((p: any) => p.is_active !== false && p.name)
        .map((p: any) => p.name);

      const activeTms = (teamsData || [])
        .filter((t: any) => t.is_active !== false && t.name)
        .map((t: any) => t.name);

      const activeTgs = (tagsData || [])
        .filter((tg: any) => tg.is_active !== false && tg.name)
        .map((tg: any) => tg.name);

      setAssigneesList(activeUsers);
      setProjectsList(activeProj);
      setTeamsList(activeTms);
      setTagsList(activeTgs);
    } catch (err: any) {
      console.error('Lỗi khi fetch metadata trong useDashboardData:', err);
      toast.error('Không thể tải một số siêu dữ liệu cấu hình. Vui lòng thiết lập ở trang Quản lý.');
    }
  }, []);

  // Fetch all tasks from Supabase tasks table
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, description, task_type, status, is_active, est_time, actual_time, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setTasks(data || []);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu tasks:', err);
      const msg = err?.message || 'Không thể kết nối cơ sở dữ liệu Supabase.';
      setError(msg);
      toast.error(`Lỗi tải danh sách công việc: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up realtime sync
  useEffect(() => {
    fetchTasks();
    fetchMetadata();

    const channel = supabase.channel('dashboard_hook_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, fetchMetadata]);

  return {
    tasks,
    loading,
    error,
    projectsList,
    teamsList,
    tagsList,
    assigneesList,
    refetch: fetchTasks,
    refreshMetadata: fetchMetadata
  };
};
