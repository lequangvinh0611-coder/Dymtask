import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, Edit2, Trash2, Power, Eye, EyeOff, Filter, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters, TaskWithDetails } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import CreateTaskModal from '../components/CreateTaskModal';
import { Task } from '../types/database.types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { MultiSearchableSelect } from '../components/ui/MultiSearchableSelect';
import { logger } from '../lib/logger';

const TaskManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  const defaultFilters: TaskFilters & { showInactiveOnly?: boolean } = {
    assignee_email: profile?.email || undefined,
    status: undefined,
    startDate: '',
    endDate: ''
  };
  const [filters, setFilters] = useState<TaskFilters & { showInactiveOnly?: boolean }>(defaultFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const isFilterChanged = 
    filters.search !== undefined || 
    filters.assignee_email !== defaultFilters.assignee_email || 
    filters.project_id !== undefined || 
    filters.tag_id !== undefined || 
    filters.status !== defaultFilters.status || 
    filters.showInactiveOnly !== undefined ||
    filters.startDate !== defaultFilters.startDate ||
    filters.endDate !== defaultFilters.endDate ||
    (Array.isArray(filters.team_id) && filters.team_id.length > 0);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const isUser = profile?.role === 'user';

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, {
    ...filters,
    is_active: filters.showInactiveOnly ? false : true
  });

  const totalPages = Math.ceil(totalCount / 15) || 1;

  const handleExportCsv = () => {
    if (!tasks || tasks.length === 0) return;
    
    const headers = ['ID', 'Task Name', 'Project', 'Tag', 'Team', 'Type', 'Deadline Date', 'Deadline Time', 'Estimated Minutes', 'Actual Minutes', 'Status', 'Active'];
    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        task.id,
        `"${task.task_name.replace(/"/g, '""')}"`,
        `"${(task.projects?.name || 'General').replace(/"/g, '""')}"`,
        `"${(task.tags?.name || 'No Tag').replace(/"/g, '""')}"`,
        `"${(task.teams?.name || 'Internal').replace(/"/g, '""')}"`,
        task.type,
        task.deadline_date || '',
        task.deadline_time || '',
        task.estimated_minutes,
        task.actual_minutes,
        task.status,
        task.is_active
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `task_manager_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaginationItems = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  useEffect(() => {
    const fetchMeta = async () => {
      const [p, t, tg, u] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('teams').select('id, name'),
        supabase.from('tags').select('id, name'),
        supabase.from('users').select('id, name, email'),
      ]);
      setProjects(p.data || []);
      setTeams(t.data || []);
      setTags(tg.data || []);
      setUsers(u.data || []);
    };
    fetchMeta();
  }, []);

  const toggleTaskActive = async (id: string, currentStatus: boolean) => {
    if (isUser) return;
    try {
      await supabase.from('tasks').update({ is_active: !currentStatus }).eq('id', id);
      await logger.log('TOGGLE_TASK_ACTIVE', `${!currentStatus ? 'Activated' : 'Deactivated'} task`, { taskId: id });
      refetch();
    } catch (error) {
       console.error('Error toggling active state:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (isUser) return;
    if (!window.confirm('This action will permanently delete the task. Continue?')) return;
    try {
      await supabase.from('tasks').delete().eq('id', id);
      await logger.log('DELETE_TASK', `Permanently deleted task`, { taskId: id });
      refetch();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const renderDeadlineContext = (task: any) => {
    switch(task.type) {
      case 'DAILY': return 'Hàng ngày';
      case 'WEEKLY': return task.deadline_days?.join(', ');
      case 'MONTHLY': return `Ngày ${task.deadline_day_num}`;
      case 'ONETIME': return task.deadline_date;
      default: return task.type;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-2 flex items-center bg-white shrink-0 border-b border-slate-100 justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Task Manager</h2>
          
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" placeholder="Tìm kiếm..." 
                value={filters.search || ""}
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm w-44 h-8 focus:outline-none focus:border-indigo-600 transition-all"
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <select 
              value={filters.assignee_email || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[120px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}
            >
              <option value="">Assignees</option>
              {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
            </select>
            <select 
              value={filters.project_id || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[100px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
            >
              <option value="">Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
              value={filters.tag_id || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[90px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
            >
              <option value="">Tags</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select 
              value={filters.team_id as string || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[100px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}
            >
              <option value="">Teams</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>

            <select 
              value={filters.showInactiveOnly ? "OFF" : "ON"}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[90px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, showInactiveOnly: e.target.value === "OFF"})}
            >
              <option value="ON">ON</option>
              <option value="OFF">OFF</option>
            </select>

            <button 
              onClick={handleExportCsv}
              className="p-1 px-4 h-8 text-xs font-black text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-2 group uppercase tracking-widest"
              title="Export CSV"
            >
              <Download className="w-4 h-4 group-hover:text-indigo-600" />
              <span className="group-hover:text-indigo-600">CSV</span>
            </button>
            
            <button onClick={() => refetch()} className={cn("p-2 ml-1 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
               <RotateCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} className="flex items-center gap-2 h-8 px-5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
            <Plus className="w-4 h-4" /> <span>Tạo mới</span>
          </button>
        </div>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedTask(null); }} 
        onSuccess={refetch} 
        taskToEdit={selectedTask || undefined} 
      />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="w-[5%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">ID</th>
              <th className="w-[25%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="w-[12%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-10">Project</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Type</th>
              <th className="w-[10%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="w-[10%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="w-[6%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="w-[5%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className={cn("hover:bg-indigo-50/30 transition-all group", !task.is_active && "bg-slate-50/80")}>
                <td className="px-6 py-2">
                  <span className="font-mono text-[10px] text-slate-400 uppercase font-bold">{String(task.display_id || 0).padStart(6, '0')}</span>
                </td>
                <td className="px-6 py-2 overflow-hidden">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-sm tracking-tight truncate" title={task.task_name}>{task.task_name}</span>
                  </div>
                </td>
                <td className="px-6 py-2 text-right pr-10">
                  <div className="text-indigo-600 font-bold text-[10px] uppercase tracking-wide truncate" title={task.projects?.name || 'General'}>
                    {task.projects?.name || 'General'}
                  </div>
                </td>
                <td className="px-6 py-2">
                   <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200 tracking-wider">
                     {task.tags?.name || 'No Tag'}
                   </span>
                </td>
                <td className="px-6 py-2 overflow-hidden">
                   <div className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-tight" title={(task as any).team_ids?.join(', ') || task.teams?.name || 'Internal'}>
                     {(task as any).team_ids && (task as any).team_ids.length > 0 ? (
                       (task as any).team_ids.length > 1 
                         ? `${(task as any).team_ids[0]} +${(task as any).team_ids.length - 1}`
                         : (task as any).team_ids[0]
                     ) : (task.teams?.name || 'Internal')}
                   </div>
                </td>
                <td className="px-6 py-2">
                   <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                     {task.type}
                   </span>
                </td>
                <td className="px-6 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{task.deadline_time || '--:--'}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{task.deadline_date || '--/--/--'}</span>
                  </div>
                </td>
                <td className="px-6 py-2 text-[9px] font-black uppercase tracking-tight">
                    <div className="text-indigo-600">Est: {task.estimated_minutes}m</div>
                    <div className="text-emerald-600">Act: {task.actual_minutes}m</div>
                </td>
                <td className="px-4 py-1.5 text-center">
                   <span className={cn(
                     "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest",
                     task.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200"
                   )}>
                     {task.is_active ? 'ON' : 'OFF'}
                   </span>
                </td>
                <td className="px-4 py-1.5 text-right pr-6">
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200 p-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                      {task.type !== 'ONETIME' && task.type !== 'ONCE' ? (
                        <button 
                          onClick={() => toggleTaskActive(task.id, task.is_active)} 
                          title={task.is_active ? "Tạm ẩn" : "Hiện thị"}
                          className={cn(
                            "p-1.5 rounded hover:scale-110 transition-all", 
                            task.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                          )}
                        >
                          <Power size={13} />
                        </button>
                      ) : (
                        <div className="w-7 h-7" /> // Placeholder for Spot tasks which don't have toggle
                      )}
                      <button 
                        onClick={() => { setSelectedTask(task); setIsModalOpen(true); }} 
                        title="Sửa Task"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all hover:scale-110"
                      >
                        <Edit2 size={13} />
                      </button>
                      {!isUser && (
                        <button 
                          onClick={() => handleDelete(task.id)} 
                          title="Xóa vĩnh viễn"
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-all hover:scale-110"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-1 border-t border-slate-100 bg-white flex items-center justify-between">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">Total: {totalCount} Entities</span>
         <div className="flex-1 flex items-center justify-center gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1 mx-2">
              {getPaginationItems().map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof item === 'number' && setPage(item)}
                  disabled={typeof item !== 'number'}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all",
                    page === item ? "bg-indigo-600 text-white shadow-sm" : 
                    typeof item === 'number' ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : 
                    "text-slate-300 cursor-default"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
         </div>
         <div className="min-w-[100px]"></div>
      </div>
    </div>
  );
};

export default TaskManager;
