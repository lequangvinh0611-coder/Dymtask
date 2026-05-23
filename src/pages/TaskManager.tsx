import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RotateCcw, Plus, Trash2, Power, Clock, Download, 
  ChevronLeft, ChevronRight, Edit2, MoreHorizontal, X, HelpCircle,
  Building, Briefcase, Tag, Users, Check, AlertCircle, FileSpreadsheet, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import CreateTaskModal from '../components/CreateTaskModal';
import { FilterSelect } from '../components/ui/FilterSelect';
import { toast } from 'sonner';
import { useAppStore } from '../types';

// Definition of SubTask interface matching mockup
interface SubTask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
}

// Definition of metadata stored as robust JSON inside standard 'description' column
interface TaskMetadata {
  description: string;
  project_name: string;
  team_name: string;
  tag_name: string;
  deadline_time: string;
  deadline_days: string;
  sub_tasks: SubTask[];
}

// Database schema representation
interface DbTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string; // 'ON' / 'OFF' for template switch
  is_active: boolean;
  est_time: number;
  actual_time: number;
  created_at: string;
}

// Helper to generate a stable, readable 6-digit ID based on deterministic UUID hash
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

// Default projects, tags, personnel and teams for fallback and populating UI
const AVAILABLE_PROJECTS = ['【事務代行】HR TECH', 'GLOBAL OUTSOURCING', '求人媒体運用', 'RECRUITING MANAGEMENT', 'ADMIN OPERATIONS'];
const AVAILABLE_TEAMS = ['内部・2課E', 'アウトソーシングG', '人事総務部', '営業サポート課'];
const AVAILABLE_TAGS = ['求人更新', 'メールチェック', 'レポート作成', 'データ入力', 'システム保守'];
const AVAILABLE_PLES = ['PHAN QUANG DAT', 'LE QUANG VINH', 'LE QUANG VINH 2', 'VINH 1', 'VINH 2'];

// Helper to parse complex data out of standard 'description' column
const parseTaskDescription = (rawDescription: string | null): TaskMetadata => {
  const defaultMeta: TaskMetadata = {
    description: '',
    project_name: '【事務代行】HR TECH',
    team_name: '内部・2課E',
    tag_name: '求人更新',
    deadline_time: '17:00',
    deadline_days: 'Mon - Fri',
    sub_tasks: []
  };

  if (!rawDescription) return defaultMeta;

  const trimmed = rawDescription.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        description: parsed.description || '',
        project_name: parsed.project_name || '【事務代行】HR TECH',
        team_name: parsed.team_name || '内部・2課E',
        tag_name: parsed.tag_name || '求人更新',
        deadline_time: parsed.deadline_time || '17:00',
        deadline_days: parsed.deadline_days || 'Mon - Fri',
        sub_tasks: Array.isArray(parsed.sub_tasks) ? parsed.sub_tasks : []
      };
    } catch {
      // JSON syntax error, parse as regular description
    }
  }

  return {
    ...defaultMeta,
    description: rawDescription
  };
};

// Helper to serialize metadata back into description column
const serializeTaskDescription = (metadata: TaskMetadata): string => {
  return JSON.stringify(metadata);
};

