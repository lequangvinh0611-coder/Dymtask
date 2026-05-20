import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RotateCcw, Clock, Check, AlertCircle, ChevronLeft, ChevronRight, 
  X, Calendar, Download, RefreshCw, Layers, CheckSquare, Square
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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
}

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

const parseTaskDescription = (rawDescription: string | null): TaskMetadata => {
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
        todo_date: parsed.todo_date
      };
    } catch {
      // JSON format issue, fallback to normal values
    }
  }

  return {
    ...defaultMeta,
    description: rawDescription
  };
};

const serializeTaskDescription = (metadata: TaskMetadata): string => {
  return JSON.stringify(metadata);
};

const TaskList: React.FC<{ title?: string }> = ({ title = "To-do List" }) => {
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
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected tasks (checkbox selection column)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Drawer slider panel
  const [openedTask, setOpenedTask] = useState<DbTask | null>(null);

  // Initial tasks loader filtering status = 'ON' or active
  const loadActiveTasks = async () => {
    setLoading(true);
    try {
      // Query templates configured active (status = 'ON')
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'ON')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách To-do:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveTasks();
  }, []);

  // Set real-time listener for tasks update
  useEffect(() => {
    const channel = supabase.channel('todo_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadActiveTasks();
      }).subscribe();
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

  // Extract dynamically options list
  const assigneesOptions = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => t.sub_tasks.forEach(s => { if (s.assignee) set.add(s.assignee); }));
    AVAILABLE_ASSIGNEES.forEach(a => set.add(a));
    return Array.from(set);
  }, [parsedTasks]);

  const tagsOptions = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.tag_name) set.add(t.tag_name); });
    AVAILABLE_TAGS.forEach(tg => set.add(tg));
    return Array.from(set);
  }, [parsedTasks]);

  const projectsOptions = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.project_name) set.add(t.project_name); });
    AVAILABLE_PROJECTS.forEach(p => set.add(p));
    return Array.from(set);
  }, [parsedTasks]);

  const teamsOptions = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach(t => { if (t.team_name) set.add(t.team_name); });
    AVAILABLE_TEAMS.forEach(tm => set.add(tm));
    return Array.from(set);
  }, [parsedTasks]);

  // Filter logic
  const filteredTasks = useMemo(() => {
    return parsedTasks.filter(task => {
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
        const hasAssignee = task.sub_tasks.some(s => s.assignee === filterAssignee);
        if (!hasAssignee) return false;
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
    });
  }, [parsedTasks, searchQuery, filterAssignee, filterTag, filterProject, filterTeam, filterTodoStatus, startDate, endDate]);

  // Paginated client side calculation
  const totalCount = filteredTasks.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredTasks.slice(startIdx, startIdx + pageSize);
  }, [filteredTasks, page]);

  // Handle checking checkbox
  const handleToggleSelectRow = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedTaskIds.size === paginatedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(paginatedTasks.map(t => t.id)));
    }
  };

  // Submit task directly changing status to DONE from actions button
  const handleDirectSubmit = async (task: DbTask) => {
    const meta = parseTaskDescription(task.description);
    
    // Set all sub-tasks to completed as default if not already, and sync times
    const updatedSubTasks = (meta.sub_tasks || []).map(sub => ({
      ...sub,
      sub_status: (sub.sub_status === 'Skipped' ? 'Skipped' : 'Done') as 'New' | 'Done' | 'Skipped',
      actual_minutes: sub.actual_minutes !== undefined ? sub.actual_minutes : sub.estimated_minutes
    }));

    const calculated_actual_time = updatedSubTasks.reduce((sum, sub) => sum + (sub.actual_minutes || 0), 0);

    const updatedMeta: TaskMetadata = {
      ...meta,
      todo_status: 'DONE',
      sub_tasks: updatedSubTasks
    };

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: serializeTaskDescription(updatedMeta),
          actual_time: calculated_actual_time
        })
        .eq('id', task.id);

      if (error) throw error;

      // Sync local tasks state list
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        description: serializeTaskDescription(updatedMeta),
        actual_time: calculated_actual_time
      } : t));

      if (openedTask && openedTask.id === task.id) {
        setOpenedTask({
          ...openedTask,
          description: serializeTaskDescription(updatedMeta),
          actual_time: calculated_actual_time
        });
      }
    } catch (err) {
      console.error('Error submitting task:', err);
    }
  };

  // Reset task back to NEW or other status adjustments inside the slider drawer
  const handleResetTask = async (task: DbTask) => {
    const meta = parseTaskDescription(task.description);
    
    // Reset individual sub-tasks to New and actual mins to 0
    const updatedSubTasks = (meta.sub_tasks || []).map(sub => ({
      ...sub,
      sub_status: 'New' as const,
      actual_minutes: 0
    }));

    const updatedMeta: TaskMetadata = {
      ...meta,
      todo_status: 'NEW',
      sub_tasks: updatedSubTasks
    };

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: serializeTaskDescription(updatedMeta),
          actual_time: 0
        })
        .eq('id', task.id);

      if (error) throw error;

      // Sync state
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        description: serializeTaskDescription(updatedMeta),
        actual_time: 0
      } : t));

      if (openedTask && openedTask.id === task.id) {
        setOpenedTask({
          ...openedTask,
          description: serializeTaskDescription(updatedMeta),
          actual_time: 0
        });
      }
    } catch (err) {
      console.error('Error resetting task:', err);
    }
  };

  // Skip task checklist representation completely
  const handleSkipTask = async (task: DbTask) => {
    const meta = parseTaskDescription(task.description);
    
    const updatedMeta: TaskMetadata = {
      ...meta,
      todo_status: 'SKIPPED'
    };

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: serializeTaskDescription(updatedMeta)
        })
        .eq('id', task.id);

      if (error) throw error;

      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        description: serializeTaskDescription(updatedMeta)
      } : t));

      if (openedTask && openedTask.id === task.id) {
        setOpenedTask({
          ...openedTask,
          description: serializeTaskDescription(updatedMeta)
        });
      }
    } catch (err) {
      console.error('Error skipping task:', err);
    }
  };

  // Update specific sub-task work characteristics (Actual Minutes or Status) inside the drawer
  const handleUpdateSubtaskValue = async (
    task: DbTask, 
    subtaskId: string, 
    fields: Partial<Pick<SubTask, 'actual_minutes' | 'sub_status'>>
  ) => {
    const meta = parseTaskDescription(task.description);
    
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

    // If all sub-tasks are done, do we set the parent status to DONE? 
    // Let's keep it manual or auto-adjust parent state helper
    let newParentTodoStatus = meta.todo_status || 'NEW';
    const isAllDone = updatedSubTasks.length > 0 && updatedSubTasks.every(s => s.sub_status === 'Done');
    if (isAllDone) {
      newParentTodoStatus = 'DONE';
    }

    const updatedMeta: TaskMetadata = {
      ...meta,
      todo_status: newParentTodoStatus,
      sub_tasks: updatedSubTasks
    };

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: serializeTaskDescription(updatedMeta),
          actual_time: calculated_actual_time
        })
        .eq('id', task.id);

      if (error) throw error;

      // Local state adjustment
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        description: serializeTaskDescription(updatedMeta),
        actual_time: calculated_actual_time
      } : t));

      const syncedTask = {
        ...task,
        description: serializeTaskDescription(updatedMeta),
        actual_time: calculated_actual_time
      };

      if (openedTask && openedTask.id === task.id) {
        setOpenedTask(syncedTask);
      }
    } catch (err) {
      console.error('Error updating subtask value:', err);
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
    if (!window.confirm(`Bạn có chắc muốn Submit ${selectedTaskIds.size} task đã chọn không?`)) return;

    try {
      for (const taskId of selectedTaskIds) {
        const taskObj = tasks.find(t => t.id === taskId);
        if (taskObj) {
          await handleDirectSubmit(taskObj);
        }
      }
      setSelectedTaskIds(new Set());
      alert('Đã hoàn thành submit hàng loạt!');
    } catch (err: any) {
      alert(`Lỗi khi xử lý hàng loạt: ${err.message}`);
    }
  };

  // Parse details for Slider drawer component
  const openedTaskParsedMeta = useMemo(() => {
    if (!openedTask) return null;
    return parseTaskDescription(openedTask.description);
  }, [openedTask]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden relative font-sans">
      
      {/* 1. Header with Filters of Checklist To-do */}
      <div className="px-6 py-4 flex flex-wrap items-center bg-white shrink-0 border-b border-slate-100 justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-blue-500 font-medium text-slate-700 h-9"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Assignees/Personnel filter */}
          <select 
            value={filterAssignee}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[130px]"
            onChange={(e) => {
              setFilterAssignee(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Assignees</option>
            {assigneesOptions.map(person => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>

          {/* Tag filter */}
          <select 
            value={filterTag}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[110px]"
            onChange={(e) => {
              setFilterTag(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Tags</option>
            {tagsOptions.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* Project filter */}
          <select 
            value={filterProject}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[110px]"
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Projects</option>
            {projectsOptions.map(proj => (
              <option key={proj} value={proj}>{proj}</option>
            ))}
          </select>

          {/* Team filter */}
          <select 
            value={filterTeam}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[110px]"
            onChange={(e) => {
              setFilterTeam(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Teams</option>
            {teamsOptions.map(tm => (
              <option key={tm} value={tm}>{tm}</option>
            ))}
          </select>

          {/* Status checklist filter (NEW, DONE, SKIPPED) */}
          <select 
            value={filterTodoStatus}
            className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[100px]"
            onChange={(e) => {
              setFilterTodoStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="DONE">Done</option>
            <option value="SKIPPED">Skipped</option>
          </select>

          {/* Interactive Date Range custom box mimicking mockup */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-3 py-1.5 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Calendar size={13} className="text-slate-400" />
              <span>{startDate.replace(/-/g, '/')} - {endDate.replace(/-/g, '/')}</span>
            </button>

            {showDatePicker && (
              <div className="absolute left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 space-y-3 min-w-[240px] animate-in fade-in duration-100">
                <span className="block text-[10px] font-black uppercase text-slate-400 font-mono">Date Range Select</span>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-0.5">From Date</label>
                    <input 
                      type="date"
                      value={startDate}
                      className="w-full p-1.5 border border-slate-200 rounded-md focus:outline-none"
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5">To Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      className="w-full p-1.5 border border-slate-200 rounded-md focus:outline-none"
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => {
                      setStartDate('2026-05-20');
                      setEndDate('2026-05-20');
                      setShowDatePicker(false);
                      setPage(1);
                    }}
                    className="text-[10px] font-bold text-red-500 hover:underline"
                  >
                    Reset Date
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded text-[10px] font-bold"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

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
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Main interactive triggers */}
        <div className="flex items-center gap-3 shrink-0">
          {selectedTaskIds.size > 0 && (
            <button
              onClick={handleBulkSubmit}
              className="flex items-center gap-1.5 px-3.5 h-9 bg-emerald-600 hover:bg-emerald-700 transition-all text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <CheckSquare size={13} />
              <span>Submit Checked ({selectedTaskIds.size})</span>
            </button>
          )}

          <button 
            onClick={handleExportCsv}
            disabled={filteredTasks.length === 0}
            className="flex items-center gap-1.5 px-3.5 h-9 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all text-slate-600 rounded-lg text-xs font-bold shadow-sm disabled:opacity-40"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Main Daily Checklist tasks list Table context */}
      <div className="flex-1 overflow-auto bg-white min-h-[400px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold animate-pulse">Loading checklist...</p>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <table className="w-full text-left border-collapse table-fixed select-none">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
              <tr>
                <th className="w-[5%] px-6 py-3.5 text-center">
                  <button 
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {selectedTaskIds.size === paginatedTasks.length ? (
                      <CheckSquare size={16} className="text-blue-600 mx-auto" />
                    ) : (
                      <Square size={16} className="mx-auto" />
                    )}
                  </button>
                </th>
                <th className="w-[10%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="w-[21%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task Name</th>
                <th className="w-[11%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag</th>
                <th className="w-[17%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project</th>
                <th className="w-[11%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team</th>
                <th className="w-[8%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                <th className="w-[12%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline</th>
                <th className="w-[12%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Time (Est/Act)</th>
                <th className="w-[10%] px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="w-[10%] px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center font-mono">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((task) => {
                const isChecked = selectedTaskIds.has(task.id);
                return (
                  <tr 
                    key={task.id} 
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() => setOpenedTask(task)}
                  >
                    {/* Checkbox selector item */}
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleSelectRow(task.id)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare size={16} className="text-blue-600 mx-auto" />
                        ) : (
                          <Square size={16} className="mx-auto" />
                        )}
                      </button>
                    </td>

                    {/* ID */}
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs text-slate-400 font-bold">
                        {getDisplayId(task.id)}
                      </span>
                    </td>

                    {/* Task Name */}
                    <td className="px-4 py-4 overflow-hidden">
                      <span className="font-semibold text-slate-800 text-sm tracking-tight truncate block" title={task.title}>
                        {task.title}
                      </span>
                    </td>

                    {/* Tag label */}
                    <td className="px-4 py-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-block border border-slate-200 bg-slate-50 px-2.5 py-0.5 rounded text-[11px] font-medium text-slate-600 truncate max-w-full">
                        {task.tag_name || '数値報告'}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-4 overflow-hidden">
                      <span className="text-slate-600 text-xs truncate block font-medium">
                        {task.project_name}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-4 overflow-hidden">
                      <span className="text-slate-500 text-xs truncate block font-medium">
                        {task.team_name}
                      </span>
                    </td>

                    {/* Frequency Badge */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-50 text-blue-600 border border-blue-100">
                        {task.task_type || 'DAILY'}
                      </span>
                    </td>

                    {/* Deadline hours and days limit representation */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col text-xs font-semibold leading-tight">
                        <span className="text-slate-800 font-bold flex items-center gap-1">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          {task.deadline_time || '08:30'}
                        </span>
                        <span className="text-slate-400 text-[10px] font-medium mt-0.5">
                          {task.deadline_days || 'Mon - Fri'}
                        </span>
                      </div>
                    </td>

                    {/* TIME (EST/ACT) columns colored capsule with precise indicators */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center justify-center font-mono text-xs font-bold leading-none gap-1">
                        <span className="text-slate-600">
                          E: <span className="text-blue-600">{task.est_time || 0}m</span>
                        </span>
                        <span className="text-slate-400 text-[10px] font-medium mt-0.5">
                          A: <span className="text-emerald-600 font-bold">{task.actual_time || 0}m</span>
                        </span>
                      </div>
                    </td>

                    {/* To-do list internal status pill ('NEW', 'DONE', 'SKIPPED') */}
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-all shadow-sm ${
                        task.todo_status === 'DONE' 
                          ? 'bg-emerald-600 border border-emerald-500 text-white' 
                          : task.todo_status === 'SKIPPED'
                            ? 'bg-amber-500 border border-amber-400 text-white'
                            : 'bg-blue-600 border border-blue-500 text-white'
                      }`}>
                        {task.todo_status}
                      </span>
                    </td>

                    {/* Direct action triggers */}
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {task.todo_status === 'NEW' ? (
                        <button
                          onClick={() => handleDirectSubmit(task)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 hover:shadow-md transition-all text-white rounded-lg text-xs font-bold shadow-sm"
                        >
                          Submit
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResetTask(task)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all border border-slate-200"
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
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white shrink-0">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          TOTAL: {totalCount} CHECKS
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 leading-snug">{openedTask.title}</h3>
                <span className="text-[10px] font-mono font-bold text-slate-400 mt-1 block uppercase">ID: {getDisplayId(openedTask.id)}</span>
              </div>
              <button 
                onClick={() => setOpenedTask(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TASK STATUS Section showing status indicator and Undo */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none font-mono block">TASK STATUS</span>
                
                <div className="flex items-center justify-between bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <span className={`inline-block px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm ${
                    openedTaskParsedMeta.todo_status === 'DONE' 
                      ? 'bg-emerald-600 text-white' 
                      : openedTaskParsedMeta.todo_status === 'SKIPPED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-blue-600 text-white'
                  }`}>
                    {openedTaskParsedMeta.todo_status || 'NEW'}
                  </span>
                  
                  <div className="flex gap-2">
                    {openedTaskParsedMeta.todo_status !== 'SKIPPED' && (
                      <button
                        onClick={() => handleSkipTask(openedTask)}
                        className="px-3 py-1.5 hover:bg-amber-50 hover:text-amber-600 transition-colors text-slate-500 text-xs font-bold rounded-lg border border-slate-200"
                      >
                        Skip Task
                      </button>
                    )}
                    <button
                      onClick={() => handleResetTask(openedTask)}
                      className="px-3 py-1.5 hover:bg-slate-100 transition-colors text-slate-600 text-xs font-bold rounded-lg border border-slate-200"
                    >
                      Reset Task
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic subtasks detailed adjustments inside the slider drawer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none font-mono">SUB-TASKS MANAGEMENT</h3>
                  <div className="text-[10px] font-bold text-slate-500 font-mono flex items-center gap-2">
                    <span>EST: {openedTask.est_time || 0}m</span>
                    <span>•</span>
                    <span className="text-emerald-600">ACT: {openedTask.actual_time || 0}m</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {openedTaskParsedMeta.sub_tasks && openedTaskParsedMeta.sub_tasks.length > 0 ? (
                    openedTaskParsedMeta.sub_tasks.map((sub, index) => {
                      const currentSubStatus = sub.sub_status || 'New';
                      return (
                        <div 
                          key={sub.id || index} 
                          className="border border-slate-100 rounded-xl p-4 bg-white flex flex-col justify-between gap-3 shadow-xs hover:border-blue-100 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <span className="text-slate-800 text-xs font-bold leading-normal">{sub.content}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 shrink-0 ml-auto">
                              {sub.assignee}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-50/80 flex-wrap sm:flex-nowrap justify-between">
                            {/* ACTUAL: [ x ] MIN field */}
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 font-mono">
                              <span className="text-[10px] font-black">ACTUAL:</span>
                              <div className="relative flex items-center">
                                <input 
                                  type="number"
                                  min={0}
                                  value={sub.actual_minutes !== undefined ? sub.actual_minutes : 0}
                                  className="w-12 h-7 px-1 text-center bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-800 focus:outline-none focus:bg-white text-xs font-mono"
                                  onChange={(e) => {
                                    const rawVal = parseInt(e.target.value) || 0;
                                    handleUpdateSubtaskValue(openedTask, sub.id, { 
                                      actual_minutes: Math.max(0, rawVal) 
                                    });
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">MIN</span>
                            </div>

                            {/* SELECT BOX sub-task state selection (Done, New, Skipped) */}
                            <select
                              value={currentSubStatus}
                              className="h-7 px-2 py-0 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black text-slate-600 focus:outline-none cursor-pointer"
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
            <div className="p-6 border-t border-slate-100 shrink-0">
              {openedTaskParsedMeta.todo_status === 'NEW' ? (
                <button 
                  onClick={() => handleDirectSubmit(openedTask)}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  <Check size={14} />
                  <span>Submit Task</span>
                </button>
              ) : (
                <button 
                  onClick={() => handleResetTask(openedTask)}
                  className="w-full h-11 bg-slate-100 hover:bg-slate-200 transition-all text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-200"
                >
                  <span>Re-open Task to NEW</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TaskList;
