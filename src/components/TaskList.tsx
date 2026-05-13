import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckSquare, Square, MoreVertical, Ban, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import CreateTaskModal from './CreateTaskModal';
import { SideDrawer } from './ui/SideDrawer';
import { logger } from '../lib/logger';
import { Task } from '../types/database.types';

interface TaskListProps {
  title: string;
  showCreate?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ title, showCreate = false }) => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  
  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, { ...filters, is_active: true });
  
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

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

  const totalPages = Math.ceil(totalCount / 15) || 1;

  const handleOpenDrawer = (task: Task) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    setUpdatingTask(taskId);
    try {
      await supabase.from('tasks').update({ status }).eq('id', taskId);
      await logger.log('UPDATE_TASK_STATUS', `Updated task status to ${status}`, { taskId });
      refetch();
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleBatchSkip = async (taskIds: string[]) => {
    try {
      await supabase.from('tasks').update({ status: 'DONE', actual_minutes: 0 }).in('id', taskIds);
      await logger.log('BATCH_SKIP_TASKS', `Skipped ${taskIds.length} tasks`, { taskIds });
      refetch();
    } catch (error) {
      console.error('Error skipping tasks:', error);
    }
  };

  const handleUpdateActualTime = async (taskId: string, minutes: number) => {
    try {
      await supabase.from('tasks').update({ actual_minutes: minutes }).eq('id', taskId);
      refetch();
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, actual_minutes: minutes } : null);
      }
    } catch (error) {
      console.error('Error updating actual time:', error);
    }
  };

  const handleToggleSubtask = async (task: Task, subtaskId: string) => {
    try {
      const currentSubtasks = task.subtasks || [];
      const newSubtasks = currentSubtasks.map((sub: any) => 
        sub.id === subtaskId ? { ...sub, is_completed: !sub.is_completed } : sub
      );
      await supabase.from('tasks').update({ subtasks: newSubtasks }).eq('id', task.id);
      refetch();
      if (selectedTask?.id === task.id) {
        setSelectedTask(prev => prev ? { ...prev, subtasks: newSubtasks } : null);
      }
    } catch (error) {
      console.error('Error toggling subtask:', error);
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-slate-50 text-slate-600 border-slate-200',
      'IN_PROGRESS': 'bg-blue-50 text-blue-600 border-blue-200',
      'DONE': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      'SUBMITTED': 'bg-purple-50 text-purple-600 border-purple-200'
    };
    return statusMap[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold border border-indigo-100 rounded">SYNCED</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => refetch()} className={cn("p-2 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
            <RotateCw className="w-4 h-4" />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Tìm kiếm..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}>
            <option value="">Tất cả Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}>
            <option value="">Tất cả Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}>
            <option value="">Tất cả Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}>
            <option value="">Tất cả Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Bộ lọc Date dành riêng cho To-do List */}
          <input 
            type="date" 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600" 
            onChange={(e) => setFilters({...filters, date: e.target.value || undefined})}
          />
          
          {showCreate && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => refetch()} />

      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        title="Task Detail"
      >
        {selectedTask && (
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Task Name</h3>
              <p className="text-xl font-bold text-slate-900">{selectedTask.task_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time Estimate</p>
                <div className="flex items-center gap-2 text-indigo-600 font-bold">
                  <Clock size={14} />
                  <span>{selectedTask.estimated_minutes} mins</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Actual Time</p>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    className="w-16 bg-transparent border-none p-0 text-emerald-600 font-bold focus:ring-0"
                    value={selectedTask.actual_minutes}
                    onChange={(e) => handleUpdateActualTime(selectedTask.id, parseInt(e.target.value) || 0)}
                  />
                  <span className="text-emerald-600 font-bold">mins</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Status Control</h3>
              <div className="grid grid-cols-2 gap-2">
                {['NEW', 'IN_PROGRESS', 'DONE', 'SUBMITTED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(selectedTask.id, s)}
                    disabled={updatingTask === selectedTask.id}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                      selectedTask.status === s 
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/30"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span>Subtasks</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                  {selectedTask.subtasks ? selectedTask.subtasks.filter((s:any) => s.is_completed).length : 0}/{selectedTask.subtasks ? selectedTask.subtasks.length : 0}
                </span>
              </h3>
              <div className="space-y-2">
                {selectedTask.subtasks?.map((sub: any) => (
                  <div key={sub.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:border-primary/20">
                    <button onClick={() => handleToggleSubtask(selectedTask, sub.id)} className="text-slate-300 hover:text-primary transition-colors">
                      {sub.is_completed ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Square size={20} />}
                    </button>
                    <span className={cn("text-sm font-medium", sub.is_completed ? "text-slate-400 line-through" : "text-slate-700")}>
                      {sub.name}
                    </span>
                    {sub.estimated_minutes && <span className="ml-auto text-[10px] font-bold text-slate-400">{sub.estimated_minutes}m</span>}
                  </div>
                ))}
                {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                  <p className="text-sm text-slate-400 italic text-center py-4">No subtasks defined.</p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
               <button 
                onClick={() => { handleBatchSkip([selectedTask.id]); setIsDrawerOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors"
               >
                 <Ban size={16} />
                 <span>Skip this task</span>
               </button>
            </div>
          </div>
        )}
      </SideDrawer>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project/Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr 
                key={task.id} 
                className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                onClick={() => handleOpenDrawer(task)}
              >
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-700">{task.task_name}</p>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${(task.subtasks.filter((s:any) => s.is_completed).length / task.subtasks.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        {task.subtasks.filter((s:any) => s.is_completed).length}/{task.subtasks.length}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                    {task.tags?.name || 'No Tag'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="text-primary font-bold text-xs">{task.projects?.name || 'General'}</div>
                  <div className="text-[10px] font-medium text-slate-400">{task.teams?.name || 'Internal'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{task.deadline_time || '--:--'}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      {renderDeadlineContext(task)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-tight">
                  <div className="text-primary mb-0.5 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    Est: {task.estimated_minutes}m
                  </div>
                  <div className="text-emerald-500 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                    Act: {task.actual_minutes}m
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider", getStatusBadge(task.status))}>
                     {task.status || 'NEW'}
                   </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 px-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task.id, 'SUBMITTED'); }}
                      disabled={task.status === 'SUBMITTED' || updatingTask === task.id}
                      className="p-2 text-primary hover:bg-primary-light rounded-lg transition-all disabled:opacity-30 tooltip"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBatchSkip([task.id]); }}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Ban size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
         <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng: {totalCount} Tasks</span>
         <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-xs font-bold">Trang {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg disabled:opacity-30"><ChevronRight size={16} /></button>
         </div>
      </div>
    </div>
  );
};

export default TaskList;