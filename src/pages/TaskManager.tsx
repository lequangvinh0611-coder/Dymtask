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
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden m-6">
      <div className="p-6 border-b border-slate-100 bg-white shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Task Repository</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Central Management Unit</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <button 
                onClick={() => setFilters({ ...filters, showInactiveOnly: !filters.showInactiveOnly })}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  filters.showInactiveOnly ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {filters.showInactiveOnly ? <EyeOff size={14} /> : <Eye size={14} />}
                {filters.showInactiveOnly ? 'Showing Inactive' : 'Showing All'}
              </button>
            </div>

            <button onClick={() => refetch()} className={cn("p-2.5 text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-primary-light", loading && "animate-spin text-primary")}>
              <RotateCw className="w-4 h-4" />
            </button>
            
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" placeholder="Search tasks..." 
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <button onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-black transition-all text-white rounded-xl text-sm font-bold shadow-lg shadow-black/10 uppercase tracking-widest">
              <Plus className="w-4 h-4" /> <span>New Task</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <SearchableSelect 
            options={users.map(u => ({ id: u.email, name: u.name || u.email }))} 
            value={filters.assignee_email || ''} 
            onChange={(val) => setFilters({...filters, assignee_email: val || undefined})}
            placeholder="Filter Assignee"
          />
          <SearchableSelect 
            options={tags} 
            value={filters.tag_id || ''} 
            onChange={(val) => setFilters({...filters, tag_id: val || undefined})}
            placeholder="Filter Tags"
          />
          <SearchableSelect 
            options={projects} 
            value={filters.project_id || ''} 
            onChange={(val) => setFilters({...filters, project_id: val || undefined})}
            placeholder="Filter Projects"
          />
          <SearchableSelect 
            options={teams} 
            value={filters.team_id || ''} 
            onChange={(val) => setFilters({...filters, team_id: val || undefined})}
            placeholder="Filter Teams"
          />
        </div>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedTask(null); }} 
        onSuccess={refetch} 
        taskToEdit={selectedTask || undefined} 
      />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Details</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Classification</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Schedule</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Estimation</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Visibility</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className={cn("hover:bg-slate-50/30 transition-all group", !task.is_active && "bg-slate-50/80")}>
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{task.task_name}</span>
                    <span className="font-mono text-[9px] text-slate-400 uppercase tracking-tighter">ID: {task.id.slice(0, 8)}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="px-2 py-0.5 w-fit rounded text-[9px] font-black uppercase bg-primary-light text-primary border border-primary/20">
                      {task.projects?.name || 'General'}
                    </span>
                    <div className="flex gap-1">
                       <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                        {task.tags?.name || 'No Tag'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase py-0.5">{task.teams?.name || 'Root'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <Clock size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">{task.deadline_time || '--:--'}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {renderDeadlineContext(task)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                    <div className="text-primary font-black text-xs">{task.estimated_minutes}m</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Allocated</div>
                </td>
                <td className="px-6 py-5 text-center">
                  <button 
                    onClick={() => toggleTaskActive(task.id, task.is_active)} 
                    disabled={isUser}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest", 
                      task.is_active 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:shadow-lg hover:shadow-emerald-500/10" 
                        : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200",
                      isUser && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <Power size={12} className={cn(task.is_active && "animate-pulse")} />
                    <span>{task.is_active ? 'Active' : 'Hidden'}</span>
                  </button>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button 
                      onClick={() => { setSelectedTask(task); setIsModalOpen(true); }} 
                      className="p-2.5 text-slate-400 hover:text-primary rounded-xl hover:bg-primary-light transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!isUser && (
                      <button 
                        onClick={() => handleDelete(task.id)} 
                        className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repository Status: {totalCount} Entities Indexed</span>
      </div>
    </div>
  );
};

export default TaskManager;