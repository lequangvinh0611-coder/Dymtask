import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, Edit2, Trash2, Power, Eye, EyeOff, Filter, Clock } from 'lucide-react';
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
  const [filters, setFilters] = useState<TaskFilters & { showInactiveOnly?: boolean }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const isUser = profile?.role === 'user';

  // Management view can see all tasks, but we can toggle active status filter
  const { tasks, totalCount, loading, refetch } = useTasks(1, 1000, {
    ...filters,
    is_active: filters.showInactiveOnly ? false : undefined
  });

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
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden m-4">
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800">Task Manager</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => refetch()} className={cn("p-1.5 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" placeholder="Tìm kiếm..." 
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-40"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select 
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
            onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}
          >
            <option value="">Tất cả Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select 
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
            onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
          >
            <option value="">Tất cả Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
            onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
          >
            <option value="">Tất cả Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          
          <button onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> <span>Tạo mới</span>
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
        <table className="w-full text-left border-collapse min-w-[1100px] table-fixed">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="w-[30%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Details</th>
              <th className="w-[15%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Classification</th>
              <th className="w-[15%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Schedule</th>
              <th className="w-[10%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Estimation</th>
              <th className="w-[10%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="w-[10%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-6">Actions</th>
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
                <td className="px-4 py-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-primary font-bold text-[10px] truncate">{task.projects?.name || 'General'}</span>
                    <div className="flex gap-1 items-center">
                       <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-400 border border-slate-200">
                         {task.tags?.name || 'No Tag'}
                       </span>
                       <span className="text-[9px] font-bold text-slate-400 truncate max-w-[50px]">{task.teams?.name || 'Root'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-700 text-xs">{task.deadline_time || '--:--'}</div>
                      <div className="text-[9px] text-slate-400 font-bold truncate">
                        {renderDeadlineContext(task)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-center">
                    <div className="text-primary font-black text-xs">{task.estimated_minutes}m</div>
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
                  <div className="flex items-center justify-end gap-1 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => toggleTaskActive(task.id, task.is_active)} 
                      title={task.is_active ? "Tạm ẩn" : "Hiện thị"}
                      className={cn("p-1.5 rounded transition-all", task.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50")}
                    >
                      <Power size={14} />
                    </button>
                    <button 
                      onClick={() => { setSelectedTask(task); setIsModalOpen(true); }} 
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all font-bold text-[10px] uppercase"
                    >
                      SỬA
                    </button>
                    {!isUser && (
                      <button 
                        onClick={() => handleDelete(task.id)} 
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center justify-between">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repository Status: {totalCount} Entities</span>
      </div>
    </div>
  );
};

export default TaskManager;
