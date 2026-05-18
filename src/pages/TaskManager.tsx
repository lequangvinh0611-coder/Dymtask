import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, Edit2, Trash2, Power, Eye, EyeOff, Filter, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import CreateTaskModal from '../components/CreateTaskModal';
import { Task } from '../types/database.types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { logger } from '../lib/logger';

const TaskManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  const defaultFilters: TaskFilters & { showInactiveOnly?: boolean } = {
    assignee_email: profile?.email || undefined,
    status: 'NEW'
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
    (Array.isArray(filters.team_id) && filters.team_id.length > 0);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const isUser = profile?.role === 'user';

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, {
    ...filters,
    is_active: filters.showInactiveOnly ? false : undefined
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
      <div className="px-4 py-1.5 border-b border-slate-100 flex items-center bg-white shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" placeholder="Tìm kiếm..." 
              value={filters.search || ""}
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs w-36"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select 
            value={filters.assignee_email || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}
          >
            <option value="">Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select 
            value={filters.project_id || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
          >
            <option value="">Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            value={filters.tag_id || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
          >
            <option value="">Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select 
            value={filters.status || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}
          >
            <option value="">Status</option>
            <option value="NEW">New</option>
            <option value="DONE">Done</option>
            <option value="SKIPPED">Skipped</option>
          </select>

          <button 
            onClick={handleExportCsv}
            className="p-1 px-2 h-7 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-all flex items-center gap-1 group"
            title="Export CSV"
          >
            <Download className="w-3 h-3 group-hover:text-indigo-600" />
            <span className="group-hover:text-indigo-600">EXPORT</span>
          </button>
          
          {isFilterChanged && (
            <button 
              onClick={() => setFilters(defaultFilters)}
              className="p-1 px-2 h-7 text-indigo-600 bg-indigo-50 border border-indigo-100 rounded hover:bg-indigo-100 transition-all flex items-center gap-1"
              title="Reset Filters"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          )}

          <button onClick={() => refetch()} className={cn("p-1 ml-1 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
             <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button 
             onClick={() => setFilters(prev => ({ ...prev, showInactiveOnly: !prev.showInactiveOnly }))}
             className={cn("p-1 px-2 h-7 text-[10px] font-bold uppercase rounded border transition-all flex items-center gap-1", filters.showInactiveOnly ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-400 border-slate-200")}
           >
             {filters.showInactiveOnly ? <EyeOff size={12} /> : <Eye size={12} />}
             <span>{filters.showInactiveOnly ? "Inactive" : "Show Inactive"}</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} className="flex items-center gap-1.5 h-7 px-3 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">
            <Plus className="w-3 h-3" /> <span>Tạo mới</span>
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
              <th className="w-[30%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="w-[12%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-6">Project</th>
              <th className="w-[9%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="w-[9%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="w-[9%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Type</th>
              <th className="w-[10%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="w-[10%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="w-[6%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Active</th>
              <th className="w-[5%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className={cn("hover:bg-slate-50/30 transition-all group", !task.is_active && "bg-slate-50/80")}>
                <td className="px-4 py-1.5 overflow-hidden">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 group-hover:text-primary transition-colors text-xs truncate" title={task.task_name}>{task.task_name}</span>
                    <span className="font-mono text-[9px] text-slate-400 uppercase">ID: {task.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right pr-6">
                  <div className="text-primary font-bold text-[10px] truncate" title={task.projects?.name || 'General'}>
                    {task.projects?.name || 'General'}
                  </div>
                </td>
                <td className="px-4 py-1.5">
                   <span className="px-1.5 py-0 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                     {task.tags?.name || 'No Tag'}
                   </span>
                </td>
                <td className="px-4 py-1.5 overflow-hidden">
                   <div className="text-[9px] font-medium text-slate-400 truncate" title={task.teams?.name || 'Internal'}>
                     {task.teams?.name || 'Internal'}
                   </div>
                </td>
                <td className="px-4 py-1.5 font-bold text-indigo-500 uppercase text-[9px] tracking-tighter">
                   {task.type}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex flex-col text-[10px]">
                    <span className="font-bold text-slate-700">{task.deadline_time || '--:--'}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">{task.deadline_date || '--/--/--'}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-[8px] font-bold uppercase tracking-tight">
                    <div className="text-primary">Est: {task.estimated_minutes}m</div>
                    <div className="text-emerald-500">Act: {task.actual_minutes}m</div>
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
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center justify-between">
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
