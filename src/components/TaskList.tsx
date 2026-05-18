import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckSquare, Square, MoreVertical, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import CreateTaskModal from './CreateTaskModal';
import { SideDrawer } from './ui/SideDrawer';
import { logger } from '../lib/logger';
import { Task } from '../types/database.types';
import { MultiSearchableSelect } from './ui/MultiSearchableSelect';

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
      await supabase.from('tasks').update({ status: 'SKIPPED', actual_minutes: 0 }).in('id', taskIds);
      await logger.log('BATCH_SKIP_TASKS', `Skipped ${taskIds.length} tasks`, { taskIds });
      refetch();
      if (selectedTask && taskIds.includes(selectedTask.id)) {
        setSelectedTask(prev => prev ? { ...prev, status: 'SKIPPED', actual_minutes: 0 } : null);
      }
    } catch (error) {
      console.error('Error skipping tasks:', error);
    }
  };

  const handleResetTask = async (task: Task) => {
    try {
      const resetSubtasks = task.subtasks?.map((sub: any) => ({
        ...sub,
        status: 'NEW',
        is_completed: false,
        actual_minutes: 0
      })) || [];
      
      await supabase.from('tasks').update({ 
        status: 'NEW', 
        actual_minutes: 0,
        subtasks: resetSubtasks 
      }).eq('id', task.id);
      
      await logger.log('RESET_TASK', `Reset task and subtasks to NEW`, { taskId: task.id });
      refetch();
      if (selectedTask?.id === task.id) {
        setSelectedTask(prev => prev ? { 
          ...prev, 
          status: 'NEW', 
          actual_minutes: 0,
          subtasks: resetSubtasks
        } : null);
      }
    } catch (error) {
      console.error('Error resetting task:', error);
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

  const handleUpdateSubtask = async (task: Task, subtaskId: string, updates: Partial<any>) => {
    try {
      const currentSubtasks = task.subtasks || [];
      const newSubtasks = currentSubtasks.map((sub: any) => 
        sub.id === subtaskId ? { ...sub, ...updates } : sub
      );
      
      // Tự động cập nhật is_completed dựa trên status
      if (updates.status) {
        const target = newSubtasks.find((s: any) => s.id === subtaskId);
        if (target) target.is_completed = updates.status === 'DONE';
      }

      await supabase.from('tasks').update({ subtasks: newSubtasks }).eq('id', task.id);
      
      // Tính toán lại tổng actual_minutes của task chính từ các subtasks
      const totalActual = newSubtasks.reduce((sum: number, s: any) => sum + (parseInt(s.actual_minutes) || 0), 0);
      await supabase.from('tasks').update({ actual_minutes: totalActual }).eq('id', task.id);

      refetch();
      if (selectedTask?.id === task.id) {
        setSelectedTask(prev => prev ? { ...prev, subtasks: newSubtasks, actual_minutes: totalActual } : null);
      }
    } catch (error) {
      console.error('Error updating subtask:', error);
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
      'NEW': 'bg-[#EBF1FF] text-[#4A7CE1] border-[#D6E4FF]',
      'IN_PROGRESS': 'bg-[#FFF9EB] text-[#D97706] border-[#FEF3C7]',
      'DONE': 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]',
      'SKIPPED': 'bg-rose-50 text-rose-600 border-rose-100'
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
          <MultiSearchableSelect 
            options={teams}
            value={Array.isArray(filters.team_id) ? filters.team_id : []}
            onChange={(val) => setFilters({...filters, team_id: val})}
            placeholder="Tất cả Teams"
            className="w-48"
            condensed={true}
          />
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}>
            <option value="">Tất cả Status</option>
            <option value="NEW">New</option>
            <option value="DONE">Done</option>
            <option value="SKIPPED">Skipped</option>
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
        title={selectedTask ? (
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{selectedTask.task_name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                ID: {selectedTask.id.substring(0, 8).toUpperCase()}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[9px] font-black uppercase border tracking-wider",
                getStatusBadge(selectedTask.status)
              )}>
                {selectedTask.status}
              </span>
            </div>
          </div>
        ) : "Task Detail"}
      >
        {selectedTask && (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-8">
              {/* SUB-TASKS MANAGEMENT SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">SUB-TASKS</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                    {selectedTask.subtasks?.filter((s:any) => s.is_completed).length || 0}/{selectedTask.subtasks?.length || 0}
                  </span>
                </div>
                
                <div className="space-y-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                  {selectedTask.subtasks?.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100/50 shadow-sm transition-all group">
                      <button 
                        onClick={() => handleUpdateSubtask(selectedTask, sub.id, { is_completed: !sub.is_completed, status: !sub.is_completed ? 'DONE' : 'NEW' })}
                        className="shrink-0"
                      >
                        {sub.is_completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="flex-1 flex items-center gap-1.5 text-[11px] min-w-0">
                        <span className={cn(
                          "font-bold text-slate-700 truncate min-w-0 flex-1",
                          sub.is_completed && "line-through text-slate-400 font-medium"
                        )}>
                          {sub.name}
                        </span>
                        <span className="text-slate-300 font-light">-</span>
                        <span className="shrink-0 text-slate-400 font-bold uppercase tracking-tighter truncate max-w-[80px]">
                          {sub.assignee?.split('@')[0] || 'Unassigned'}
                        </span>
                        <span className="text-slate-300 font-light">-</span>
                        <div className="flex items-center gap-1 shrink-0 font-black">
                          <span className="text-slate-400">{sub.estimated_minutes || 0}m</span>
                          <span className="text-slate-300 font-light">/</span>
                          <input 
                            type="number"
                            className="w-10 bg-indigo-50 text-primary border-none rounded px-1 focus:ring-0 text-center font-black"
                            value={sub.actual_minutes || 0}
                            onChange={(e) => handleUpdateSubtask(selectedTask, sub.id, { actual_minutes: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <span className="text-slate-300 font-light">-</span>
                        <select 
                          value={sub.status || (sub.is_completed ? 'DONE' : 'NEW')}
                          onChange={(e) => handleUpdateSubtask(selectedTask, sub.id, { status: e.target.value })}
                          className="bg-transparent text-[9px] font-black text-indigo-500 uppercase tracking-tighter focus:outline-none cursor-pointer hover:text-indigo-700 transition-colors"
                        >
                          <option value="NEW">New</option>
                          <option value="IN_PROGRESS">Progress</option>
                          <option value="DONE">Done</option>
                          <option value="SKIPPED">Skip</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                    <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No subtasks defined</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3 mt-auto">
              {['DONE', 'SKIPPED'].includes(selectedTask.status) ? (
                selectedTask.is_active && (
                  <button 
                    onClick={() => handleResetTask(selectedTask)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-200 uppercase tracking-widest"
                  >
                    <RotateCw size={14} />
                    <span>Reset Task</span>
                  </button>
                )
              ) : (
                <>
                  <button 
                    onClick={() => {
                      const subtasks = selectedTask.subtasks || [];
                      const hasNew = subtasks.some((s: any) => (s.status || 'NEW') === 'NEW');
                      if (hasNew) {
                        alert('Không thể submit khi còn subtask ở trạng thái New');
                        return;
                      }
                      
                      let newStatus: string = 'DONE';
                      const hasDone = subtasks.some((s: any) => s.status === 'DONE');
                      const allSkipped = subtasks.length > 0 && subtasks.every((s: any) => s.status === 'SKIPPED');
                      
                      if (hasDone) newStatus = 'DONE';
                      else if (allSkipped) newStatus = 'SKIPPED';
                      else if (subtasks.length === 0) newStatus = 'DONE';

                      handleUpdateStatus(selectedTask.id, newStatus);
                      setIsDrawerOpen(false);
                    }}
                    disabled={updatingTask === selectedTask.id || (selectedTask.subtasks || []).some((s: any) => (s.status || 'NEW') === 'NEW')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={14} />
                    <span>Submit</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </SideDrawer>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="w-[30%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="w-[10%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="w-[15%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project</th>
              <th className="w-[10%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="w-[12%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="w-[10%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="w-[8%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="w-[5%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task, index) => (
              <tr 
                key={task.id} 
                className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                onClick={() => handleOpenDrawer(task)}
              >
                <td className="px-6 py-4 overflow-hidden">
                  <p className="font-bold text-slate-700 truncate" title={task.task_name}>{task.task_name}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {task.id.substring(0, 8).toUpperCase()}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                    {task.tags?.name || 'No Tag'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-primary font-bold text-xs truncate" title={task.projects?.name || 'General'}>
                    {task.projects?.name || 'General'}
                  </div>
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  <div className="text-[10px] font-medium text-slate-400 truncate" title={task.teams?.name || 'Internal'}>
                    {task.teams?.name || 'Internal'}
                  </div>
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
                    {['DONE', 'SKIPPED'].includes(task.status) ? (
                      task.is_active && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleResetTask(task); }}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all tooltip"
                          title="Reset Task"
                        >
                          <RotateCw size={18} />
                        </button>
                      )
                    ) : (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const subtasks = task.subtasks || [];
                          let newStatus: string = 'DONE';
                          const hasDone = subtasks.some((s: any) => s.status === 'DONE');
                          const allSkipped = subtasks.length > 0 && subtasks.every((s: any) => s.status === 'SKIPPED');
                          if (hasDone) newStatus = 'DONE';
                          else if (allSkipped) newStatus = 'SKIPPED';
                          else if (subtasks.length === 0) newStatus = 'DONE';
                          handleUpdateStatus(task.id, newStatus); 
                        }}
                        disabled={['DONE', 'SKIPPED'].includes(task.status) || updatingTask === task.id || (task.subtasks || []).some((s: any) => (s.status || 'NEW') === 'NEW')}
                        className="p-2 text-primary hover:bg-primary-light rounded-lg transition-all disabled:opacity-30 tooltip flex items-center justify-center"
                        title="Submit Task"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
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