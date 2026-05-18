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
  const today = new Date().toISOString().split('T')[0];
  const defaultFilters: TaskFilters & { showInactiveOnly?: boolean } = {
    assignee_email: profile?.email || undefined,
    status: 'NEW',
    date: today
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
    filters.date !== defaultFilters.date ||
    filters.showInactiveOnly !== undefined ||
    (Array.isArray(filters.team_id) && filters.team_id.length > 0);
  
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
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-1.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
           {isFilterChanged && (
             <button 
               onClick={() => setFilters(defaultFilters)}
               className="p-1 px-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded hover:bg-indigo-100 transition-all flex items-center gap-1"
             >
               <RotateCw className="w-2.5 h-2.5" />
               RESET
             </button>
           )}
           <button onClick={() => refetch()} className={cn("p-1 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
             <RotateCw className="w-3 h-3" />
           </button>
           <button 
             onClick={() => setFilters(prev => ({ ...prev, showInactiveOnly: !prev.showInactiveOnly }))}
             className={cn("p-1 text-[10px] font-bold uppercase rounded border transition-all flex items-center gap-1", filters.showInactiveOnly ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-400 border-slate-200")}
           >
             {filters.showInactiveOnly ? <EyeOff size={12} /> : <Eye size={12} />}
             {filters.showInactiveOnly ? "Inactive" : "Show Inactive"}
           </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
            <option value="">Tất cả Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select 
            value={filters.project_id || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
          >
            <option value="">Tất cả Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            value={filters.tag_id || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
          >
            <option value="">Tất cả Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select 
            value={filters.status || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7" 
            onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}
          >
            <option value="">Tất cả Status</option>
            <option value="NEW">New</option>
            <option value="DONE">Done</option>
            <option value="SKIPPED">Skipped</option>
          </select>
          <input 
            type="date" 
            value={filters.date || ""}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7 focus:outline-none text-slate-600" 
            onChange={(e) => {
              const selectedDate = e.target.value;
              if (selectedDate) {
                const diffTime = Math.abs(new Date(selectedDate).getTime() - new Date(today).getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 62) {
                  alert("Không được phép chọn nhiều hơn 62 ngày");
                  return;
                }
              }
              setFilters({...filters, date: selectedDate || undefined});
            }}
          />
          
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
              <th className="w-[30%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Details</th>
              <th className="w-[12%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-6">Classification</th>
              <th className="w-[9%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Schedule</th>
              <th className="w-[10%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Estimation</th>
              <th className="w-[10%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Time</th>
              <th className="w-[6%] px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
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
                    <div className="text-emerald-500 font-black text-xs">{task.actual_minutes}m</div>
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
      <div className="px-4 py-1.5 border-t border-slate-100 bg-white flex items-center justify-end">
         <div className="flex items-center gap-1">
            {/* Pagination can go here if needed, keeping it empty for now to match UI spacing */}
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total: {totalCount} Entities</span>
         </div>
      </div>
    </div>
  );
};

export default TaskManager;
