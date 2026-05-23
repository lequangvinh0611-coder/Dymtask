import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RotateCcw, Clock, Check, AlertCircle, ChevronLeft, ChevronRight, 
  X, Calendar, Download, RefreshCw, Layers, CheckSquare, Square, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DateRangePicker } from './ui/DateRangePicker';
import { FilterSelect } from './ui/FilterSelect';
import { toast } from 'sonner';
import { useAppStore } from '../types';
import { useAuthStore } from '../store/authStore';

// TS interfaces matching the schema
interface SubTask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
  actual_minutes?: number; // Realized minutes tracked for To-do
  sub_status?: 'New' | 'Done' | 'Skipped'; // Status of individual sub-task
}

interface TaskMetadata {
  description: string;
  project_name: string;
  team_name: string;
  tag_name: string;
  deadline_time: string;
  deadline_days: string;
  sub_tasks: SubTask[];
  todo_status?: 'NEW' | 'DONE' | 'SKIPPED'; // Checklist status stored in JSON
  todo_date?: string; // Date of list tracking
  completions?: Record<string, { todo_status: 'NEW' | 'DONE' | 'SKIPPED', actual_time: number, sub_tasks?: SubTask[] }>;
}

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string; // 'ON' / 'OFF' template setting
  is_active: boolean;
  est_time: number;
  actual_time: number;
  created_at: string;
  assignees?: string[];
}

interface VirtualTask extends DbTask {
  virtual_id: string;
  meta: TaskMetadata;
  project_name?: string;
  team_name?: string;
  tag_name?: string;
  todo_date: string;
  todo_status: string;
  sub_tasks: any[];
}

const getDatesBetween = (start: string, end: string) => {
  const dates = [];
  let curr = new Date(start);
  const last = new Date(end);
  while (curr <= last) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

const AVAILABLE_PROJECTS = ['【事務代行】HR TECH', 'GLOBAL OUTSOURCING', '求人媒体運用', 'RECRUITING MANAGEMENT', 'ADMIN OPERATIONS'];
const AVAILABLE_TEAMS = ['内部・2課E', '内部・1課', 'アウトソーシングG', '人事総務部', '営業サポート課'];
const AVAILABLE_TAGS = ['求人更新', '数値報告', 'メールチェック', 'レポート作成', 'データ入力'];
const AVAILABLE_ASSIGNEES = ['PHAN QUANG DAT', 'LE QUANG VINH', 'LE QUANG VINH 2', 'VINH 1', 'VINH 2'];

// Helper to convert UUID to a secure, stable 6-digit number string
const getDisplayId = (uuid: string): string => {
  if (!uuid) return '000001';
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash << 5) - hash + uuid.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash) % 1000000;
  return String(positiveHash).padStart(6, '0');
};

const parseTaskDescription = (rawDescription: any): TaskMetadata => {
  const defaultMeta: TaskMetadata = {
    description: '',
    project_name: '【事務代行】HR TECH',
    team_name: '内部・1課',
    tag_name: '数値報告',
    deadline_time: '17:00',
    deadline_days: 'Mon - Fri',
    sub_tasks: [],
    todo_status: 'NEW'
  };

  if (!rawDescription) return defaultMeta;

  if (typeof rawDescription === 'object') {
    return {
      description: rawDescription.description || '',
      project_name: rawDescription.project_name || '【事務代行】HR TECH',
      team_name: rawDescription.team_name || '内部・1課',
      tag_name: rawDescription.tag_name || '数値報告',
      deadline_time: rawDescription.deadline_time || '17:00',
      deadline_days: rawDescription.deadline_days || 'Mon - Fri',
      sub_tasks: Array.isArray(rawDescription.sub_tasks) ? rawDescription.sub_tasks : [],
      todo_status: rawDescription.todo_status || 'NEW',
      todo_date: rawDescription.todo_date,
      completions: rawDescription.completions || {}
    };
  }

  if (typeof rawDescription === 'string') {
    const trimmed = rawDescription.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          description: parsed.description || '',
          project_name: parsed.project_name || '【事務代行】HR TECH',
          team_name: parsed.team_name || '内部・1課',
          tag_name: parsed.tag_name || '数値報告',
          deadline_time: parsed.deadline_time || '17:00',
          deadline_days: parsed.deadline_days || 'Mon - Fri',
          sub_tasks: Array.isArray(parsed.sub_tasks) ? parsed.sub_tasks : [],
          todo_status: parsed.todo_status || 'NEW',
          todo_date: parsed.todo_date,
          completions: parsed.completions || {}
        };
      } catch {
        // JSON format issue, fallback to normal values
      }
    }
  }

  return {
    ...defaultMeta,
    description: String(rawDescription)
  };
};

const serializeTaskDescription = (metadata: TaskMetadata): any => {
  return metadata;
};

