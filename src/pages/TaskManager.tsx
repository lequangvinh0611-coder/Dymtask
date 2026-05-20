import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RotateCcw, Plus, Trash2, Power, Clock, Download, 
  ChevronLeft, ChevronRight, Edit2, MoreHorizontal, X, HelpCircle,
  Building, Briefcase, Tag, Users, Check, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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

  // Modal custom states (Form fields representation)
  const [modal_title, setModalTitle] = useState('');
  const [modal_project, setModalProject] = useState(AVAILABLE_PROJECTS[0]);
  const [modal_team, setModalTeam] = useState(AVAILABLE_TEAMS[0]);
  const [modal_tag, setModalTag] = useState(AVAILABLE_TAGS[0]);
  const [modal_task_type, setModalTaskType] = useState('DAILY');
  const [modal_deadline_time, setModalDeadlineTime] = useState('09:00 AM');
  const [modal_deadline_days, setModalDeadlineDays] = useState('Mon - Fri');
  const [modal_description, setModalDescription] = useState('');
  const [modal_sub_tasks, setModalSubTasks] = useState<SubTask[]>([]);

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
  }, []);

  // Sync real-time database events
  useEffect(() => {
    const channel = supabase.channel('task_manager_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      }).subscribe();
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
    const set = new Set<string>();
    parsedTasks.forEach(t => {
      t.sub_tasks.forEach(sub => {
        if (sub.assignee) set.add(sub.assignee);
      });
    });
    // Add standard defaults
    AVAILABLE_PLES.forEach(p => set.add(p));
    return Array.from(set);
  }, [parsedTasks]);

  const dynamicTags = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.tag_name) set.add(t.tag_name); });
    AVAILABLE_TAGS.forEach(t => set.add(t));
    return Array.from(set);
  }, [parsedTasks]);

  const dynamicProjects = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.project_name) set.add(t.project_name); });
    AVAILABLE_PROJECTS.forEach(p => set.add(p));
    return Array.from(set);
  }, [parsedTasks]);

  const dynamicTeams = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.team_name) set.add(t.team_name); });
    AVAILABLE_TEAMS.forEach(tm => set.add(tm));
    return Array.from(set);
  }, [parsedTasks]);

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
    } catch (err: any) {
      console.error('Error toggling task status:', err);
      alert(`Không thể thay đổi trạng thái: ${err.message}`);
    }
  };

  // Delete a task permanently from supabase without RLS
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn template task này không?')) return;
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
    } catch (err: any) {
      console.error('Error deleting task:', err);
      alert(`Không thể xóa task: ${err.message}`);
    }
  };

  // Open Modal in Edit Mode
  const handleOpenEditModal = (task: DbTask) => {
    const parsed = parseTaskDescription(task.description);
    setModalTask(task);
    setModalTitle(task.title);
    setModalProject(parsed.project_name);
    setModalTeam(parsed.team_name);
    setModalTag(parsed.tag_name);
    setModalTaskType(task.task_type || 'DAILY');
    setModalDeadlineTime(parsed.deadline_time);
    setModalDeadlineDays(parsed.deadline_days);
    setModalDescription(parsed.description);
    setModalSubTasks(parsed.sub_tasks);
    
    setIsModalOpen(true);
    setOpenedDrawerTask(null); // Close sidebar drawer when editing
    setActiveMenuTaskId(null);
  };

  // Open Modal in Create Mode
  const handleOpenCreateModal = () => {
    setModalTask(null);
    setModalTitle('');
    setModalProject(AVAILABLE_PROJECTS[0]);
    setModalTeam(AVAILABLE_TEAMS[0]);
    setModalTag(AVAILABLE_TAGS[0]);
    setModalTaskType('DAILY');
    setModalDeadlineTime('09:00 AM');
    setModalDeadlineDays('Mon - Fri');
    setModalDescription('');
    setModalSubTasks([]);
    
    setIsModalOpen(true);
    setActiveMenuTaskId(null);
  };

  // Save changes or create new task in supabase
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modal_title.trim()) {
      alert('Vui lòng nhập tên Task.');
      return;
    }

    // Est duration is sum of estimated_minutes of subtasks
    const calculated_est_time = modal_sub_tasks.reduce((sum, sub) => sum + (Number(sub.estimated_minutes) || 0), 0);

    const metadata: TaskMetadata = {
      description: modal_description.trim(),
      project_name: modal_project,
      team_name: modal_team,
      tag_name: modal_tag,
      deadline_time: modal_deadline_time,
      deadline_days: modal_deadline_days,
      sub_tasks: modal_sub_tasks
    };

    const payload = {
      title: modal_title.trim(),
      description: serializeTaskDescription(metadata),
      task_type: modal_task_type,
      est_time: calculated_est_time,
      status: modalTask ? modalTask.status : 'ON', // Set default to 'ON'
      is_active: modalTask ? modalTask.is_active : true,
      actual_time: modalTask ? modalTask.actual_time : 0
    };

    try {
      if (modalTask) {
        // Edit Mode
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', modalTask.id);

        if (error) throw error;
      } else {
        // Create Mode
        const { error } = await supabase
          .from('tasks')
          .insert([payload]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      loadTasks();
    } catch (err: any) {
      console.error('Error saving task:', err);
      alert(`Không thể lưu: ${err.message}`);
    }
  };

  // Add sub-task row helper function
  const handleAddSubTaskRow = () => {
    const newRow: SubTask = {
      id: Math.random().toString(36).substring(2, 9),
      content: '',
      assignee: AVAILABLE_PLES[0],
      estimated_minutes: 0
    };
    setModalSubTasks([...modal_sub_tasks, newRow]);
  };

  // Delete sub-task row helper function
  const handleDeleteSubTaskRow = (id: string) => {
    setModalSubTasks(modal_sub_tasks.filter(sub => sub.id !== id));
  };

  // Update specific sub-task row field
  const handleUpdateSubTask = (id: string, field: keyof SubTask, value: any) => {
    setModalSubTasks(modal_sub_tasks.map(sub => {
      if (sub.id === id) {
        return { ...sub, [field]: value };
      }
      return sub;
    }));
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
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden relative font-sans">
      
      {/* 1. Header Filter & Actions Controls */}
      <div className="px-6 py-4 flex flex-wrap items-center bg-white shrink-0 border-b border-slate-100 justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search task */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-700 h-9"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Filter Personnel */}
          <select 
            value={filterPersonnel}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer text-left shrink-0 min-w-[130px]"
            onChange={(e) => {
              setFilterPersonnel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Personnel</option>
            {dynamicPersonnel.map(person => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>

          {/* Filter All Tags */}
          <select 
            value={filterTag}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer text-left shrink-0 min-w-[110px]"
            onChange={(e) => {
              setFilterTag(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Tags</option>
            {dynamicTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* Filter All Projects */}
          <select 
            value={filterProject}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer text-left shrink-0 min-w-[110px]"
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Projects</option>
            {dynamicProjects.map(proj => (
              <option key={proj} value={proj}>{proj}</option>
            ))}
          </select>

          {/* Filter All Teams */}
          <select 
            value={filterTeam}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer text-left shrink-0 min-w-[110px]"
            onChange={(e) => {
              setFilterTeam(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Teams</option>
            {dynamicTeams.map(tm => (
              <option key={tm} value={tm}>{tm}</option>
            ))}
          </select>

          {/* Filter Status (ON/OFF) */}
          <select 
            value={filterStatus}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer text-left shrink-0 min-w-[80px]"
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Status (All)</option>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>

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
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Create and CSV action triggers */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCsv}
            disabled={filteredTasks.length === 0}
            className="flex items-center gap-1.5 px-3.5 h-9 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all text-slate-600 rounded-lg text-xs font-bold shadow-sm disabled:opacity-40"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-lg text-xs font-bold shadow-sm shadow-blue-100"
          >
            <Plus size={16} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* 2. Main High-Polished Grid/Table Grid Panel */}
      <div className="flex-1 overflow-auto bg-white min-h-[400px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold animate-pulse">Loading templates...</p>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <table className="w-full text-left border-collapse table-fixed select-none">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
              <tr>
                <th className="w-[8%] px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="w-[22%] px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task Name</th>
                <th className="w-[11%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag</th>
                <th className="w-[18%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project</th>
                <th className="w-[12%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team</th>
                <th className="w-[9%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                <th className="w-[11%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline</th>
                <th className="w-[9%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Est.Min</th>
                <th className="w-[11%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="w-[6%] px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((task) => (
                <tr 
                  key={task.id} 
                  className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                  onClick={() => setOpenedDrawerTask(task)}
                >
                  {/* ID */}
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      {getDisplayId(task.id)}
                    </span>
                  </td>

                  {/* Task Name */}
                  <td className="px-6 py-4 overflow-hidden">
                    <span className="font-semibold text-slate-800 text-sm tracking-tight truncate block" title={task.title}>
                      {task.title}
                    </span>
                  </td>

                  {/* Tag */}
                  <td className="px-4 py-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-block border border-slate-200 bg-slate-50 px-2.5 py-0.5 rounded text-[11px] font-medium text-slate-600 truncate max-w-full">
                      {task.tag_name || '求人更新'}
                    </span>
                  </td>

                  {/* Project */}
                  <td className="px-4 py-4 overflow-hidden">
                    <span className="text-slate-600 text-xs truncate block font-medium" title={task.project_name || '【事務代行】HR TECH'}>
                      {task.project_name || '【事務代行】HR TECH'}
                    </span>
                  </td>

                  {/* Team */}
                  <td className="px-4 py-4 overflow-hidden">
                    <span className="text-slate-500 text-xs truncate block font-medium" title={task.team_name || '内部・2課E'}>
                      {task.team_name || '内部・2課E'}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                      task.task_type === 'DAILY' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      task.task_type === 'WEEKLY' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      task.task_type === 'MONTHLY' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                      'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {task.task_type || 'DAILY'}
                    </span>
                  </td>

                  {/* Deadline text output */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col text-xs font-semibold leading-tight">
                      <span className="text-slate-800 font-bold flex items-center gap-1">
                        <Clock size={11} className="text-slate-400 shrink-0" />
                        {task.deadline_time || '17:00'}
                      </span>
                      <span className="text-slate-400 text-[10px] font-medium mt-0.5">
                        {task.deadline_days || 'Mon - Fri'}
                      </span>
                    </div>
                  </td>

                  {/* Estimated minutes */}
                  <td className="px-4 py-4 text-center" onClick={(e) => { e.stopPropagation(); setOpenedDrawerTask(task); }}>
                    <span className="text-blue-600 hover:text-blue-800 font-bold font-mono text-xs underline cursor-pointer">
                      {task.est_time || 0}m
                    </span>
                  </td>

                  {/* Status Switch (ON/OFF) Toggle Pill */}
                  <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(task, task.status)}
                      className={`inline-flex px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-all shadow-sm ${
                        task.status === 'ON' 
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-500'
                      }`}
                    >
                      {task.status || 'ON'}
                    </button>
                  </td>

                  {/* Actions dropdown button */}
                  <td className="px-6 py-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setActiveMenuTaskId(activeMenuTaskId === task.id ? null : task.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {/* Quick action floating menu context popup */}
                    {activeMenuTaskId === task.id && (
                      <div className="absolute right-6 top-12 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-[100] w-32 animate-in fade-in duration-100">
                        <button
                          onClick={() => handleOpenEditModal(task)}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <Edit2 size={12} className="text-slate-400" />
                          <span>Edit Template</span>
                        </button>
                        <hr className="my-1 border-slate-100" />
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={12} className="text-red-400" />
                          <span>Delete</span>
                        </button>
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
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white shrink-0">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          TOTAL: {totalCount} TEMPLATES
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Template Details</span>
              <button 
                onClick={() => setOpenedDrawerTask(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Task template heading with toggle switch */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{openedDrawerTask.title}</h2>
                  <span className="text-xs font-mono font-bold text-slate-400 mt-1 block uppercase">ID: {getDisplayId(openedDrawerTask.id)}</span>
                </div>
                <button
                  onClick={() => handleToggleStatus(openedDrawerTask, openedDrawerTask.status)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-sm ${
                    openedDrawerTask.status === 'ON' 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100' 
                      : 'bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-500'
                  }`}
                >
                  {openedDrawerTask.status || 'ON'}
                </button>
              </div>

              {/* Tags info grid block */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50/70 rounded-2xl p-4 text-xs font-semibold">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Project</span>
                  <span className="text-slate-700 block text-xs underline decoration-dotted truncate">{drawerParsedMeta.project_name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Tag</span>
                  <span className="text-slate-700 block text-xs truncate">{drawerParsedMeta.tag_name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Team</span>
                  <span className="text-slate-700 block text-xs truncate">{drawerParsedMeta.team_name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Frequency Mode</span>
                  <span className="text-slate-700 block text-xs">{openedDrawerTask.task_type || 'DAILY'}</span>
                </div>
              </div>

              {/* Sub-tasks management section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none font-mono">SUB-TASKS MANAGEMENT</h3>
                  <span className="text-[10px] font-bold text-blue-600 uppercase font-mono tracking-wider">
                    TOTAL EST: {openedDrawerTask.est_time || 0} MIN
                  </span>
                </div>

                <div className="space-y-2.5">
                  {drawerParsedMeta.sub_tasks && drawerParsedMeta.sub_tasks.length > 0 ? (
                    drawerParsedMeta.sub_tasks.map((sub, index) => (
                      <div 
                        key={sub.id || index} 
                        className="border border-slate-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all rounded-xl p-4 bg-white flex flex-col justify-between gap-3 relative shadow-xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-700 text-xs font-bold leading-normal">{sub.content}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 ml-auto shrink-0">
                            {sub.assignee}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-50/80">
                          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center justify-between gap-1.5 font-mono">
                            <span>ESTIMATED</span>
                            <span className="text-slate-700 font-black">{sub.estimated_minutes} MIN</span>
                          </div>
                          
                          <div className="border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 font-mono text-center">
                            TEMPLATE
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
            <div className="p-6 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => handleOpenEditModal(openedDrawerTask)}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                <Edit2 size={13} />
                <span>Edit This Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL OVERLAY: Create & Edit Template Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                {modalTask ? 'EDIT TASK' : 'CREATE NEW TASK'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form scroll container */}
            <form onSubmit={handleSaveTask} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TASK NAME Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TASK NAME</label>
                <input 
                  required 
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-semibold text-slate-700 leading-normal"
                  placeholder="Nhập những gì cần hoàn thành..." 
                  value={modal_title} 
                  onChange={(e) => setModalTitle(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* PROJECT Select */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">PROJECT</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer text-slate-700"
                    value={modal_project} 
                    onChange={(e) => setModalProject(e.target.value)}
                  >
                    {AVAILABLE_PROJECTS.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                </div>

                {/* TASK TYPE Select */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TASK TYPE</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer text-slate-700"
                    value={modal_task_type} 
                    onChange={(e) => setModalTaskType(e.target.value)}
                  >
                    <option value="DAILY">Daily Task</option>
                    <option value="WEEKLY">Weekly Task</option>
                    <option value="MONTHLY">Monthly Task</option>
                    <option value="ONETIME">One-time Task</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* DEADLINE TIME Input */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono flex items-center gap-1">
                    <span>DEADLINE TIME</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700"
                      placeholder="e.g. 09:00 AM"
                      value={modal_deadline_time} 
                      onChange={(e) => setModalDeadlineTime(e.target.value)} 
                    />
                    <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* DEADLINE DAYS Input */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE DAYS</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700"
                    placeholder="e.g. Mon - Fri, Mon, Thu"
                    value={modal_deadline_days} 
                    onChange={(e) => setModalDeadlineDays(e.target.value)} 
                  />
                </div>
              </div>

              {/* Extras Grid for editing descriptions tags and teams */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                {/* TEAM Select option */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TEAM</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer text-slate-700"
                    value={modal_team} 
                    onChange={(e) => setModalTeam(e.target.value)}
                  >
                    {AVAILABLE_TEAMS.map(tm => (
                      <option key={tm} value={tm}>{tm}</option>
                    ))}
                  </select>
                </div>

                {/* TAG Select option */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TAG</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer text-slate-700"
                    value={modal_tag} 
                    onChange={(e) => setModalTag(e.target.value)}
                  >
                    {AVAILABLE_TAGS.map(tg => (
                      <option key={tg} value={tg}>{tg}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Raw description */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DESCRIPTION / GHI CHÚ (Mẫu)</label>
                <textarea 
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700 resize-none"
                  placeholder="Ghi chú chi tiết cho template..." 
                  value={modal_description} 
                  onChange={(e) => setModalDescription(e.target.value)} 
                />
              </div>

              {/* Sub-tasks section with dynamic rows creation */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">SUB-TASKS</span>
                  <button 
                    type="button" 
                    onClick={handleAddSubTaskRow}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>+ Add Row</span>
                  </button>
                </div>

                {/* Subtasks items rows container */}
                <div className="space-y-3 max-h-56 overflow-y-auto p-1 bg-slate-50/50 border border-slate-100 rounded-xl">
                  {modal_sub_tasks.length > 0 ? (
                    modal_sub_tasks.map((sub, idx) => (
                      <div key={sub.id} className="bg-white border border-slate-200/80 rounded-xl p-3 relative space-y-2 group shadow-xs">
                        {/* Row Trash Delete button top right */}
                        <button 
                          type="button"
                          onClick={() => handleDeleteSubTaskRow(sub.id)}
                          className="absolute right-2.5 top-2.5 text-slate-300 hover:text-red-500 transition-colors p-1"
                          title="Xóa dòng"
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="space-y-1.5 pr-6">
                          <label className="block text-[9px] font-bold text-slate-400 tracking-wider">Content</label>
                          <input 
                            required
                            type="text" 
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                            placeholder="Tên sub-task..."
                            value={sub.content}
                            onChange={(e) => handleUpdateSubTask(sub.id, 'content', e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pr-6">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 tracking-wider mb-0.5">Assignee</label>
                            <select 
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer text-left"
                              value={sub.assignee}
                              onChange={(e) => handleUpdateSubTask(sub.id, 'assignee', e.target.value)}
                            >
                              {AVAILABLE_PLES.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 tracking-wider mb-0.5">Est (Phút)</label>
                            <input 
                              required
                              type="number" 
                              min={0}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                              value={sub.estimated_minutes === 0 ? '' : sub.estimated_minutes}
                              placeholder="Minutes"
                              onChange={(e) => handleUpdateSubTask(sub.id, 'estimated_minutes', Math.max(0, parseInt(e.target.value) || 0))}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic font-medium">
                      Bấm "+ Add Row" để thêm mới một row sub-task phụ.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Submit controls */}
              <div className="pt-3 flex gap-3.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-2.5 text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all uppercase tracking-widest text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-50 uppercase tracking-widest text-center"
                >
                  {modalTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;