const TaskManager: React.FC = () => {
  const { showConfirm } = useAppStore();
  const { profile } = useAuthStore();
  const userRole = (profile?.role || 'user').toString().toLowerCase().trim();
  const isUser = userRole === 'user';

  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  // Page state
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPersonnel, setFilterPersonnel] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('ON'); // Default 'ON' as requested in Mockup (shows dropdown On)
  
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Drawer Panel & Modal view states
  const [openedDrawerTask, setOpenedDrawerTask] = useState<DbTask | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<DbTask | null>(null); // Null for create view, populated for edit view

  // Action Menu dropdown state for specific task action buttons
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

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
      console.error('Error fetching metadata in TaskManager:', err);
    }
  };

  // Fetch all tasks directly from database
  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    fetchMetadata();

    const channel = supabase.channel('task_manager_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchMetadata())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute parsed tasks incorporating their JSON descriptions
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
        sub_tasks: meta.sub_tasks
      };
    });
  }, [tasks]);

  // Extract option lists for filters dynamically based on existing records
  const dynamicPersonnel = useMemo(() => {
    if (assigneesList.length > 0) {
      return assigneesList;
    }
    return AVAILABLE_PLES;
  }, [assigneesList]);

  const dynamicTags = useMemo(() => {
    if (tagsList.length > 0) {
      return tagsList;
    }
    return AVAILABLE_TAGS;
  }, [tagsList]);

  const dynamicProjects = useMemo(() => {
    if (projectsList.length > 0) {
      return projectsList;
    }
    return AVAILABLE_PROJECTS;
  }, [projectsList]);

  const dynamicTeams = useMemo(() => {
    if (teamsList.length > 0) {
      return teamsList;
    }
    return AVAILABLE_TEAMS;
  }, [teamsList]);

  // Filter the parsed tasks based on current UI filtration values
  const filteredTasks = useMemo(() => {
    return parsedTasks.filter(task => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const displayId = getDisplayId(task.id);
        const matchTitle = (task.title || '').toLowerCase().includes(query);
        const matchId = displayId.includes(query);
        const matchProj = (task.project_name || '').toLowerCase().includes(query);
        const matchTeam = (task.team_name || '').toLowerCase().includes(query);
        const matchTag = (task.tag_name || '').toLowerCase().includes(query);
        if (!matchTitle && !matchId && !matchProj && !matchTeam && !matchTag) return false;
      }

      // 2. Personnel
      if (filterPersonnel) {
        const hasPersonnel = task.sub_tasks.some(s => s.assignee === filterPersonnel);
        if (!hasPersonnel) return false;
      }

      // 3. Tag Filter
      if (filterTag && task.tag_name !== filterTag) return false;

      // 4. Project Filter
      if (filterProject && task.project_name !== filterProject) return false;

      // 5. Team Filter
      if (filterTeam && task.team_name !== filterTeam) return false;

      // 6. Status Filter ('ON', 'OFF')
      if (filterStatus) {
        if (task.status !== filterStatus) return false;
      }

      return true;
    });
  }, [parsedTasks, searchQuery, filterPersonnel, filterTag, filterProject, filterTeam, filterStatus]);

  // Handle client-side pagination
  const totalCount = filteredTasks.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredTasks.slice(startIdx, startIdx + pageSize);
  }, [filteredTasks, page]);

  // Update specific task status switcher (ON/OFF)
  const handleToggleStatus = async (task: DbTask, currentStatus: string) => {
    const nextStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: nextStatus,
          is_active: nextStatus === 'ON'
        })
        .eq('id', task.id);

      if (error) throw error;
      
      // Update local state smoothly
      setTasks(prev => prev.map(t => t.id === task.id ? { 
        ...t, 
        status: nextStatus,
        is_active: nextStatus === 'ON'
      } : t));

      // Update opened Drawer task too if active
      if (openedDrawerTask && openedDrawerTask.id === task.id) {
        setOpenedDrawerTask({
          ...openedDrawerTask,
          status: nextStatus,
          is_active: nextStatus === 'ON'
        });
      }
      toast.success(`Đã thay đổi trạng thái hoạt động thành ${nextStatus}!`);
    } catch (err: any) {
      console.error('Error toggling task status:', err);
      toast.error(`Không thể thay đổi trạng thái: ${err.message}`);
    }
  };

  // Delete a task permanently from supabase without RLS
  const handleDeleteTask = async (taskId: string) => {
    showConfirm({
      title: "Xác nhận xóa vĩnh viễn",
      message: "Bạn có chắc chắn muốn xóa vĩnh viễn template task này không? Hành động này sẽ loại bỏ nó hoàn toàn khỏi dymtask.",
      confirmText: "Xóa vĩnh viễn",
      cancelText: "Hủy",
      onConfirm: async () => {
        setDeletingTaskId(taskId);
        try {
          const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

          if (error) throw error;
          
          // Sync state and close elements
          setTasks(prev => prev.filter(t => t.id !== taskId));
          if (openedDrawerTask && openedDrawerTask.id === taskId) {
            setOpenedDrawerTask(null);
          }
          setActiveMenuTaskId(null);
          toast.success("Xóa template task thành công!");
        } catch (err: any) {
          console.error('Error deleting task:', err);
          toast.error(`Không thể xóa task: ${err.message}`);
        } finally {
          setDeletingTaskId(null);
        }
      }
    });
  };

  // Open Modal in Edit Mode
  const handleOpenEditModal = (task: DbTask) => {
    setModalTask(task);
    setIsModalOpen(true);
    setOpenedDrawerTask(null); // Close sidebar drawer when editing
    setActiveMenuTaskId(null);
  };

  // Open Modal in Create Mode
  const handleOpenCreateModal = () => {
    setModalTask(null);
    setIsModalOpen(true);
    setActiveMenuTaskId(null);
  };

  // Export current list to CSV
  const handleExportCsv = () => {
    if (filteredTasks.length === 0) return;
    
    // Header setup
    const headers = ['ID', 'TASK NAME', 'TAG', 'PROJECT', 'TEAM', 'TYPE', 'DEADLINE TIME', 'DEADLINE DAYS', 'EST.MIN', 'STATUS'];
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
          `"${task.deadline_time || ''}"`,
          `"${task.deadline_days || ''}"`,
          `"${task.est_time || 0}m"`,
          `"${task.status || 'ON'}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dymtask_manager_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculated dynamic state of Drawer
  const drawerParsedMeta = useMemo(() => {
    if (!openedDrawerTask) return null;
    return parseTaskDescription(openedDrawerTask.description);
  }, [openedDrawerTask]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-x-auto relative font-sans">
      
      {/* 1. Header Filter & Actions Controls */}
      {/* 1. Actions Header toolbar */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 flex-nowrap overflow-visible relative z-[40] min-w-max w-full mb-0">
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* Search task */}
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

          {/* Filter Personnel */}
          <FilterSelect 
            value={filterPersonnel}
            onChange={(val) => {
              setFilterPersonnel(val);
              setPage(1);
            }}
            defaultOptionLabel="Assignees"
            options={dynamicPersonnel.map(person => ({ value: person, label: person }))}
          />

          {/* Filter All Tags */}
          <FilterSelect 
            value={filterTag}
            onChange={(val) => {
              setFilterTag(val);
              setPage(1);
            }}
            defaultOptionLabel="Tags"
            options={dynamicTags.map(tag => ({ value: tag, label: tag }))}
          />

          {/* Filter All Projects */}
          <FilterSelect 
            value={filterProject}
            onChange={(val) => {
              setFilterProject(val);
              setPage(1);
            }}
            defaultOptionLabel="Projects"
            options={dynamicProjects.map(proj => ({ value: proj, label: proj }))}
          />

          {/* Filter All Teams */}
          <FilterSelect 
            value={filterTeam}
            onChange={(val) => {
              setFilterTeam(val);
              setPage(1);
            }}
            defaultOptionLabel="Teams"
            options={dynamicTeams.map(tm => ({ value: tm, label: tm }))}
          />

          {/* Filter Status (ON/OFF) */}
          <FilterSelect 
            value={filterStatus}
            onChange={(val) => {
              setFilterStatus(val);
              setPage(1);
            }}
            defaultOptionLabel="Status"
            options={[
              { value: 'ON', label: 'On' },
              { value: 'OFF', label: 'Off' }
            ]}
          />

          {/* Reset Filters button */}
          {(searchQuery || filterPersonnel || filterTag || filterProject || filterTeam || filterStatus !== 'ON') && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterPersonnel('');
                setFilterTag('');
                setFilterProject('');
                setFilterTeam('');
                setFilterStatus('ON');
                setPage(1);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Create and CSV action triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 h-8 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-md text-xs font-medium shadow-sm"
          >
            <Plus size={14} />
            <span>Create task</span>
          </button>
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

      {/* 2. Main High-Polished Grid/Table Grid Panel */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white min-h-[400px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-medium animate-pulse">Loading templates...</p>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <table className="w-full text-left border-collapse table-fixed select-none min-w-[1100px]">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
              <tr className="h-8">
                <th className="w-[8%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Id</th>
                <th className="w-[22%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Task Name</th>
                <th className="w-[11%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Tag</th>
                <th className="w-[18%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Project</th>
                <th className="w-[12%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Team</th>
                <th className="w-[9%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Type</th>
                <th className="w-[11%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100">Deadline</th>
                <th className="w-[9%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Est. min</th>
                <th className="w-[11%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Status</th>
                <th className="w-[6%] px-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center bg-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((task) => (
                <tr 
                  key={task.id} 
                  className="h-9 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => setOpenedDrawerTask(task)}
                >
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

                  {/* Tag */}
                  <td className="px-3 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-block bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 truncate max-w-full font-medium">
                      {task.tag_name || '求人更新'}
                    </span>
                  </td>

                  {/* Project */}
                  <td className="px-3 py-1.5 overflow-hidden">
                    <span className="text-slate-600 text-xs truncate block font-normal" title={task.project_name || '【事務代行】HR TECH'}>
                      {task.project_id ? (projectsList.find((p: any) => p === task.project_name) || task.project_name) : task.project_name}
                    </span>
                  </td>

                  {/* Team */}
                  <td className="px-3 py-1.5 overflow-hidden">
                    <span className="text-slate-500 text-xs truncate block font-normal" title={task.team_name || '内部・2課E'}>
                      {task.team_name || '内部・2課E'}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-1.5 text-center">
                    <span className="inline-block bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-medium">
                      {task.task_type || 'DAILY'}
                    </span>
                  </td>

                  {/* Deadline text output */}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate" title={`${task.deadline_time || '17:00'} ${task.deadline_days || 'Mon - Fri'}`}>
                        {task.deadline_time || '17:00'}
                      </span>
                    </div>
                  </td>

                  {/* Estimated minutes */}
                  <td className="px-3 py-1.5 text-center" onClick={(e) => { e.stopPropagation(); setOpenedDrawerTask(task); }}>
                    <span className="text-indigo-600 hover:text-indigo-800 font-medium font-mono text-xs underline cursor-pointer">
                      {task.est_time || 0}m
                    </span>
                  </td>

                  {/* Status Switch (ON/OFF) Toggle Pill - Dot style */}
                  <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                    {isUser ? (
                      <div className="inline-flex items-center gap-1.5 opacity-60 cursor-not-allowed" title="Tài khoản của bạn không có quyền đổi trạng thái">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'ON' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="text-xs text-slate-500 font-medium font-sans">
                          {task.status === 'ON' ? 'On' : 'Off'}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(task, task.status)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Click to toggle status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'ON' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="text-xs text-slate-600 font-medium font-sans">
                          {task.status === 'ON' ? 'On' : 'Off'}
                        </span>
                      </button>
                    )}
                  </td>

                  {/* Actions dropdown button */}
                  <td className="px-3 py-1.5 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setActiveMenuTaskId(activeMenuTaskId === task.id ? null : task.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Quick action floating menu context popup */}
                    {activeMenuTaskId === task.id && (
                      <div className="absolute right-3 top-8 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-[100] w-32">
                        <button
                          onClick={() => handleOpenEditModal(task)}
                          className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <Edit2 size={12} className="text-slate-400" />
                          <span>Edit template</span>
                        </button>
                        
                        {!isUser && (
                          <>
                            <hr className="my-1 border-slate-100" />
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deletingTaskId === task.id}
                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              {deletingTaskId === task.id ? (
                                <Loader2 size={12} className="text-red-400 animate-spin" />
                              ) : (
                                <Trash2 size={12} className="text-red-400" />
                              )}
                              <span>{deletingTaskId === task.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-50 rounded-full mb-3 text-slate-300">
              <AlertCircle size={36} />
            </div>
            <h4 className="text-slate-800 font-bold text-sm">No Task Templates Available</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
              Hãy bấm vào "+ Create Task" để bắt đầu tạo khuôn mẫu nhiệm vụ đầu tiên đồng bộ vào bảng Supabase.
            </p>
          </div>
        )}
      </div>

      {/* 3. Footer Statistics and Client-side Page Navigator */}
      <div className="px-6 py-3 flex items-center justify-between border-t border-slate-100 bg-white shrink-0 selection:bg-none">
        <span className="text-xs font-medium text-slate-400 font-mono">
          Total: {totalCount} templates
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

      {/* 4. SIDE DRAWER: Details Display Panel (Opens from Right side) */}
      {openedDrawerTask && drawerParsedMeta && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity cursor-pointer animate-in fade-in duration-200" 
            onClick={() => setOpenedDrawerTask(null)}
          />
          {/* Drawer Panel Body container */}
          <div className="relative w-full max-w-[450px] bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-100 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-400">Template details</span>
              <button 
                onClick={() => setOpenedDrawerTask(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Task template heading with toggle switch */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 leading-tight">{openedDrawerTask.title}</h2>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">Id: {getDisplayId(openedDrawerTask.id)}</span>
                </div>
                {isUser ? (
                  <div className="inline-flex items-center gap-1.5 opacity-60 cursor-not-allowed" title="Tài khoản của bạn không có quyền đổi trạng thái">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${openedDrawerTask.status === 'ON' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-500 font-medium">
                      {openedDrawerTask.status === 'ON' ? 'On' : 'Off'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggleStatus(openedDrawerTask, openedDrawerTask.status)}
                    className="inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Click to toggle status"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${openedDrawerTask.status === 'ON' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-600 font-medium">
                      {openedDrawerTask.status === 'ON' ? 'On' : 'Off'}
                    </span>
                  </button>
                )}
              </div>

              {/* Tags info grid block */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium block">Project</span>
                  <span className="text-slate-700 block text-xs font-semibold hover:text-indigo-600 cursor-pointer transition-colors truncate">{drawerParsedMeta.project_name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium block">Tag</span>
                  <span className="text-slate-700 block text-xs truncate">{drawerParsedMeta.tag_name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium block">Team</span>
                  <span className="text-slate-700 block text-xs truncate">{drawerParsedMeta.team_name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium block">Frequency mode</span>
                  <span className="text-slate-700 block text-xs">{openedDrawerTask.task_type || 'DAILY'}</span>
                </div>
              </div>

              {/* Sub-tasks management section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-semibold text-slate-500">Sub-tasks management</h3>
                  <span className="text-xs font-medium text-blue-600 font-mono">
                    Total est: {openedDrawerTask.est_time || 0} min
                  </span>
                </div>

                <div className="space-y-2">
                  {drawerParsedMeta.sub_tasks && drawerParsedMeta.sub_tasks.length > 0 ? (
                    drawerParsedMeta.sub_tasks.map((sub, index) => (
                      <div 
                        key={sub.id || index} 
                        className="border border-slate-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all rounded-lg p-3 bg-white flex flex-col justify-between gap-2 relative shadow-xs animate-in fade-in"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-700 text-xs font-medium leading-normal">{sub.content}</span>
                          <span className="text-xs bg-slate-50 text-slate-500 border border-slate-100 rounded px-1.5 py-0.5 ml-auto shrink-0 font-medium">
                            {sub.assignee}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-50">
                          <div className="flex-1 bg-slate-50 border border-slate-100 rounded px-2 py-1 text-xs text-slate-400 flex items-center justify-between font-mono">
                            <span>Estimated</span>
                            <span className="text-slate-700 font-medium">{sub.estimated_minutes} min</span>
                          </div>
                          
                          <div className="border border-slate-100 rounded px-2 py-1 text-xs text-slate-400 shrink-0 font-mono text-center">
                            Template
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 border border-dashed border-slate-200 hover:border-blue-200 transition-all text-center rounded-xl text-slate-400 text-xs bg-slate-50/40">
                      Không có sub-tasks phụ nào được định nghĩa trên template này.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Edit Action Button */}
            <div className="p-4 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => handleOpenEditModal(openedDrawerTask)}
                className="w-full h-8 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <Edit2 size={13} />
                <span>Edit template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL OVERLAY: Create & Edit Template Task Modal */}
      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          loadTasks();
          if (openedDrawerTask) {
            setOpenedDrawerTask(null);
          }
        }} 
        taskToEdit={modalTask} 
      />
    </div>
  );
};

export default TaskManager;
