import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RotateCcw, Clock, Check, AlertCircle, ChevronLeft, ChevronRight, 
  Calendar, RefreshCw, Loader2, Play, CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { FilterSelect } from './ui/FilterSelect';
import { toast } from 'sonner';

// Interfaces matching data patterns
interface SubTask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
  actual_minutes?: number;
  sub_status?: 'New' | 'Done' | 'Skipped';
}

interface TaskMetadata {
  description: string;
  project_name: string;
  team_name: string;
  tag_name: string;
  deadline_time: string;
  deadline_days: string;
  sub_tasks: SubTask[];
  todo_status?: 'NEW' | 'DONE' | 'SKIPPED';
  todo_date?: string;
}

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string; // NEW, IN_PROGRESS, DONE
  is_active: boolean;
  est_time: number;
  actual_time: number;
  created_at: string;
  assignees?: string[];
  deadline_date?: string | null;
}

// Deterministic 6-digit Display ID generator
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
      // ignore JSON parse issue
    }
  }

  return {
    ...defaultMeta,
    description: rawDescription
  };
};

const TaskList: React.FC<{ title?: string }> = ({ title = "To-do List" }) => {
  const { profile } = useAuthStore();
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Real-time & Data Fetching
  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách công việc:', err);
      toast.error('Lỗi khi tải dữ liệu công việc: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();

    // Setup Realtime Sync
    const channel = supabase.channel('personal_tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // Trigger silent update 
        supabase.from('tasks').select('*').order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) setTasks(data);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update Status directly on database
  const handleUpdateStatus = async (taskId: string, newStatus: 'NEW' | 'IN_PROGRESS' | 'DONE') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success(`Đã cập nhật trạng thái thành ${newStatus === 'NEW' ? 'To-do' : newStatus === 'IN_PROGRESS' ? 'In Progress' : 'Done'}`);
      
      // Update local state immediately for snappy responsive feel
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: newStatus } : task));
    } catch (err: any) {
      console.error('Lỗi khi cập nhật trạng thái:', err);
      toast.error('Không thể cập nhật trạng thái: ' + err.message);
    }
  };

  // Memoized parsed tasks from JSON description
  const parsedTasks = useMemo(() => {
    return tasks.map(task => {
      const meta = parseTaskDescription(task.description);
      return {
        ...task,
        meta,
        project_name: meta.project_name,
        team_name: meta.team_name,
        tag_name: meta.tag_name,
        sub_tasks: meta.sub_tasks,
        todo_date: meta.todo_date || task.deadline_date || (task.created_at ? task.created_at.split('T')[0] : '')
      };
    });
  }, [tasks]);

  // Extract unique options for filter select
  const projectsOptions = useMemo(() => {
    const list = new Set<string>();
    parsedTasks.forEach(t => t.project_name && list.add(t.project_name));
    return Array.from(list).map(p => ({ value: p, label: p }));
  }, [parsedTasks]);

  const tagsOptions = useMemo(() => {
    const list = new Set<string>();
    parsedTasks.forEach(t => t.tag_name && list.add(t.tag_name));
    return Array.from(list).map(tg => ({ value: tg, label: tg }));
  }, [parsedTasks]);

  // Frontend filtering logic combining specifications
  const filteredTasks = useMemo(() => {
    const profileName = profile?.name;
    if (!profileName) return [];

    const nameToMatch = profileName.toLowerCase().trim();

    return parsedTasks.filter(task => {
      // 1. Task đang hoạt động (is_active === true)
      if (task.is_active === false) return false;

      // 2. Task được giao cho user hiện tại:
      // Kiểm tra mảng task.assignees chứa profile.name
      const isAssignedToMe = Array.isArray(task.assignees) && task.assignees.some(
        (asn: string) => asn && asn.toLowerCase().trim() === nameToMatch
      );

      // Kiểm tra assignee của sub-task trùng với profile.name
      const isSubTaskAssignedToMe = Array.isArray(task.sub_tasks) && task.sub_tasks.some(
        (sub: any) => sub.assignee && sub.assignee.toLowerCase().trim() === nameToMatch
      );

      if (!isAssignedToMe && !isSubTaskAssignedToMe) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const displayId = getDisplayId(task.id);
        const matchTitle = (task.title || '').toLowerCase().includes(query);
        const matchId = displayId.includes(query);
        const matchProj = (task.project_name || '').toLowerCase().includes(query);
        if (!matchTitle && !matchId && !matchProj) return false;
      }

      // 4. Status filter
      if (filterStatus && task.status !== filterStatus) return false;

      // 5. Project filter
      if (filterProject && task.project_name !== filterProject) return false;

      // 6. Tag filter
      if (filterTag && task.tag_name !== filterTag) return false;

      return true;
    });
  }, [parsedTasks, searchQuery, filterStatus, filterProject, filterTag, profile]);

  // Client side pagination
  const totalCount = filteredTasks.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredTasks.slice(startIdx, startIdx + pageSize);
  }, [filteredTasks, page]);

  // UI helpers for status tags and dot indicators resemble Corporate style
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'NEW':
        return { dot: 'bg-blue-500', name: 'To-do', class: 'text-blue-700 bg-blue-50/50 border-blue-100' };
      case 'IN_PROGRESS':
        return { dot: 'bg-amber-500', name: 'In Progress', class: 'text-amber-700 bg-amber-50/50 border-amber-100' };
      case 'DONE':
        return { dot: 'bg-emerald-500', name: 'Done', class: 'text-emerald-700 bg-emerald-50/50 border-emerald-100' };
      default:
        return { dot: 'bg-slate-400', name: status || 'To-do', class: 'text-slate-700 bg-slate-50 border-slate-100' };
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 overflow-hidden font-sans">
      
      {/* Search and Filters Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3 shrink-0 flex-nowrap">
          {/* Title Area */}
          <h1 className="text-sm font-bold text-slate-800 tracking-tight mr-2">{title}</h1>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm công việc..." 
              value={searchQuery}
              className="pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-indigo-500 font-medium text-slate-700 h-8 shadow-sm transition-all"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Project Filter */}
          <FilterSelect
            value={filterProject}
            onChange={(val) => {
              setFilterProject(val);
              setPage(1);
            }}
            defaultOptionLabel="Tất cả dự án"
            options={projectsOptions}
            className="h-8 min-w-[130px] border-slate-200"
          />

          {/* Tag Filter */}
          <FilterSelect
            value={filterTag}
            onChange={(val) => {
              setFilterTag(val);
              setPage(1);
            }}
            defaultOptionLabel="Tất cả nhãn"
            options={tagsOptions}
            className="h-8 min-w-[120px] border-slate-200"
          />

          {/* Status Filter */}
          <FilterSelect
            value={filterStatus}
            onChange={(val) => {
              setFilterStatus(val);
              setPage(1);
            }}
            defaultOptionLabel="Tất cả trạng thái"
            options={[
              { value: 'NEW', label: 'To-do' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'DONE', label: 'Done' }
            ]}
            className="h-8 min-w-[130px] border-slate-200"
          />

          {/* Reset Filters Trigger */}
          {(searchQuery || filterProject || filterStatus || filterTag) && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterProject('');
                setFilterStatus('');
                setFilterTag('');
                setPage(1);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Sync Trigger and Profile view indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/50">
            Cá nhân: <span className="font-bold text-slate-700">{profile?.name || 'User'}</span>
          </div>

          <button 
            onClick={fetchMyTasks}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white transition-all shadow-xs"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Checklist / Tasks section */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-24 gap-3 bg-white">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold animate-pulse">Đang tải danh sách công việc...</p>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-fixed select-none min-w-[950px]">
              <thead className="bg-slate-50 border-b border-slate-200/60 sticky top-0 z-20">
                <tr className="h-10">
                  <th className="w-[10%] px-6 text-[11px] uppercase tracking-wider font-bold text-slate-500">Mã Công Việc</th>
                  <th className="w-[30%] px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500">Tên công việc</th>
                  <th className="w-[18%] px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500">Dự án</th>
                  <th className="w-[12%] px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500">Thẻ</th>
                  <th className="w-[12%] px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500">Hạn chót (Due date)</th>
                  <th className="w-[10%] px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center">Trạng thái</th>
                  <th className="w-[18%] px-6 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-right">Thay đổi trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  return (
                    <tr 
                      key={task.id} 
                      className="h-12 hover:bg-slate-50/50 transition-colors group"
                    >
                      {/* ID Row */}
                      <td className="px-6 py-2">
                        <span className="font-mono text-xs text-slate-400 font-medium">
                          #{getDisplayId(task.id)}
                        </span>
                      </td>

                      {/* Title Row */}
                      <td className="px-4 py-2">
                        <span className="font-semibold text-slate-700 text-xs line-clamp-1 block" title={task.title || ''}>
                          {task.title}
                        </span>
                      </td>

                      {/* Project Row */}
                      <td className="px-4 py-2">
                        <span className="text-slate-600 text-xs truncate block font-normal">
                          {task.project_name || '—'}
                        </span>
                      </td>

                      {/* Tag Row */}
                      <td className="px-4 py-2">
                        {task.tag_name ? (
                          <span className="inline-block bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded text-xs text-slate-500 font-medium">
                            {task.tag_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Due Date Row */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {task.todo_date || 'Chưa định hạn'}
                          </span>
                        </div>
                      </td>

                      {/* Status Row with standard Minimalist dot indicator */}
                      <td className="px-4 py-2 text-center">
                        <div className="inline-flex items-center gap-1.5 justify-center bg-slate-50 border border-slate-100 rounded-full px-2.5 py-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dot}`} />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {statusConfig.name}
                          </span>
                        </div>
                      </td>

                      {/* Single Action Row: Toggle and status update buttons only */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {task.status !== 'NEW' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'NEW')}
                              className="px-2 py-1 text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-all shadow-xs shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                              title="Chuyển về mục Cần làm"
                            >
                              To-do
                            </button>
                          )}
                          
                          {task.status !== 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                              className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 rounded-md transition-all shadow-xs shrink-0 flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Bắt đầu công việc này"
                            >
                              <Play size={10} className="fill-indigo-700 text-indigo-700" />
                              <span>Doing</span>
                            </button>
                          )}

                          {task.status !== 'DONE' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'DONE')}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 rounded-md transition-all shadow-xs shrink-0 flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Hoàn thành công việc này"
                            >
                              <CheckCircle size={10} />
                              <span>Done</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty State Corporate Modern UI */
          <div className="py-24 flex flex-col items-center justify-center text-center bg-white min-h-[400px]">
            <div className="p-4 bg-slate-50 rounded-full mb-3 text-slate-300 border border-slate-100">
              <AlertCircle size={44} />
            </div>
            <h4 className="text-slate-800 font-bold text-base">Không có công việc nào</h4>
            <p className="text-slate-400 text-sm mt-1 max-w-xs leading-relaxed">
              Bạn hiện không có công việc nào cần xử lý hoặc được giao.
            </p>
          </div>
        )}
      </div>

      {/* Footer / Pagination standard */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white shrink-0 select-none">
        <span className="text-xs font-semibold text-slate-500 font-mono">
          Tổng số: {totalCount} công việc cá nhân
        </span>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="p-1 px-2 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1 mx-1.5">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pIndex = idx + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => setPage(pIndex)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      page === pIndex 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
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
              className="p-1 px-2 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        <div className="w-20 hidden md:block"></div>
      </div>

    </div>
  );
};

export default TaskList;