const TaskList: React.FC<{ title?: string }> = ({ title = "To-do List" }) => {
  const { profile } = useAuthStore();
  const isUser = (profile?.role || '').toString().toLowerCase().trim() === 'user';
  const { showConfirm } = useAppStore();
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  // Database Tasks State (where status column is 'ON', i.e., template active)
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter conditions state matched to Mockup
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterTodoStatus, setFilterTodoStatus] = useState('NEW'); // default 'New' as shown under the status dropdown
  
  // Date configuration
  const [startDate, setStartDate] = useState('2026-05-20');
  const [endDate, setEndDate] = useState('2026-05-20');

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected tasks (checkbox selection column)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isQuickSkipMode, setIsQuickSkipMode] = useState(false);

  // Drawer slider panel
  const [openedTask, setOpenedTask] = useState<VirtualTask | null>(null);

  // Initial tasks loader filtering is_active = true
  const loadActiveTasks = async () => {
    setLoading(true);
    try {
      // Query active tasks (is_active = true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách To-do:', err);
    } finally {
      setLoading(false);
    }
  };

  // Metadata states
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [assigneesList, setAssigneesList] = useState<string[]>([]);

  // Fetch metadata dynamically and filter only active ones
  const fetchMetadata = async () => {
    try {
      const [
        { data: usersData },
        { data: projectsData },
        { data: teamsData },
        { data: tagsData }
      ] = await Promise.all([
        supabase.from('users').select('name, status'),
        supabase.from('projects').select('name, is_active'),
        supabase.from('teams').select('name, is_active'),
        supabase.from('tags').select('name, is_active')
      ]);

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
    } catch (err) {
      console.error('Error fetching metadata in TaskList:', err);
    }
  };

  useEffect(() => {
    loadActiveTasks();
    fetchMetadata();

    const channel = supabase.channel('todo_realtime_metadata_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadActiveTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchMetadata())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Parse task fields from description-packed JSON meta tags
  const parsedTasks = useMemo(() => {
    return tasks.map(task => {
      const meta = parseTaskDescription(task.description);
      return {
        ...task,
        meta,
        project_name: meta.project_name,
        team_name: meta.team_name,
        tag_name: meta.tag_name,
        deadline_time: meta.deadline_time,
        deadline_days: meta.deadline_days,
        sub_tasks: meta.sub_tasks,
        todo_status: meta.todo_status || 'NEW',
        todo_date: meta.todo_date || new Date(task.created_at).toISOString().split('T')[0]
      };
    });
  }, [tasks]);

  // Generate frontend trackable virtual tasks for 'DAILY' type within startDate & endDate
  const virtualTasks = useMemo(() => {
    const dates = getDatesBetween(startDate, endDate);
    const list: VirtualTask[] = [];

    parsedTasks.forEach(task => {
      const isDaily = task.task_type?.toUpperCase() === 'DAILY';

      if (isDaily) {
        dates.forEach(date => {
          const completions = task.meta.completions || {};
          const completion = completions[date];
          
          const todo_status = completion?.todo_status || 'NEW';
          const actual_time = completion?.actual_time || 0;
          
          // Map subtasks separately per date
          const sub_tasks = completion?.sub_tasks || task.meta.sub_tasks.map(s => ({
            ...s,
            sub_status: 'New' as const,
            actual_minutes: 0
          }));

          list.push({
            ...task,
            virtual_id: `${task.id}_${date}`,
            todo_date: date,
            todo_status,
            actual_time,
            sub_tasks
          });
        });
      } else {
        const todo_date = task.todo_date || new Date(task.created_at).toISOString().split('T')[0];
        list.push({
          ...task,
          virtual_id: task.id,
          todo_date,
          todo_status: task.todo_status || 'NEW',
          sub_tasks: task.sub_tasks || []
        });
      }
    });

    return list;
  }, [parsedTasks, startDate, endDate]);

  // Sync opened task dynamically inside the slider drawer
  useEffect(() => {
    if (openedTask) {
      const updatedOpenedTask = virtualTasks.find(t => t.virtual_id === openedTask.virtual_id);
      if (updatedOpenedTask) {
        const strA = JSON.stringify(updatedOpenedTask);
        const strB = JSON.stringify(openedTask);
        if (strA !== strB) {
          setOpenedTask(updatedOpenedTask);
        }
      }
    }
  }, [virtualTasks, openedTask]);

  // Extract dynamically options list
  const assigneesOptions = useMemo(() => {
    if (assigneesList.length > 0) {
      return assigneesList;
    }
    return AVAILABLE_ASSIGNEES;
  }, [assigneesList]);

  const tagsOptions = useMemo(() => {
    if (tagsList.length > 0) {
      return tagsList;
    }
    return AVAILABLE_TAGS;
  }, [tagsList]);

  const projectsOptions = useMemo(() => {
    if (projectsList.length > 0) {
      return projectsList;
    }
    return AVAILABLE_PROJECTS;
  }, [projectsList]);

  const teamsOptions = useMemo(() => {
    if (teamsList.length > 0) {
      return teamsList;
    }
    return AVAILABLE_TEAMS;
  }, [teamsList]);

  // Filter logic
  const filteredTasks = useMemo(() => {
    return virtualTasks.filter(task => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const displayId = getDisplayId(task.id);
        const matchTitle = (task.title || '').toLowerCase().includes(query);
        const matchId = displayId.includes(query);
        const matchProj = (task.project_name || '').toLowerCase().includes(query);
        const matchTeam = (task.team_name || '').toLowerCase().includes(query);
        if (!matchTitle && !matchId && !matchProj && !matchTeam) return false;
      }

      // 2. Assignee / Personnel filter
      if (filterAssignee) {
        if (filterAssignee === 'ME') {
          const myName = (profile?.name || '').toLowerCase().trim();
          const hasInSubTask = task.sub_tasks.some(s => (s.assignee || '').toLowerCase().trim() === myName);
          const hasInMain = task.assignees?.some(a => (a || '').toLowerCase().trim() === myName);
          if (!hasInSubTask && !hasInMain) return false;
        } else {
          const hasInSubTask = task.sub_tasks.some(s => s.assignee === filterAssignee);
          const hasInMain = task.assignees?.includes(filterAssignee);
          if (!hasInSubTask && !hasInMain) return false;
        }
      }

      // 3. Tag filter
      if (filterTag && task.tag_name !== filterTag) return false;

      // 4. Project filter
      if (filterProject && task.project_name !== filterProject) return false;

      // 5. Team filter
      if (filterTeam && task.team_name !== filterTeam) return false;

      // 6. To-do checklist status filter ('NEW' | 'DONE' | 'SKIPPED')
      if (filterTodoStatus && task.todo_status !== filterTodoStatus) return false;

      // 7. Date Filter (matched to todo_date or creation date boundary)
      if (startDate && endDate) {
        const taskDate = task.todo_date;
        if (taskDate < startDate || taskDate > endDate) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.todo_date || '';
      const dateB = b.todo_date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const dlA = a.deadline_time || '';
      const dlB = b.deadline_time || '';
      if (dlA !== dlB) return dlA.localeCompare(dlB);

      const teamA = a.team_name || '';
      const teamB = b.team_name || '';
      if (teamA !== teamB) return teamA.localeCompare(teamB);

      const projA = a.project_name || '';
      const projB = b.project_name || '';
      if (projA !== projB) return projA.localeCompare(projB);

      const tagA = a.tag_name || '';
      const tagB = b.tag_name || '';
      if (tagA !== tagB) return tagA.localeCompare(tagB);

      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB);
    });
  }, [virtualTasks, searchQuery, filterAssignee, filterTag, filterProject, filterTeam, filterTodoStatus, startDate, endDate, profile]);

  // Paginated client side calculation
  const totalCount = filteredTasks.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredTasks.slice(startIdx, startIdx + pageSize);
  }, [filteredTasks, page]);

  // Handle checking checkbox
  const handleToggleSelectRow = (virtualId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(virtualId)) {
        next.delete(virtualId);
      } else {
        next.add(virtualId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedTaskIds.size === paginatedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(paginatedTasks.map(t => t.virtual_id)));
    }
  };

  // Submit task directly changing status to DONE from actions button
  const handleDirectSubmit = async (task: VirtualTask) => {
    try {
      const { data: dbData, error: fetchErr } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', task.id)
        .single();

      if (fetchErr) throw fetchErr;

      const meta = parseTaskDescription(dbData?.description);
      const isRecurring = ['DAILY', 'WEEKLY', 'MONTHLY'].includes((task.task_type || '').toUpperCase());

      // Auto complete all 'New' sub-tasks to 'Done' if submitted from list, or protect drawer choices
      const updatedSubTasks = (task.sub_tasks || []).map(sub => {
        const current_sub_status = sub.sub_status || 'New';
        const sub_status = (current_sub_status === 'New' ? 'Done' : current_sub_status) as 'New' | 'Done' | 'Skipped';
        const actual_minutes = sub.actual_minutes !== undefined && sub.actual_minutes > 0 ? sub.actual_minutes : (sub_status === 'Skipped' ? 0 : sub.estimated_minutes);
        return {
          ...sub,
          sub_status,
          actual_minutes
        };
      });

      const calculated_actual_time = updatedSubTasks.reduce((sum, sub) => sum + (sub.actual_minutes || 0), 0);
      const hasSubtasks = updatedSubTasks.length > 0;
      const allSkipped = hasSubtasks && updatedSubTasks.every(sub => sub.sub_status === 'Skipped');
      const finalStatus = allSkipped ? 'SKIPPED' : 'DONE';

      let updatedMeta: TaskMetadata;

      if (isRecurring) {
        const completions = meta.completions || {};
        completions[task.todo_date] = {
          todo_status: finalStatus,
          actual_time: calculated_actual_time,
          sub_tasks: updatedSubTasks
        };

        updatedMeta = {
          ...meta,
          completions
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Sync local tasks state list
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t));

        if (openedTask && openedTask.id === task.id && openedTask.todo_date === task.todo_date) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time,
            todo_status: finalStatus,
            sub_tasks: updatedSubTasks
          });
        }
      } else {
        updatedMeta = {
          ...meta,
          todo_status: finalStatus,
          sub_tasks: updatedSubTasks
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time,
            is_active: false
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Sync local tasks state list
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta),
          actual_time: calculated_actual_time,
          is_active: false
        } : t));

        if (openedTask && openedTask.id === task.id) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time,
            todo_status: finalStatus,
            sub_tasks: updatedSubTasks,
            is_active: false
          });
        }
      }

      toast.success('Ghi nhận việc hoàn thành thành công!');
    } catch (err: any) {
      console.error('Error submitting task:', err);
      toast.error(`Có lỗi xảy ra khi submit: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Reset task back to NEW or other status adjustments inside the slider drawer
  const handleResetTask = async (task: VirtualTask) => {
    const isOneTime = (task.task_type || '').toUpperCase() === 'ONETIME';

    // Lock Reset if template is inactive and not OneTime
    if (!isOneTime && !task.is_active) {
      toast.error("Không cho phép Reset nếu Task đang tắt ở Task Manager!");
      return;
    }

    try {
      const { data: dbData, error: fetchErr } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', task.id)
        .single();

      if (fetchErr) throw fetchErr;

      const meta = parseTaskDescription(dbData?.description);
      const isRecurring = ['DAILY', 'WEEKLY', 'MONTHLY'].includes((task.task_type || '').toUpperCase());

      if (isRecurring) {
        const completions = meta.completions || {};
        // Reset individual sub-tasks to New and actual mins to 0
        const updatedSubTasks = (task.sub_tasks || []).map(sub => ({
          ...sub,
          sub_status: 'New' as const,
          actual_minutes: 0
        }));

        completions[task.todo_date] = {
          todo_status: 'NEW',
          actual_time: 0,
          sub_tasks: updatedSubTasks
        };

        const updatedMeta: TaskMetadata = {
          ...meta,
          completions
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Sync state
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t));

        if (openedTask && openedTask.id === task.id && openedTask.todo_date === task.todo_date) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: 0,
            todo_status: 'NEW',
            sub_tasks: updatedSubTasks
          });
        }
      } else {
        // Reset individual sub-tasks to New and actual mins to 0
        const updatedSubTasks = (meta.sub_tasks || []).map(sub => ({
          ...sub,
          sub_status: 'New' as const,
          actual_minutes: 0
        }));

        // Update OneTime's date to today to prevent floating into the past
        const todayStr = new Date().toISOString().split('T')[0];
        const updatedMeta: TaskMetadata = {
          ...meta,
          todo_status: 'NEW',
          todo_date: todayStr,
          sub_tasks: updatedSubTasks
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta),
            actual_time: 0,
            is_active: true
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Sync state
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta),
          actual_time: 0,
          is_active: true
        } : t));

        if (openedTask && openedTask.id === task.id) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: 0,
            todo_status: 'NEW',
            todo_date: todayStr,
            sub_tasks: updatedSubTasks,
            is_active: true
          });
        }
      }

      toast.success('Reset việc thành công!');
    } catch (err: any) {
      console.error('Error resetting task:', err);
      toast.error(`Reset thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Skip task checklist representation completely
  const handleSkipTask = async (task: VirtualTask) => {
    try {
      const { data: dbData, error: fetchErr } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', task.id)
        .single();

      if (fetchErr) throw fetchErr;

      const meta = parseTaskDescription(dbData?.description);
      const isRecurring = ['DAILY', 'WEEKLY', 'MONTHLY'].includes((task.task_type || '').toUpperCase());

      if (isRecurring) {
        const completions = meta.completions || {};
        const currentCompletion = completions[task.todo_date] || {
          todo_status: 'NEW',
          actual_time: 0,
          sub_tasks: (task.sub_tasks || []).map(sub => ({
            ...sub,
            sub_status: 'New' as const,
            actual_minutes: 0
          }))
        };

        completions[task.todo_date] = {
          ...currentCompletion,
          todo_status: 'SKIPPED'
        };

        const updatedMeta: TaskMetadata = {
          ...meta,
          completions
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t));

        if (openedTask && openedTask.id === task.id && openedTask.todo_date === task.todo_date) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            todo_status: 'SKIPPED'
          });
        }
      } else {
        const updatedMeta: TaskMetadata = {
          ...meta,
          todo_status: 'SKIPPED'
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t));

        if (openedTask && openedTask.id === task.id) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            todo_status: 'SKIPPED'
          });
        }
      }

      toast.success('Bỏ qua việc thành công!');
    } catch (err: any) {
      console.error('Error skipping task:', err);
      toast.error(`Bỏ qua thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Update specific sub-task work characteristics (Actual Minutes or Status) inside the drawer
  const handleUpdateSubtaskValue = async (
    task: VirtualTask, 
    subtaskId: string, 
    fields: Partial<Pick<SubTask, 'actual_minutes' | 'sub_status'>>
  ) => {
    try {
      const { data: dbData, error: fetchErr } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', task.id)
        .single();

      if (fetchErr) throw fetchErr;

      const meta = parseTaskDescription(dbData?.description);
      const isRecurring = ['DAILY', 'WEEKLY', 'MONTHLY'].includes((task.task_type || '').toUpperCase());

      if (isRecurring) {
        const completions = meta.completions || {};
        const currentCompletion = completions[task.todo_date] || {
          todo_status: 'NEW' as const,
          actual_time: 0,
          sub_tasks: (task.sub_tasks || []).map(sub => ({
            ...sub,
            sub_status: 'New' as const,
            actual_minutes: 0
          }))
        };

        const updatedSubTasks = currentCompletion.sub_tasks.map(sub => {
          if (sub.id === subtaskId) {
            return {
              ...sub,
              ...fields
            };
          }
          return sub;
        });

        const calculated_actual_time = updatedSubTasks.reduce((sum, sub) => sum + (sub.actual_minutes || 0), 0);
        const parentTodoStatus = currentCompletion.todo_status || 'NEW';

        completions[task.todo_date] = {
          todo_status: parentTodoStatus,
          actual_time: calculated_actual_time,
          sub_tasks: updatedSubTasks
        };

        const updatedMeta: TaskMetadata = {
          ...meta,
          completions
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Local state adjustment
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t));

        if (openedTask && openedTask.id === task.id && openedTask.todo_date === task.todo_date) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time,
            todo_status: parentTodoStatus,
            sub_tasks: updatedSubTasks
          });
        }
      } else {
        const updatedSubTasks = (meta.sub_tasks || []).map(sub => {
          if (sub.id === subtaskId) {
            return {
              ...sub,
              ...fields
            };
          }
          return sub;
        });

        const calculated_actual_time = updatedSubTasks.reduce((sum, sub) => sum + (sub.actual_minutes || 0), 0);
        const parentTodoStatus = meta.todo_status || 'NEW';

        const updatedMeta: TaskMetadata = {
          ...meta,
          todo_status: parentTodoStatus,
          sub_tasks: updatedSubTasks
        };

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time
          })
          .eq('id', task.id);

        if (updateErr) throw updateErr;

        // Local state adjustment
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta),
          actual_time: calculated_actual_time
        } : t));

        if (openedTask && openedTask.id === task.id) {
          setOpenedTask({
            ...openedTask,
            description: serializeTaskDescription(updatedMeta),
            actual_time: calculated_actual_time,
            todo_status: parentTodoStatus,
            sub_tasks: updatedSubTasks
          });
        }
      }

      toast.success('Cập nhật subtask thành công!');
    } catch (err: any) {
      console.error('Error updating subtask value:', err);
      toast.error(`Cập nhật subtask thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Export current listings to CSV spreadsheet
  const handleExportCsv = () => {
    if (filteredTasks.length === 0) return;
    
    const headers = ['ID', 'TASK NAME', 'TAG', 'PROJECT', 'TEAM', 'TYPE', 'DEADLINE', 'EST TIME', 'ACT TIME', 'STATUS'];
    const csvContent = [
      headers.join(','),
      ...filteredTasks.map(task => {
        return [
          `"${getDisplayId(task.id)}"`,
          `"${(task.title || '').replace(/"/g, '""')}"`,
          `"${(task.tag_name || '').replace(/"/g, '""')}"`,
          `"${(task.project_name || '').replace(/"/g, '""')}"`,
          `"${(task.team_name || '').replace(/"/g, '""')}"`,
          `"${task.task_type || ''}"`,
          `"${task.deadline_time || ''} ${task.deadline_days || ''}"`,
          `"${task.est_time || 0}m"`,
          `"${task.actual_time || 0}m"`,
          `"${task.todo_status || 'NEW'}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dym_todo_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Submit selected tasks
  const handleBulkSubmit = async () => {
    if (selectedTaskIds.size === 0) return;

    showConfirm({
      title: "Xác nhận Submit",
      message: `Bạn có chắc muốn Submit ${selectedTaskIds.size} task đã chọn không?`,
      confirmText: "Submit",
      cancelText: "Hủy",
      onConfirm: async () => {
        setIsBulkSubmitting(true);
        try {
          for (const virtualId of selectedTaskIds) {
            const taskObj = virtualTasks.find(t => t.virtual_id === virtualId);
            if (taskObj) {
              await handleDirectSubmit(taskObj);
            }
          }
          setSelectedTaskIds(new Set());
          toast.success('Đã hoàn thành submit hàng loạt!');
        } catch (err: any) {
          toast.error(`Lỗi khi xử lý hàng loạt: ${err.message}`);
        } finally {
          setIsBulkSubmitting(false);
        }
      }
    });
  };

  // Quick Skip batch selected items
  const handleQuickSkipBatch = async () => {
    if (selectedTaskIds.size === 0) {
      setIsQuickSkipMode(false);
      return;
    }

    setLoading(true);
    try {
      let currentTasksList = [...tasks];

      for (const virtualId of selectedTaskIds) {
        const taskObj = virtualTasks.find(t => t.virtual_id === virtualId);
        if (!taskObj) continue;

        const { data: dbData, error: fetchErr } = await supabase
          .from('tasks')
          .select('description')
          .eq('id', taskObj.id)
          .single();

        if (fetchErr) throw fetchErr;

        const meta = parseTaskDescription(dbData?.description);
        const isDaily = taskObj.task_type?.toUpperCase() === 'DAILY';
        let updatedMeta: TaskMetadata;

        if (isDaily) {
          const completions = meta.completions || {};
          const currentCompletion = completions[taskObj.todo_date] || {
            todo_status: 'NEW',
            actual_time: 0,
            sub_tasks: (taskObj.sub_tasks || []).map(sub => ({
              ...sub,
              sub_status: 'New' as const,
              actual_minutes: 0
            }))
          };

          completions[taskObj.todo_date] = {
            ...currentCompletion,
            todo_status: 'SKIPPED'
          };

          updatedMeta = {
            ...meta,
            completions
          };
        } else {
          updatedMeta = {
            ...meta,
            todo_status: 'SKIPPED'
          };
        }

        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            description: serializeTaskDescription(updatedMeta)
          })
          .eq('id', taskObj.id);

        if (updateErr) throw updateErr;

        currentTasksList = currentTasksList.map(t => t.id === taskObj.id ? {
          ...t,
          description: serializeTaskDescription(updatedMeta)
        } : t);
      }

      setTasks(currentTasksList);

      if (openedTask) {
        const updated = currentTasksList.find(t => t.id === openedTask.id);
        if (updated) {
          const parsed = parseTaskDescription(updated.description);
          if (openedTask.task_type?.toUpperCase() === 'DAILY') {
            const completion = parsed.completions?.[openedTask.todo_date];
            if (completion?.todo_status === 'SKIPPED') {
              setOpenedTask({
                ...openedTask,
                description: updated.description,
                todo_status: 'SKIPPED'
              });
            }
          } else {
            if (parsed.todo_status === 'SKIPPED') {
              setOpenedTask({
                ...openedTask,
                description: updated.description,
                todo_status: 'SKIPPED'
              });
            }
          }
        }
      }

      toast.success(`Đã skip thành công ${selectedTaskIds.size} nhiệm vụ!`, {
        position: 'bottom-right'
      });
    } catch (err: any) {
      console.error('Error in Quick Skip batch:', err);
      toast.error(`Có lỗi xảy ra: ${err.message}`, {
        position: 'bottom-right'
      });
    } finally {
      setSelectedTaskIds(new Set());
      setIsQuickSkipMode(false);
      setLoading(false);
    }
  };

  // Parse details for Slider drawer component
  const openedTaskParsedMeta = useMemo(() => {
    if (!openedTask) return null;
    return parseTaskDescription(openedTask.description);
  }, [openedTask]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-x-auto relative font-sans">
      
      {/* 1. Header with Filters of Checklist To-do */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 flex-nowrap overflow-visible relative z-[40] min-w-max w-full select-none">
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              className="pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs w-40 focus:outline-none focus:border-slate-400 font-medium text-slate-700 h-8 shadow-sm"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Assignees/Personnel filter */}
          <FilterSelect
            value={filterAssignee}
            onChange={(val) => {
              setFilterAssignee(val);
              setPage(1);
            }}
            defaultOptionLabel="Assignees"
            options={[{value: 'ME', label: 'Chỉ việc của tôi'}, ...assigneesOptions.map(person => ({ value: person, label: person }))]}
            className="h-8 min-w-[120px]"
          />

          {/* Project filter */}
          <FilterSelect
            value={filterProject}
            onChange={(val) => {
              setFilterProject(val);
              setPage(1);
            }}
            defaultOptionLabel="Projects"
            options={projectsOptions.map(proj => ({ value: proj, label: proj }))}
            className="h-8 min-w-[105px]"
          />

          {/* Tag filter */}
          <FilterSelect
            value={filterTag}
            onChange={(val) => {
              setFilterTag(val);
              setPage(1);
            }}
            defaultOptionLabel="Tags"
            options={tagsOptions.map(tag => ({ value: tag, label: tag }))}
            className="h-8 min-w-[105px]"
          />

          {/* Team filter */}
          <FilterSelect
            value={filterTeam}
            onChange={(val) => {
              setFilterTeam(val);
              setPage(1);
            }}
            defaultOptionLabel="Teams"
            options={teamsOptions.map(tm => ({ value: tm, label: tm }))}
            className="h-8 min-w-[105px]"
          />

          {/* Status checklist filter (NEW, DONE, SKIPPED) */}
          <FilterSelect
            value={filterTodoStatus}
            onChange={(val) => {
              setFilterTodoStatus(val);
              setPage(1);
            }}
            defaultOptionLabel="Status"
            options={[
              { value: 'NEW', label: 'New' },
              { value: 'DONE', label: 'Done' },
              { value: 'SKIPPED', label: 'Skipped' }
            ]}
            className="h-8 min-w-[95px]"
          />

          {/* Interactive Date Range custom box mimicking mockup */}
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start || '2026-05-20');
              setEndDate(end || '2026-05-20');
              setPage(1);
            }}
            className="h-8"
          />

          {/* Reset Filters */}
          {(searchQuery || filterAssignee || filterTag || filterProject || filterTeam || filterTodoStatus !== 'NEW' || startDate !== '2026-05-20' || endDate !== '2026-05-20') && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterAssignee('');
                setFilterTag('');
                setFilterProject('');
                setFilterTeam('');
                setFilterTodoStatus('NEW');
                setStartDate('2026-05-20');
                setEndDate('2026-05-20');
                setPage(1);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Main interactive triggers */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedTaskIds.size > 0 && !isQuickSkipMode && (
            <button
              onClick={handleBulkSubmit}
              disabled={isBulkSubmitting}
              className="flex items-center gap-1.5 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 transition-colors text-white rounded-md text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isBulkSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckSquare size={13} />
              )}
              <span>{isBulkSubmitting ? 'Submitting...' : `Submit checked (${selectedTaskIds.size})`}</span>
            </button>
          )}

          {!isUser && (
            <button 
              onClick={() => {
                if (isQuickSkipMode) {
                  handleQuickSkipBatch();
                } else {
                  setIsQuickSkipMode(true);
                }
              }}
              className={`h-8 px-3 flex items-center gap-1.5 border rounded-md transition-colors font-semibold text-xs whitespace-nowrap ${
                isQuickSkipMode 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm' 
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isQuickSkipMode ? `Skip selected (${selectedTaskIds.size})` : 'Quick Skip'}</span>
            </button>
          )}

          <button 
            onClick={handleExportCsv}
            disabled={filteredTasks.length === 0}
            className="h-8 px-3 flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-md transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Main Daily Checklist tasks list Table context */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white min-h-[400px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-medium animate-pulse">Loading checklist...</p>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <table className="w-full text-left border-collapse table-fixed select-none min-w-[1100px]">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
              <tr className="h-8">
                {isQuickSkipMode && (
                  <th className="w-[5%] px-3 text-center bg-slate-100">
                    <button onClick={handleToggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {selectedTaskIds.size === paginatedTasks.length ? (
                        <CheckSquare size={14} className="text-indigo-600 mx-auto" />
                      ) : (
                        <Square size={14} className="mx-auto" />
                      )}
                    </button>
                  </th>
                )}
                <th className={`${isQuickSkipMode ? 'w-[10%]' : 'w-[15%]'} px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100`}>Id</th>
                <th className="w-[21%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Task Name</th>
                <th className="w-[17%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Project</th>
                <th className="w-[11%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Tag</th>
                <th className="w-[11%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Team</th>
                <th className="w-[8%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Type</th>
                <th className="w-[12%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Deadline</th>
                <th className="w-[12%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Time</th>
                <th className="w-[10%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Status</th>
                <th className="w-[10%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((task) => {
                const isChecked = selectedTaskIds.has(task.virtual_id);
                return (
                  <tr 
                    key={task.virtual_id} 
                    className="h-9 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => setOpenedTask(task)}
                  >
                    {/* Checkbox selector item */}
                    {isQuickSkipMode && (
                      <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleToggleSelectRow(task.virtual_id)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare size={14} className="text-indigo-600 mx-auto" />
                          ) : (
                            <Square size={14} className="mx-auto" />
                          )}
                        </button>
                      </td>
                    )}

                    {/* ID */}
                    <td className="px-3 py-1.5">
                      <span className="font-mono text-xs text-slate-400 font-medium">
                        {getDisplayId(task.id)}
                      </span>
                    </td>

                    {/* Task Name */}
                    <td className="px-3 py-1.5 overflow-hidden">
                      <span className="font-medium text-slate-700 text-xs truncate block" title={task.title || ''}>
                        {task.title}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="px-3 py-1.5 overflow-hidden">
                      <span className="text-slate-600 text-xs truncate block font-normal">
                        {task.project_name}
                      </span>
                    </td>

                    {/* Tag label */}
                    <td className="px-3 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-block bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 truncate max-w-full font-medium">
                        {task.tag_name || '数値報告'}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="px-3 py-1.5 overflow-hidden">
                      <span className="text-slate-500 text-xs truncate block font-normal">
                        {task.team_name}
                      </span>
                    </td>

                    {/* Frequency Badge */}
                    <td className="px-3 py-1.5 text-center">
                      <span className="inline-block bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-medium">
                        {task.task_type || 'DAILY'}
                      </span>
                    </td>

                    {/* Deadline hours and days limit representation */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate" title={`${task.deadline_time || '08:30'} ${task.deadline_days || 'Mon - Fri'}`}>
                          {task.todo_date} ({task.deadline_time || '08:30'})
                        </span>
                      </div>
                    </td>

                    {/* TIME (EST/ACT) columns */}
                    <td className="px-3 py-1.5 text-center">
                      <span className="font-mono text-xs text-slate-600">
                        {task.est_time || 0}m / <span className="text-emerald-600 font-medium">{task.actual_time || 0}m</span>
                      </span>
                    </td>

                    {/* To-do list internal status pill with standard minimalistic dot */}
                    <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          task.todo_status === 'DONE' 
                            ? 'bg-emerald-500' 
                            : task.todo_status === 'SKIPPED'
                              ? 'bg-slate-400'
                              : 'bg-blue-500'
                        }`} />
                        <span className="text-xs text-slate-600">
                          {task.todo_status === 'DONE' ? 'Done' : task.todo_status === 'SKIPPED' ? 'Skipped' : 'New'}
                        </span>
                      </div>
                    </td>

                    {/* Direct action triggers */}
                    <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {task.todo_status === 'NEW' ? (
                        <button
                          onClick={() => handleDirectSubmit(task)}
                          className="px-2.5 h-6 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-md text-xs font-medium"
                        >
                          Submit
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResetTask(task)}
                          className="px-2.5 h-6 bg-white hover:bg-slate-50 text-slate-500 rounded-md text-xs font-medium transition-colors border border-slate-200"
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-50 rounded-full mb-3 text-slate-300">
              <AlertCircle size={36} />
            </div>
            <h4 className="text-slate-800 font-bold text-sm">No Checklist Tasks Available</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
              Không tìm thấy nhiệm vụ nào khớp với bộ lọc của bạn hoặc không có nhiệm vụ active (template status ON).
            </p>
          </div>
        )}
      </div>

      {/* 3. Footer Pagination standard matching list mockup */}
      <div className="px-6 py-3 flex items-center justify-between border-t border-slate-100 bg-white shrink-0 selection:bg-none">
        <span className="text-xs font-medium text-slate-400 font-mono">
          Total: {totalCount} tasks
        </span>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="px-2.5 py-1.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1.5 mx-2">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pIndex = idx + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => setPage(pIndex)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      page === pIndex 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-slate-200/60 bg-white"
                    }`}
                  >
                    {pIndex}
                  </button>
                );
              })}
            </div>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="px-2.5 py-1.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        <div className="w-20 hidden md:block"></div>
      </div>

      {/* 4. SIDE DRAWER: Detailed progress check side drawer */}
      {openedTask && openedTaskParsedMeta && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity cursor-pointer animate-in fade-in duration-200" 
            onClick={() => setOpenedTask(null)}
          />

          {/* Drawer Body container */}
          <div className="relative w-full max-w-[450px] bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-100 animate-in slide-in-from-right duration-300">
            {/* Header info */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 leading-snug">{openedTask.title}</h3>
                <span className="text-xs font-mono text-slate-400 mt-0.5 block">Id: {getDisplayId(openedTask.id)}</span>
              </div>
              <button 
                onClick={() => setOpenedTask(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TASK STATUS Section showing status indicator */}
              <div className="space-y-2 pb-3 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 block">Task status</span>
                
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-120">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      openedTask.todo_status === 'DONE' 
                        ? 'bg-emerald-500' 
                        : openedTask.todo_status === 'SKIPPED'
                          ? 'bg-slate-400'
                          : 'bg-blue-500'
                    }`} />
                    <span className="text-xs text-slate-600">
                      {openedTask.todo_status === 'DONE' ? 'Done' : openedTask.todo_status === 'SKIPPED' ? 'Skipped' : 'New'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic subtasks detailed adjustments inside the slider drawer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-0.5">
                  <h3 className="text-xs font-semibold text-slate-500">Sub-tasks management</h3>
                  <div className="text-xs font-medium text-slate-500 font-mono flex items-center gap-2">
                    <span>Est: {openedTask.est_time || 0}m</span>
                    <span>•</span>
                    <span className="text-emerald-600">Act: {openedTask.actual_time || 0}m</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {openedTask.sub_tasks && openedTask.sub_tasks.length > 0 ? (
                    openedTask.sub_tasks.map((sub, index) => {
                      const currentSubStatus = sub.sub_status || 'New';
                      return (
                        <div 
                          key={sub.id || index} 
                          className="border border-slate-100 rounded-lg p-3 bg-white flex flex-col justify-between gap-2 shadow-xs hover:border-blue-100 transition-all animate-in fade-in"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <span className="text-slate-800 text-xs font-medium leading-normal">{sub.content}</span>
                            <span className="text-xs bg-slate-50 text-slate-500 border border-slate-100 rounded px-1.5 py-0.5 shrink-0 ml-auto font-medium">
                              {sub.assignee}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-50 flex-wrap sm:flex-nowrap justify-between">
                            {/* ACTUAL: [ x ] MIN field */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                              <span>Actual:</span>
                              <div className="relative flex items-center">
                                <input 
                                  type="number"
                                  min={0}
                                  value={sub.actual_minutes !== undefined ? sub.actual_minutes : 0}
                                  className="w-12 h-6 px-1 text-center bg-slate-50 border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:bg-white text-xs font-mono"
                                  onChange={(e) => {
                                    const rawVal = parseInt(e.target.value) || 0;
                                    handleUpdateSubtaskValue(openedTask, sub.id, { 
                                      actual_minutes: Math.max(0, rawVal) 
                                    });
                                  }}
                                />
                              </div>
                              <span>min</span>
                            </div>

                            {/* SELECT BOX sub-task state selection (Done, New, Skipped) */}
                            <select
                              value={currentSubStatus}
                              className="h-6 px-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 focus:outline-none cursor-pointer"
                              onChange={(e) => {
                                const nextVal = e.target.value as 'New' | 'Done' | 'Skipped';
                                handleUpdateSubtaskValue(openedTask, sub.id, { 
                                  sub_status: nextVal,
                                  // Auto set mins if setting to Done
                                  ...(nextVal === 'Done' && (sub.actual_minutes === 0 || sub.actual_minutes === undefined) ? { actual_minutes: sub.estimated_minutes } : {})
                                });
                              }}
                            >
                              <option value="New">New</option>
                              <option value="Done">Done</option>
                              <option value="Skipped">Skipped</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 border border-dashed border-slate-200 select-none text-center rounded-xl text-slate-400 text-xs bg-slate-50/40">
                      Không có sub-tasks phụ nào được định nghĩa trên template này.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit template button at bottom of Side Drawer */}
            <div className="p-4 border-t border-slate-100 shrink-0">
              {(() => {
                const isOneTime = (openedTask.task_type || '').toUpperCase() === 'ONETIME';
                const hasNewSubTask = (openedTask.sub_tasks || []).some(sub => (sub.sub_status || 'New') === 'New');
                const isResetDisabled = !isOneTime && !openedTask.is_active;

                if (openedTask.todo_status === 'NEW') {
                  return (
                    <button 
                      onClick={() => handleDirectSubmit(openedTask)}
                      disabled={hasNewSubTask}
                      className={`w-full h-8 rounded text-xs font-semibold flex items-center justify-center gap-2 shadow-sm pointer-events-auto transition-all ${
                        hasNewSubTask
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-300 opacity-70'
                          : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      }`}
                      title={hasNewSubTask ? "Vui lòng cập nhật tất cả sub-task sang trạng thái Done hoặc Skipped (không để New) trước khi Submit!" : undefined}
                    >
                      <Check size={14} />
                      <span>Submit task</span>
                    </button>
                  );
                } else {
                  return (
                    <button 
                      onClick={() => handleResetTask(openedTask)}
                      disabled={isResetDisabled}
                      className={`w-full h-8 rounded text-xs font-semibold flex items-center justify-center gap-2 shadow-sm pointer-events-auto transition-all ${
                        isResetDisabled
                          ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-slate-600 hover:bg-slate-700 text-white cursor-pointer'
                      }`}
                      title={isResetDisabled ? "Không cho phép Reset nhiệm vụ khi template đang tắt ở Task Manager!" : undefined}
                    >
                      <RotateCcw size={14} />
                      <span>{isResetDisabled ? 'Reset nháp (Template Offline)' : 'Reset task'}</span>
                    </button>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TaskList;
